package com.talonkombainera

import android.util.Log
import android.webkit.JavascriptInterface
import com.facebook.react.uimanager.ThemedReactContext
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper
import com.google.gson.Gson
import com.talonkombainera.maps.PushUserIdResponse
import com.talonkombainera.maps.PushUserIdResponseNative

class CustomWebViewManager : RNCWebViewManager() {

    override fun createViewInstance(reactContext: ThemedReactContext): RNCWebViewWrapper {
        val wrapper = super.createViewInstance(reactContext)
        val webView = wrapper.webView

        webView.addJavascriptInterface(JavaScriptBridge(), "NativeBridge")

        return wrapper
    }

    private class JavaScriptBridge {
        @JavascriptInterface
        fun getPushUserId(reqId: String): String {
            Log.d("CustomWebViewManager", "getPushUserId вызван из JS")

            val type = "pushUserId"
            val status = "MainActivity.pushUserId"
            val native = PushUserIdResponseNative(type, status)

            val response = PushUserIdResponse(reqId, native)
            return Gson().toJson(response)
        }
    }
}
