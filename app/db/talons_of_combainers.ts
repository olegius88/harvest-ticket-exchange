// Файл: app/db/talons_of_combainers.ts

import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database';
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateTalonParams, IEditTalonParams, TalonStatus } from '../../global';

/**
 * Интерфейс для полей в таблице talons_of_combainers
 */
export interface ICreateTalonsParams extends Model, ICreateTalonParams {
  readonly id: string;
  readonly talonNumber: string;
  created_at: number;
  updated_at: number;
}

/**
 * Класс TalonsOfCombainers и описание схемы WatermelonDB
 */
export class TalonsOfCombainers extends Model {
  static table = 'talons_of_combainers';

  @field('kombainerId') kombainerId: string;
  @field('voditelId') voditelId: string;
  @field('status') status: string;
  @field('startTime') startTime: number;
  @field('endTime') endTime: number;
  @field('weight') weight: number;
  @field('comment') comment: string;
  @field('talonNumber') talonNumber: string;
  @field('created_at') created_at: number;
  @field('updated_at') updated_at: number;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'kombainerId', type: 'string' },
        { name: 'voditelId', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'startTime', type: 'number' },
        { name: 'endTime', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'comment', type: 'string' },
        { name: 'talonNumber', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    });
  }

  /**
   * Проверка обязательных полей.
   */
  static validateFields(fields: Partial<ICreateTalonParams>) {
    const missingFields: string[] = [];
    if (!fields.kombainerId) missingFields.push('kombainerId');
    if (!fields.status) missingFields.push('status');
    if (!fields.startTime) missingFields.push('startTime');

    if (missingFields.length > 0) {
      throw new Error(`Validation Error: Missing required fields: ${missingFields.join(', ')}`);
    }

    const validStatuses: TalonStatus[] = [
      'created',
      'driver_assigned',
      'in_progress',
      'completed',
      'cancelled',
    ];
    if (!validStatuses.includes(fields.status as TalonStatus)) {
      throw new Error(
        `Validation Error: Invalid value for status. Allowed values are: ${validStatuses.join(', ')}`
      );
    }
  }
}

/**
 * Создание записи в таблице "talons_of_combainers".
 */
export async function createTalon({
  kombainerId,
  voditelId,
  status,
  startTime,
  endTime,
  weight,
  comment,
}: ICreateTalonParams): Promise<string> {
  // Валидация входных данных
  TalonsOfCombainers.validateFields({ kombainerId, status, startTime });
  return database.write(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);

    // Получаем все талоны данного комбайнера
    const existingTalons = await collection.query(Q.where('kombainerId', kombainerId)).fetch();
    // Вычисляем номер талона: ID комбайнера + порядковый номер
    const sequentialNumber = existingTalons.length + 1;
    const talonNumber = `${sequentialNumber}`;

    console.log('createTalon|talonNumber=', talonNumber);

    const now = Date.now();
    const newTalon = await collection.create(record => {
      record._raw.id = uuid.v4();
      record.kombainerId = kombainerId.trim();
      record.voditelId = voditelId ? voditelId.trim() : null;
      record.status = status;
      record.startTime = startTime;
      record.endTime = endTime || null;
      record.weight = weight || null;
      record.comment = comment ? comment.trim() : null;
      record.talonNumber = talonNumber;
      record.created_at = now;
      record.updated_at = now;
    });
    return newTalon.id;
  });
}

/**
 * Получить все талоны из таблицы "talons_of_combainers".
 */
export async function getAllTalons(): Promise<ICreateTalonsParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    return await collection.query().fetch();
  });
}

/**
 * Получить талон по ID.
 */
export async function getTalonById(talonId: string): Promise<ICreateTalonsParams> {
  console.log('getTalonById|talonId=', talonId);
  return database.read(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    return {
      id: record.id,
      kombainerId: record.kombainerId,
      voditelId: record.voditelId,
      status: record.status as TalonStatus,
      startTime: record.startTime,
      endTime: record.endTime,
      weight: record.weight,
      comment: record.comment,
      talonNumber: record.talonNumber,
      created_at: record.created_at,
      updated_at: record.updated_at,
    } as ICreateTalonsParams;
  });
}

/**
 * Получить все талоны для конкретного комбайнера.
 */
export async function getTalonsByKombainerId(kombainerId: string): Promise<ICreateTalonsParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    return await collection.query(Q.where('kombainerId', kombainerId)).fetch();
  });
}

/**
 * Получить все талоны для конкретного водителя.
 */
export async function getTalonsByVoditelId(voditelId: string): Promise<ICreateTalonsParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    return await collection.query(Q.where('voditelId', voditelId)).fetch();
  });
}

/**
 * Обновить талон.
 */
export async function editTalon({
  talonId,
  kombainerId,
  voditelId,
  status,
  startTime,
  endTime,
  weight,
  comment,
}: IEditTalonParams): Promise<string> {
  // Валидация входных данных
  TalonsOfCombainers.validateFields({ kombainerId, status, startTime });
  return database.write(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update(r => {
      r.kombainerId = kombainerId.trim();
      r.voditelId = voditelId ? voditelId.trim() : null;
      r.status = status;
      r.startTime = startTime;
      r.endTime = endTime || null;
      r.weight = weight || null;
      r.comment = comment ? comment.trim() : null;
      r.updated_at = now;
    });
    return record.id;
  });
}

/**
 * Назначить водителя на талон.
 */
export async function assignDriverToTalon(talonId: string, voditelId: string): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update(r => {
      r.voditelId = voditelId.trim();
      r.status = 'driver_assigned';
      r.updated_at = now;
    });
    return record.id;
  });
}

/**
 * Обновить статус талона.
 */
export async function updateTalonStatus(talonId: string, status: TalonStatus): Promise<string> {
  const validStatuses: TalonStatus[] = [
    'created',
    'driver_assigned',
    'in_progress',
    'completed',
    'cancelled',
  ];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Validation Error: Invalid value for status. Allowed values are: ${validStatuses.join(', ')}`
    );
  }

  return database.write(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update(r => {
      r.status = status;
      r.updated_at = now;

      // Если статус "завершен", то автоматически устанавливаем время окончания
      if (status === 'completed' && !r.endTime) {
        r.endTime = now;
      }
    });
    return record.id;
  });
}

/**
 * Добавить вес к талону.
 */
export async function updateTalonWeight(talonId: string, weight: number): Promise<string> {
  if (weight <= 0) {
    throw new Error('Validation Error: Weight must be greater than 0');
  }

  return database.write(async () => {
    const collection = database.collections.get<ICreateTalonsParams>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update(r => {
      r.weight = weight;
      r.updated_at = now;
    });
    return record.id;
  });
}
