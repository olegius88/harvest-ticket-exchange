// database.ts
import { appSchema, Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Users } from './users';
import { Configs } from './configs';

const schema = appSchema({
  version: 2,
  tables: [Users.tableSchema, Configs.tableSchema],
});

const adapter = new SQLiteAdapter({ schema });

/**
 * И это — наш единственный экземпляр базы
 */
export const database = new Database({
  adapter,
  modelClasses: [Users, Configs],
});

// Экспортируем модель Users для использования в других файлах
export { Users, Configs };
