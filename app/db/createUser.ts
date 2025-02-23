// createUser.ts
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';
import { database, User } from './database'; // <-- импортируем из единственного источника
import { Model } from '@nozbe/watermelondb';
import { ICreateUserParams } from '../../global';

export async function createUser({
  fio,
  phone,
  position,
  password,
}: ICreateUserParams): Promise<string> {
  // Выполняем валидацию через модель User
  User.validateFields({ fio, phone, position, password });

  return database.write(async () => {
    const collection = database.collections.get<Model>('users');
    const newUser = await collection.create((user) => {
      // @ts-ignore
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
