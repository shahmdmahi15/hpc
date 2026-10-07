package com.shahmdmahi.hpc.ui

import android.app.AlertDialog
import android.content.Context
import android.util.Log
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.EditText
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.focusable
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.shahmdmahi.hpc.R
import com.shahmdmahi.hpc.util.DeviceRoleManager
import com.shahmdmahi.hpc.util.NetworkScanner
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.GeckoRuntimeSettings
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.WebRequestError

private const val TAG = "HPC_GeckoView"

/**
 * Singleton manager for GeckoRuntime to ensure optimized shared memory
 * across the TV app lifecycle.
 */
object GeckoRuntimeManager {
    @Volatile
    private var runtime: GeckoRuntime? = null

    fun getRuntime(context: Context): GeckoRuntime {
        return runtime ?: synchronized(this) {
            runtime ?: run {
                val settings = GeckoRuntimeSettings.Builder()
                    // 1. Bypass SSL verification specifically for local network / custom CA HTTPS Next.js server
                    .allowInsecureConnections(GeckoRuntimeSettings.ALLOW_ALL)
                    // 2. Trust user/system installed root CAs (like root_ca.pem)
                    .enterpriseRootsEnabled(true)
                    .aboutConfigEnabled(true)
                    .javaScriptEnabled(true)
                    .consoleOutput(true)
                    .remoteDebuggingEnabled(true)
                    .build()

                GeckoRuntime.create(context.applicationContext, settings).also {
                    runtime = it
                    Log.i(TAG, "GeckoRuntime initialized with ALLOW_ALL insecure connections & enterprise roots enabled")
                }
            }
        }
    }
}

@Composable
fun GeckoViewContainer(
    targetUrl: String = stringResource(id = R.string.pwa_target_url),
    onRescanRequested: (() -> Unit)? = null,
    onManualIpChanged: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }
    var loadingProgress by remember { mutableFloatStateOf(0f) }
    var hasError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }
    var canGoBack by remember { mutableStateOf(false) }

    val focusRequester = remember { FocusRequester() }
    val runtime = remember { GeckoRuntimeManager.getRuntime(context) }

    // Session settings tailored for Android 9 TV (armeabi-v7a)
    val sessionSettings = remember {
        GeckoSessionSettings.Builder()
            .usePrivateMode(false)
            .useTrackingProtection(false)
            .allowJavascript(true)
            .viewportMode(GeckoSessionSettings.VIEWPORT_MODE_DESKTOP)
            .userAgentOverride(
                "Mozilla/5.0 (Large Screen; Android TV 9; armeabi-v7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 HPCNativeTV/1.0 Gecko/115.0"
            )
            .build()
    }

    val geckoSession = remember(targetUrl) {
        GeckoSession(sessionSettings)
    }

    val geckoView = remember {
        GeckoView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            isFocusable = true
            isFocusableInTouchMode = true
            keepScreenOn = true
        }
    }

    // Attach delegates to the GeckoSession
    LaunchedEffect(geckoSession) {
        geckoSession.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onCanGoBack(session: GeckoSession, canGoBackState: Boolean) {
                canGoBack = canGoBackState
            }

            override fun onLocationChange(
                session: GeckoSession,
                url: String?,
                perms: MutableList<GeckoSession.PermissionDelegate.ContentPermission>
            ) {
                Log.d(TAG, "Navigated to: $url")
            }

            override fun onLoadError(
                session: GeckoSession,
                uri: String?,
                error: WebRequestError
            ): GeckoResult<String>? {
                Log.w(
                    TAG,
                    "onLoadError: uri=$uri, category=${error.category}, code=${error.code}, message=${error.message}"
                )

                // Intercept SSL security errors and bypass them
                if (error.category == WebRequestError.ERROR_CATEGORY_SECURITY) {
                    Log.i(TAG, "SSL Certificate validation intercepted for $uri. Allowing through GeckoRuntime.")
                    return null
                }

                // For true connection failures (e.g. host unreachable, port 3000 offline)
                hasError = true
                errorMessage = error.message ?: "Failed to reach server (code ${error.code})"
                isLoading = false
                return null
            }
        }

        geckoSession.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onPageStart(session: GeckoSession, url: String) {
                isLoading = true
                hasError = false
            }

            override fun onPageStop(session: GeckoSession, success: Boolean) {
                isLoading = false
                if (!success && !hasError) {
                    // Handled by onLoadError if failure occurred
                }
            }

            override fun onProgressChange(session: GeckoSession, progress: Int) {
                loadingProgress = progress / 100f
                if (progress >= 100) {
                    isLoading = false
                }
            }
        }

        geckoSession.permissionDelegate = object : GeckoSession.PermissionDelegate {
            override fun onContentPermissionRequest(
                session: GeckoSession,
                perm: GeckoSession.PermissionDelegate.ContentPermission
            ): GeckoResult<Int>? {
                Log.d(TAG, "Allowing content permission: ${perm.permission}")
                return GeckoResult.fromValue(GeckoSession.PermissionDelegate.ContentPermission.VALUE_ALLOW)
            }

            override fun onMediaPermissionRequest(
                session: GeckoSession,
                uri: String,
                video: Array<out GeckoSession.PermissionDelegate.MediaSource>?,
                audio: Array<out GeckoSession.PermissionDelegate.MediaSource>?,
                callback: GeckoSession.PermissionDelegate.MediaCallback
            ) {
                Log.d(TAG, "Granting WebRTC media permissions for origin: $uri")
                callback.grant(video?.firstOrNull(), audio?.firstOrNull())
            }
        }

        geckoSession.promptDelegate = object : GeckoSession.PromptDelegate {
            override fun onAlertPrompt(
                session: GeckoSession,
                prompt: GeckoSession.PromptDelegate.AlertPrompt
            ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse>? {
                val res = GeckoResult<GeckoSession.PromptDelegate.PromptResponse>()
                AlertDialog.Builder(context)
                    .setTitle(prompt.title ?: "Alert")
                    .setMessage(prompt.message ?: "")
                    .setPositiveButton(android.R.string.ok) { _, _ -> res.complete(prompt.dismiss()) }
                    .setOnCancelListener { res.complete(prompt.dismiss()) }
                    .create()
                    .show()
                return res
            }

            override fun onButtonPrompt(
                session: GeckoSession,
                prompt: GeckoSession.PromptDelegate.ButtonPrompt
            ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse>? {
                val res = GeckoResult<GeckoSession.PromptDelegate.PromptResponse>()
                AlertDialog.Builder(context)
                    .setTitle(prompt.title ?: "Confirm")
                    .setMessage(prompt.message ?: "")
                    .setPositiveButton(android.R.string.ok) { _, _ -> res.complete(prompt.confirm(0)) }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> res.complete(prompt.dismiss()) }
                    .setOnCancelListener { res.complete(prompt.dismiss()) }
                    .create()
                    .show()
                return res
            }

            override fun onTextPrompt(
                session: GeckoSession,
                prompt: GeckoSession.PromptDelegate.TextPrompt
            ): GeckoResult<GeckoSession.PromptDelegate.PromptResponse>? {
                val res = GeckoResult<GeckoSession.PromptDelegate.PromptResponse>()
                val input = EditText(context).apply {
                    setText(prompt.defaultValue ?: "")
                }
                AlertDialog.Builder(context)
                    .setTitle(prompt.title ?: "Prompt")
                    .setMessage(prompt.message ?: "")
                    .setView(input)
                    .setPositiveButton(android.R.string.ok) { _, _ ->
                        res.complete(prompt.confirm(input.text.toString()))
                    }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> res.complete(prompt.dismiss()) }
                    .setOnCancelListener { res.complete(prompt.dismiss()) }
                    .create()
                    .show()
                return res
            }
        }

        // Open session and attach to GeckoView
        geckoSession.open(runtime)
        geckoView.setSession(geckoSession)
        Log.i(TAG, "Loading Target URL in GeckoView: $targetUrl")
        geckoSession.loadUri(targetUrl)
    }

    // Handle Back Press inside GeckoView session if can navigate back
    if (canGoBack) {
        BackHandler {
            geckoSession.goBack()
        }
    }

    DisposableEffect(targetUrl) {
        onDispose {
            geckoView.releaseSession()
            geckoSession.close()
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { geckoView },
            modifier = Modifier
                .fillMaxSize()
                .focusRequester(focusRequester)
                .focusable()
                .onKeyEvent { keyEvent ->
                    // Capture remote control arrow & enter events and pass them directly to GeckoView
                    val native = keyEvent.nativeKeyEvent
                    when (native.keyCode) {
                        KeyEvent.KEYCODE_DPAD_UP,
                        KeyEvent.KEYCODE_DPAD_DOWN,
                        KeyEvent.KEYCODE_DPAD_LEFT,
                        KeyEvent.KEYCODE_DPAD_RIGHT,
                        KeyEvent.KEYCODE_DPAD_CENTER,
                        KeyEvent.KEYCODE_ENTER -> {
                            geckoView.dispatchKeyEvent(native)
                            true
                        }
                        else -> false
                    }
                }
        )

        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
            geckoView.requestFocus()
        }

        // Loading Indicator
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Rendering via Mozilla GeckoView...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White
                    )
                }
            }
        }

        // Connection Error Screen
        if (hasError) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(32.dp)
                ) {
                    Text(
                        text = "Unable to connect to Server",
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.error
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Target: $targetUrl\nReason: $errorMessage\n\nPlease ensure your Next.js server is running on your local Wi-Fi / LAN network.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Row {
                        Button(
                            onClick = {
                                hasError = false
                                isLoading = true
                                geckoSession.loadUri(targetUrl)
                            },
                            modifier = Modifier.focusRequester(focusRequester)
                        ) {
                            Text("Retry Connection")
                        }

                        if (onRescanRequested != null) {
                            Spacer(modifier = Modifier.width(16.dp))
                            OutlinedButton(
                                onClick = onRescanRequested
                            ) {
                                Text("Rescan Network")
                            }
                        }

                        Spacer(modifier = Modifier.width(16.dp))
                        OutlinedButton(
                            onClick = {
                                val input = EditText(context).apply {
                                    hint = "192.168.10.124"
                                }
                                AlertDialog.Builder(context)
                                    .setTitle("Enter Server IP")
                                    .setMessage("Type the IP address of your Next.js server:")
                                    .setView(input)
                                    .setPositiveButton("Connect") { _, _ ->
                                        val ip = input.text.toString().trim()
                                        if (ip.isNotEmpty()) {
                                            val url = if (ip.startsWith("http")) ip else "https://$ip:3000"
                                            NetworkScanner.saveServerUrl(context, url)
                                            val savedRole = DeviceRoleManager.getSavedRole(context)
                                            val fullUrl = DeviceRoleManager.buildFullTargetUrl(url, savedRole)
                                            if (onManualIpChanged != null) {
                                                onManualIpChanged(fullUrl)
                                            } else {
                                                hasError = false
                                                isLoading = true
                                                geckoSession.loadUri(fullUrl)
                                            }
                                        }
                                    }
                                    .setNegativeButton("Cancel", null)
                                    .show()
                            }
                        ) {
                            Text("Enter IP Manually")
                        }
                    }
                }
            }
        }
    }
}
