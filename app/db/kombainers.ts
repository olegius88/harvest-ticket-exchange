// kombainers.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateKombainerParams } from '../../global';

/**
 * Интерфейс для полей в таблице kombainers
 */
export interface ICreateKombainersParams extends Model, ICreateKombainerParams {
  id: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Класс Kombainer и описание схемы WatermelonDB
 */
export class Kombainers extends Model {
  static table = 'kombainers';

  // @ts-ignore
  @field('userId') userId!: string;
  // @ts-ignore
  @field('combine') combine!: string;
  // @ts-ignore
  @field('brigade') brigade!: string;
  // @ts-ignore
  @field('culture') culture!: string;
  // @ts-ignore
  @field('field') field!: string;
  // @ts-ignore
  @field('createdAt') createdAt!: number;
  // @ts-ignore
  @field('updatedAt') updatedAt!: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'userId', type: 'string' },
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
  static validateFields(fields: Partial<ICreateKombainersParams>) {
    const missingFields: string[] = [];
    if (!fields.userId) missingFields.push('userId');
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
  userId,
  combine,
  brigade,
  culture,
  field,
}: ICreateKombainersParams): Promise<string> {
  // Валидация входных данных
  Kombainers.validateFields({ userId, combine, brigade, culture, field });
  return database.write(async () => {
    const collection = database.collections.get<Model>(Kombainers.table);
    const now = Date.now();
    const newKombainer = await collection.create((record) => {
      // @ts-ignore
      record._raw.id = uuid.v4();
      // @ts-ignore
      record.userId = userId.trim();
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
export async function getAllKombainers(): Promise<ICreateKombainersParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    return await collection.query().fetch();
  });
}

/**
 * Получить конкретную запись "kombainer" по ID.
 */
export async function getKombainerById(
  kombainerId: string
): Promise<ICreateKombainersParams | null> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    const record = await collection.find(kombainerId).catch(() => null);

    if (!record) {
      return null;
    }

    return record;
  });
}

/**
 * Получить все записи для конкретного userId.
 */
export async function getKombainerByUserId(userId: string): Promise<ICreateKombainersParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    const results = await collection.query(Q.where('userId', userId)).fetch();
    return results;
  });
}
