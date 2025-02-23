//global.d.ts

export interface ISendPostResponseAuthCheck {
  type: 'authCheck';
  status: 'authOk' | 'noAuth';
}
export interface ISendPostResponseRegistration {
  type: 'registration';
  userId: string;
}

export interface ISendPostMessage {
  type: 'registration' | 'login' | 'authCheck';
  data: ILoginForm | IAuthCheck | ICreateUserParams;
}

export interface ISendPostMessageRequest {
  req: ISendPostMessage;
  reqId: string;
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
      res: ISendPostResponseAuthCheck | ISendPostResponseRegistration; // Обязательно при 'resolve'
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

// Расширяем ICreateUserParams, добавляя confirmPassword для формы регистрации
export interface IRegistrationForm extends ICreateUserParams {
  confirmPassword: string;
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

export interface IAuthCheck {
  context: UserContext;
}

export type IGetConfigKey = ISendPostResponseAuthCheck['type'];

export interface IGetConfigParam {
  key: IGetConfigKey;
  value: string;
}
