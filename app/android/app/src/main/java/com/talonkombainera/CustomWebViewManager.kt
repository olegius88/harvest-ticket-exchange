// java/com/talonkombainera/CustomWebViewManager.kt
package com.talonkombainera

import android.net.wifi.WifiManager
import android.util.Log
import android.webkit.JavascriptInterface
import com.facebook.react.uimanager.ThemedReactContext
import com.google.gson.Gson
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper
import com.talonkombainera.maps.PushUserIdResponse
import com.talonkombainera.maps.PushUserIdResponseNative

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
     * Здесь реализованы три метода:
     * 1. getPushUserId – пример вызова нативного метода, возвращающего pushUserId.
     * 2. startHotspot – инициирует создание локального хотспота.
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
         * Устанавливается обратный вызов для получения событий, и запускается создание хотспота.
         * Результат возвращается в виде JSON.
         *
         * Внимание! Подробности (SSID, пароль, ошибки и т.п.) логируются в Logcat.
         */
        @JavascriptInterface
        fun startHotspot(reqId: String): String {
            Log.d("CustomWebViewManager", "startHotspot вызван из JS, reqId: $reqId")

            // Устанавливаем обратный вызов для получения уведомлений о событиях хотспота
            mainWifi.callback = object : MainWifi.MainWifiCallback {
                override fun onHotspotStarted(
                    ssid: String,
                    password: String,
                    key: ByteArray,
                    reservation: WifiManager.LocalOnlyHotspotReservation
                ) {
                    Log.d("CustomWebViewManager", "startHotspot|Hotspot запущен. SSID: $ssid, Пароль: $password")
                    // Здесь можно добавить уведомление JavaScript о запуске хотспота
                }

                override fun onHotspotFailed(reason: Int) {
                    Log.e("CustomWebViewManager", "startHotspot|Ошибка запуска hotspot, код ошибки: $reason")
                    // Здесь можно добавить уведомление JavaScript об ошибке запуска
                }

                override fun onHotspotStopped() {
                    Log.d("CustomWebViewManager", "startHotspot|Hotspot остановлен")
                    // Здесь можно добавить уведомление JavaScript об остановке хотспота
                }

                override fun onHotspotJoined() {
                    Log.d("CustomWebViewManager", "startHotspot|Устройство подключилось к hotspot")
                    // Здесь можно добавить уведомление JavaScript о подключении
                }

                override fun onJoinFailed(error: String) {
                    Log.e("CustomWebViewManager", "startHotspot|Ошибка подключения к hotspot: $error")
                    // Здесь можно добавить уведомление JavaScript об ошибке подключения
                }
            }

            // Запускаем хотспот
            mainWifi.startHotspot()

            // Возвращаем JSON-ответ о том, что запуск хотспота инициирован
            val responseMap = mapOf("reqId" to reqId, "status" to "startHotspot|Hotspot запуск инициирован")
            return Gson().toJson(responseMap)
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
