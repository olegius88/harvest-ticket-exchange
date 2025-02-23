// users.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, Q, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateUserParams, ILoginUserParams, PositionOptionValue } from '../../global';

export class Users extends Model {
  static table = 'users';

  // @ts-ignore
  @field('fio') fio!: string;
  // @ts-ignore
  @field('phone') phone!: string;
  // @ts-ignore
  @field('position') position!: string;
  // @ts-ignore
  @field('password') password!: string;

  static get tableSchema() {
    return tableSchema({
      name: this.table,
      columns: [
        { name: 'fio', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'position', type: 'string' },
        { name: 'password', type: 'string' },
      ],
    });
  }

  /**
   * Статический метод для проверки обязательных полей.
   * Если какое-либо поле отсутствует или поле position имеет недопустимое значение,
   * выбрасывается ошибка.
   */
  static validateFields(fields: Partial<ICreateUserParams>) {
    const missingFields: string[] = [];
    if (!fields.fio) missingFields.push('fio');
    if (!fields.phone) missingFields.push('phone');
    if (!fields.position) missingFields.push('position');
    if (!fields.password) missingFields.push('password');

    if (missingFields.length > 0) {
      throw new Error(`Validation Error: Missing required fields: ${missingFields.join(', ')}`);
    }

    // Проверяем, что значение position является допустимым
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
}: ICreateUserParams): Promise<string> {
  // Выполняем валидацию через модель Users
  Users.validateFields({ fio, phone, position, password });

  return database.write(async () => {
    const collection = database.collections.get<Model>(Users.table);
    const newUser = await collection.create((user) => {
      user._raw.id = uuid.v4();
      // @ts-ignore
      user.fio = fio;
      // @ts-ignore
      user.phone = phone;
      // @ts-ignore
      user.position = position;
      // @ts-ignore
      user.password = password;
    });
    return newUser.id;
  });
}

/**
 * Функция loginUser ищет запись в таблице по номеру телефона и паролю (без шифрования)
 * и возвращает userId, если пользователь найден.
 */
export async function loginUser({ phone, password }: ILoginUserParams): Promise<string> {
  return database.read(async () => {
    const collection = database.collections.get<Model>(Users.table);
    const users = await collection
      .query(Q.where('phone', phone), Q.where('password', password))
      .fetch();

    if (users.length > 0) {
      // Возвращаем идентификатор первого найденного пользователя
      return users[0].id;
    }
    throw new Error('User not found or invalid credentials');
  });
}

/**
 * Функция getAllUsers получает все записи из таблицы пользователей и возвращает их
 * в виде массива объектов типа ICreateUserParams.
 */
export async function getAllUsers(): Promise<ICreateUserParams[]> {
  return database.read(async () => {
    const collection = database.collections.get<Model>(Users.table);
    const users = await collection.query().fetch();
    return users.map((user) => ({
      // @ts-ignore
      fio: user.fio,
      // @ts-ignore
      phone: user.phone,
      // @ts-ignore
      position: user.position,
      // @ts-ignore
      password: user.password,
    }));
  });
}
