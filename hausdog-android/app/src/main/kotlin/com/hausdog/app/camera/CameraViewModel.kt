package com.hausdog.app.camera

import android.content.Context
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hausdog.app.data.ApiClient
import com.hausdog.app.data.DocumentRepository
import com.hausdog.app.data.DocumentResponse
import com.hausdog.app.data.DocumentUploadRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.Executor

sealed class CaptureState {
    data object Idle : CaptureState()
    data object Capturing : CaptureState()
    data class Preview(val file: File) : CaptureState()
    data object Uploading : CaptureState()
    data object Processing : CaptureState()
    data class Success(val document: DocumentResponse) : CaptureState()
    data class Error(val message: String) : CaptureState()
}

class CameraViewModel(
    private val apiBaseUrl: String
) : ViewModel() {

    private val documentRepository = DocumentRepository()
    private val apiClient = ApiClient(apiBaseUrl)

    private val _captureState = MutableStateFlow<CaptureState>(CaptureState.Idle)
    val captureState: StateFlow<CaptureState> = _captureState.asStateFlow()

    private var currentImageCapture: ImageCapture? = null

    fun setImageCapture(imageCapture: ImageCapture) {
        currentImageCapture = imageCapture
    }

    fun capturePhoto(
        context: Context,
        executor: Executor
    ) {
        val imageCapture = currentImageCapture ?: return

        _captureState.value = CaptureState.Capturing

        val photoFile = File(
            context.cacheDir,
            "hausdog_${System.currentTimeMillis()}.jpg"
        )

        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        imageCapture.takePicture(
            outputOptions,
            executor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    _captureState.value = CaptureState.Preview(photoFile)
                }

                override fun onError(exception: ImageCaptureException) {
                    _captureState.value = CaptureState.Error(
                        exception.message ?: "Failed to capture photo"
                    )
                }
            }
        )
    }

    fun retakePhoto() {
        // Clean up preview file
        val currentState = _captureState.value
        if (currentState is CaptureState.Preview) {
            currentState.file.delete()
        }
        _captureState.value = CaptureState.Idle
    }

    fun uploadAndProcess(
        file: File,
        userId: String,
        accessToken: String
    ) {
        viewModelScope.launch {
            _captureState.value = CaptureState.Uploading

            // Upload to Supabase storage
            val uploadResult = documentRepository.uploadDocumentFromFile(file, userId)

            uploadResult.fold(
                onSuccess = { upload ->
                    // Create document record via API
                    val createResult = apiClient.createDocument(
                        DocumentUploadRequest(
                            storagePath = upload.storagePath,
                            filename = upload.filename,
                            contentType = "image/jpeg"
                        ),
                        accessToken
                    )

                    createResult.fold(
                        onSuccess = { doc ->
                            _captureState.value = CaptureState.Processing

                            // Trigger extraction
                            val extractResult = apiClient.extractDocument(doc.id, accessToken)

                            extractResult.fold(
                                onSuccess = { extractedDoc ->
                                    // Poll for completion if still processing
                                    if (extractedDoc.processingStatus == "processing") {
                                        pollForCompletion(doc.id, accessToken)
                                    } else {
                                        _captureState.value = CaptureState.Success(extractedDoc)
                                    }
                                },
                                onFailure = { e ->
                                    _captureState.value = CaptureState.Error(
                                        e.message ?: "Extraction failed"
                                    )
                                }
                            )
                        },
                        onFailure = { e ->
                            _captureState.value = CaptureState.Error(
                                e.message ?: "Failed to create document"
                            )
                        }
                    )
                },
                onFailure = { e ->
                    _captureState.value = CaptureState.Error(
                        e.message ?: "Upload failed"
                    )
                }
            )

            // Clean up temp file
            file.delete()
        }
    }

    private suspend fun pollForCompletion(documentId: String, accessToken: String) {
        repeat(30) { // Max 30 attempts (30 seconds)
            delay(1000)
            val result = apiClient.getDocument(documentId, accessToken)
            result.fold(
                onSuccess = { doc ->
                    when (doc.processingStatus) {
                        "complete" -> {
                            _captureState.value = CaptureState.Success(doc)
                            return
                        }
                        "failed" -> {
                            _captureState.value = CaptureState.Error("Processing failed")
                            return
                        }
                    }
                },
                onFailure = { }
            )
        }
        _captureState.value = CaptureState.Error("Processing timed out")
    }

    fun reset() {
        _captureState.value = CaptureState.Idle
    }
}
