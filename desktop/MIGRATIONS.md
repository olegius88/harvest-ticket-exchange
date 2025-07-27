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
