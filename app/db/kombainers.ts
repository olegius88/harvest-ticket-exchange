// Файл: app/db/kombainers.ts

import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateKombainerParams, IEditKombainerParams } from '../../global';

/**
 * Интерфейс для полей в таблице kombainers
 */
export interface ICreateKombainersParams extends Model, ICreateKombainerParams {
  readonly id: string;
  created_at: number;
  updated_at: number;
}

/**
 * Класс Kombainers и описание схемы WatermelonDB
 */
export class Kombainers extends Model {
  static table = 'kombainers';

  @field('userId') userId: string;
  @field('combine') combine: string;
  @field('brigade') brigade: string;
  @field('culture') culture: string;
  @field('field') field: string;
  @field('created_at') created_at: number;
  @field('updated_at') updated_at: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'userId', type: 'string' },
        { name: 'combine', type: 'string' },
        { name: 'brigade', type: 'string' },
        { name: 'culture', type: 'string' },
        { name: 'field', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    });
  }

  /**
   * Проверка обязательных полей.
   */
  static validateFields(fields: Partial<ICreateKombainerParams>) {
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
}: ICreateKombainerParams): Promise<string> {
  // Валидация входных данных
  Kombainers.validateFields({ userId, combine, brigade, culture, field });
  return database.write(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    const now = Date.now();
    const newKombainer = await collection.create((record) => {
      record._raw.id = uuid.v4();
      record.userId = userId.trim();
      record.combine = combine.trim();
      record.brigade = brigade.trim();
      record.culture = culture.trim();
      record.field = field.trim();
      record.created_at = now;
      record.updated_at = now;
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
export async function getKombainerById(kombainerId: string): Promise<ICreateKombainersParams> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    const record = await collection.find(kombainerId);

    if (!record) {
      throw new Error(`Комбайнер с ID ${kombainerId} не найден.`);
    }

    // Возвращаем чистый объект без лишних циклических ссылок и методов WatermelonDB
    return {
      id: record.id,
      userId: record.userId,
      combine: record.combine,
      brigade: record.brigade,
      culture: record.culture,
      field: record.field,
      created_at: record.created_at,
      updated_at: record.updated_at,
    } as ICreateKombainersParams;
  });
}

/**
 * Получить запись для конкретного userId.
 */
export async function getKombainerByUserId(userId: string): Promise<ICreateKombainersParams> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    const results = await collection.query(Q.where('userId', userId)).fetch();
    const res = results.map((record) => ({
      id: record.id,
      userId: record.userId,
      combine: record.combine,
      brigade: record.brigade,
      culture: record.culture,
      field: record.field,
      created_at: record.created_at,
      updated_at: record.updated_at,
    })) as ICreateKombainersParams[];

    return res.length > 0 ? res[0] : null;
  });
}

/**
 * Обновление данных комбайнера через вызов метода updateField.
 */
export async function editKombainer({
  kombainerId,
  userId,
  combine,
  brigade,
  culture,
  field,
}: IEditKombainerParams): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<ICreateKombainersParams>(Kombainers.table);
    const record = await collection.find(kombainerId);
    const now = Date.now();
    await record.update((r) => {
      r.userId = userId.trim();
      r.combine = combine.trim();
      r.brigade = brigade.trim();
      r.culture = culture.trim();
      r.field = field.trim();
      r.updated_at = now;
    });
    return record.id;
  });
}
