// Файл: java/com/talonkombainera/MainWifiModule.kt
package com.talonkombainera

import android.util.Log
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
        Log.d("MainWifiModule", "joinHotspot called with ssid: $ssid, password: $password")
        try {
            // Создаем экземпляр MainWifi и устанавливаем callback, который будет уведомлять о подключении
            val mainWifi = MainWifi(reactApplicationContext)
            mainWifi.callback = object : MainWifi.MainWifiCallback {
                override fun onHotspotStarted(
                    ssid: String,
                    password: String,
                    key: ByteArray,
                    reservation: android.net.wifi.WifiManager.LocalOnlyHotspotReservation
                ) {
                    Log.d("MainWifiModule", "onHotspotStarted: ssid=$ssid, password=$password")
                    // Здесь ничего не делаем, так как promise разрешается при получении IP-адреса
                }

                override fun onHotspotFailed(reason: Int) {
                    Log.e("MainWifiModule", "onHotspotFailed: reason=$reason")
                    promise.reject("JOIN_ERROR", "Ошибка запуска hotspot: $reason")
                }

                override fun onHotspotStopped() {
                    Log.d("MainWifiModule", "onHotspotStopped")
                }

                override fun onHotspotJoined(ipAddress: String) {
                    Log.d("MainWifiModule", "onHotspotJoined: ipAddress=$ipAddress")
                    // При успешном подключении возвращаем IP-адрес в promise.resolve
                    promise.resolve(ipAddress)
                }

                override fun onJoinFailed(error: String) {
                    Log.e("MainWifiModule", "onJoinFailed: error=$error")
                    promise.reject("JOIN_ERROR", error)
                }
            }
            // Вызываем метод подключения
            Log.d("MainWifiModule", "Calling mainWifi.joinHotspot()")
            mainWifi.joinHotspot(ssid, password)
        } catch (e: Exception) {
            Log.e("MainWifiModule", "Exception in joinHotspot: ${e.message}")
            promise.reject("JOIN_ERROR", e)
        }
    }
}
