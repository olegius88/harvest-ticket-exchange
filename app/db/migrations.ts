// Файл: app/db/migrations.ts
import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Миграция для версии 8: добавляем столбцы created_at и updated_at для таблиц users и configs.
const migrationTo8 = {
  toVersion: 8,
  steps: [
    addColumns({
      table: 'users',
      columns: [
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    addColumns({
      table: 'configs',
      columns: [
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
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
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
};

// Миграция для версии 10: создаём новую таблицу водителей (voditeli).
const migrationTo10 = {
  toVersion: 10,
  steps: [
    createTable({
      name: 'voditeli',
      columns: [
        { name: 'userId', type: 'string' },
        { name: 'transport', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
};

// Миграция для версии 11: создаём новую таблицу талонов комбайнера (talons_of_combainers).
const migrationTo11 = {
  toVersion: 11,
  steps: [
    createTable({
      name: 'talons_of_combainers',
      columns: [
        { name: 'kombainerId', type: 'string' },
        { name: 'voditelId', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'startTime', type: 'number' },
        { name: 'endTime', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'comment', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
};

// Миграция для версии 12: добавляем поле talonNumber в таблицу talons_of_combainers.
const migrationTo12 = {
  toVersion: 12,
  steps: [
    addColumns({
      table: 'talons_of_combainers',
      columns: [{ name: 'talonNumber', type: 'string' }],
    }),
  ],
};

// Миграция для версии 13: добавляем поле cancellationReason в таблицу talons_of_combainers.
const migrationTo13 = {
  toVersion: 13,
  steps: [
    addColumns({
      table: 'talons_of_combainers',
      columns: [{ name: 'cancellationReason', type: 'string' }],
    }),
  ],
};

// Миграция для версии 14: добавляем столбец from_remote в таблицу users.
const migrationTo14 = {
  toVersion: 14,
  steps: [
    addColumns({
      table: 'users',
      columns: [{ name: 'from_remote', type: 'boolean' }],
    }),
  ],
};

// Миграция для версии 15: добавляем столбец from_remote в таблицу voditeli.
const migrationTo15 = {
  toVersion: 15,
  steps: [
    addColumns({
      table: 'voditeli',
      columns: [{ name: 'from_remote', type: 'boolean' }],
    }),
  ],
};

export const schemaVersion = 15;
export const migrations = schemaMigrations({
  migrations: [
    migrationTo8,
    migrationTo9,
    migrationTo10,
    migrationTo11,
    migrationTo12,
    migrationTo13,
    migrationTo14,
    migrationTo15,
  ],
});
