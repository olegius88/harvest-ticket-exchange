package com.talonkombainera

import android.util.Log
import android.webkit.JavascriptInterface
import com.facebook.react.uimanager.ThemedReactContext
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper

class CustomWebViewManager : RNCWebViewManager() {

    override fun createViewInstance(reactContext: ThemedReactContext): RNCWebViewWrapper {
        val wrapper = super.createViewInstance(reactContext)
        val webView = wrapper.webView

        webView.addJavascriptInterface(JavaScriptBridge(), "NativeBridge")

        return wrapper
    }

    private class JavaScriptBridge {
        @JavascriptInterface
        fun getPushUserId(): String {
            Log.d("CustomWebViewManager", "getPushUserId вызван из JS")
            return "MainActivity.pushUserId" // замените на реальное значение
        }
    }
}
