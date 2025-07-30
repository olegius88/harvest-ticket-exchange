#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use flying_carpet_core::{
    clean_up_transfer, network, start_transfer, utils, Transfer, WiFiInterface, UI,
};
use local_ip_address::local_ip;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;
use std::{fs, sync::Mutex};
use talon_db::{CreateUserRequest, DatabaseError, LoginRequest, TalonDatabase};
use tauri::{Emitter, State, Window};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use uuid::Uuid;

// Database state
struct DatabaseState {
    db: Arc<Mutex<TalonDatabase>>,
}

// TCP Server state for talon acceptance
struct TcpServerState {
    server_info: Arc<Mutex<Option<TalonTcpServerInfo>>>,
}

#[derive(Clone, serde::Serialize)]
struct TalonTcpServerInfo {
    ip: String,
    port: u16,
    auth_code: String,
    qr_data: String,
}

// Структуры для возврата данных без password_hash
#[derive(serde::Serialize)]
struct SafeUser {
    id: String,
    fio: String,
    phone: String,
    position: String,
    created_at: String,
    updated_at: String,
    from_remote: bool,
}

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[derive(Clone, serde::Serialize)]
struct Progress {
    value: u8,
}

#[derive(Clone)]
struct GUI {
    window: Arc<Mutex<Window>>,
}

impl UI for GUI {
    fn output(&self, msg: &str) {
        self.window
            .lock()
            .expect("Couldn't lock GUI mutex")
            .emit(
                "outputMsg",
                Payload {
                    message: msg.to_string(),
                },
            )
            .expect("could not emit event");
    }
    fn show_progress_bar(&self) {
        self.window
            .lock()
            .expect("Couldn't lock GUI mutex")
            .emit("showProgressBar", Progress { value: 0 })
            .expect("could not emit event");
    }
    fn update_progress_bar(&self, percent: u8) {
        self.window
            .lock()
            .expect("Couldn't lock GUI mutex")
            .emit("updateProgressBar", Progress { value: percent })
            .expect("could not emit event");
    }
    fn enable_ui(&self) {
        self.window
            .lock()
            .expect("Couldn't lock GUI mutex")
            .emit("enableUi", Progress { value: 0 })
            .expect("could not emit event");
    }
    fn show_pin(&self, pin: &str) {
        println!("showing pin");
        self.window
            .lock()
            .expect("Couldn't lock GUI mutex")
            .emit(
                "showPin",
                Payload {
                    message: pin.to_string(),
                },
            )
            .expect("could not emit event");
    }
}

#[tauri::command]
fn cancel_transfer(window: Window, state: State<Transfer>) -> String {
    let mut message = String::new();

    // cancel file transfer, which should close tcp socket?
    let cancel_handle = &mut state.cancel_handle.lock().unwrap();
    if let Some(handle) = cancel_handle.as_ref() {
        handle.abort();
        while !handle.is_finished() {
            println!("Waiting for transfer to cancel...");
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        **cancel_handle = None;
        message += "Transfer cancelled"
    } else {
        message += "No transfer to cancel"
    }

    // shut down hotspot
    let hotspot = state
        .hotspot
        .lock()
        .expect("Couldn't lock state hotspot mutex.");
    let hotspot = &*hotspot;
    let ssid = state.ssid.lock().expect("Couldn't lock state ssid mutex.");
    let ssid = &*ssid;
    match network::stop_hotspot(hotspot.as_ref(), ssid.as_deref()) {
        Err(e) => println!("Error stopping hotspot: {}", e),
        Ok(msg) => println!("{}", msg),
    };

    window
        .emit("enableUi", Progress { value: 0 })
        .expect("Couldn't emit to window");
    message
}

#[tauri::command]
fn start_async(
    state: State<Transfer>,
    mode: String,
    peer: Option<String>,
    password: Option<String>,
    interface: WiFiInterface,
    file_list: Option<Vec<String>>,
    receive_dir: Option<String>,
    _using_bluetooth: bool, // Prefix with underscore to avoid warning
    window: Window,
) {
    let thread_window = window.clone();
    let gui = GUI {
        window: Arc::new(Mutex::new(thread_window)),
    };

    let transfer_hotspot = state.hotspot.clone();
    let transfer_ssid = state.ssid.clone();

    // Bluetooth is disabled, no need for UI channel
    let (_ble_ui_tx, ble_ui_rx) = mpsc::channel(1);

    let cancel_handle = tokio::spawn(async move {
        let stream: std::option::Option<tokio::net::TcpStream> = start_transfer(
            mode,
            false, // Always disable bluetooth
            peer,
            password,
            interface,
            file_list,
            receive_dir,
            &gui,
            transfer_hotspot.clone(),
            transfer_ssid.clone(),
            ble_ui_rx,
        )
        .await;
        clean_up_transfer(stream, transfer_hotspot, transfer_ssid, &gui).await;
    });
    let mut state_cancel_handle = state.cancel_handle.lock().unwrap();
    *state_cancel_handle = Some(cancel_handle);
    // No need to store bluetooth UI channel
}

#[tokio::main]
async fn main() {
    tauri::async_runtime::set(tokio::runtime::Handle::current());

    // Инициализируем базу данных
    let db_path = get_database_path();
    let db_path_str = db_path.to_string_lossy();
    let db = match TalonDatabase::new(&db_path_str) {
        Ok(database) => database,
        Err(e) => {
            eprintln!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    let db_state = DatabaseState {
        db: Arc::new(Mutex::new(db)),
    };

    let tcp_server_state = TcpServerState {
        server_info: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(Transfer::new())
        .manage(db_state)
        .manage(tcp_server_state)
        .invoke_handler(tauri::generate_handler![
            start_async,
            cancel_transfer,
            is_dir,
            expand_files,
            // generate_password, // Скрыто
            // get_wifi_interfaces, // Скрыто
            // Vesovschik commands
            register_vesovschik,
            login_vesovschik,
            validate_vesovschik_session,
            // start_vesovschik_hotspot, // Скрыто
            // stop_vesovschik_hotspot, // Скрыто
            // Database talon commands
            get_all_talons,
            // Database migration commands
            get_applied_migrations,
            get_pending_migrations,
            rollback_migration,
            // TCP server commands for talon acceptance
            start_talon_tcp_server,
            stop_talon_tcp_server,
            get_talon_tcp_server_info,
            // Debug command to check users
            debug_get_all_users_any_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_database_path() -> PathBuf {
    let app_data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("TalonKombaineraV3");

    // Создаем директорию если не существует
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).unwrap_or_else(|e| {
            eprintln!("Failed to create app data directory: {}", e);
        });
    }

    app_data_dir.join("talon_kombainera.db")
}

// Vesovschik commands
#[tauri::command]
async fn register_vesovschik(
    request: CreateUserRequest,
    db_state: State<'_, DatabaseState>,
) -> Result<String, String> {
    println!(
        "Starting registration for user: {} ({})",
        request.fio, request.phone
    );

    let mut db = db_state.db.lock().map_err(|e| {
        let error = format!("Database lock error: {}", e);
        println!("Registration failed: {}", error);
        error
    })?;

    let mut vesovschik_request = request;
    vesovschik_request.position = "vesovschik".to_string();

    println!(
        "Registration request prepared: FIO={}, Phone={}, Position={}",
        vesovschik_request.fio, vesovschik_request.phone, vesovschik_request.position
    );

    match db.create_user(vesovschik_request) {
        Ok(user_id) => {
            println!("User successfully created with ID: {}", user_id);
            Ok(user_id)
        }
        Err(DatabaseError::UserAlreadyExists) => {
            let error = "Пользователь с таким номером телефона уже существует".to_string();
            println!("Registration failed: {}", error);
            Err(error)
        }
        Err(DatabaseError::ValidationError(msg)) => {
            println!("Registration validation error: {}", msg);
            Err(msg)
        }
        Err(e) => {
            let error = format!("Ошибка регистрации: {}", e);
            println!("Registration failed with error: {}", error);
            Err(error)
        }
    }
}

#[tauri::command]
async fn login_vesovschik(
    request: LoginRequest,
    db_state: State<'_, DatabaseState>,
) -> Result<SafeUser, String> {
    let db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    println!("Attempting login for phone: {}", request.phone);

    // Сначала попробуем найти всех пользователей-весовщиков для отладки
    match db.get_users_by_position("vesovschik") {
        Ok(users) => {
            println!("Available vesovschik users:");
            for user in &users {
                println!("  - Phone: {}, FIO: {}", user.phone, user.fio);
            }
        }
        Err(e) => println!("Error getting users: {}", e),
    }

    match db.login_user(request) {
        Ok(user) => {
            if user.position != "vesovschik" {
                return Err("Пользователь не является весовщиком".to_string());
            }

            Ok(SafeUser {
                id: user.id,
                fio: user.fio,
                phone: user.phone,
                position: user.position,
                created_at: user.created_at.to_rfc3339(),
                updated_at: user.updated_at.to_rfc3339(),
                from_remote: user.from_remote,
            })
        }
        Err(DatabaseError::UserNotFound) => {
            Err("Пользователь с указанным номером телефона не найден".to_string())
        }
        Err(DatabaseError::InvalidCredentials) => Err("Неверный пароль".to_string()),
        Err(e) => Err(format!("Ошибка входа: {}", e)),
    }
}

#[tauri::command]
async fn validate_vesovschik_session(
    user_id: String,
    db_state: State<'_, DatabaseState>,
) -> Result<bool, String> {
    println!("Validating session for user_id: {}", user_id);

    let db = db_state.db.lock().map_err(|e| {
        println!("Database lock error during session validation: {}", e);
        format!("Database lock error: {}", e)
    })?;

    match db.get_user_by_id(&user_id) {
        Ok(user) => {
            println!(
                "User found: {} ({}), position: {}",
                user.fio, user.id, user.position
            );
            let is_valid = user.position == "vesovschik";
            println!("Session validation result: {}", is_valid);
            Ok(is_valid)
        }
        Err(e) => {
            println!("User not found during session validation: {:?}", e);
            Ok(false)
        }
    }
}

#[tauri::command]
async fn debug_get_all_users_any_position(
    db_state: State<'_, DatabaseState>,
) -> Result<String, String> {
    let db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    match db.get_all_users_debug() {
        Ok(users) => {
            let mut result = String::from("All users in database:\n");
            let count = users.len();
            for user in users {
                result.push_str(&format!("  {}\n", user));
            }
            result.push_str(&format!("Total users found: {}", count));
            Ok(result)
        }
        Err(e) => Err(format!("Failed to get users: {}", e)),
    }
}

/*
#[derive(serde::Serialize)]
struct HotspotInfo {
    ssid: String,
    password: String,
}

#[tauri::command]
async fn start_vesovschik_hotspot(
    user_id: String,
    db_state: State<'_, DatabaseState>,
) -> Result<HotspotInfo, String> {
    let db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    // Проверяем, что пользователь существует и является весовщиком
    let user = match db.get_user_by_id(&user_id) {
        Ok(user) => user,
        Err(_) => return Err("Пользователь не найден".to_string()),
    };

    if user.position != "vesovschik" {
        return Err("Пользователь не является весовщиком".to_string());
    }

    // Генерируем SSID и пароль для hotspot
    let ssid = format!("Vesovschik_{}", &user.fio.replace(" ", "_"));
    let password = utils::generate_password();

    // В будущем здесь будет создание реального hotspot
    // Пока возвращаем информацию для тестирования
    Ok(HotspotInfo { ssid, password })
}

#[tauri::command]
async fn stop_vesovschik_hotspot() -> Result<String, String> {
    // В будущем здесь будет остановка реального hotspot
    Ok("Hotspot остановлен".to_string())
}
*/

// Hotspot функции скрыты - используется внутренняя WiFi сеть весовой

// Bluetooth functions removed - bluetooth is disabled

// for javascript, None/null means no error and Some(String) means error message
// #[tauri::command]
// async fn check_support() -> Option<String> {
//     bluetooth::check_support()
//         .await
//         .map_err(|e| e.to_string())
//         .err()
// }

#[tauri::command]
fn is_dir(path: &str) -> bool {
    match fs::metadata(path) {
        Ok(m) => m.is_dir(),
        Err(_) => false,
    }
}

#[tauri::command]
fn expand_files(paths: Vec<&str>) -> Vec<String> {
    let path_bufs: Vec<PathBuf> = paths
        .iter()
        .filter_map(|p| PathBuf::from_str(p).ok())
        .collect();
    let mut files: Vec<String> = vec![];
    let mut dirs_to_search: Vec<PathBuf> = vec![];
    for path in path_bufs {
        if let Some(metadata) = fs::metadata(&path).ok() {
            if metadata.is_dir() {
                dirs_to_search.push(path.clone());
            }
            if metadata.is_file() {
                files.push(path.to_string_lossy().to_string());
            }
        }
    }
    while dirs_to_search.len() > 0 {
        let (mut temp_files, mut temp_dirs) = utils::expand_dir(
            dirs_to_search
                .pop()
                .expect("Had dirs to search but couldn't pop."),
        );
        files.append(&mut temp_files);
        dirs_to_search.append(&mut temp_dirs);
    }
    files
}

// #[tauri::command]
// fn generate_password() -> String {
//     utils::generate_password()
// }

// #[tauri::command]
// fn get_wifi_interfaces() -> Vec<WiFiInterface> {
//     match network::get_wifi_interfaces() {
//         Ok(interfaces) => interfaces,
//         Err(_e) => vec![], // if there was an error, just return empty list of interfaces and let javascript detect "no wifi card found"
//     }
// }

// Bluetooth pair function removed - bluetooth is disabled
// #[tauri::command]
// fn user_bluetooth_pair(choice: bool, state: State<Transfer>) {
//     println!("in user_bluetooth_pair");
//     let ble_ui_tx = state
//         .ble_ui_tx
//         .lock()
//         .expect("Could not lock ble_ui_tx mutex");
//     let ble_ui_tx = ble_ui_tx.as_ref().expect("State ble_ui_tx was None");
//     let ble_ui_tx = ble_ui_tx.clone();
//
//     tokio::spawn(async move {
//         ble_ui_tx
//             .send(choice)
//             .await
//             .expect("Could not send on ble_ui_tx");
//         println!("sent in user_bluetooth_pair");
//     });
// }

// Database talon commands
#[tauri::command]
async fn get_all_talons(
    db_state: State<'_, DatabaseState>,
) -> Result<Vec<serde_json::Value>, String> {
    let db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    match db.get_all_talons() {
        Ok(talons) => {
            // Преобразуем в JSON для фронтенда
            let json_talons: Vec<serde_json::Value> = talons
                .into_iter()
                .map(|talon| {
                    serde_json::json!({
                        "id": talon.id,
                        "talon_number": talon.talon_number,
                        "kombainer_id": talon.kombainer_id,
                        "kombainer_data": talon.kombainer_data,
                        "kombainer_user_data": talon.kombainer_user_data,
                        "voditel_id": talon.voditel_id,
                        "voditel_user_id": talon.voditel_user_id,
                        "voditel_data": talon.voditel_data,
                        "voditel_user_data": talon.voditel_user_data,
                        "status": talon.status,
                        "start_time": talon.start_time,
                        "end_time": talon.end_time,
                        "weight": talon.weight,
                        "comment": talon.comment,
                        "cancellation_reason": talon.cancellation_reason,
                        "created_at": talon.created_at.to_rfc3339(),
                        "updated_at": talon.updated_at.to_rfc3339()
                    })
                })
                .collect();
            Ok(json_talons)
        }
        Err(e) => Err(format!("Failed to get talons: {}", e)),
    }
}

// Database migration commands
#[tauri::command]
async fn get_applied_migrations(
    db_state: State<'_, DatabaseState>,
) -> Result<Vec<(i32, String, String)>, String> {
    let db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    match db.get_applied_migrations() {
        Ok(migrations) => Ok(migrations),
        Err(e) => Err(format!("Failed to get migrations: {}", e)),
    }
}

#[tauri::command]
async fn get_pending_migrations(
    db_state: State<'_, DatabaseState>,
) -> Result<Vec<(i32, String)>, String> {
    let db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    match db.get_pending_migrations() {
        Ok(migrations) => Ok(migrations
            .iter()
            .map(|m| (m.version, m.description.to_string()))
            .collect()),
        Err(e) => Err(format!("Failed to get pending migrations: {}", e)),
    }
}

#[tauri::command]
async fn rollback_migration(
    target_version: i32,
    db_state: State<'_, DatabaseState>,
) -> Result<String, String> {
    let mut db = db_state
        .db
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    match db.rollback_migration(target_version) {
        Ok(()) => Ok(format!(
            "Successfully rolled back to version {}",
            target_version
        )),
        Err(e) => Err(format!("Failed to rollback migration: {}", e)),
    }
}

// TCP Server commands for talon acceptance
#[tauri::command]
async fn start_talon_tcp_server(
    tcp_state: State<'_, TcpServerState>,
) -> Result<TalonTcpServerInfo, String> {
    println!("Starting talon TCP server...");

    // Генерируем уникальный код авторизации
    let auth_code = Uuid::new_v4().to_string()[..8].to_string();

    // Получаем локальный IP адрес
    let local_ip = local_ip().map_err(|e| format!("Failed to get local IP: {}", e))?;
    let ip_str = local_ip.to_string();

    // Пытаемся найти свободный порт
    let listener = TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("Failed to bind to port: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port();

    // Создаем данные для QR кода
    let qr_data = serde_json::json!({
        "ip": ip_str,
        "port": port,
        "auth_code": auth_code
    })
    .to_string();

    let server_info = TalonTcpServerInfo {
        ip: ip_str.clone(),
        port,
        auth_code: auth_code.clone(),
        qr_data: qr_data.clone(),
    };

    // Сохраняем информацию о сервере в состоянии
    {
        let mut state = tcp_state
            .server_info
            .lock()
            .map_err(|e| format!("Failed to lock server state: {}", e))?;
        *state = Some(server_info.clone());
    }

    // Запускаем TCP сервер в фоновом режиме
    let auth_code_clone = auth_code.clone();
    tokio::spawn(async move {
        handle_talon_tcp_connections(listener, auth_code_clone).await;
    });

    println!(
        "TCP server started on {}:{} with auth code: {}",
        ip_str, port, auth_code
    );
    Ok(server_info)
}

#[tauri::command]
async fn stop_talon_tcp_server(tcp_state: State<'_, TcpServerState>) -> Result<String, String> {
    let mut state = tcp_state
        .server_info
        .lock()
        .map_err(|e| format!("Failed to lock server state: {}", e))?;

    if state.is_some() {
        *state = None;
        Ok("TCP server stopped".to_string())
    } else {
        Err("TCP server is not running".to_string())
    }
}

#[tauri::command]
async fn get_talon_tcp_server_info(
    tcp_state: State<'_, TcpServerState>,
) -> Result<Option<TalonTcpServerInfo>, String> {
    let state = tcp_state
        .server_info
        .lock()
        .map_err(|e| format!("Failed to lock server state: {}", e))?;

    Ok(state.clone())
}

async fn handle_talon_tcp_connections(listener: TcpListener, auth_code: String) {
    println!("TCP server listening for talon connections...");

    while let Ok((mut stream, addr)) = listener.accept().await {
        println!("New connection from: {}", addr);

        let auth_code_clone = auth_code.clone();
        tokio::spawn(async move {
            // Здесь будет логика обработки подключения Android устройства
            // Пока что просто логируем подключение
            match handle_android_connection(&mut stream, auth_code_clone).await {
                Ok(_) => println!("Android connection handled successfully"),
                Err(e) => println!("Error handling Android connection: {}", e),
            }
        });
    }
}

async fn handle_android_connection(
    stream: &mut tokio::net::TcpStream,
    expected_auth_code: String,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    println!("Handling Android connection...");

    // Буфер для чтения данных
    let mut buffer = [0; 8192]; // Увеличиваем буфер для больших JSON
    let n = stream.read(&mut buffer).await?;

    if n == 0 {
        return Err("Connection closed by Android client".into());
    }

    let received_data = String::from_utf8_lossy(&buffer[..n]);
    println!("Received from Android (raw): {}", received_data);

    // Убираем лишние символы и пробелы
    let cleaned_data = received_data
        .trim()
        .trim_end_matches('\n')
        .trim_end_matches('\0');
    println!("Cleaned data: {}", cleaned_data);

    // Парсим JSON
    let request: serde_json::Value = match serde_json::from_str(cleaned_data) {
        Ok(json) => json,
        Err(e) => {
            let error_response = serde_json::json!({
                "status": "error",
                "message": format!("Invalid JSON format: {}", e)
            });
            stream
                .write_all(error_response.to_string().as_bytes())
                .await?;
            return Err(format!("JSON parsing error: {}", e).into());
        }
    };

    println!("Parsed JSON: {}", serde_json::to_string_pretty(&request)?);

    // Проверяем структуру запроса
    let request_type = request
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    if request_type != "weighingData" {
        let error_response = serde_json::json!({
            "status": "error",
            "message": format!("Unsupported request type: {}", request_type)
        });
        stream
            .write_all(error_response.to_string().as_bytes())
            .await?;
        return Err(format!("Unsupported request type: {}", request_type).into());
    }

    // Проверяем код авторизации
    let auth_code = request
        .get("auth_code")
        .and_then(|v| v.as_str())
        .ok_or("Missing auth_code in request")?;

    if auth_code != expected_auth_code {
        println!(
            "Auth code mismatch. Expected: {}, Got: {}",
            expected_auth_code, auth_code
        );
        let error_response = serde_json::json!({
            "status": "error",
            "message": "Invalid auth code"
        });
        stream
            .write_all(error_response.to_string().as_bytes())
            .await?;
        return Err("Invalid auth code".into());
    }

    // Извлекаем данные талона
    let talon_data = request
        .get("talon_data")
        .ok_or("Missing talon_data in request")?;

    println!(
        "Processing talon data: {}",
        serde_json::to_string_pretty(talon_data)?
    );

    // Здесь можно добавить логику сохранения данных талона в базу данных
    // Пока что просто логируем успешное получение

    let talon_id = talon_data
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let talon_number = talon_data
        .get("talonNumber")
        .and_then(|v| v.as_str())
        .unwrap_or("не указан");

    println!("Received talon: ID={}, Number={}", talon_id, talon_number);

    // Отправляем успешный ответ
    let response = serde_json::json!({
        "status": "success",
        "message": "Talon data received successfully",
        "received_data": {
            "talon_id": talon_id,
            "auth_verified": true,
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        }
    });

    let response_str = response.to_string();
    println!("Sending response to Android: {}", response_str);

    // Добавляем символ новой строки для завершения сообщения согласно протоколу Android клиента
    let response_with_newline = format!("{}\n", response_str);
    stream.write_all(response_with_newline.as_bytes()).await?;
    stream.flush().await?;
    
    // Даем время Android клиенту получить полный ответ перед закрытием соединения
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    println!("Android connection handled successfully");
    Ok(())
}
