# Весовщик - Desktop приложение

Современное desktop приложение на базе SvelteKit + Tauri + TailwindCSS.

## 🚀 Быстрый старт

```bash
# Разработка
npm run tauri:dev

# Сборка с новой версией
npm run build:desktop
```

## 📋 Доступные команды

### Разработка

```bash
npm run dev              # Запуск SvelteKit в режиме разработки
npm run tauri:dev        # Запуск Tauri desktop приложения в режиме разработки
```

### Сборка

```bash
npm run build:desktop         # Полная сборка с инкрементом версии + открытие папки
npm run build:desktop:quick   # Быстрая сборка без инкремента версии + открытие папки
npm run build                 # Сборка только frontend (SvelteKit)
npm run tauri:build           # Сборка только desktop приложения (Tauri)
```

### Управление версиями

```bash
npm run version:bump     # Увеличение версии на +1 в package.json и tauri.conf.json
npm run version:show     # Показать текущую версию и статус сборки
```

### Утилиты

```bash
npm run build:info       # Показать информацию о последней сборке
npm run open:bundle      # Открыть папку с результатами сборки в проводнике
npm run check            # Проверка TypeScript типов
npm run check:watch      # Проверка типов в режиме отслеживания изменений
```

## 📁 Структура проекта

```text
├── src/
│   ├── routes/
│   │   ├── +layout.svelte      # Главный layout
│   │   ├── +layout.ts          # Конфигурация SPA режима
│   │   └── +page.svelte        # Главная страница приложения
│   ├── lib/
│   │   └── components/
│   │       ├── Login.svelte        # Компонент входа
│   │       ├── Registration.svelte # Компонент регистрации
│   │       ├── Dashboard.svelte    # Главный дашборд
│   │       └── LogPanel.svelte     # Панель логов
│   ├── app.css             # Глобальные стили с TailwindCSS
│   └── app.html            # HTML template
├── src-tauri/              # Rust backend для desktop
├── scripts/                # Утилиты для сборки
│   ├── increment-version.cjs   # Автоинкремент версии
│   ├── build-info.cjs          # Информация о сборке
│   └── open-bundle-dir.cjs     # Открытие папки с результатами
└── static/                 # Статические файлы
```

## ⚡ Особенности

### SPA режим

- Отключен SSR (Server-Side Rendering) для упрощения desktop разработки
- Все код выполняется в браузере/webview
- localStorage доступен без дополнительных проверок

### Автоматическое управление версиями

- Команда `build:desktop` автоматически увеличивает версию
- Версия синхронизируется между package.json и tauri.conf.json
- После сборки автоматически открывается папка с результатами

### Результаты сборки

Готовые файлы находятся в:

```text
src-tauri/target/release/bundle/
├── msi/                    # Windows installer
└── nsis/                   # NSIS installer (если настроен)
```

## 🛠 Технологический стек

- **Frontend**: SvelteKit + TailwindCSS + TypeScript
- **Desktop**: Tauri 2.0 (Rust)
- **Build**: Vite + PostCSS
- **UI**: Component-based architecture
- **State**: Reactive stores (Svelte)

## 💻 Разработка

1. Для быстрой разработки UI используйте `npm run tauri:dev`
2. Изменения в SvelteKit коде применяются мгновенно (HMR)
3. Изменения в Rust коде требуют перекомпиляции
4. Логи приложения отображаются в развернутой панели внизу

## 🏗 Сборка для production

```bash
# Полная сборка с новой версией
npm run build:desktop

# Или быстрая сборка без изменения версии
npm run build:desktop:quick
```

После сборки автоматически откроется папка с готовыми установочными файлами.

## 📋 Примеры использования

```bash
# Проверить текущую версию
npm run version:show

# Увеличить версию на 1
npm run version:bump

# Разработка с hot reload
npm run tauri:dev

# Полная сборка
npm run build:desktop
```
