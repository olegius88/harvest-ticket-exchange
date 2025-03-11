// Файл: CustomWebViewManager.kt
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
 * вызывать нативные методы. В частности, добавлен метод startHotspot, который инициирует
 * создание локального хотспота с помощью класса MainWifi.
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
     * Здесь реализованы два метода:
     * 1. getPushUserId – пример вызова нативного метода, возвращающего pushUserId.
     * 2. startHotspot – инициирует создание локального хотспота.
     */
    private class JavaScriptBridge(private val context: ThemedReactContext) {

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
         * Он создает экземпляр MainWifi, устанавливает обратный вызов для получения событий
         * и запускает хотспот. Результат возвращается в виде JSON.
         *
         * Внимание! Метод возвращает сразу ответ о том, что запуск инициирован, а подробности
         * (SSID, пароль, ошибки и т.п.) логируются в Logcat. Для уведомления JS-части можно
         * реализовать дополнительный механизм (например, отправку события через WebView).
         */
        @JavascriptInterface
        fun startHotspot(reqId: String): String {
            Log.d("CustomWebViewManager", "startHotspot вызван из JS, reqId: $reqId")

            // Создаем экземпляр MainWifi для управления хотспотом
            val mainWifi = MainWifi(context)

            // Устанавливаем обратный вызов для получения уведомлений о событиях хотспота
            mainWifi.callback = object : MainWifi.MainWifiCallback {
                override fun onHotspotStarted(
                    ssid: String,
                    password: String,
                    key: ByteArray,
                    reservation: WifiManager.LocalOnlyHotspotReservation
                ) {
                    Log.d("CustomWebViewManager", "Hotspot запущен. SSID: $ssid, Пароль: $password")
                    // Здесь можно добавить уведомление JavaScript о запуске хотспота
                }

                override fun onHotspotFailed(reason: Int) {
                    Log.e("CustomWebViewManager", "Ошибка запуска hotspot, код ошибки: $reason")
                    // Здесь можно добавить уведомление JavaScript об ошибке запуска
                }

                override fun onHotspotStopped() {
                    Log.d("CustomWebViewManager", "Hotspot остановлен")
                    // Здесь можно добавить уведомление JavaScript об остановке хотспота
                }

                override fun onHotspotJoined() {
                    Log.d("CustomWebViewManager", "Устройство подключилось к hotspot")
                    // Здесь можно добавить уведомление JavaScript о подключении
                }

                override fun onJoinFailed(error: String) {
                    Log.e("CustomWebViewManager", "Ошибка подключения к hotspot: $error")
                    // Здесь можно добавить уведомление JavaScript об ошибке подключения
                }
            }

            // Запускаем хотспот
            mainWifi.startHotspot()

            // Возвращаем JSON-ответ о том, что запуск хотспота инициирован
            val responseMap = mapOf("reqId" to reqId, "status" to "Hotspot запуск инициирован")
            return Gson().toJson(responseMap)
        }
    }
}
