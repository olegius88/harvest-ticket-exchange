# Android-приложение

Мобильное приложение на React Native 0.80 (TypeScript): комбайнер создаёт талон и передаёт его
водителю с телефона на телефон через локальную точку доступа Wi-Fi и TCP, водитель доставляет
талон на весовую. Общее описание проекта — в [корневом README](../README.md).

## Структура

| Путь | Назначение |
|------|------------|
| [`pages/kombainer`](pages/kombainer) | экраны комбайнера: создание талона, QR-код для передачи, экспорт |
| [`pages/voditel`](pages/voditel) | экраны водителя: сканирование QR, рейсы, реестр талонов, передача на весовую |
| [`pages/admin`](pages/admin) | панель администратора: статистика БД, бэкап, экспорт и очистка данных |
| [`wifi`](wifi) | TCP-сервер и клиент (`react-native-tcp-socket`), обработка входящих сообщений |
| [`services`](services) | `ConnectionManager`, `MessageHandler` — протокол сообщений и управление hotspot |
| [`db`](db) | SQLite: пользователи, комбайны, водители, талоны, миграции ([`migrations.ts`](db/migrations.ts)) |
| [`stores`](stores), [`hooks`](hooks), [`components`](components), [`views`](views) | состояние авторизации, хуки, общие UI-компоненты |
| [`android/app/src/main/java/com/talonkombainera`](android/app/src/main/java/com/talonkombainera) | нативные модули на Kotlin: `LocalOnlyHotspot`, подключение через `WifiNetworkSpecifier` |
| [`docs`](docs) | описание статусов талона и прочие заметки |

## Передача талона между телефонами

1. Телефон комбайнера включает `LocalOnlyHotspot`, запускает TCP-сервер на случайном порту и
   показывает QR-код с SSID, паролем, IP и портом.
2. Телефон водителя сканирует QR (`react-native-vision-camera`), подключается к точке доступа
   через `WifiNetworkSpecifier` (без доступа в интернет) и открывает TCP-соединение.
3. Стороны обмениваются JSON-сообщениями: данные водителя, назначение и подпись талона.

## Запуск

Нужны Node.js ≥ 18, JDK 17+ и Android SDK — см.
[настройку окружения React Native](https://reactnative.dev/docs/set-up-your-environment).

```sh
npm install
npm start          # Metro
npm run android    # сборка и установка на подключённое устройство
```

Для проверки обмена нужны два реальных устройства на Android 10+ (`minSdkVersion 29`) с
включённой геолокацией: без неё Android не даёт запустить точку доступа.

## Проверки

```sh
npm run typecheck  # tsc --noEmit
npm run lint
npm test           # jest
```

Release-сборка APK: `npm run build:android` (Linux/macOS) или `npm run build:android:win`.
