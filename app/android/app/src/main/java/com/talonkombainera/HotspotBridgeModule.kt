package com.talonkombainera

import android.net.wifi.WifiManager
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.gson.Gson
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class HotspotBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "HotspotBridge"
    
    private val mainWifi: MainWifi = MainWifi(reactContext)
    
    @ReactMethod
    fun startHotspot(reqId: String, promise: Promise) {
        try {
            Log.d("HotspotBridgeModule", "startHotspot вызван из React Native, reqId: $reqId")
            
            val latch = CountDownLatch(1)
            val result = AtomicReference<String>("")
            val isStarted = AtomicReference(false)
            
            mainWifi.callback = object : MainWifi.MainWifiCallback {
                override fun onHotspotStarted(
                    ssid: String,
                    password: String,
                    key: ByteArray,
                    reservation: WifiManager.LocalOnlyHotspotReservation
                ) {
                    Log.d("HotspotBridgeModule", "Hotspot запущен. SSID: $ssid, Пароль: $password")
                    
                    GlobalScope.launch {
                        mainWifi.startTCP()
                    }
                    
                    isStarted.set(true)
                    val jsonResult = Gson().toJson(
                        mapOf(
                            "reqId" to reqId,
                            "status" to "running",
                            "ssid" to ssid,
                            "password" to password
                        )
                    )
                    result.set(jsonResult)
                    latch.countDown()
                }
                
                override fun onHotspotFailed(reason: Int) {
                    Log.e("HotspotBridgeModule", "Ошибка запуска hotspot, код ошибки: $reason")
                    if (isStarted.get()) {
                        return
                    }
                    val jsonResult = Gson().toJson(
                        mapOf(
                            "reqId" to reqId,
                            "status" to "error",
                            "error" to reason
                        )
                    )
                    result.set(jsonResult)
                    latch.countDown()
                }
                
                override fun onHotspotStopped() {
                    Log.d("HotspotBridgeModule", "Hotspot остановлен")
                    GlobalScope.launch {
                        mainWifi.stopTCP()
                    }
                }
                
                override fun onHotspotJoined(ipAddress: String?) {
                    Log.d("HotspotBridgeModule", "Устройство подключилось к hotspot")
                    Log.d("HotspotBridgeModule", "ipAddress: $ipAddress")
                }
                
                override fun onJoinFailed(error: String) {
                    Log.e("HotspotBridgeModule", "Ошибка подключения к hotspot: $error")
                }
            }
            
            mainWifi.startHotspot()
            
            latch.await(30, TimeUnit.SECONDS)
            promise.resolve(result.get())
        } catch (e: Exception) {
            promise.reject("HOTSPOT_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun stopHotspot(reqId: String, promise: Promise) {
        try {
            Log.d("HotspotBridgeModule", "stopHotspot вызван из React Native, reqId: $reqId")
            mainWifi.stopHotspot()
            val responseMap = mapOf("reqId" to reqId, "status" to "stopped")
            promise.resolve(Gson().toJson(responseMap))
        } catch (e: Exception) {
            promise.reject("HOTSPOT_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun getHotspotStatus(reqId: String, promise: Promise) {
        try {
            Log.d("HotspotBridgeModule", "getHotspotStatus вызван из React Native, reqId: $reqId")
            val status = mainWifi.getHotspotStatus()
            val responseMap = mapOf("reqId" to reqId, "status" to status)
            promise.resolve(Gson().toJson(responseMap))
        } catch (e: Exception) {
            promise.reject("HOTSPOT_ERROR", e.message, e)
        }
    }
}