# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## 2026-10-08

### Added

- [README.md](README.md) — описание проекта, схема обмена талонами, стек и инструкции по запуску.
- [LICENSE](LICENSE) — GPL-3.0 (desktop-часть основана на Flying Carpet, распространяемом под GPL-3.0).

### Changed

- Репозиторий подготовлен к публикации: из истории удалены IDE-настройки (`.idea/`), локальные
  `.env`-файлы, служебные заметки (`_t/`), собранные source map'ы, бинарник `rustup-init.exe` и
  посторонние конфигурации, а также устаревший веб-фронт (`front/`, `TalonKombainera-react/`) и его
  собранный бандл `app/android/app/src/main/assets/web/`, которые в текущей версии не используются; [.gitignore](.gitignore) дополнен, чтобы они не возвращались.
