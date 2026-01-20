package com.hausdog.app

import android.app.Application
import com.hausdog.app.data.SupabaseClient

class HausdogApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // Initialize Supabase client
        SupabaseClient.initialize(this)
    }
}
