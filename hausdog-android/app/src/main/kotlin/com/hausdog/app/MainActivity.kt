package com.hausdog.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hausdog.app.auth.AuthState
import com.hausdog.app.auth.AuthViewModel
import com.hausdog.app.auth.LoginScreen
import com.hausdog.app.camera.CameraScreen
import com.hausdog.app.camera.CameraViewModel
import com.hausdog.app.data.SupabaseClient
import com.hausdog.app.ui.theme.HausdogTheme
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Handle deep links for Supabase auth
        handleIntent(intent)

        setContent {
            HausdogTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    HausdogApp()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        intent.data?.let { uri ->
            if (uri.scheme == "hausdog" && uri.host == "auth") {
                kotlinx.coroutines.MainScope().launch {
                    SupabaseClient.auth.handleDeeplinks(intent)
                }
            }
        }
    }
}

@Composable
fun HausdogApp() {
    val authViewModel: AuthViewModel = viewModel()
    val authState by authViewModel.authState.collectAsState()
    val isLoading by authViewModel.isLoading.collectAsState()

    val context = LocalContext.current
    val executor = remember { Executors.newSingleThreadExecutor() }

    when (val state = authState) {
        is AuthState.Loading -> {
            // Could show a splash screen here
            LoadingScreen()
        }

        is AuthState.Authenticated -> {
            // API base URL - in production, this would come from BuildConfig
            val apiBaseUrl = "http://10.0.2.2:3000" // Android emulator localhost

            val cameraViewModel = remember {
                CameraViewModel(apiBaseUrl)
            }
            val captureState by cameraViewModel.captureState.collectAsState()

            CameraScreen(
                captureState = captureState,
                userEmail = state.email,
                onCapturePhoto = {
                    cameraViewModel.capturePhoto(context, executor)
                },
                onRetake = {
                    cameraViewModel.retakePhoto()
                },
                onUpload = { file ->
                    val userId = authViewModel.getUserId()
                    val token = authViewModel.getAccessToken()
                    if (userId != null && token != null) {
                        cameraViewModel.uploadAndProcess(file, userId, token)
                    }
                },
                onReset = {
                    cameraViewModel.reset()
                },
                onSignOut = {
                    authViewModel.signOut()
                },
                onSetImageCapture = { imageCapture ->
                    cameraViewModel.setImageCapture(imageCapture)
                }
            )
        }

        is AuthState.NotAuthenticated,
        is AuthState.MagicLinkSent,
        is AuthState.Error -> {
            LoginScreen(
                authState = state,
                isLoading = isLoading,
                onSendMagicLink = { email ->
                    authViewModel.sendMagicLink(email)
                }
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = androidx.compose.ui.Alignment.Center
    ) {
        androidx.compose.material3.CircularProgressIndicator()
    }
}
