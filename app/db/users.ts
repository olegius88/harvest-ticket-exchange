// app/db/users.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database';
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateUserParams, ILoginUserParams, PositionOptionValue } from '../../global';
import { NotFoundError } from '../exceptions/exceptionsClasses';

/**
 * Интерфейс для полей в таблице users
 */
export interface ICreateUsersParams extends Model, ICreateUserParams {
  readonly id: string;
  created_at: number;
  updated_at: number;
}

export class Users extends Model {
  static table = 'users';

  @field('fio') fio!: string;
  @field('phone') phone!: string;
  @field('position') position!: string;
  @field('password') password!: string;
  @field('created_at') created_at!: number;
  @field('updated_at') updated_at!: number;
  @field('from_remote') from_remote!: boolean;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'fio', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'position', type: 'string' },
        { name: 'password', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'from_remote', type: 'boolean' },
      ],
    });
  }

  /**
   * Проверка обязательных полей и корректности значения поля position.
   */
  static validateFields(fields: Partial<ICreateUsersParams>) {
    const missingFields: string[] = [];
    if (!fields.fio) missingFields.push('fio');
    if (!fields.phone) missingFields.push('phone');
    if (!fields.position) missingFields.push('position');
    if (!fields.password) missingFields.push('password');

    if (missingFields.length > 0) {
      throw new Error(`Validation Error: Missing required fields: ${missingFields.join(', ')}`);
    }

    const validPositions: PositionOptionValue[] = ['kombainer', 'voditel', 'bunkerist'];
    if (!validPositions.includes(fields.position as PositionOptionValue)) {
      throw new Error(
        `Validation Error: Invalid value for position. Allowed values are: ${validPositions.join(', ')}`
      );
    }
  }
}

export async function createUser({
  fio,
  phone,
  position,
  password,
  from_remote = false,
}: ICreateUserParams): Promise<string> {
  // Валидация входных данных
  Users.validateFields({ fio, phone, position, password });
  return database.write(async () => {
    const collection = database.collections.get<ICreateUsersParams>(Users.table);
    const now = Date.now();
    const newUser = await collection.create((user) => {
      user._raw.id = uuid.v4();
      user.fio = fio;
      user.phone = phone.trim();
      user.position = position;
      user.password = password.trim();
      user.from_remote = from_remote;
      // Устанавливаем временные метки
      user.created_at = now;
      user.updated_at = now;
    });
    return newUser.id;
  });
}

/**
 * Функция loginUser ищет запись по номеру телефона и паролю (без шифрования)
 * и возвращает userId, если пользователь найден.
 */
export async function loginUser({ phone, password }: ILoginUserParams): Promise<string> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateUsersParams>(Users.table);
    const users = await collection.query(Q.where('phone', phone)).fetch();

    if (users.length === 0) {
      throw new Error(`Пользователь с указанным номером телефона ${phone} не найден.`);
    }
    const userData = users[0];
    if (userData.password != password.trim()) {
      throw new Error(`Неверный пароль для пользователя с номером телефона ${phone}.`);
    }

    return userData.id;
  });
}

/**
 * Функция getAllUsers получает все записи из таблицы пользователей.
 */
export async function getAllUsers(): Promise<ICreateUsersParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateUsersParams>(Users.table);
    return await collection.query().fetch();
  });
}

/**
 * Функция getUserById получает пользователя по его ID.
 */
export async function getUserById(userId: string): Promise<ICreateUsersParams> {
  return database.read(async () => {
    const collection = database.collections.get<ICreateUsersParams>(Users.table);
    const user = await collection.find(userId);

    if (!user) {
      throw new NotFoundError(`Пользователь с ID ${userId} не найден.`);
    }

    // Возвращаем чистый объект без циклических ссылок
    return {
      id: user.id,
      fio: user.fio,
      phone: user.phone,
      position: user.position,
      password: user.password,
      from_remote: user.from_remote,
      created_at: user.created_at,
      updated_at: user.updated_at,
    } as ICreateUsersParams;
  });
}

/**
 * Функция editUserFio обновляет поле "fio" (ФИО пользователя) для указанного пользователя.
 * @param userId - ID пользователя, ФИО которого нужно обновить.
 * @param newFio - Новое значение ФИО.
 * @returns Promise с ID пользователя после обновления.
 */
export async function editUserFio(userId: string, newFio: string): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<ICreateUsersParams>(Users.table);
    const user = await collection.find(userId);
    await user.update((u) => {
      u.fio = newFio.trim();
      u.updated_at = Date.now();
    });
    return user.id;
  });
}

/**
 * Функция editUser обновляет данные пользователя (ФИО, телефон, должность).
 * @param userId - ID пользователя, данные которого нужно обновить.
 * @param newFio - Новое значение ФИО.
 * @param newPhone - Новый номер телефона.
 * @param newPosition - Новая должность.
 * @returns Promise с ID пользователя после обновления.
 */
export async function editUser(
  userId: string,
  newFio: string,
  newPhone: string,
  newPosition: string
): Promise<string> {
  return database.write(async () => {
    const collection = database.collections.get<ICreateUsersParams>(Users.table);
    const user = await collection.find(userId);

    // Проверка правильности значения поля position
    if (newPosition) {
      const validPositions: PositionOptionValue[] = ['kombainer', 'voditel', 'bunkerist'];
      if (!validPositions.includes(newPosition as PositionOptionValue)) {
        throw new Error(
          `Validation Error: Invalid value for position. Allowed values are: ${validPositions.join(', ')}`
        );
      }
    }

    await user.update((u) => {
      if (newFio) u.fio = newFio.trim();
      if (newPhone) u.phone = newPhone.trim();
      if (newPosition) u.position = newPosition;
      u.updated_at = Date.now();
    });

    return user.id;
  });
}
