// migrations.ts
import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Миграция для версии 8: добавляем столбцы createdAt и updatedAt для таблиц users и configs.
const migrationTo8 = {
  toVersion: 8,
  steps: [
    addColumns({
      table: 'users',
      columns: [
        { name: 'createdAt', type: 'number' },
        { name: 'updatedAt', type: 'number' },
      ],
    }),
    addColumns({
      table: 'configs',
      columns: [
        { name: 'createdAt', type: 'number' },
        { name: 'updatedAt', type: 'number' },
      ],
    }),
  ],
};

// Миграция для версии 9: создаём новую таблицу kombainers.
const migrationTo9 = {
  toVersion: 9,
  steps: [
    createTable({
      name: 'kombainers',
      columns: [
        { name: 'userId', type: 'string' },
        { name: 'combine', type: 'string' },
        { name: 'brigade', type: 'string' },
        { name: 'culture', type: 'string' },
        { name: 'field', type: 'string' },
        { name: 'createdAt', type: 'number' },
        { name: 'updatedAt', type: 'number' },
      ],
    }),
  ],
};

// Экспорт последней версии схемы и массива миграций.
export const schemaVersion = 9;
export const migrations = schemaMigrations({
  migrations: [migrationTo8, migrationTo9],
});
