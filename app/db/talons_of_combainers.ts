// Файл: app/db/talons_of_combainers.ts

import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database';
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import {
  ICreateTalonParams,
  IEditTalonParams,
  TalonStatus,
  IVoditelData,
  ICreateKombainerParams,
  ICreateVoditelParams,
  ICreateUserParams,
} from '../../global';
import { Users, ICreateUsersParams } from './users';
import { Kombainers } from './kombainers';
import { Voditeli } from './viditels';

/**
 * Интерфейс для полей в таблице talons_of_combainers
 */
export interface ICreateTalonsParams extends Model, ICreateTalonParams {
  readonly id: string;
  readonly talonNumber: string;
  readonly cancellationReason?: string | null;
  kombainerData?: ICreateKombainerParams | null; // Объект с данными комбайнера
  kombainerUserData?: ICreateUserParams | null; // Объект с данными пользователя комбайнера
  voditelUserId?: string | null; // Новый параметр для хранения ID пользователя водителя
  voditelData?: ICreateVoditelParams | null; // Объект с данными водителя
  voditelUserData?: ICreateUserParams | null; // Объект с данными пользователя водителя
  created_at: number;
  updated_at: number;
}

/**
 * Интерфейс для данных выгрузки талонов
 */
export interface ITalonExportData {
  serialNumber: number;
  talonNumber: string;
  unloadWeight: number | null; // выгрузка - данные вбитые в поле вес
  nominalWeight: number | null; // номинальный вес с весовой (пока то же что и выгрузка)
  createdTime: number;
  fio: string; // ФИО комбайнера для водителя или водителя для комбайнера
  talonId: string;
  status: string;
  voditelId?: string | null; // ID водителя, если назначен
  voditelData?: IVoditelData | null; // данные водителя
  // Дополнительные поля для тестирования
  kombainerId: string;
  voditelUserId?: string | null;
  startTime: number;
  endTime?: number | null;
  weight?: number | null;
  comment?: string | null;
  cancellationReason?: string | null;
  updated_at: number;
  rawData?: any; // сырые данные из базы для отладки
}

export const validStatuses: TalonStatus[] = [
  'created',
  'assigned',
  'in_progress',
  'voditel_signed',
  'completed',
  'cancelled',
  'cancelled_by_kombainer',
  'cancelled_by_voditel',
];

/**
 * Класс TalonsOfCombainers и описание схемы WatermelonDB
 */
export class TalonsOfCombainers extends Model {
  static table = 'talons_of_combainers';

  @field('kombainerId') kombainerId!: string;
  @field('kombainerData') kombainerData?: string | null;
  @field('kombainerUserData') kombainerUserData?: string | null;
  @field('voditelId') voditelId?: string | null;
  @field('voditelUserId') voditelUserId?: string | null;
  @field('voditelData') voditelData?: string | null;
  @field('voditelUserData') voditelUserData?: string | null;
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
        { name: 'kombainerData', type: 'string', isOptional: true },
        { name: 'kombainerUserData', type: 'string', isOptional: true },
        { name: 'voditelId', type: 'string' },
        { name: 'voditelUserId', type: 'string', isOptional: true },
        { name: 'voditelData', type: 'string', isOptional: true },
        { name: 'voditelUserData', type: 'string', isOptional: true },
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
  id,
  kombainerId,
  kombainerData, // Новый параметр для данных комбайнера
  kombainerUserData, // Новый параметр для данных пользователя комбайнера
  voditelId,
  voditelUserId, // Новый параметр для хранения ID пользователя водителя
  voditelData, // Новый параметр для данных водителя
  voditelUserData, // Новый параметр для данных пользователя водителя
  status,
  startTime,
  endTime,
  weight,
  comment,
  talonNumber: initialTalonNumber, // Новый параметр для передачи номера талона
}: ICreateTalonParams): Promise<string> {
  // Валидация входных данных
  TalonsOfCombainers.validateFields({ kombainerId, status, startTime });
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);

    // Если номер талона передан, используем его, иначе генерируем новый
    let newTalonNumber: string;
    if (initialTalonNumber) {
      newTalonNumber = initialTalonNumber.trim();
    } else {
      // Получаем последний неотмененный талон
      const lastNonCancelledTalons = await collection
        .query(
          Q.and(Q.where('kombainerId', kombainerId), Q.where('status', Q.notEq('cancelled'))),
          Q.sortBy('created_at', Q.desc),
          Q.take(1)
        )
        .fetch();

      // Получаем последний отмененный талон
      const lastCancelledTalons = await collection
        .query(
          Q.and(Q.where('kombainerId', kombainerId), Q.where('status', 'cancelled')),
          Q.sortBy('created_at', Q.asc),
          Q.take(1)
        )
        .fetch();

      if (lastCancelledTalons.length > 0) {
        // Если есть отмененный талон, используем его номер
        newTalonNumber = lastCancelledTalons[0].talonNumber.replace('A', '');
      } else {
        // Иначе берем номер последнего неотмененного талона и увеличиваем на 1
        let sequentialNumber = 1;
        if (lastNonCancelledTalons.length > 0) {
          const lastNumber = parseInt(lastNonCancelledTalons[0].talonNumber.replace('A', ''));
          sequentialNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
        }
        newTalonNumber = `${sequentialNumber}`;
      }
    }

    const now = Date.now();
    const newTalon = await collection.create((record: any) => {
      record._raw.id = id || uuid.v4();
      record.kombainerId = kombainerId.trim();
      // Правильно сохраняем данные комбайнера как JSON строки
      record.kombainerData = stringifyToJson(kombainerData);
      record.kombainerUserData = stringifyToJson(kombainerUserData);
      record.voditelId = voditelId ? voditelId.trim() : undefined;
      record.voditelUserId = voditelUserId ? voditelUserId.trim() : undefined; // Сохраняем ID пользователя водителя
      // Правильно сохраняем данные водителя как JSON строки
      record.voditelData = stringifyToJson(voditelData);
      record.voditelUserData = stringifyToJson(voditelUserData);
      record.status = status;
      record.startTime = startTime;
      record.endTime = endTime || undefined;
      record.weight = weight || undefined;
      record.comment = comment ? comment.trim() : undefined;
      record.talonNumber = newTalonNumber; // Используем новый или существующий номер талона
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
  console.log('cancelTalon|talonId=', talonId);
  console.log('cancelTalon|reason=', reason);
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      console.error(`cancelTalon|Талон с ID ${talonId} не найден.`);
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
 * Отменить талон водителем и указать причину отмены
 */
export async function cancelTalonByVoditel(talonId: string, reason: string): Promise<string> {
  console.log('cancelTalonByVoditel|talonId=', talonId);
  console.log('cancelTalonByVoditel|reason=', reason);
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      console.error(`cancelTalonByVoditel|Талон с ID ${talonId} не найден.`);
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      r.status = 'cancelled_by_voditel';
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
 * Отменить талон комбайнером и указать причину отмены
 */
export async function cancelTalonByKombainer(talonId: string, reason: string): Promise<string> {
  console.log('cancelTalonByKombainer|talonId=', talonId);
  console.log('cancelTalonByKombainer|reason=', reason);
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      console.error(`cancelTalonByKombainer|Талон с ID ${talonId} не найден.`);
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      r.status = 'cancelled_by_kombainer';
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
 * Вспомогательные функции для преобразования данных
 */
function parseJsonSafely<T>(jsonString: string | null | undefined): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Ошибка парсинга JSON:', error);
    return null;
  }
}

function stringifyToJson(obj: any): string | undefined {
  if (!obj) return undefined;
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Ошибка преобразования в JSON:', error);
    return undefined;
  }
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
          kombainerData: parseJsonSafely<ICreateKombainerParams>(record.kombainerData),
          kombainerUserData: parseJsonSafely<ICreateUserParams>(record.kombainerUserData),
          voditelId: record.voditelId,
          voditelUserId: record.voditelUserId || null,
          voditelData: parseJsonSafely<ICreateVoditelParams>(record.voditelData),
          voditelUserData: parseJsonSafely<ICreateUserParams>(record.voditelUserData),
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
          kombainerData: parseJsonSafely<ICreateKombainerParams>(record.kombainerData),
          kombainerUserData: parseJsonSafely<ICreateUserParams>(record.kombainerUserData),
          voditelId: record.voditelId,
          voditelUserId: record.voditelUserId || null,
          voditelData: parseJsonSafely<ICreateVoditelParams>(record.voditelData),
          voditelUserData: parseJsonSafely<ICreateUserParams>(record.voditelUserData),
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
      kombainerData: parseJsonSafely<ICreateKombainerParams>(record.kombainerData),
      kombainerUserData: parseJsonSafely<ICreateUserParams>(record.kombainerUserData),
      voditelId: record.voditelId,
      voditelUserId: record.voditelUserId || null,
      voditelData: parseJsonSafely<ICreateVoditelParams>(record.voditelData),
      voditelUserData: parseJsonSafely<ICreateUserParams>(record.voditelUserData),
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
          kombainerData: parseJsonSafely<ICreateKombainerParams>(record.kombainerData),
          kombainerUserData: parseJsonSafely<ICreateUserParams>(record.kombainerUserData),
          voditelId: record.voditelId,
          voditelUserId: record.voditelUserId || null,
          voditelData: parseJsonSafely<ICreateVoditelParams>(record.voditelData),
          voditelUserData: parseJsonSafely<ICreateUserParams>(record.voditelUserData),
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
          kombainerData: parseJsonSafely<ICreateKombainerParams>(record.kombainerData),
          kombainerUserData: parseJsonSafely<ICreateUserParams>(record.kombainerUserData),
          voditelId: record.voditelId,
          voditelUserId: record.voditelUserId || null,
          voditelData: parseJsonSafely<ICreateVoditelParams>(record.voditelData),
          voditelUserData: parseJsonSafely<ICreateUserParams>(record.voditelUserData),
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
 * Получить последний талон для указанного комбайнера.
 */
export async function getLastTalonByKombainerId(
  kombainerId: string
): Promise<ICreateTalonsParams | null> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const records = await collection
      .query(Q.where('kombainerId', kombainerId), Q.sortBy('created_at', Q.desc), Q.take(1))
      .fetch();

    if (records.length > 0) {
      const record = records[0];
      return {
        id: record.id,
        kombainerId: record.kombainerId,
        kombainerData: parseJsonSafely<ICreateKombainerParams>(record.kombainerData),
        kombainerUserData: parseJsonSafely<ICreateUserParams>(record.kombainerUserData),
        voditelId: record.voditelId,
        voditelUserId: record.voditelUserId,
        voditelData: parseJsonSafely<ICreateVoditelParams>(record.voditelData),
        voditelUserData: parseJsonSafely<ICreateUserParams>(record.voditelUserData),
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
    }
    return null;
  });
}

/**
 * Редактирование записи в таблице "talons_of_combainers".
 */
export async function editTalon(talonId: string, params: IEditTalonParams): Promise<string> {
  // Валидация входных данных
  TalonsOfCombainers.validateFields({
    kombainerId: params.kombainerId,
    status: params.status,
    startTime: params.startTime,
  });
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      r.kombainerId = params.kombainerId.trim();
      r.voditelId = params.voditelId ? params.voditelId.trim() : undefined;
      // Добавляем обновление поля voditelUserId
      r.voditelUserId = params.voditelUserId ? params.voditelUserId.trim() : undefined;
      // Правильно сохраняем данные водителя как JSON строки
      r.voditelData = params.voditelData ? JSON.stringify(params.voditelData) : undefined;
      r.voditelUserData = params.voditelUserData
        ? JSON.stringify(params.voditelUserData)
        : undefined;
      r.status = params.status;
      r.startTime = params.startTime;
      r.endTime = params.endTime || undefined;
      r.weight = params.weight || undefined;
      r.comment = params.comment ? params.comment.trim() : undefined;
      r.updated_at = now;
    });
    return record.id;
  });
}

/**
 * Сохранить данные водителя в талон.
 */
export async function saveTalonVoditelData(
  talonId: string,
  voditelData: any,
  voditelUserData: any
): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    const now = Date.now();
    await record.update((r) => {
      // Правильно сохраняем данные водителя как JSON строки
      r.voditelData = voditelData ? JSON.stringify(voditelData) : undefined;
      r.voditelUserData = voditelUserData ? JSON.stringify(voditelUserData) : undefined;
      r.updated_at = now;
    });
    return record.id;
  });
}

/**
 * Получить данные водителя из талона.
 */
export async function getTalonVoditelData(talonId: string): Promise<{
  voditelData: any | null;
  voditelUserData: any | null;
}> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const record = await collection.find(talonId);

    if (!record) {
      throw new Error(`Талон с ID ${talonId} не найден.`);
    }

    let voditelData = null;
    let voditelUserData = null;

    try {
      if (record.voditelData) {
        voditelData = JSON.parse(record.voditelData);
      }
    } catch (error) {
      console.error('Ошибка парсинга voditelData:', error);
    }

    try {
      if (record.voditelUserData) {
        voditelUserData = JSON.parse(record.voditelUserData);
      }
    } catch (error) {
      console.error('Ошибка парсинга voditelUserData:', error);
    }

    return {
      voditelData,
      voditelUserData,
    };
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
      r.status = 'voditel_assigned';
      r.updated_at = now;
    });
    return record.id;
  });
}

/**
 * Обновить voditelId у талона (без изменения статуса).
 */
export async function updateTalonVoditelId(talonId: string, voditelId: string): Promise<string> {
  console.log('updateTalonVoditelId|talonId=', talonId, 'voditelId=', voditelId);

  // Сначала проверим, существует ли запись
  try {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);

    // Попробуем найти запись без write операции для диагностики
    const allTalons = await database.read(async () => {
      return await collection.query().fetch();
    });

    console.log('updateTalonVoditelId|total talons count=', allTalons.length);

    const existingRecord = allTalons.find((t) => t.id === talonId);
    if (!existingRecord) {
      console.log('updateTalonVoditelId|record not found in all talons');
      console.log(
        'updateTalonVoditelId|available talons:',
        allTalons.map((t) => ({ id: t.id, talonNumber: t.talonNumber }))
      );
      throw new Error(`Талон с ID ${talonId} не найден в базе данных`);
    }

    console.log('updateTalonVoditelId|found record:', {
      id: existingRecord.id,
      talonNumber: existingRecord.talonNumber,
      currentVoditelId: existingRecord.voditelId,
      status: existingRecord.status,
    });

    return database.write(async () => {
      const record = await collection.find(talonId);

      if (!record) {
        throw new Error(`Талон с ID ${talonId} не найден при попытке обновления`);
      }

      const now = Date.now();
      await record.update((r) => {
        console.log(
          'updateTalonVoditelId|updating record, old voditelId=',
          r.voditelId,
          'new voditelId=',
          voditelId.trim()
        );
        r.voditelId = voditelId.trim();
        r.updated_at = now;
      });

      console.log('updateTalonVoditelId|successfully updated record');
      return record.id;
    });
  } catch (error) {
    console.error('updateTalonVoditelId|error=', error);
    throw error;
  }
}

/**
 * Попытаться обновить voditelId у талона (мягкая ошибка если талон не найден).
 */
export async function tryUpdateTalonVoditelId(
  talonId: string,
  voditelId: string
): Promise<{ success: boolean; error?: string }> {
  console.log('tryUpdateTalonVoditelId|talonId=', talonId, 'voditelId=', voditelId);

  try {
    await updateTalonVoditelId(talonId, voditelId);
    return { success: true };
  } catch (error) {
    console.error('tryUpdateTalonVoditelId|error=', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Обновить статус талона.
 */
export async function updateTalonStatus(talonId: string, status: TalonStatus): Promise<string> {
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

/**
 * Получить талоны комбайнера с фильтром по дате для выгрузки
 */
export async function getTalonsForKombainerExport(
  kombainerId: string,
  startDate: number,
  endDate: number
): Promise<ITalonExportData[]> {
  return database.read(async () => {
    const talonCollection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const userCollection = database.collections.get<Users>('users');
    const voditelCollection = database.collections.get<Voditeli>('voditeli');

    // Получаем талоны комбайнера за указанный период
    const talons = await talonCollection
      .query(
        Q.and(
          Q.where('kombainerId', kombainerId),
          Q.where('created_at', Q.gte(startDate)),
          Q.where('created_at', Q.lte(endDate))
        ),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();
    console.log(
      'getTalonsForKombainerExport talons raw:',
      talons.map((t) => t._raw)
    );

    const exportData: ITalonExportData[] = [];

    for (let i = 0; i < talons.length; i++) {
      const talon = talons[i];
      console.log(`talon ${i} raw:`, talon._raw);
      let voditelFio = 'Не назначен';
      let voditelData: IVoditelData | null = null;
      const voditelIdForExport = talon.voditelId || null;

      console.log(`getTalonsForKombainerExport|talon.voditelId=`, i, talon.voditelId);

      // Сначала пытаемся получить данные водителя из самого талона
      try {
        if (talon.voditelData) {
          const parsedVoditelData = JSON.parse(talon.voditelData);
          voditelData = parsedVoditelData;
        }

        if (talon.voditelUserData) {
          const parsedVoditelUserData = JSON.parse(talon.voditelUserData);
          voditelFio = parsedVoditelUserData.fio || 'Не указано';
        }
      } catch (error) {
        console.log('Ошибка парсинга данных водителя из талона:', error);
      }

      // Если данные не найдены в талоне, пытаемся получить их из старых таблиц
      if (!voditelData && talon.voditelId) {
        try {
          const voditel = await voditelCollection.find(talon.voditelId);
          console.log('voditel raw:', voditel._raw);
          if (voditel) {
            // Сохраняем данные водителя
            voditelData = {
              id: voditel.id,
              userId: voditel.userId,
              transport: voditel.transport,
              created_at: voditel.created_at,
              updated_at: voditel.updated_at,
            };
            const user = await userCollection.find(voditel.userId);
            console.log('user raw:', user._raw);
            if (user) {
              voditelFio = user.fio;
            }
          }
        } catch (error) {
          console.log('Водитель не найден для талона:', talon.id);
        }
      }

      exportData.push({
        serialNumber: i + 1,
        talonNumber: talon.talonNumber,
        unloadWeight: talon.weight,
        nominalWeight: talon.weight, // пока используем то же значение
        createdTime: talon.created_at,
        fio: voditelFio,
        talonId: talon.id,
        voditelId: voditelIdForExport,
        voditelData,
        status: talon.status,
        // Дополнительные поля для тестирования
        kombainerId: talon.kombainerId,
        voditelUserId: talon.voditelUserId,
        startTime: talon.startTime,
        endTime: talon.endTime,
        weight: talon.weight,
        comment: talon.comment,
        cancellationReason: talon.cancellationReason,
        updated_at: talon.updated_at,
        rawData: talon._raw, // сырые данные из базы для отладки
      });
    }

    return exportData;
  });
}

/**
 * Получить талоны водителя с фильтром по дате для выгрузки
 */
export async function getTalonsForVoditelExport(
  voditelId: string,
  startDate: number,
  endDate: number
): Promise<ITalonExportData[]> {
  return database.read(async () => {
    console.log(
      'getTalonsForVoditelExport|voditelId=',
      voditelId,
      'startDate=',
      startDate,
      'endDate=',
      endDate
    );
    const talonCollection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const userCollection = database.collections.get<Users>('users');
    const kombainerCollection = database.collections.get<Kombainers>('kombainers');

    // Получаем талоны водителя за указанный период
    const talons = await talonCollection
      .query(
        Q.and(
          Q.where('voditelId', voditelId),
          Q.where('created_at', Q.gte(startDate)),
          Q.where('created_at', Q.lte(endDate))
        ),
        Q.sortBy('created_at', Q.asc)
      )
      .fetch();

    const exportData: ITalonExportData[] = [];

    for (let i = 0; i < talons.length; i++) {
      const talon = talons[i];
      let kombainerFio = 'Не найден';

      // Получаем ФИО комбайнера
      try {
        const kombainer = await kombainerCollection.find(talon.kombainerId);
        if (kombainer) {
          const user = await userCollection.find(kombainer.userId);
          if (user) {
            kombainerFio = user.fio;
          }
        }
      } catch (error) {
        console.log('Комбайнер не найден для талона:', talon.id);
      }

      exportData.push({
        serialNumber: i + 1,
        talonNumber: talon.talonNumber,
        unloadWeight: talon.weight,
        nominalWeight: talon.weight, // пока используем то же значение
        createdTime: talon.created_at,
        fio: kombainerFio,
        talonId: talon.id,
        status: talon.status,
        // Дополнительные поля для тестирования
        kombainerId: talon.kombainerId,
        voditelId: talon.voditelId,
        voditelUserId: talon.voditelUserId,
        startTime: talon.startTime,
        endTime: talon.endTime,
        weight: talon.weight,
        comment: talon.comment,
        cancellationReason: talon.cancellationReason,
        updated_at: talon.updated_at,
        rawData: talon._raw, // сырые данные из базы для отладки
      });
    }

    return exportData;
  });
}

/**
 * Проверить существование талона по ID.
 */
export async function checkTalonExists(talonId: string): Promise<boolean> {
  try {
    return database.read(async () => {
      const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
      const record = await collection.find(talonId);
      return !!record;
    });
  } catch (error) {
    console.error('checkTalonExists|error=', error);
    return false;
  }
}

/**
 * Получить информацию о талоне для отладки.
 */
export async function getTalonDebugInfo(talonId: string): Promise<any> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);

    try {
      const record = await collection.find(talonId);
      return {
        found: true,
        id: record.id,
        talonNumber: record.talonNumber,
        voditelId: record.voditelId,
        status: record.status,
        created_at: record.created_at,
      };
    } catch (error) {
      // Если не найдено, проверим все талоны
      const allTalons = await collection.query().fetch();
      return {
        found: false,
        error: error instanceof Error ? error.message : String(error),
        totalTalonsCount: allTalons.length,
        allTalonIds: allTalons.map((t) => t.id).slice(0, 10), // первые 10 ID для отладки
      };
    }
  });
}

/**
 * Получить список всех талонов для диагностики.
 */
export async function getAllTalonsForDebug(): Promise<
  { id: string; kombainerId?: string; voditelId?: string; created_at: number }[]
> {
  console.log('getAllTalonsForDebug|getting all talons...');

  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const allTalons = await collection.query().fetch();

    const talonsInfo = allTalons.map((talon) => ({
      id: talon.id,
      kombainerId: talon.kombainerId,
      voditelId: talon.voditelId,
      created_at: talon.created_at,
    }));

    console.log(
      'getAllTalonsForDebug|found',
      talonsInfo.length,
      'talons:',
      JSON.stringify(talonsInfo, null, 2)
    );
    return talonsInfo;
  });
}

/**
 * Получить следующий номер талона для комбайнера (оптимизированная версия).
 */
export async function getNextTalonNumber(kombainerId: string): Promise<string> {
  return database.read(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);

    // Получаем последний неотмененный талон
    const lastNonCancelledTalons = await collection
      .query(
        Q.and(Q.where('kombainerId', kombainerId), Q.where('status', Q.notEq('cancelled'))),
        Q.sortBy('created_at', Q.desc),
        Q.take(1)
      )
      .fetch();

    console.log('getNextTalonNumber|lastNonCancelledTalons:', lastNonCancelledTalons);

    // Получаем первый (самый старый) отмененный талон
    const firstCancelledTalons = await collection
      .query(
        Q.and(Q.where('kombainerId', kombainerId), Q.where('status', 'cancelled')),
        Q.sortBy('created_at', Q.asc),
        Q.take(1)
      )
      .fetch();

    console.log('getNextTalonNumber|firstCancelledTalons:', firstCancelledTalons);

    let talonNumber: string;

    if (firstCancelledTalons.length > 0) {
      // Если есть отмененный талон, используем его номер
      talonNumber = firstCancelledTalons[0].talonNumber.replace('A', '');
    } else {
      // Иначе берем номер последнего неотмененного талона и увеличиваем на 1
      let sequentialNumber = 1;
      if (lastNonCancelledTalons.length > 0) {
        const lastNumber = parseInt(lastNonCancelledTalons[0].talonNumber.replace('A', ''));
        sequentialNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
      }
      talonNumber = `${sequentialNumber}`;
    }

    return talonNumber;
  });
}

/**
 * Удалить все талоны из таблицы "talons_of_combainers".
 * ВНИМАНИЕ: Это действие нельзя отменить!
 */
export async function deleteAllTalons(): Promise<number> {
  return database.write(async () => {
    const collection = database.collections.get<TalonsOfCombainers>(TalonsOfCombainers.table);
    const allTalons = await collection.query().fetch();

    const count = allTalons.length;

    // Удаляем все талоны
    await Promise.all(allTalons.map((talon) => talon.destroyPermanently()));

    console.log(`deleteAllTalons: Удалено ${count} талонов`);
    return count;
  });
}
