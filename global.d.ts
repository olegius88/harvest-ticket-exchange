// Файл: /global.d.ts

import { ICreateUsersParams } from './app/db/users';

export interface ISendPostResponseUserPushId {
  type: 'pushUserId';
  status: string | null;
}

export interface ISendPostResponseIsHotspotEnabled {
  type: 'isHotspotEnabled';
  ssid: string;
  password: string;
}

export interface ISendPostResponseSetHotspotEnabled {
  type: 'setHotspotEnabled';
  ssid: string;
  password: string;
}

export interface ISendPostResponseSetHotspotDisabled {
  type: 'setHotspotDisabled';
  ssid: string;
  password: string;
}

/**
 * Интерфейс для ответа по запросу получения данных текущего пользователя.
 */
export interface ISendPostResponseCurrentUser {
  type: 'currentUser';
  status: string | null;
  kombainerData: ICreateKombainerParams;
  userData: ICreateUsersParams;
}

/**
 * Интерфейс для ответа по регистрации.
 */
export interface ISendPostResponseRegistration {
  type: 'registration';
  userId: string;
}

/**
 * Интерфейс для ответа по созданию комбайнера.
 */
export interface ISendPostResponseCreateKombainer {
  type: 'createKombainer';
}

/**
 * Интерфейс для ответа по запросу данных пользователя.
 */
export interface ISendPostResponseUserData {
  type: 'userData';
  userData: ICreateUsersParams;
}

/**
 * Интерфейс для ответа по авторизации.
 */
export interface ISendPostResponseLogin {
  type: 'login';
  userId: string;
}

/**
 * Интерфейс для ответа по созданию hotspot.
 */
export interface ISendPostResponseStartHotspot {
  type: 'startHotspot';
  ssid: string;
  password: string;
}

/**
 * Интерфейс для запроса регистрации.
 */
export interface ISendPostMessageRegistration {
  type: 'registration';
  data: ICreateUserParams;
}

/**
 * Интерфейс для запроса авторизации.
 */
export interface ISendPostMessageLogin {
  type: 'login';
  data: ILoginForm;
}

/**
 * Интерфейс для запроса проверки авторизации.
 */
export interface ISendPostMessageCurrentUser {
  type: 'currentUser';
  data: IAuthCheck;
}

/**
 * Интерфейс для запроса данных пользователя.
 */
export interface ISendPostMessageUserData {
  type: 'userData';
  data: ICreateUsersParams;
}

/**
 * Интерфейс для запроса создания комбайнера.
 */
export interface ISendPostMessageCreateKombainer {
  type: 'createKombainer';
  data: ICreateKombainerParams;
}

/**
 * Интерфейс для запроса запуска hotspot.
 */
export interface ISendPostMessageStartHotspot {
  type: 'startHotspot';
}

export interface ISendPostMessageUserPushId {
  type: 'pushUserId';
  status: string;
}
export interface ISendPostMessageIsHotspotEnabled {
  type: 'isHotspotEnabled';
}
export interface ISendPostMessageSetHotspotEnabled {
  type: 'setHotspotEnabled';
}
export interface ISendPostMessageSetHotspotDisabled {
  type: 'setHotspotDisabled';
}

export interface IVoid {
  type: 'void';
}

export type ISendPostMessage =
  | ISendPostMessageLogin
  | ISendPostMessageRegistration
  | ISendPostMessageCurrentUser
  | ISendPostMessageCreateKombainer
  | ISendPostMessageUserData
  | ISendPostMessageStartHotspot
  | ISendPostMessageUserPushId
  | ISendPostMessageIsHotspotEnabled
  | ISendPostMessageSetHotspotEnabled
  | ISendPostMessageSetHotspotDisabled;

export type ISendPostResponseRes =
  | ISendPostResponseCurrentUser
  | ISendPostResponseRegistration
  | ISendPostResponseLogin
  | ISendPostResponseCreateKombainer
  | ISendPostResponseUserData
  | ISendPostResponseStartHotspot
  | ISendPostResponseUserPushId
  | ISendPostResponseIsHotspotEnabled
  | ISendPostResponseSetHotspotEnabled
  | ISendPostResponseSetHotspotDisabled;

export interface ISendPostMessageRequest {
  req: ISendPostMessage;
  reqId: string;
}

export type ISendNativeMessage = ISendPostMessageUserPushId;

export interface ISendNativeMessageRequest {
  native: ISendNativeMessage;
  reqId: string;
}

/**
 * Если resType === 'reject', то 'res' не нужно, но 'error' обязательно.
 * Если resType === 'resolve', то 'res' обязательно, а 'error' не нужно.
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
      res: ISendPostResponseRes;
      error?: any; // При 'resolve' не используем поле 'error'
    }
  // игнорируемые сообщения
  | {
      type: 'webpackOk' | 'webpackClose' | 'webpackErrors' | 'webpackInvalid';
      reqId?: string;
      resType?: 'reject';
      error?: any;
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

/**
 * Интерфейс для полей в таблице kombainers
 */
export interface ICreateKombainerParams {
  userId: string;
  combine: string; // "комбайн"
  brigade: string; // "бригада"
  culture: string; // "культура"
  field: string; // "поле"
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Интерфейс для конфигураций
 */
export interface IConfigParams {
  key: string;
  value: string;
}

/**
 * Интерфейс, описывающий параметры для авторизации пользователя
 */
export interface ILoginUserParams {
  phone: string;
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

/**
 * Интерфейс для формы регистрации комбайнера
 */
interface IKombainerForm {
  combine: string; // "Комбайн"
  brigade: string; // "Бригада"
  culture: string; // "Культура"
  field: string; // "Поле"
}

export type UserContext = PositionOptionValue;

export interface IAuthCheck {
  context: UserContext;
}

export type IGetConfigKey = 'currentUserId';

export interface IGetConfigParam {
  key: IGetConfigKey;
  value: string;
}
