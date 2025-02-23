// users.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database } from './database'; // <-- импортируем из единственного источника
import { Model, tableSchema } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { ICreateUserParams, PositionOptionValue } from '../../global';

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
