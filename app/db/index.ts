import { appSchema, Database, Model, tableSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { field, readonly } from '@nozbe/watermelondb/decorators';
import { v4 as uuidv4 } from 'uuid';

export const UserColumns = {
  name: 'name',
  login: 'login',
  email: 'email',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

export const ConfigsColumns = {
  name: 'name',
  valueString: 'valueString',
  valueInt: 'valueInt',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

export interface IUsers {
  id: string;
  name: string;
  login: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

export interface IConfigs {
  id: string;
  name: string;
  valueString: string;
  valueInt: number;
  createdAt: number;
  updatedAt: number;
}

export class Users extends Model implements IUsers {
  static table = 'users';

  // Поле id уже задаётся базовым классом Model (автоматически, но мы можем его переопределить при создании записи)
  // declare readonly id: string;

  @field(UserColumns.name) name!: string;
  @field(UserColumns.login) login!: string;
  @field(UserColumns.email) email!: string;
  @readonly @field(UserColumns.createdAt) createdAt!: number;
  @readonly @field(UserColumns.updatedAt) updatedAt!: number;
}

export class Configs extends Model implements IConfigs {
  static table = 'configs';

  @field(ConfigsColumns.name) name!: string;
  @field(ConfigsColumns.valueString) valueString!: string;
  @field(ConfigsColumns.valueInt) valueInt!: number;
  @readonly @field(ConfigsColumns.createdAt) createdAt!: number;
  @readonly @field(ConfigsColumns.updatedAt) updatedAt!: number;
}

// ====================================================================
// Определяем схему таблицы для пользователей
// ====================================================================
const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        // Обратите внимание, что поле id не указываем — оно создаётся автоматически
        { name: UserColumns.name, type: 'string' },
        { name: UserColumns.login, type: 'string' },
        { name: UserColumns.email, type: 'string', isOptional: true },
        { name: UserColumns.createdAt, type: 'number' },
        { name: UserColumns.updatedAt, type: 'number' },
      ],
    }),
    tableSchema({
      name: 'configs',
      columns: [
        // Обратите внимание, что поле id не указываем — оно создаётся автоматически
        { name: ConfigsColumns.name, type: 'string' },
        { name: ConfigsColumns.valueString, type: 'string', isOptional: true },
        { name: ConfigsColumns.valueInt, type: 'number', isOptional: true },
        { name: ConfigsColumns.createdAt, type: 'number' },
        { name: ConfigsColumns.updatedAt, type: 'number' },
      ],
    }),
  ],
});

// ====================================================================
// Инициализация адаптера и базы данных
// ====================================================================
const adapter = new SQLiteAdapter({
  schema,
  dbName: 'MyAppDatabase',
});

export const database = new Database({
  adapter,
  modelClasses: [Users],
});

// ====================================================================
// Пример CRUD-операции: создание пользователя с использованием UUID для id
// ====================================================================
export async function createUser(name: string, login: string, email: string) {
  await database.action(async () => {
    await database.collections.get('users').create((user) => {
      // Задаём id, сгенерированный через uuid
      user._raw.id = uuidv4();
      user.name = name;
      user.login = login;
      user.email = email;
      user.createdAt = Date.now();
      user.updatedAt = Date.now();
    });
  });
}
