//global.d.ts

export interface ISendPostResponsePushToken {
  mode: 'getPushToken';
  pushUserId: string;
  pushToken: string;
}
export interface ISendPostResponseRegistration {
  mode: 'registration';
  userId: string;
}

/**
 * Если resType === 'reject', то 'res' не нужно, но 'e' обязательно.
 * Если resType === 'resolve', то 'res' обязательно, а 'e' не нужно.
 */
export type ISendPostResponse =
  | {
      reqId: string;
      type: 'sendPostResponse';
      resType: 'reject';
      error: any; // Обязательно при 'reject'
      res?: undefined; // При 'reject' не используем поле 'res'
    }
  | {
      reqId: string;
      type: 'sendPostResponse';
      resType: 'resolve';
      res: ISendPostResponsePushToken | ISendPostResponseRegistration; // Обязательно при 'resolve'
      error?: any; // При 'resolve' не используем поле 'error'
    };

export interface IPostMessageCallback {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  timerId: NodeJS.Timeout;
}

/**
 * Интерфейс, описывающий параметры для создания пользователя
 */
export interface ICreateUserParams {
  fio: string;
  phone: string;
  position: string;
  password: string;
}

export type PositionOptionValue = 'kombainer' | 'voditel' | 'bunkerist';

export interface IOption {
  value: PositionOptionValue;
  label: string;
}

export interface ILoginForm {
  phone: string;
  password: string;
}

export type UserContext = PositionOptionValue;
