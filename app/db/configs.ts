// app/db/configs.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { IConfigParams, IGetConfigParam } from '../../global';

export interface IConfigsParams extends Model, IConfigParams {
  id: string;
  created_at: number;
  updated_at: number;
}

export class Configs extends Model {
  static table = 'configs';

  @field('key') key!: string;
  @field('value') value!: string;
  @field('created_at') created_at!: number;
  @field('updated_at') updated_at!: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    });
  }

  static validateFields(fields: Partial<IConfigParams>) {
    const missingFields: string[] = [];
    if (!fields.key) missingFields.push('key');
    if (!fields.value) missingFields.push('value');

    if (missingFields.length > 0) {
      throw new Error(`Validation Error: Missing required fields: ${missingFields.join(', ')}`);
    }
  }
}

/**
 * Функция setConfig: если запись с заданным ключом существует, обновляет её (обновляя updated_at),
 * иначе создаёт новую (с установкой created_at и updated_at).
 */
export async function setConfig({ key, value }: IConfigParams): Promise<string> {
  Configs.validateFields({ key, value });
  return database.write(async () => {
    const collection = database.collections.get<IConfigsParams>(Configs.table);
    const now = Date.now();
    const existingConfigs = await collection.query(Q.where('key', key)).fetch();

    if (existingConfigs.length > 0) {
      const configToUpdate = existingConfigs[0];
      await configToUpdate.update((config) => {
        config.value = value;
        config.updated_at = now;
      });
      return configToUpdate.id;
    } else {
      const newConfig = await collection.create((config) => {
        config._raw.id = uuid.v4();
        config.key = key;
        config.value = value;
        config.created_at = now;
        config.updated_at = now;
      });
      return newConfig.id;
    }
  });
}

/**
 * Функция getConfig ищет конфигурацию по ключу и возвращает её значение.
 * Если конфигурация не найдена, возвращает null.
 */
export async function getConfig(key: IGetConfigParam['key']): Promise<string | null> {
  return database.read(async () => {
    const collection = database.collections.get<IConfigsParams>(Configs.table);
    const existingConfigs = await collection.query(Q.where('key', key)).fetch();
    if (existingConfigs.length > 0) {
      return existingConfigs[0].value;
    }
    return null;
  });
}
