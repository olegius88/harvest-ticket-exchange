// configs.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { IGetConfigParam } from '../../global';

export interface IConfigParams {
  key: string;
  value: string;
}

export class Configs extends Model {
  static table = 'configs';

  // @ts-ignore
  @field('key') key!: string;
  // @ts-ignore
  @field('value') value!: string;
  // @ts-ignore
  @field('createdAt') createdAt!: number;
  // @ts-ignore
  @field('updatedAt') updatedAt!: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
        { name: 'createdAt', type: 'number' },
        { name: 'updatedAt', type: 'number' },
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
 * Функция setConfig: если запись с заданным ключом существует, обновляет её (обновляя updatedAt),
 * иначе создаёт новую (с установкой createdAt и updatedAt).
 */
export async function setConfig({ key, value }: IConfigParams): Promise<string> {
  Configs.validateFields({ key, value });
  return database.write(async () => {
    const collection = database.collections.get<Model>(Configs.table);
    const now = Date.now();
    const existingConfigs = await collection.query(Q.where('key', key)).fetch();

    if (existingConfigs.length > 0) {
      const configToUpdate = existingConfigs[0];
      await configToUpdate.update((config) => {
        // @ts-ignore
        config.value = value;
        // @ts-ignore
        config.updatedAt = now;
      });
      return configToUpdate.id;
    } else {
      const newConfig = await collection.create((config) => {
        config._raw.id = uuid.v4();
        // @ts-ignore
        config.key = key;
        // @ts-ignore
        config.value = value;
        // @ts-ignore
        config.createdAt = now;
        // @ts-ignore
        config.updatedAt = now;
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
    const collection = database.collections.get<Model>(Configs.table);
    const existingConfigs = (await collection
      .query(Q.where('key', key))
      .fetch()) as unknown as IConfigParams[];
    if (existingConfigs.length > 0) {
      return existingConfigs[0].value;
    }
    return null;
  });
}
