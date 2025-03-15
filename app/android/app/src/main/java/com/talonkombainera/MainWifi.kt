// java/com/talonkombainera/MainWifi.kt
package com.talonkombainera

// Импорт необходимых классов и пакетов
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.ActivityCompat
import java.security.MessageDigest

/**
 * Класс MainWifi предоставляет функциональность для управления локальным Wi‑Fi хотспотом,
 * а также для подключения к существующим хотспотам.
 *
 * Для уведомления о событиях (запуск, ошибка, остановка, подключение) используется интерфейс
 * обратного вызова MainWifiCallback. Данный класс не зависит от AppCompatActivity и может быть
 * легко интегрирован в любой проект.
 */
class MainWifi(private val context: Context) {

    /**
     * Интерфейс для обратного вызова событий, связанных с работой хотспота.
     */
    interface MainWifiCallback {
        /**
         * Вызывается при успешном запуске локального хотспота.
         *
         * @param ssid       Имя (SSID) запущенного хотспота.
         * @param password   Пароль запущенного хотспота.
         * @param key        Ключ, сгенерированный на основе пароля с использованием SHA-256.
         * @param reservation Объект-резервация запущенного хотспота.
         */
        fun onHotspotStarted(ssid: String, password: String, key: ByteArray, reservation: WifiManager.LocalOnlyHotspotReservation)

        /**
         * Вызывается, если запуск хотспота завершился ошибкой.
         *
         * @param reason Код ошибки (можно использовать отрицательные значения для обозначения
         *               собственных ошибок, например: -2 – отсутствует разрешение, -3 – исключение).
         */
        fun onHotspotFailed(reason: Int)

        /**
         * Вызывается, когда локальный хотспот был остановлен.
         */
        fun onHotspotStopped()

        /**
         * Вызывается, когда устройство успешно подключилось к хотспоту.
         */
        fun onHotspotJoined()

        /**
         * Вызывается, если подключение к хотспоту завершилось неудачно.
         *
         * @param error Сообщение об ошибке подключения.
         */
        fun onJoinFailed(error: String)
    }

    // Объект для обратного вызова, который должен быть установлен пользователем данного класса.
    var callback: MainWifiCallback? = null

    // Системный менеджер Wi‑Fi
    private val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    // Handler для выполнения обратных вызовов на основном потоке
    private val handler = Handler(Looper.getMainLooper())

    // Объект-резервация для запущенного локального хотспота (если таковой имеется)
    private var hotspotReservation: WifiManager.LocalOnlyHotspotReservation? = null

    /**
     * Внутренний объект обратного вызова для локального хотспота.
     * Он обрабатывает события успешного старта, ошибки и остановки хотспота.
     */
    private val localOnlyHotspotCallback = object : WifiManager.LocalOnlyHotspotCallback() {
        // Метод вызывается, если запуск хотспота завершился неудачно.
        override fun onFailed(reason: Int) {
            super.onFailed(reason)
            // Уведомляем через callback об ошибке запуска хотспота.
            callback?.onHotspotFailed(reason)
        }

        // Метод вызывается при успешном запуске хотспота.
        override fun onStarted(reservation: WifiManager.LocalOnlyHotspotReservation?) {
            super.onStarted(reservation)
            if (reservation == null) {
                callback?.onHotspotFailed(-1) // -1 означает неизвестную ошибку
                return
            }
            // Сохраняем полученную резервацию
            hotspotReservation = reservation

            // Получаем конфигурацию запущенного хотспота: SSID и пароль
            var ssid = ""
            var password = ""
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                // Для Android версий ниже R используем поле wifiConfiguration
                val config = reservation.wifiConfiguration
                config?.let {
                    ssid = it.SSID
                    password = it.preSharedKey
                }
            } else {
                // Для Android R и выше используем softApConfiguration
                val config = reservation.softApConfiguration
                // Для Android Tiramisu (API 33+) используется wifiSsid
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    config.wifiSsid?.let { ssid = it.toString() }
                } else {
                    config.ssid?.let { ssid = it }
                }
                config.passphrase?.let { password = it }
            }

            // Удаляем возможные кавычки из SSID
            ssid = ssid.replace("\"", "")

            // Генерируем ключ из пароля с помощью алгоритма SHA-256
            val hasher = MessageDigest.getInstance("SHA-256")
            hasher.update(password.toByteArray())
            val key = hasher.digest()

            // Уведомляем через callback, что хотспот успешно запущен
            callback?.onHotspotStarted(ssid, password, key, reservation)
        }

        // Метод вызывается, когда запущенный хотспот останавливается
        override fun onStopped() {
            super.onStopped()
            callback?.onHotspotStopped()
        }
    }

    /**
     * Метод для запуска локального хотспота.
     *
     * Перед вызовом метода убедитесь, что у приложения есть необходимые разрешения:
     * - Для Android версий ниже 33: ACCESS_FINE_LOCATION
     * - Для Android 33 и выше: NEARBY_WIFI_DEVICES
     *
     * Если разрешение отсутствует, вызывается callback с кодом ошибки -2.
     */
    fun startHotspot() {
        // Определяем требуемое разрешение в зависимости от версии Android
        val requiredPermission = if (Build.VERSION.SDK_INT < 33) {
            Manifest.permission.ACCESS_FINE_LOCATION
        } else {
            Manifest.permission.NEARBY_WIFI_DEVICES
        }

        // Проверяем наличие разрешения
        if (ActivityCompat.checkSelfPermission(context, requiredPermission) != PackageManager.PERMISSION_GRANTED) {
            // Разрешение отсутствует – уведомляем через callback
            callback?.onHotspotFailed(-2)
            return
        }

        try {
            // Запускаем локальный хотспот с использованием нашего callback и Handler'а
            wifiManager.startLocalOnlyHotspot(localOnlyHotspotCallback, handler)
        } catch (e: Exception) {
            // В случае возникновения исключения уведомляем через callback об ошибке (-3)
            callback?.onHotspotFailed(-3)
        }
    }

    /**
     * Метод для остановки ранее запущенного локального хотспота.
     * Если хотспот активен, он будет закрыт, а callback уведомит об остановке.
     */
    fun stopHotspot() {
        hotspotReservation?.close()
        hotspotReservation = null
        callback?.onHotspotStopped()
    }

    /**
     * Внутренний класс обратного вызова для подключения к Wi‑Fi сети (хотспоту).
     * Он уведомляет о том, что сеть стала доступной, либо сообщает об ошибке подключения.
     */
    private inner class WifiJoinCallback : ConnectivityManager.NetworkCallback() {
        // Метод вызывается, когда устройство успешно подключилось к сети
        override fun onAvailable(network: Network) {
            super.onAvailable(network)
            // Уведомляем через callback, что устройство присоединилось к сети
            callback?.onHotspotJoined()
            // После успешного подключения отменяем регистрацию обратного вызова
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            connectivityManager.unregisterNetworkCallback(this)
        }

        // Метод вызывается, если подключение к сети теряется
        override fun onLost(network: Network) {
            super.onLost(network)
            callback?.onJoinFailed("Соединение потеряно")
        }
    }

    /**
     * Метод для подключения к существующему хотспоту по заданным SSID и паролю.
     *
     * @param ssid     Имя (SSID) сети, к которой необходимо подключиться.
     * @param password Пароль сети.
     *
     * Для подключения используется WifiNetworkSpecifier и NetworkRequest.
     * Обратите внимание, что в данном случае сеть запрашивается без доступа к интернету.
     */
    fun joinHotspot(ssid: String, password: String) {
        // Создаем объект спецификатора сети с указанными SSID и паролем (WPA2)
        val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setWpa2Passphrase(password)
            .build()

        // Формируем запрос на подключение к Wi‑Fi сети
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) // Исключаем возможность доступа в интернет
            .setNetworkSpecifier(specifier)
            .build()

        // Получаем ConnectivityManager для выполнения запроса
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        // Регистрируем запрос на подключение с использованием нашего обратного вызова
        connectivityManager.requestNetwork(request, WifiJoinCallback(), handler)
    }
}
