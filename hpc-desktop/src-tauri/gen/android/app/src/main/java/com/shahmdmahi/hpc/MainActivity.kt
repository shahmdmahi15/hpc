package com.shahmdmahi.hpc

import android.content.pm.ActivityInfo
import android.os.Bundle
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // 1. Strictly enforce landscape mode across all devices, tablets, TVs, and mobile phones
    requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

    // 2. Keep screen on (Kiosk display for clinic Waiting Room & Desks)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      databaseEnabled = true
      mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
      allowFileAccess = true
      allowContentAccess = true
      mediaPlaybackRequiresUserGesture = false
      setSupportMultipleWindows(false)
      cacheMode = WebSettings.LOAD_DEFAULT
      userAgentString = "${userAgentString} HPCNativeTV/1.0"
    }

    CookieManager.getInstance().apply {
      setAcceptCookie(true)
      setAcceptThirdPartyCookies(webView, true)
    }
  }
}
