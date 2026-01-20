package com.hausdog.app.data

import android.content.Context
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.storage.Storage
import io.github.jan.supabase.storage.storage
import com.hausdog.app.BuildConfig

object SupabaseClient {
    private lateinit var client: SupabaseClient

    fun initialize(context: Context) {
        client = createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_KEY
        ) {
            install(Auth) {
                flowType = FlowType.PKCE
                scheme = "hausdog"
                host = "auth"
            }
            install(Storage)
        }
    }

    val instance: SupabaseClient
        get() = client

    val auth get() = client.auth
    val storage get() = client.storage
}
