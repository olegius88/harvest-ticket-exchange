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
  readonly cancellationReason?: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Класс TalonsOfCombainers и описание схемы WatermelonDB
 */
export class TalonsOfCombainers extends Model {
  static table = 'talons_of_combainers';

  @field('kombainerId') kombainerId!: string;
  @field('voditelId') voditelId?: string | null;
  @field('status') status!: string;
  @field('startTime') startTime!: number;
  @field('endTime') endTime?: number | null;
  @field('weight') weight?: number | null;
  @field('comment') comment?: string | null;
  @field('talonNumber') talonNumber!: string;
  @field('cancellationReason') cancellationReason?: string | null;
  @field('created_at') created_at!: number;
  @field('updated_at') updated_at!: number;

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
        { name: 'cancellationReason', type: 'string' },
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
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);

    // Генерация номера талона
    // Получаем все не отмененные талоны данного комбайнера
    const existingTalons = await collection
      .query(Q.and(Q.where('kombainerId', kombainerId), Q.where('status', Q.notEq('cancelled'))))
      .fetch();

    // Проверяем, есть ли отмененные талоны, чтобы переиспользовать их номера
    const cancelledTalons = await collection
      .query(Q.and(Q.where('kombainerId', kombainerId), Q.where('status', 'cancelled')))
      .fetch();

    // Сортируем отмененные талоны по номеру (без префикса 'A')
    const sortedCancelledTalons = cancelledTalons.sort((a, b) => {
      const aNum = parseInt(a.talonNumber.replace('A', ''));
      const bNum = parseInt(b.talonNumber.replace('A', ''));
      return aNum - bNum;
    });

    let talonNumber: string;

    // Если есть отмененные талоны, используем номер первого отмененного
    if (sortedCancelledTalons.length > 0) {
      // Берем номер из первого отмененного талона, убирая префикс 'A'
      talonNumber = sortedCancelledTalons[0].talonNumber.replace('A', '');
    } else {
      // Иначе создаем новый порядковый номер
      const sequentialNumber = existingTalons.length + 1;
      talonNumber = `${sequentialNumber}`;
    }

    const now = Date.now();
    const newTalon = await collection.create((record: any) => {
      record._raw.id = uuid.v4();
      record.kombainerId = kombainerId.trim();
      record.voditelId = voditelId ? voditelId.trim() : undefined;
      record.status = status;
      record.startTime = startTime;
      record.endTime = endTime || undefined;
      record.weight = weight || undefined;
      record.comment = comment ? comment.trim() : undefined;
      record.talonNumber = talonNumber;
      record.cancellationReason = undefined;
      record.created_at = now;
      record.updated_at = now;
    });
    return newTalon.id;
  });
}

/**
 * Отменить талон и указать причину отмены
 */
export async function cancelTalon(talonId: string, reason: string): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      r.status = 'cancelled';
      r.cancellationReason = reason.trim();
      r.updated_at = now;

      // Если талон отменяется, автоматически устанавливаем время окончания
      if (!r.endTime) {
        r.endTime = now;
      }
    });
    return record.id;
  });
}

/**
 * Получить все отмененные талоны
 */
export async function getCancelledTalons(): Promise<ICreateTalonsParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const records = await collection.query(Q.where('status', 'cancelled')).fetch();
    return records.map(
      (record) =>
        ({
          id: record.id,
          kombainerId: record.kombainerId,
          voditelId: record.voditelId,
          status: record.status as TalonStatus,
          startTime: record.startTime,
          endTime: record.endTime,
          weight: record.weight,
          comment: record.comment,
          talonNumber: record.talonNumber,
          cancellationReason: record.cancellationReason,
          created_at: record.created_at,
          updated_at: record.updated_at,
        }) as ICreateTalonsParams
    );
  });
}

/**
 * Получить все талоны из таблицы "talons_of_combainers".
 */
export async function getAllTalons(): Promise<ICreateTalonsParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const records = await collection.query().fetch();
    return records.map(
      (record) =>
        ({
          id: record.id,
          kombainerId: record.kombainerId,
          voditelId: record.voditelId,
          status: record.status as TalonStatus,
          startTime: record.startTime,
          endTime: record.endTime,
          weight: record.weight,
          comment: record.comment,
          talonNumber: record.talonNumber,
          cancellationReason: record.cancellationReason,
          created_at: record.created_at,
          updated_at: record.updated_at,
        }) as ICreateTalonsParams
    );
  });
}

/**
 * Получить талон по ID.
 */
export async function getTalonById(talonId: string): Promise<ICreateTalonsParams> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
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
      cancellationReason: record.cancellationReason,
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
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const records = await collection.query(Q.where('kombainerId', kombainerId)).fetch();
    return records.map(
      (record) =>
        ({
          id: record.id,
          kombainerId: record.kombainerId,
          voditelId: record.voditelId,
          status: record.status as TalonStatus,
          startTime: record.startTime,
          endTime: record.endTime,
          weight: record.weight,
          comment: record.comment,
          talonNumber: record.talonNumber,
          cancellationReason: record.cancellationReason,
          created_at: record.created_at,
          updated_at: record.updated_at,
        }) as ICreateTalonsParams
    );
  });
}

/**
 * Получить все талоны для конкретного водителя.
 */
export async function getTalonsByVoditelId(voditelId: string): Promise<ICreateTalonsParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const records = await collection.query(Q.where('voditelId', voditelId)).fetch();
    return records.map(
      (record) =>
        ({
          id: record.id,
          kombainerId: record.kombainerId,
          voditelId: record.voditelId,
          status: record.status as TalonStatus,
          startTime: record.startTime,
          endTime: record.endTime,
          weight: record.weight,
          comment: record.comment,
          talonNumber: record.talonNumber,
          cancellationReason: record.cancellationReason,
          created_at: record.created_at,
          updated_at: record.updated_at,
        }) as ICreateTalonsParams
    );
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
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      r.kombainerId = kombainerId.trim();
      r.voditelId = voditelId ? voditelId.trim() : undefined;
      r.status = status;
      r.startTime = startTime;
      r.endTime = endTime || undefined;
      r.weight = weight || undefined;
      r.comment = comment ? comment.trim() : undefined;
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
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
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
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
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
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      r.weight = weight;
      r.updated_at = now;
    });
    return record.id;
  });
}
