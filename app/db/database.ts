// database.ts
import { appSchema, Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Users } from './users';
import { Configs } from './configs';
import migrations from './migrations';

const schema = appSchema({
  version: 3,
  tables: [Users.tableSchema, Configs.tableSchema],
});

const adapter = new SQLiteAdapter({ schema, migrations });

export const database = new Database({
  adapter,
  modelClasses: [Users, Configs],
});

export { Users, Configs };
