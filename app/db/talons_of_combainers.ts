// Файл: app/db/talons_of_combainers.ts

import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database';
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateTalonParams, IEditTalonParams, TalonStatus, IVoditelData } from '../../global';
import { Users } from './users';
import { Kombainers } from './kombainers';
import { Voditeli } from './viditels';

/**
 * Интерфейс для полей в таблице talons_of_combainers
 */
export interface ICreateTalonsParams extends Model, ICreateTalonParams {
  readonly id: string;
  readonly talonNumber: string;
  readonly cancellationReason?: string | null;
  voditelUserId?: string | null; // Новый параметр для хранения ID пользователя водителя
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
}

export const validStatuses: TalonStatus[] = [
  'created',
  'assigned',
  'in_progress',
  'completed',
  'cancelled',
];

/**
 * Класс TalonsOfCombainers и описание схемы WatermelonDB
 */
export class TalonsOfCombainers extends Model {
  static table = 'talons_of_combainers';

  @field('kombainerId') kombainerId!: string;
  @field('voditelId') voditelId?: string | null;
  @field('voditelUserId') voditelUserId?: string | null;
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
        { name: 'voditelUserId', type: 'string', isOptional: true },
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
  kombainerId,
  voditelId,
  voditelUserId, // Новый параметр для хранения ID пользователя водителя
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

    let newTalonNumber: string;
    if (initialTalonNumber) {
      newTalonNumber = initialTalonNumber.trim();
    } else if (sortedCancelledTalons.length > 0) {
      newTalonNumber = sortedCancelledTalons[0].talonNumber.replace('A', '');
    } else {
      const sequentialNumber = existingTalons.length + 1;
      newTalonNumber = `${sequentialNumber}`;
    }

    const now = Date.now();
    const newTalon = await collection.create((record: any) => {
      record._raw.id = uuid.v4();
      record.kombainerId = kombainerId.trim();
      record.voditelId = voditelId ? voditelId.trim() : undefined;
      record.voditelUserId = voditelUserId ? voditelUserId.trim() : undefined; // Сохраняем ID пользователя водителя
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
          voditelUserId: record.voditelUserId || null,
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
          voditelUserId: record.voditelUserId || null,
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
      voditelUserId: record.voditelUserId || null,
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
          voditelUserId: record.voditelUserId || null,
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
          voditelUserId: record.voditelUserId || null,
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
        voditelId: record.voditelId,
        voditelUserId: record.voditelUserId,
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

      // console.log(`getTalonsForKombainerExport|talon=`, i, talon);
      console.log(`getTalonsForKombainerExport|talon.voditelId=`, i, talon.voditelId);

      // Если у талона есть водитель, получаем его ФИО
      if (talon.voditelId) {
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
