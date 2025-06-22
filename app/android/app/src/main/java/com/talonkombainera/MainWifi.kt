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

/**
 * Класс MainWifi предоставляет функциональность для управления локальным Wi‑Fi хотспотом,
 * а также для подключения к существующим хотспотам.
 *
 * Для уведомления о событиях (запуск, ошибка, остановка, подключение) используется интерфейс
 * обратного вызова MainWifiCallback.
 */
class MainWifi(private val context: Context) {

    companion object {
        @Volatile
        private var isHotspotOperationInProgress = false
        private val hotspotLock = Object()
        private const val MAX_RETRY_COUNT = 3
        private const val RETRY_DELAY_MS = 3000L
    }

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
         * Вызывается, когда устройство успешно подключилось to хотспоту.
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
        synchronized(hotspotLock) {
            if (isHotspotOperationInProgress) {
                Log.d("MainWifi", "Операция с хотспотом уже выполняется, пропускаем запрос")
                callback?.onHotspotFailed(-6) // Код для "операция уже выполняется"
                return
            }

            isHotspotOperationInProgress = true
            try {
                // Проверяем, запущен ли уже хотспот, и останавливаем его перед запуском нового
                if (hotspotReservation != null) {
                    Log.d("MainWifi", "Хотспот уже запущен, останавливаем перед повторным запуском")
                    stopHotspot()
                    // Увеличиваем задержку для корректного завершения предыдущего хотспота
                    try {
                        Thread.sleep(2000) // Увеличиваем до 2 секунд
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

                // Дополнительная проверка активного хотспота через другие методы
                try {
                    // Пытаемся запустить хотспот с обработкой ошибок
                    if (ActivityCompat.checkSelfPermission(context, requiredPermission) != PackageManager.PERMISSION_GRANTED) {
                        callback?.onHotspotFailed(-2)
                        return
                    }

                    // Проверяем, включён ли режим определения местоположения
                    if (!isLocationEnabled(context)) {
                        Log.e("MainWifi", "Режим определения местоположения отключён. Необходимо его включить.")
                        promptEnableLocation()
                        callback?.onHotspotFailed(-4)
                        return
                    }

                    try {
                        // Запускаем локальный хотспот с использованием нашего callback и Handler'а
                        wifiManager.startLocalOnlyHotspot(localOnlyHotspotCallback, handler)
                    } catch (e: IllegalStateException) {
                        // Обрабатываем конкретно эту ошибку
                        Log.e("MainWifi", "Хотспот уже активен в системе. Выполняем последовательность принудительного сброса", e)

                        // Повторные попытки с принудительным сбросом
                        var retryCount = 0
                        var success = false

                        while (retryCount < MAX_RETRY_COUNT && !success) {
                            retryCount++
                            Log.d("MainWifi", "Попытка принудительного сброса хотспота #$retryCount")

                            // Попытка принудительного сброса через рефлексию
                            try {
                                val method = wifiManager.javaClass.getMethod("cancelLocalOnlyHotspotRequest")
                                method.invoke(wifiManager)
                                Log.d("MainWifi", "Выполнен принудительный сброс хотспота")
                            } catch (reflectEx: Exception) {
                                Log.e("MainWifi", "Не удалось выполнить принудительный сброс: ${reflectEx.message}")
                            }

                            // Ждем перед повторной попыткой
                            try {
                                Thread.sleep(RETRY_DELAY_MS)
                                Log.d("MainWifi", "Повторная попытка запуска хотспота после сброса")

                                // Повторная попытка запуска
                                try {
                                    wifiManager.startLocalOnlyHotspot(localOnlyHotspotCallback, handler)
                                    success = true
                                    Log.d("MainWifi", "Успешный запуск хотспота после принудительного сброса")
                                    break
                                } catch (retryEx: IllegalStateException) {
                                    Log.e("MainWifi", "Повторная попытка #$retryCount не удалась: ${retryEx.message}")
                                }
                            } catch (sleepEx: InterruptedException) {
                                Log.e("MainWifi", "Прерывание во время ожидания между попытками", sleepEx)
                            }
                        }

                        if (!success) {
                            Log.e("MainWifi", "Все попытки запустить хотспот после сброса не удались")
                            callback?.onHotspotFailed(-5)
                        }
                    } catch (e: Exception) {
                        Log.e("MainWifi", "startHotspot|error: ${e.message}", e)
                        e.printStackTrace()
                        callback?.onHotspotFailed(-3)
                    }
                } catch (e: Exception) {
                    Log.e("MainWifi", "Общая ошибка при запуске хотспота: ${e.message}", e)
                    callback?.onHotspotFailed(-3)
                }
            } finally {
                isHotspotOperationInProgress = false
            }
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

        Log.d("MainWifi", "Остановка хотспота начата")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val reservation = hotspotReservation
                if (reservation != null) {
                    reservation.close()
                    hotspotReservation = null

                    // Увеличиваем время ожидания для полного освобождения ресурсов
                    try {
                        Thread.sleep(3000) // Увеличиваем до 3 секунд
                    } catch (e: InterruptedException) {
                        Log.e("MainWifi", "Прерывание во время ожидания освобождения ресурсов", e)
                    }

                    // Принудительная попытка сбросить хотспот через WifiManager
                    try {
                        val method = wifiManager.javaClass.getMethod("cancelLocalOnlyHotspotRequest")
                        method.invoke(wifiManager)
                        Log.d("MainWifi", "Выполнен принудительный сброс хотспота через API")
                    } catch (e: Exception) {
                        Log.e("MainWifi", "Не удалось выполнить принудительный сброс хотспота: ${e.message}", e)
                    }

                    Log.d("MainWifi", "Хотспот успешно остановлен")
                } else {
                    Log.d("MainWifi", "Нет активного hotspotReservation для остановки")

                    // Попытка принудительного сброса, даже если у нас нет объекта reservation
                    try {
                        val method = wifiManager.javaClass.getMethod("cancelLocalOnlyHotspotRequest")
                        method.invoke(wifiManager)
                        Log.d("MainWifi", "Выполнен принудительный сброс хотспота через API (без reservation)")
                    } catch (e: Exception) {
                        Log.e("MainWifi", "Не удалось выполнить принудительный сброс хотспота: ${e.message}", e)
                    }
                }
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
                    Thread.sleep(1000)
                } catch (ex: Exception) {
                    Log.e("MainWifi", "Ошибка при отключении хотспота: ${ex.message}", ex)
                }
            }
        } catch (e: Exception) {
            Log.e("MainWifi", "Ошибка при остановке хотспота: ${e.message}", e)
        } finally {
            // Обязательно вызываем callback даже при ошибках
            callback?.onHotspotStopped()
        }
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

    /**
     * Метод для перезапуска службы Wi-Fi.
     * Выключает и снова включает Wi-Fi на устройстве.
     */
    private fun resetWifiService() {
        Log.d("MainWifi", "Попытка перезапуска службы Wi-Fi")
        try {
            // Выключаем Wi-Fi
            wifiManager.setWifiEnabled(false)
            Thread.sleep(1000)

            // Включаем Wi-Fi
            wifiManager.setWifiEnabled(true)
            Thread.sleep(2000)

            Log.d("MainWifi", "Служба Wi-Fi перезапущена")
        } catch (e: Exception) {
            Log.e("MainWifi", "Ошибка при перезапуске службы Wi-Fi: ${e.message}", e)
        }
    }
}
