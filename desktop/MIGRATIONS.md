# Система миграций TalonKombaineraV3

Этот проект использует систему миграций для безопасного обновления схемы базы данных на обеих платформах.

## Архитектура

### Desktop (Rust)
- **Файл**: `desktop/core/talon-db/src/lib.rs`
- **Миграции**: Константа `MIGRATIONS`
- **Применение**: Автоматически при запуске
- **Управление**: Web-интерфейс `/migrations.html`

### Android (TypeScript)
- **Файл**: `app/db/migrations.ts`
- **Миграции**: Массив `migrations`
- **Применение**: Автоматически при запуске приложения

## Добавление новой миграции

### 1. Определите номер версии
Выберите следующий номер версии (например, если последняя миграция имеет версию 2, используйте 3).

### 2. Создайте миграцию в Desktop (Rust)
```rust
// В desktop/core/talon-db/src/lib.rs
Migration {
    version: 3,
    description: "Add new column to users",
    up_sql: "ALTER TABLE users ADD COLUMN new_field TEXT DEFAULT ''",
    down_sql: Some("ALTER TABLE users DROP COLUMN new_field"),
},
```

### 3. Создайте миграцию в Android (TypeScript)
```typescript
// В app/db/migrations.ts
{
  version: 3,
  description: "Add new column to users",
  up: (db: SQLiteDatabase) => {
    db.executeSql("ALTER TABLE users ADD COLUMN new_field TEXT DEFAULT ''");
  },
  down: (db: SQLiteDatabase) => {
    db.executeSql("ALTER TABLE users DROP COLUMN new_field");
  }
}
```

### 4. Проверьте совместимость типов данных

| Rust | TypeScript | SQLite | Описание |
|------|------------|---------|----------|
| `bool` | `boolean` | `INTEGER` | 0/1 значения |
| `String` | `string` | `TEXT` | Строки |
| `DateTime<Utc>` | `Date` | `TEXT` | RFC3339 формат |
| `i32/i64` | `number` | `INTEGER` | Числа |

## Команды управления

### Desktop
- `get_applied_migrations` - получить примененные миграции
- `get_pending_migrations` - получить ожидающие миграции
- `rollback_migration(version)` - откатить к версии

### Web-интерфейс
Откройте `/migrations.html` в desktop приложении для:
- Просмотра статуса миграций
- Выполнения отката
- Мониторинга процесса

## Лучшие практики

1. **Всегда создавайте миграции для обеих платформ**
2. **Используйте одинаковые номера версий**
3. **Тестируйте на обеих платформах**
4. **Предусматривайте откат для критических изменений**
5. **Документируйте изменения схемы**
6. **Не изменяйте существующие миграции**

## Отладка

### Desktop
Логи миграций выводятся в консоль при запуске:
```
Applying migration 1: Create users table
Applying migration 2: Create indexes for users table
```

### Android
Проверьте логи React Native для информации о применении миграций.

## Список миграций

### Версия 1: Создание таблицы users
- **Описание**: Базовая таблица пользователей
- **Таблицы**: `users`
- **Поля**: id, fio, phone, position, password_hash, created_at, updated_at, from_remote

### Версия 2: Индексы для таблицы users
- **Описание**: Создание индексов для оптимизации запросов
- **Индексы**: `idx_users_phone`, `idx_users_position`

### Версия 3: Создание таблицы kombainers
- **Описание**: Таблица комбайнеров
- **Таблицы**: `kombainers`
- **Поля**: id, user_id, combine, brigade, culture, field, created_at, updated_at
- **Связи**: FOREIGN KEY (user_id) REFERENCES users(id)

### Версия 4: Создание таблицы voditeli
- **Описание**: Таблица водителей
- **Таблицы**: `voditeli`
- **Поля**: id, user_id, transport, created_at, updated_at, from_remote
- **Связи**: FOREIGN KEY (user_id) REFERENCES users(id)

### Версия 5: Создание таблицы talons_of_combainers
- **Описание**: Основная таблица талонов комбайнеров
- **Таблицы**: `talons_of_combainers`
- **Поля**:
  - id, kombainer_id, kombainer_data, kombainer_user_data
  - voditel_id, voditel_user_id, voditel_data, voditel_user_data
  - status, start_time, end_time, weight, comment, talon_number
  - cancellation_reason, created_at, updated_at
- **Связи**:
  - FOREIGN KEY (kombainer_id) REFERENCES kombainers(id)
  - FOREIGN KEY (voditel_id) REFERENCES voditeli(id)

### Версия 6: Индексы для связанных таблиц
- **Описание**: Создание индексов для оптимизации запросов
- **Индексы**:
  - `idx_kombainers_user_id`
  - `idx_voditeli_user_id`
  - `idx_talons_kombainer_id`
  - `idx_talons_voditel_id`
  - `idx_talons_status`
  - `idx_talons_talon_number`
  - `idx_talons_created_at`

## Соответствие с Android версиями

| Desktop | Android | Описание |
|---------|---------|----------|
| v1 | v8+ | Таблица users с временными метками |
| v3 | v9 | Таблица kombainers |
| v4 | v10 | Таблица voditeli |
| v5 | v11-18 | Таблица talons_of_combainers (постепенное добавление полей) |

**Примечание**: Android версии 11-18 постепенно добавляли поля в таблицу талонов. Desktop версия 5 создает всю таблицу сразу со всеми необходимыми полями.

## Структура схемы

### Таблица schema_migrations
```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL
);
```

Эта таблица автоматически создается и используется для отслеживания примененных миграций.
