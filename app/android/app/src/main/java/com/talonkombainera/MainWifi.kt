// Файл: java/com/talonkombainera/MainWifi.kt
package com.talonkombainera

import android.Manifest
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET
import android.net.NetworkCapabilities.TRANSPORT_WIFI
import android.net.NetworkRequest
import android.net.wifi.WifiConfiguration
import android.net.wifi.WifiManager
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import android.util.Log
import androidx.appcompat.app.AppCompatActivity.CONNECTIVITY_SERVICE
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import java.net.Inet4Address

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
    var peerIP: Inet4Address? = null

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
         * @param reason Код ошибки (например: -2 – отсутствует разрешение, -3 – исключение, -4 – отключён режим определения местоположения).
         */
        fun onHotspotFailed(reason: Int)

        /**
         * Вызывается, когда локальный хотспот был остановлен.
         */
        fun onHotspotStopped()

        /**
         * Вызывается, когда устройство успешно подключилось к хотспоту.
         */
        fun onHotspotJoined(ipAddress: String?)

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
     * Функция для проверки, включён ли режим определения местоположения.
     */
    private fun isLocationEnabled(context: Context): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    /**
     * Функция для открытия настроек включения определения местоположения.
     */
    fun promptEnableLocation() {
        val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

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
                val config: WifiConfiguration? = reservation.wifiConfiguration
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
     * Если хотспот уже запущен, сначала останавливает его.
     */
    fun startHotspot() {
        // Проверяем, запущен ли уже хотспот, и останавливаем его перед запуском нового
        if (hotspotReservation != null) {
            Log.d("MainWifi", "Хотспот уже запущен, останавливаем перед повторным запуском")
            stopHotspot()
            // Небольшая задержка для корректного завершения предыдущего хотспота
            try {
                Thread.sleep(500)
            } catch (e: InterruptedException) {
                Log.e("MainWifi", "Прерывание потока во время задержки", e)
            }
        }

        // Определяем требуемое разрешение в зависимости от версии Android
        val requiredPermission = if (Build.VERSION.SDK_INT < 33) {
            Manifest.permission.ACCESS_FINE_LOCATION
        } else {
            Manifest.permission.NEARBY_WIFI_DEVICES
        }

        // Проверяем наличие разрешения
        if (ActivityCompat.checkSelfPermission(context, requiredPermission) != PackageManager.PERMISSION_GRANTED) {
            callback?.onHotspotFailed(-2)
            return
        }

        // Проверяем, включён ли режим определения местоположения
        if (!isLocationEnabled(context)) {
            Log.e("MainWifi", "Режим определения местоположения отключён. Необходимо его включить.")
            // Можно дополнительно уведомить пользователя или открыть настройки
            promptEnableLocation()
            callback?.onHotspotFailed(-4)
            return
        }

        try {
            // Запускаем локальный хотспот с использованием нашего callback и Handler'а
            wifiManager.startLocalOnlyHotspot(localOnlyHotspotCallback, handler)
        } catch (e: Exception) {
            Log.e("MainWifi", "startHotspot|error: ${e.message}", e)
            e.printStackTrace()
            // В случае возникновения исключения уведомляем через callback об ошибке (-3)
            callback?.onHotspotFailed(-3)
        }
    }

    /**
     * Метод для остановки запущенного локального хотспота.
     * Для API level 26 и выше используется стандартное закрытие через hotspotReservation,
     * а для устройств с API level ниже 26 (например, API 24) используется отражение для отключения хотспота.
     * Также при остановке хотспота вызывается метод stopTCP() для остановки TCP-сервера.
     */
    fun stopHotspot() {
        // Останавливаем TCP-сервер при остановке хотспота
        stopTCP()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            hotspotReservation?.close()
            hotspotReservation = null
        } else {
            try {
                // Для API ниже 26 используем методы setWifiApEnabled через reflection
                val methodGet = wifiManager.javaClass.getMethod("getWifiApConfiguration")
                val wifiConfig = methodGet.invoke(wifiManager)
                val methodSet = wifiManager.javaClass.getMethod(
                    "setWifiApEnabled",
                    wifiConfig.javaClass,
                    Boolean::class.javaPrimitiveType
                )
                methodSet.invoke(wifiManager, wifiConfig, false)
            } catch (ex: Exception) {
                Log.e("MainWifi", "Ошибка при отключении хотспота: ${ex.message}", ex)
            }
        }
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
        val callback = this.NetworkCallback()

        val specifier = WifiNetworkSpecifier.Builder()
            .setSsid(ssid)
            .setWpa2Passphrase(password)
            .build()
        val request = NetworkRequest.Builder()
            .addTransportType(TRANSPORT_WIFI)
            .removeCapability(NET_CAPABILITY_INTERNET)
            .setNetworkSpecifier(specifier)
            .build()
        val connectivityManager =
            context.getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        callback.connectivityManager = connectivityManager
        peerIP = null // Проверяем в NetworkCallback, чтобы запускать передачу только один раз для каждого вызова joinHotspot
        connectivityManager.requestNetwork(request, callback)
    }

    // Используется при подключении к хотспоту
    inner class NetworkCallback : ConnectivityManager.NetworkCallback() {
        lateinit var connectivityManager: ConnectivityManager
        override fun onAvailable(network: Network) {
            super.onAvailable(network)
            connectivityManager.bindProcessToNetwork(network)
        }

        override fun onLost(network: Network) {
            super.onLost(network)
            connectivityManager.bindProcessToNetwork(null)
        }

        override fun onUnavailable() {
            super.onUnavailable()
            connectivityManager.bindProcessToNetwork(null)
        }

        // Получаем IP-адрес шлюза (хоста)
        override fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) {
            super.onLinkPropertiesChanged(network, linkProperties)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                linkProperties.dhcpServerAddress?.let {
                    if (it is Inet4Address) {
                        peerIP = it
                    }
                }
            } else {
                for (route in linkProperties.routes) {
                    if (route.isDefaultRoute && route.gateway is Inet4Address) {
                        peerIP = route.gateway as Inet4Address
                        break
                    }
                }
            }

            if (peerIP != null) {
                val ipAddress = peerIP!!.hostAddress
                Log.d("MainWifi", "peerIP resolved: $ipAddress")
                callback?.onHotspotJoined(ipAddress)
            } else {
                Log.e("MainWifi", "Не удалось определить IP-адрес хоста")
                callback?.onJoinFailed("Не удалось определить IP-адрес хоста")
            }
        }
    }

    /**
     * Метод для подключения к существующему хотспоту по заданным SSID и паролю.
     * Сеть запрашивается без доступа к интернету.
     */
    fun joinHotspo22222t(ssid: String, password: String) {
//        Log.d("joinHotspot", "ssid="+ssid)
//        Log.d("joinHotspot", "password="+password)
//        val specifier = WifiNetworkSpecifier.Builder()
//            .setSsid(ssid)
//            .setWpa2Passphrase(password)
//            .build()
//        val request = NetworkRequest.Builder()
//            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
////            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
//            .setNetworkSpecifier(specifier)
//            .build()
//        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
//        connectivityManager.requestNetwork(request, object : ConnectivityManager.NetworkCallback() {
//            override fun onAvailable(network: Network) {
//                super.onAvailable(network)
//                Log.d("joinHotspot", "onAvailable")
//                // Получаем IP-адрес после успешного подключения
//                val linkProperties = connectivityManager.getLinkProperties(network)
//                val ipAddress = linkProperties?.linkAddresses
//                    ?.map { it.address }
//                    ?.filterIsInstance<Inet4Address>()
//                    ?.firstOrNull()
//                    ?.hostAddress ?: "N/A"
//                Log.d("joinHotspot", "ipAddress="+ipAddress)
//                callback?.onHotspotJoined(ipAddress)
//                connectivityManager.unregisterNetworkCallback(this)
//            }
//            override fun onLost(network: Network) {
//                super.onLost(network)
//                Log.d("joinHotspot", "onLost")
//                callback?.onJoinFailed("Соединение потеряно")
//            }
//        }, handler)
    }

    /**
     * Метод для запуска TCP-сервера.
     * После успешного запуска TCP-сервера выводится AlertDialog на главном потоке.
     */
    suspend fun startTCP() {
//        Log.d("startTCP", "init")
//        withContext(Dispatchers.IO) {
//            try {
//                withContext(Dispatchers.Main) {
//                    AlertDialog.Builder(context)
//                        .setTitle("startTCP")
//                        .setMessage("startTCP")
//                        .setPositiveButton("OK", null)
//                        .show()
//                }
//                Log.d("startTCP", "init 2")
//                server = ServerSocket(PORT)
//                client = server.accept()
//                Log.d("startTCP", "init 3")
//                client.sendBufferSize = chunkSize * 2
//                client.receiveBufferSize = chunkSize * 2
//                inputStream = client.getInputStream()
//                outputStream = client.getOutputStream()
//                Log.d("startTCP", "init 4")
//                // После успешного запуска TCP-сервера, выводим алерт на главном потоке
//                withContext(Dispatchers.Main) {
//                    AlertDialog.Builder(context)
//                        .setTitle("Успех")
//                        .setMessage("TCP-сервер успешно запущен")
//                        .setPositiveButton("OK", null)
//                        .show()
//                }
//            } catch (e: Exception) {
//                Log.e("startTCP", "error|message="+e.message)
//                // Здесь можно добавить обработку исключений, например, логирование ошибки
//                e.printStackTrace()
//            }
//        }
    }

    /**
     * Метод для остановки TCP-сервера.
     * Закрывает клиентский сокет и ServerSocket, если они инициализированы.
     */
    fun stopTCP() {
        Log.d("MainWifi", "stopTCP init")
        try {
            if (this::client.isInitialized && !client.isClosed) {
                client.close()
            }
            if (this::server.isInitialized && !server.isClosed) {
                server.close()
            }
        } catch (e: Exception) {
            Log.e("MainWifi", "stopTCP|Ошибка остановки TCP-сервера: ${e.message}", e)
            e.printStackTrace()
        }
    }
}
