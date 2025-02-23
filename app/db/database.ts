// database.ts
import { appSchema, Database, tableSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Users } from './users';

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'fio', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'position', type: 'string' },
        { name: 'password', type: 'string' },
      ],
    }),
  ],
});

const adapter = new SQLiteAdapter({ schema });

/**
 * И это — наш единственный экземпляр базы
 */
export const database = new Database({
  adapter,
  modelClasses: [Users],
});

// Экспортируем модель Users для использования в других файлах
export { Users };
