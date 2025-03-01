// kombainer.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/**
 * Интерфейс для полей в таблице kombainer
 */
export interface ICreateKombainerParams {
  combine: string; // "комбайн"
  brigade: string; // "бригада"
  culture: string; // "культура"
  field: string; // "поле"
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Класс Kombainer и описание схемы WatermelonDB
 */
export class Kombainer extends Model {
  static table = 'kombainer';

  // @ts-ignore
  @field('combine') combine!: string; // "комбайн"
  // @ts-ignore
  @field('brigade') brigade!: string; // "бригада"
  // @ts-ignore
  @field('culture') culture!: string; // "культура"
  // @ts-ignore
  @field('field') field!: string; // "поле"
  // @ts-ignore
  @field('createdAt') createdAt!: number;
  // @ts-ignore
  @field('updatedAt') updatedAt!: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'combine', type: 'string' },
        { name: 'brigade', type: 'string' },
        { name: 'culture', type: 'string' },
        { name: 'field', type: 'string' },
        { name: 'createdAt', type: 'number' },
        { name: 'updatedAt', type: 'number' },
      ],
    });
  }

  /**
   * Проверка обязательных полей.
   */
  static validateFields(fields: Partial<ICreateKombainerParams>) {
    const missingFields: string[] = [];
    if (!fields.combine) missingFields.push('combine');
    if (!fields.brigade) missingFields.push('brigade');
    if (!fields.culture) missingFields.push('culture');
    if (!fields.field) missingFields.push('field');

    if (missingFields.length > 0) {
      throw new Error(`Validation Error: Missing required fields: ${missingFields.join(', ')}`);
    }
  }
}

/**
 * Создание записи в таблице "kombainer".
 */
export async function createKombainer({
  combine,
  brigade,
  culture,
  field,
}: ICreateKombainerParams): Promise<string> {
  // Валидация входных данных
  Kombainer.validateFields({ combine, brigade, culture, field });
  return database.write(async () => {
    const collection = database.collections.get<Model>(Kombainer.table);
    const now = Date.now();
    const newKombainer = await collection.create((record) => {
      // @ts-ignore
      record._raw.id = uuid.v4();
      // @ts-ignore
      record.combine = combine.trim();
      // @ts-ignore
      record.brigade = brigade.trim();
      // @ts-ignore
      record.culture = culture.trim();
      // @ts-ignore
      record.field = field.trim();
      // @ts-ignore
      record.createdAt = now;
      // @ts-ignore
      record.updatedAt = now;
    });
    return newKombainer.id;
  });
}

/**
 * Получить все записи из таблицы "kombainer".
 */
export async function getAllKombainers(): Promise<ICreateKombainerParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<Model>(Kombainer.table);
    return await collection.query().fetch();
  });
}

/**
 * Получить конкретную запись "kombainer" по ID.
 */
export async function getKombainerById(
  kombainerId: string
): Promise<ICreateKombainerParams | null> {
  return database.read(async () => {
    const collection = database.collections.get<Model>(Kombainer.table);
    const record = await collection.find(kombainerId).catch(() => null);

    if (!record) {
      return null;
    }

    return record;
  });
}
