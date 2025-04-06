// java/com/talonkombainera/CustomWebViewManager.kt
package com.talonkombainera

import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import com.facebook.react.uimanager.ThemedReactContext
import com.google.gson.Gson
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper
import com.talonkombainera.maps.PushUserIdResponse
import com.talonkombainera.maps.PushUserIdResponseNative
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Кастомный менеджер WebView, который расширяет стандартный RNCWebViewManager.
 *
 * Здесь добавлен JavaScript-интерфейс "NativeBridge", позволяющий из JavaScript
 * вызывать нативные методы. В частности, добавлены методы startHotspot, stopHotspot и getHotspotStatus,
 * которые позволяют управлять локальным хотспотом с помощью класса MainWifi.
 */
class CustomWebViewManager : RNCWebViewManager() {

    override fun createViewInstance(reactContext: ThemedReactContext): RNCWebViewWrapper {
        val wrapper = super.createViewInstance(reactContext)
        val webView = wrapper.webView

        // Добавляем JavaScript-интерфейс, передавая контекст для работы с MainWifi
        webView.addJavascriptInterface(JavaScriptBridge(reactContext), "NativeBridge")

        return wrapper
    }

    /**
     * Класс JavaScriptBridge содержит методы, доступные для вызова из JavaScript.
     * Здесь реализованы четыре метода:
     * 1. getPushUserId – пример вызова нативного метода, возвращающего pushUserId.
     * 2. startHotspot – инициирует создание локального хотспота и возвращает результат,
     *    когда он уже известен (успех или ошибка).
     * 3. stopHotspot – останавливает запущенный хотспот.
     * 4. getHotspotStatus – возвращает статус запущенного хотспота.
     */
    private class JavaScriptBridge(private val context: ThemedReactContext) {

        // Создаем единый экземпляр MainWifi для управления хотспотом
        private val mainWifi: MainWifi = MainWifi(context)

        /**
         * Метод getPushUserId вызывается из JavaScript и возвращает JSON-строку с pushUserId.
         */
        @JavascriptInterface
        fun getPushUserId(reqId: String): String {
            Log.d("CustomWebViewManager", "getPushUserId вызван из JS")

            val type = "pushUserId"
            val status = "MainActivity.pushUserId"
            val native = PushUserIdResponseNative(type, status)

            val response = PushUserIdResponse(reqId, native)
            return Gson().toJson(response)
        }

        /**
         * Метод startHotspot вызывается из JavaScript для создания локального хотспота.
         * Для того чтобы обработчик обратного вызова успел сработать, запуск хотспота
         * производится на главном потоке, а ожидание результата происходит через CountDownLatch.
         *
         * Результат (успешное создание или ошибка) возвращается в виде JSON.
         */
        @JavascriptInterface
        fun startHotspot(reqId: String): String {
            Log.d("CustomWebViewManager", "startHotspot вызван из JS, reqId: $reqId")

            val latch = CountDownLatch(1)
            val result = AtomicReference<String>("")
            val isStarted = AtomicReference(false)

            // Запускаем код на главном потоке, чтобы не блокировать UI и дать возможность обработчику сработать
            Handler(Looper.getMainLooper()).post {
                mainWifi.callback = object : MainWifi.MainWifiCallback {
                    override fun onHotspotStarted(
                        ssid: String,
                        password: String,
                        key: ByteArray,
                        reservation: WifiManager.LocalOnlyHotspotReservation
                    ) {
                        Log.d("CustomWebViewManager", "startHotspot|Hotspot запущен. SSID: $ssid, Пароль: $password")

                        // Запускаем TCP-сервер внутри корутины, так как startTCP является suspend-функцией
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
                        Log.e("CustomWebViewManager", "startHotspot|Ошибка запуска hotspot, код ошибки: $reason")
                        if (isStarted.get()) {
                            Log.e("CustomWebViewManager", "startHotspot|Ошибка запуска hotspot|isStarted.get()==true")
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
                        Log.d("CustomWebViewManager", "startHotspot|Hotspot остановлен")
                        GlobalScope.launch {
                            mainWifi.stopTCP()
                        }
                    }

                    // Исправлено: параметр теперь nullable (String?) для соответствия интерфейсу
                    override fun onHotspotJoined(ipAddress: String?) {
                        Log.d("CustomWebViewManager|joinHotspot", "startHotspot|Устройство подключилось к hotspot")
                        Log.d("CustomWebViewManager|joinHotspot", "ipAddress: $ipAddress")
                    }

                    override fun onJoinFailed(error: String) {
                        Log.e("CustomWebViewManager", "startHotspot|Ошибка подключения к hotspot: $error")
                    }
                }
                // Запускаем хотспот на главном потоке
                mainWifi.startHotspot()
            }

            // Ожидаем результат с таймаутом (например, 30 секунд)
            latch.await(30, TimeUnit.SECONDS)
            return result.get()
        }

        /**
         * Метод stopHotspot вызывается из JavaScript для остановки запущенного хотспота.
         * Результат возвращается в виде JSON.
         */
        @JavascriptInterface
        fun stopHotspot(reqId: String): String {
            Log.d("CustomWebViewManager", "stopHotspot вызван из JS, reqId: $reqId")
            mainWifi.stopHotspot()
            val responseMap = mapOf("reqId" to reqId, "status" to "stopped")
            return Gson().toJson(responseMap)
        }

        /**
         * Метод getHotspotStatus вызывается из JavaScript для получения статуса запущенного хотспота.
         * Статус возвращается в виде JSON: "running" – если хотспот активен, иначе "stopped".
         */
        @JavascriptInterface
        fun getHotspotStatus(reqId: String): String {
            Log.d("CustomWebViewManager", "getHotspotStatus вызван из JS, reqId: $reqId")
            val status = mainWifi.getHotspotStatus()
            val responseMap = mapOf("reqId" to reqId, "status" to status)
            return Gson().toJson(responseMap)
        }
    }
}
