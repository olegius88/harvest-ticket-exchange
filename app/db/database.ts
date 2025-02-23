// database.ts
import { appSchema, Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Users } from './users';
import { Configs } from './configs';
import { migrations, schemaVersion } from './migrations';

const schema = appSchema({
  version: schemaVersion,
  tables: [Users.tableSchema, Configs.tableSchema],
});

const adapter = new SQLiteAdapter({ schema, migrations });

export const database = new Database({
  adapter,
  modelClasses: [Users, Configs],
});

export { Users, Configs };
