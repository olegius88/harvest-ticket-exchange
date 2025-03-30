// java/com/talonkombainera/MainWifi.kt
package com.talonkombainera

import android.Manifest
import android.app.AlertDialog // импорт для отображения AlertDialog
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import android.util.Log

// Константы и глобальные переменные
val zero = ByteArray(8) // представляет 64-битное число 0
val one = byteArrayOf(0, 0, 0, 0, 0, 0, 0, 1) // представляет 64-битное число 1
const val chunkSize = 5_000_000
const val PORT = 3290

/**
 * Класс MainWifi предоставляет функциональность для управления локальным Wi‑Fi хотспотом,
 * а также для подключения к существующим хотспотам.
 *
 * Для уведомления о событиях (запуск, ошибка, остановка, подключение) используется интерфейс
 * обратного вызова MainWifiCallback.
 */
class MainWifi(private val context: Context) {

    lateinit var server: ServerSocket // TCP listener, используемый для освобождения порта при ошибках или завершении передачи
    lateinit var client: Socket // TCP сокет
    lateinit var inputStream: InputStream // входящий поток от сокета
    lateinit var outputStream: OutputStream // исходящий поток к сокету

    /**
     * Интерфейс для обратного вызова событий, связанных с работой хотспота.
     */
    interface MainWifiCallback {
        /**
         * Вызывается при успешном запуске локального хотспота.
         *
         * @param ssid        Имя (SSID) запущенного хотспота.
         * @param password    Пароль запущенного хотспота.
         * @param key         Ключ, сгенерированный на основе пароля с использованием SHA-256.
         * @param reservation Объект-резервация запущенного хотспота.
         */
        fun onHotspotStarted(
            ssid: String,
            password: String,
            key: ByteArray,
            reservation: WifiManager.LocalOnlyHotspotReservation
        )

        /**
         * Вызывается, если запуск хотспота завершился ошибкой.
         *
         * @param reason Код ошибки (например: -2 – отсутствует разрешение, -3 – исключение).
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

    // Handler для выполнения обратного вызова на главном потоке
    private val handler = Handler(Looper.getMainLooper())

    // Объект-резервация для запущенного локального хотспота (если имеется)
    private var hotspotReservation: WifiManager.LocalOnlyHotspotReservation? = null

    /**
     * Внутренний объект обратного вызова для локального хотспота.
     * Обрабатывает события успешного старта, ошибки и остановки хотспота.
     */
    private val localOnlyHotspotCallback = object : WifiManager.LocalOnlyHotspotCallback() {
        override fun onFailed(reason: Int) {
            super.onFailed(reason)
            callback?.onHotspotFailed(reason)
        }

        override fun onStarted(reservation: WifiManager.LocalOnlyHotspotReservation?) {
            super.onStarted(reservation)
            if (reservation == null) {
                callback?.onHotspotFailed(-1) // -1 означает неизвестную ошибку
                return
            }
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

            // Удаляем кавычки из SSID
            ssid = ssid.replace("\"", "")

            // Генерируем ключ с помощью SHA-256
            val hasher = MessageDigest.getInstance("SHA-256")
            hasher.update(password.toByteArray())
            val key = hasher.digest()

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
     * Метод для остановки запущенного локального хотспота.
     * Теперь при остановке хотспота также вызывается метод stopTCP() для остановки TCP-сервера.
     */
    fun stopHotspot() {
        hotspotReservation?.close()
        hotspotReservation = null
        // Останавливаем TCP-сервер при остановке хотспота
        stopTCP()
        callback?.onHotspotStopped()
    }

    /**
     * Метод для получения статуса хотспота.
     * @return "running", если хотспот запущен, иначе "stopped".
     */
    fun getHotspotStatus(): String {
        return if (hotspotReservation != null) "running" else "stopped"
    }

    /**
     * Метод для подключения к существующему хотспоту по заданным SSID и паролю.
     * Сеть запрашивается без доступа к интернету.
     */
    fun joinHotspot(ssid: String, password: String) {
        val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setWpa2Passphrase(password)
            .build()
        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .setNetworkSpecifier(specifier)
            .build()
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        connectivityManager.requestNetwork(request, object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                callback?.onHotspotJoined()
                connectivityManager.unregisterNetworkCallback(this)
            }
            override fun onLost(network: Network) {
                super.onLost(network)
                callback?.onJoinFailed("Соединение потеряно")
            }
        }, handler)
    }

    /**
     * Метод для запуска TCP-сервера.
     * После успешного запуска TCP-сервера выводится AlertDialog на главном потоке.
     */
    suspend fun startTCP() {
        Log.d("startTCP", "init")
        withContext(Dispatchers.IO) {
            try {
                Log.d("startTCP", "init 2")
                server = ServerSocket(PORT)
                client = server.accept()
                Log.d("startTCP", "init 3")
                client.sendBufferSize = chunkSize * 2
                client.receiveBufferSize = chunkSize * 2
                inputStream = client.getInputStream()
                outputStream = client.getOutputStream()
                Log.d("startTCP", "init 4")
                // После успешного запуска TCP-сервера, выводим алерт на главном потоке
                withContext(Dispatchers.Main) {
                    AlertDialog.Builder(context)
                        .setTitle("Успех")
                        .setMessage("TCP-сервер успешно запущен")
                        .setPositiveButton("OK", null)
                        .show()
                }
            } catch (e: Exception) {
                Log.e("startTCP", "error|message="+e.message)
                // Здесь можно добавить обработку исключений, например, логирование ошибки
                e.printStackTrace()
            }
        }
    }

    /**
     * Метод для остановки TCP-сервера.
     * Закрывает клиентский сокет и ServerSocket, если они инициализированы.
     */
    fun stopTCP() {
        Log.d("stopTCP", "init")
        try {
            if (this::client.isInitialized && !client.isClosed) {
                client.close()
            }
            if (this::server.isInitialized && !server.isClosed) {
                server.close()
            }
        } catch (e: Exception) {
            Log.e("stopTCP", "error|message="+e.message)
            e.printStackTrace()
        }
    }
}
