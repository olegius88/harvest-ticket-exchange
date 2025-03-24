package com.talonkombainera

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class MainWifiModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "MainWifiModule"
    }

    @ReactMethod
    fun joinHotspot(ssid: String, password: String, promise: Promise) {
        try {
            // Здесь вызывайте нужный метод из MainWifi для подключения к hotspot.
            val mainWifi = MainWifi(reactApplicationContext)
            mainWifi.joinHotspot(ssid, password)
            promise.resolve("Подключено")
        } catch (e: Exception) {
            promise.reject("JOIN_ERROR", e)
        }
    }
}
