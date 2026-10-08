# Desktop-приложение весовой

Приложение для ПК на весовой: принимает талоны с телефонов водителей и хранит их в локальной
базе SQLite. Статус — в разработке.

Построено на основе [Flying Carpet](https://github.com/spieglt/FlyingCarpet) (Theron Spiegl,
GPL-3.0): из него взяты Tauri-оболочка и сетевое ядро (`core/`: Wi-Fi hotspot, Bluetooth,
передача данных). Код hotspot сохранён, но в текущей схеме не используется: ПК и телефоны
работают во внутренней Wi-Fi сети весовой.

## Как принимаются талоны

1. Весовщик входит в приложение (учётные записи в SQLite, пароли — bcrypt).
2. Приложение поднимает TCP-сервер на свободном порту и показывает QR-код
   `{ "ip", "port", "auth_code" }`; `auth_code` — 8 символов UUID, новый при каждом запуске сервера.
3. Водитель в Android-приложении сканирует QR и отправляет талон по TCP.
4. Сервер проверяет код и сохраняет талон в базу.

Tauri-команды: `start_talon_tcp_server`, `stop_talon_tcp_server`, `get_talon_tcp_server_info`,
`get_all_talons`, `register_vesovschik` / `login_vesovschik`, миграции —
`get_applied_migrations`, `get_pending_migrations`, `rollback_migration`
([`Flying Carpet/src-tauri/src/main.rs`](../Flying%20Carpet/src-tauri/src/main.rs)).

## Структура

| Путь | Назначение |
|------|------------|
| [`Flying Carpet/src-tauri`](../Flying%20Carpet/src-tauri) | Tauri 2 backend: команды, TCP-сервер приёма талонов |
| [`Flying Carpet/src`](../Flying%20Carpet/src) | интерфейс на SvelteKit + Svelte 5 + Tailwind CSS |
| [`core`](../core) | сетевое ядро из Flying Carpet (Windows / Linux) |
| [`core/talon-db`](../core/talon-db) | SQLite-слой и миграции, синхронные с Android ([`MIGRATIONS.md`](../MIGRATIONS.md)) |

## Запуск

Нужны [Rust](https://www.rust-lang.org/tools/install), Node.js и
[зависимости Tauri](https://tauri.app/start/prerequisites/).

```sh
cd "desktop/Flying Carpet"
npm install
cargo tauri dev
```

## Другие документы

- [VESOVSCHIK_MODULE.md](VESOVSCHIK_MODULE.md) — модуль весовщика
- [INTEGRATION.md](INTEGRATION.md) — ранняя схема интеграции с Android (через hotspot ПК)
- [WiFi_2_4GHz_Implementation.md](WiFi_2_4GHz_Implementation.md) — настройка hotspot 2.4 ГГц на Windows
- [SUMMARY.md](SUMMARY.md), [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) — сводки изменений

## Лицензия

GPL-3.0, как и у Flying Carpet: [`../LICENSE.txt`](../LICENSE.txt).
