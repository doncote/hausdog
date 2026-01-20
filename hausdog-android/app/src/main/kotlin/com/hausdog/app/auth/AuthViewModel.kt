package com.hausdog.app.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hausdog.app.data.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthState {
    data object Loading : AuthState()
    data object NotAuthenticated : AuthState()
    data class Authenticated(val userId: String, val email: String?) : AuthState()
    data class MagicLinkSent(val email: String) : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Loading)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    init {
        observeAuthState()
    }

    private fun observeAuthState() {
        viewModelScope.launch {
            SupabaseClient.auth.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        val user = status.session.user
                        _authState.value = AuthState.Authenticated(
                            userId = user?.id ?: "",
                            email = user?.email
                        )
                    }
                    is SessionStatus.NotAuthenticated -> {
                        // Only reset to NotAuthenticated if we're not showing MagicLinkSent
                        if (_authState.value !is AuthState.MagicLinkSent) {
                            _authState.value = AuthState.NotAuthenticated
                        }
                    }
                    is SessionStatus.Initializing -> {
                        _authState.value = AuthState.Loading
                    }
                    else -> {
                        _authState.value = AuthState.NotAuthenticated
                    }
                }
            }
        }
    }

    fun sendMagicLink(email: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                SupabaseClient.auth.signInWith(OTP) {
                    this.email = email
                }
                _authState.value = AuthState.MagicLinkSent(email)
            } catch (e: Exception) {
                _authState.value = AuthState.Error(e.message ?: "Failed to send magic link")
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            try {
                SupabaseClient.auth.signOut()
                _authState.value = AuthState.NotAuthenticated
            } catch (e: Exception) {
                _authState.value = AuthState.Error(e.message ?: "Failed to sign out")
            }
        }
    }

    fun clearError() {
        if (_authState.value is AuthState.Error) {
            _authState.value = AuthState.NotAuthenticated
        }
    }

    fun getAccessToken(): String? {
        return SupabaseClient.auth.currentAccessTokenOrNull()
    }

    fun getUserId(): String? {
        return SupabaseClient.auth.currentUserOrNull()?.id
    }
}
