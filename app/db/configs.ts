// configs.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { IGetConfigParam } from '../../global';

/**
 * Интерфейс, описывающий параметры для установки конфигурации
 */
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

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
      ],
    });
  }

  /**
   * Статический метод для проверки обязательных полей.
   * Если какое-либо поле отсутствует, выбрасывается ошибка.
   */
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
 * Функция setConfig проверяет наличие записи конфигурации по заданному ключу.
 * Если запись существует, она обновляется, иначе создаётся новая.
 */
export async function setConfig({ key, value }: IConfigParams): Promise<string> {
  // Выполняем валидацию входных параметров через модель Configs
  Configs.validateFields({ key, value });

  return database.write(async () => {
    const collection = database.collections.get<Model>(Configs.table);
    // Ищем существующую запись с указанным ключом
    const existingConfigs = await collection.query(Q.where('key', key)).fetch();

    if (existingConfigs.length > 0) {
      // Если запись существует, обновляем её значение
      const configToUpdate = existingConfigs[0];
      await configToUpdate.update((config) => {
        // @ts-ignore
        config.value = value;
      });
      return configToUpdate.id;
    } else {
      // Если записи нет, создаём новую
      const newConfig = await collection.create((config) => {
        config._raw.id = uuid.v4();
        // @ts-ignore
        config.key = key;
        // @ts-ignore
        config.value = value;
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
      // Возвращаем значение первой найденной записи
      return existingConfigs[0].value;
    }
    return null;
  });
}
