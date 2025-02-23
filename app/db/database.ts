// database.ts
import { appSchema, Database, Model, tableSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { field } from '@nozbe/watermelondb/decorators';
import { PositionOptionValue } from '../../global';

// Интерфейс для удобства валидации
interface IUserFields {
  fio: string;
  phone: string;
  position: string;
  password: string;
}

class User extends Model {
  static table = 'users';

  // @ts-ignore
  @field('fio') fio!: string;
  // @ts-ignore
  @field('phone') phone!: string;
  // @ts-ignore
  @field('position') position!: string;
  // @ts-ignore
  @field('password') password!: string;

  /**
   * Статический метод для проверки обязательных полей.
   * Если какое-либо поле отсутствует или поле position имеет недопустимое значение,
   * выбрасывается ошибка.
   */
  static validateFields(fields: Partial<IUserFields>) {
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

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'fio', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'position', type: 'string' },
        { name: 'password', type: 'string' },
      ],
    }),
  ],
});

const adapter = new SQLiteAdapter({ schema });

/**
 * И это — наш единственный экземпляр базы
 */
export const database = new Database({
  adapter,
  modelClasses: [User],
});

// Экспортируем модель User для использования в других файлах
export { User };
