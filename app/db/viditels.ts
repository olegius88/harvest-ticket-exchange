// Файл: app/db/viditels.ts

import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database';
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateVoditelParams, IEditVoditelParams } from '../../global';

/**
 * Интерфейс для полей в таблице водителей
 */
export interface ICreateVoditeliParams extends Model, ICreateVoditelParams {
  readonly id: string;
  created_at: number;
  updated_at: number;
}

/**
 * Класс Voditeli и описание схемы WatermelonDB
 */
export class Voditeli extends Model {
  static table = 'voditeli';

  @field('userId') userId: string;
  @field('transport') transport: string;
  @field('created_at') created_at: number;
  @field('updated_at') updated_at: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'userId', type: 'string' },
        { name: 'transport', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    });
  }

  /**
   * Проверка обязательных полей.
   */
  static validateFields(fields: Partial<ICreateVoditelParams>) {
    const missingFields: string[] = [];
    if (!fields.userId) missingFields.push('userId');
    if (!fields.transport) missingFields.push('transport');

    if (missingFields.length > 0) {
      throw new Error(`Validation Error: Missing required fields: ${missingFields.join(', ')}`);
    }
  }
}

/**
 * Создание записи в таблице "voditeli".
 */
export async function createVoditel({ userId, transport }: ICreateVoditelParams): Promise<string> {
  Voditeli.validateFields({ userId, transport });
  return database.write(async () => {
    const collection = database.collections.get<ICreateVoditeliParams>(Voditeli.table);
    const now = Date.now();
    const newVoditel = await collection.create((record) => {
      record._raw.id = uuid.v4();
      record.userId = userId.trim();
      record.transport = transport.trim();
      record.created_at = now;
      record.updated_at = now;
    });
    return newVoditel.id;
  });
}

/**
 * Получить все записи из таблицы "voditeli".
 */
export async function getAllVoditeli(): Promise<ICreateVoditeliParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateVoditeliParams>(Voditeli.table);
    return await collection.query().fetch();
  });
}

/**
 * Получить конкретную запись "voditeli" по ID.
 */
export async function getVoditelById(voditelId: string): Promise<ICreateVoditeliParams> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateVoditeliParams>(Voditeli.table);
    const record = await collection.find(voditelId);

    if (!record) {
      throw new Error(`Водитель с ID ${voditelId} не найден.`);
    }

    return {
      id: record.id,
      userId: record.userId,
      transport: record.transport,
      created_at: record.created_at,
      updated_at: record.updated_at,
    } as ICreateVoditeliParams;
  });
}

/**
 * Получить запись для конкретного userId.
 */
export async function getVoditelByUserId(userId: string): Promise<ICreateVoditeliParams | null> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateVoditeliParams>(Voditeli.table);
    const results = await collection.query(Q.where('userId', userId)).fetch();
    const res = results.map((record) => ({
      id: record.id,
      userId: record.userId,
      transport: record.transport,
      created_at: record.created_at,
      updated_at: record.updated_at,
    })) as ICreateVoditeliParams[];

    return res.length > 0 ? res[0] : null;
  });
}

/**
 * Обновление данных водителя.
 */
export async function editVoditel({
  voditelId,
  userId,
  transport,
}: IEditVoditelParams): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<ICreateVoditeliParams>(Voditeli.table);
    const record = await collection.find(voditelId);
    const now = Date.now();
    await record.update((r) => {
      r.userId = userId.trim();
      r.transport = transport.trim();
      r.updated_at = now;
    });
    return record.id;
  });
}
