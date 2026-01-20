package com.hausdog.app.data

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class DocumentUploadRequest(
    val storagePath: String,
    val filename: String,
    val contentType: String = "image/jpeg"
)

@Serializable
data class DocumentUploadResponse(
    val id: String,
    val processingStatus: String
)

@Serializable
data class DocumentExtractRequest(
    val documentId: String
)

@Serializable
data class ExtractedData(
    val documentType: String? = null,
    val confidence: Double? = null,
    val equipment: EquipmentData? = null,
    val financial: FinancialData? = null,
    val suggestedCategory: String? = null,
    val rawText: String? = null
)

@Serializable
data class EquipmentData(
    val manufacturer: String? = null,
    val model: String? = null,
    val serialNumber: String? = null
)

@Serializable
data class FinancialData(
    val vendor: String? = null,
    val amount: Double? = null,
    val currency: String? = null
)

@Serializable
data class DocumentResponse(
    val id: String,
    val filename: String,
    val storagePath: String,
    val processingStatus: String,
    val extractedData: ExtractedData? = null
)

class ApiClient(private val baseUrl: String) {

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
            })
        }
    }

    suspend fun createDocument(
        request: DocumentUploadRequest,
        accessToken: String
    ): Result<DocumentUploadResponse> {
        return try {
            val response = client.post("$baseUrl/api/documents") {
                contentType(ContentType.Application.Json)
                bearerAuth(accessToken)
                setBody(request)
            }
            Result.success(response.body())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun extractDocument(
        documentId: String,
        accessToken: String
    ): Result<DocumentResponse> {
        return try {
            val response = client.post("$baseUrl/api/documents/$documentId/extract") {
                contentType(ContentType.Application.Json)
                bearerAuth(accessToken)
            }
            Result.success(response.body())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDocument(
        documentId: String,
        accessToken: String
    ): Result<DocumentResponse> {
        return try {
            val response = client.get("$baseUrl/api/documents/$documentId") {
                bearerAuth(accessToken)
            }
            Result.success(response.body())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
