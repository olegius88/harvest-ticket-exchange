# Интеграция модуля Весовщика с Android приложением

## Обзор интеграции

Десктопный модуль Весовщика полностью интегрирован с Android приложением TalonKombaineraV3 и использует единую архитектуру для обмена данными.

## Схема взаимодействия

```
Android App (Комбайнер) ←→ WiFi ←→ Desktop App (Весовщик)
                                       ↓
                                  SQLite Database
                                       ↓
                                 Обработка талонов
```

## Протокол обмена данными

### 1. Создание соединения

**Desktop (Весовщик):**
1. Создает WiFi hotspot
2. Генерирует QR-код с параметрами подключения
3. Запускает TCP сервер на порту 3290

**Android (Комбайнер):**
1. Сканирует QR-код или подключается вручную
2. Подключается к WiFi сети весовщика
3. Устанавливает TCP соединение с весовщиком

### 2. Формат QR-кода

```json
{
  "ssid": "Vesovschik_Имя_Весовщика",
  "password": "сгенерированный_пароль",
  "vesovschik": "ФИО весовщика"
}
```

### 3. Структура данных талона

```typescript
interface TalonData {
  id: string;
  kombainer_id: string;
  kultura: string;
  field: string;
  weight: number;
  moisture: number;
  impurities: number;
  created_at: string;
  vesovschik_id?: string;
  processed_at?: string;
}
```

## Реализация TCP сервера

### Текущее состояние

В текущей версии TCP сервер наследует функциональность из Flying Carpet и адаптирован для приема данных талонов вместо файлов.

### Планируемые изменения

1. **Специализированный протокол для талонов**
   ```rust
   // В core/src/talon_protocol.rs
   pub enum TalonMessage {
       Connect { kombainer_id: String },
       SendTalon { talon: TalonData },
       Acknowledge { talon_id: String },
       Disconnect,
   }
   ```

2. **Обработчик талонов**
   ```rust
   // В src-tauri/src/talon_handler.rs
   pub async fn handle_talon_data(
       talon: TalonData,
       vesovschik_id: String,
       db: &mut TalonDatabase
   ) -> Result<(), TalonError> {
       // Валидация данных
       // Сохранение в базу данных
       // Уведомление пользователя
   }
   ```

## База данных

### Общие таблицы

Обе платформы используют одинаковую структуру таблиц:

- `users` - пользователи системы
- `kombainers` - данные комбайнеров
- `voditel` - данные водителей
- `talons` - основная таблица талонов

### Синхронизация данных

**Android → Desktop:**
- Отправка новых талонов
- Передача обновлений весов
- Синхронизация пользователей

**Desktop → Android:**
- Подтверждение приема талонов
- Статус обработки
- Отчеты по весовщику

## Сетевая архитектура

### WiFi hotspot

**Параметры сети:**
- Название: `Vesovschik_{ФИО_весовщика}`
- Безопасность: WPA2-PSK
- Частота: 2.4 GHz (для совместимости)
- Канал: Автоматический выбор

### TCP соединение

**Порт:** 3290 (стандартный для Flying Carpet)
**Протокол:** TCP с шифрованием AES-GCM
**Таймаут:** 30 секунд для установки соединения

## Обработка ошибок

### Типы ошибок

```rust
#[derive(Debug, Error)]
pub enum TalonNetworkError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Invalid talon data: {0}")]
    InvalidData(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Authentication failed")]
    AuthenticationFailed,
}
```

### Стратегии восстановления

1. **Потеря соединения**: Автоматическое переподключение (до 3 попыток)
2. **Ошибка данных**: Запрос повторной отправки
3. **Переполнение буфера**: Временная приостановка приема

## Безопасность

### Шифрование данных

- **В передаче**: AES-GCM с 256-битным ключом
- **В хранении**: Хеширование bcrypt для паролей
- **В сети**: WPA2-PSK защита WiFi

### Аутентификация

1. **Весовщик**: Логин/пароль в desktop приложении
2. **Комбайнер**: QR-код или ручной ввод параметров сети
3. **Данные**: Подпись талонов по ключу комбайнера

## Тестирование интеграции

### Тестовые сценарии

1. **Подключение Android к Desktop**
   - Создание hotspot на desktop
   - Сканирование QR-кода на Android
   - Установка TCP соединения

2. **Передача тестового талона**
   - Создание талона на Android
   - Отправка через TCP
   - Сохранение в desktop базе данных

3. **Обработка ошибок**
   - Потеря WiFi соединения
   - Некорректные данные талона
   - Переполнение буфера

### Инструменты тестирования

```bash
# Проверка TCP соединения
telnet <desktop_ip> 3290

# Тест WiFi подключения
netsh wlan show interfaces

# Мониторинг базы данных
sqlite3 talon_kombainera.db ".tables"
```

## Развертывание

### Системные требования

**Desktop (Windows):**
- Windows 10/11
- WiFi адаптер с поддержкой hotspot
- .NET Framework 4.8+
- Права администратора (для создания hotspot)

**Android:**
- Android 8.0+ (API level 26)
- WiFi модуль
- Камера (для сканирования QR-кодов)

### Настройка firewall

```powershell
# Добавление правила Windows Firewall
netsh advfirewall firewall add rule name="TalonKombainera" dir=in action=allow protocol=TCP localport=3290
```

## Логирование и мониторинг

### Desktop логи

```rust
// В main.rs
log::info!("Hotspot created: {}", ssid);
log::debug!("Received talon: {:?}", talon_data);
log::error!("Database error: {}", error);
```

### Android логи

```typescript
// В TcpClient.ts
console.log('Connected to vesovschik:', vesovschik_info);
console.debug('Sending talon:', talon);
console.error('Connection failed:', error);
```

## Планы по развитию

### Краткосрочные (1-2 месяца)

1. Реализация реального TCP сервера для талонов
2. Интеграция с системным WiFi API Windows
3. Добавление уведомлений о новых талонах

### Долгосрочные (3-6 месяцев)

1. Поддержка множественных подключений
2. Веб-интерфейс для удаленного мониторинга
3. Интеграция с внешними системами учета
4. Расширенная аналитика и отчетность
