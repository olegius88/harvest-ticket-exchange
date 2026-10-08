# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## 2026-10-08 (3)

### Fixed

- Кнопка «Просмотреть» после взвешивания в
  [VoditelTicketDetailAfterSetWeight.tsx](app/pages/voditel/VoditelTicketDetailAfterSetWeight.tsx) вела на
  несуществующий экран `VoditelTicketDetailAfterWeighingScreen`; теперь остаётся на экране талона с
  обновлёнными данными. Регрессионный тест:
  [navigationRoutes.test.ts](app/__tests__/navigationRoutes.test.ts) — все цели `navigate()` должны быть
  зарегистрированы в `App.tsx`.

### Removed

- Скрипты `start:dev` / `start:dev:nout` (требовали локальных `.env.dev*`) и тип `API_URL`;
  задачи VS Code, [Documentation.md](app/docs/Documentation.md) и
  [copilot-instructions.md](.github/copilot-instructions.md) переведены на `npm start`.

## 2026-10-08 (2)

### Changed

- [app/README.md](app/README.md) — вместо шаблона React Native: структура приложения, схема передачи
  талона между телефонами, запуск и проверки.
- [desktop/docs/README.md](desktop/docs/README.md) — вместо копии README Flying Carpet: описание
  desktop-приложения весовой, приём талонов по TCP/QR, структура и запуск.
- [README.md](README.md) — уточнено, что на весовой телефон подключается к её локальной Wi-Fi сети.

### Removed

- Закомментированная функция `joinHotspo22222t` в
  [MainWifi.kt](app/android/app/src/main/java/com/talonkombainera/MainWifi.kt) (дубль `joinHotspot`).
- Неиспользуемая переменная `url` в [App.tsx](app/App.tsx): указывала на удалённый веб-бандл
  `assets/web/index.html` и только писалась в лог.

## 2026-10-08

### Added

- [README.md](README.md) — описание проекта, схема обмена талонами, стек и инструкции по запуску.
- [LICENSE](LICENSE) — GPL-3.0 (desktop-часть основана на Flying Carpet, распространяемом под GPL-3.0).

### Changed

- Репозиторий подготовлен к публикации: из истории удалены IDE-настройки (`.idea/`), локальные
  `.env`-файлы, служебные заметки (`_t/`), собранные source map'ы, бинарник `rustup-init.exe` и
  посторонние конфигурации, а также устаревший веб-фронт (`front/`, `TalonKombainera-react/`) и его
  собранный бандл `app/android/app/src/main/assets/web/`, которые в текущей версии не используются; [.gitignore](.gitignore) дополнен, чтобы они не возвращались.
