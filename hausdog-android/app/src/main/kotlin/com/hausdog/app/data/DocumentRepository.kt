package com.hausdog.app.data

import android.content.Context
import android.net.Uri
import io.github.jan.supabase.storage.storage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.io.File
import java.util.UUID

@Serializable
data class UploadResult(
    val storagePath: String,
    val filename: String
)

class DocumentRepository {

    suspend fun uploadDocument(
        context: Context,
        imageUri: Uri,
        userId: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            val contentResolver = context.contentResolver
            val inputStream = contentResolver.openInputStream(imageUri)
                ?: return@withContext Result.failure(Exception("Could not open image"))

            val bytes = inputStream.readBytes()
            inputStream.close()

            val fileId = UUID.randomUUID().toString()
            val filename = "photo_${System.currentTimeMillis()}.jpg"
            val storagePath = "$userId/$fileId/$filename"

            SupabaseClient.storage
                .from("documents")
                .upload(storagePath, bytes) {
                    upsert = false
                }

            Result.success(UploadResult(storagePath, filename))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadDocumentFromFile(
        file: File,
        userId: String
    ): Result<UploadResult> = withContext(Dispatchers.IO) {
        try {
            val bytes = file.readBytes()

            val fileId = UUID.randomUUID().toString()
            val filename = "photo_${System.currentTimeMillis()}.jpg"
            val storagePath = "$userId/$fileId/$filename"

            SupabaseClient.storage
                .from("documents")
                .upload(storagePath, bytes) {
                    upsert = false
                }

            Result.success(UploadResult(storagePath, filename))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
