// Файл: /global.d.ts

import { ICreateUsersParams } from './app/db/users';

export interface ISendPostResponseUserPushId {
  type: 'pushUserId';
  status: string | null;
}

export interface ISendPostResponseIsHotspotEnabled {
  type: 'isHotspotEnabled';
  status: 'stopped' | 'running';
}

export interface ISendPostResponseSetHotspotEnabled {
  type: 'setHotspotEnabled';
  ssid: string;
  password: string;
}

export interface ISendPostResponseSetHotspotDisabled {
  type: 'setHotspotDisabled';
}

export interface ISendPostResponseCheckAndRequestPermissions {
  type: 'checkPermissionsHotspot';
}

// Интерфейсы для водителя
export interface ICreateVoditelParams {
  id?: string;
  userId: string;
  transport: string;
  created_at?: number;
  updated_at?: number;
}

export interface IEditVoditelParams {
  voditelId: string;
  userId: string;
  transport: string;
  created_at?: number;
  updated_at?: number;
}

export interface ISendPostResponseCurrentUser {
  type: 'currentUser';
  status: string | null;
  userData: ICreateUsersParams;
  kombainerData: ICreateKombainerParams | null;
  voditelData: ICreateVoditelParams | null;
}

// Интерфейсы ответов для создания и редактирования водителя
export interface ISendPostResponseCreateVoditel {
  type: 'createVoditel';
}
export interface ISendPostResponseEditVoditel {
  type: 'editVoditel';
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
 * Интерфейс для ответа по редактированию комбайнера.
 */
export interface ISendPostResponseEditKombainer {
  type: 'editKombainer';
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
 * Интерфейс для ответа по открытию сканера QR.
 */
export interface ISendPostResponseOpenQRScanner {
  type: 'openQRScanner';
  status: string;
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

export interface ISendPostMessageCreateVoditel {
  type: 'createVoditel';
  data: ICreateVoditelParams;
}

/**
 * Интерфейс для запроса редактирования комбайнера.
 */
export interface ISendPostMessageEditKombainer {
  type: 'editKombainer';
  data: IEditKombainerParams;
}

export interface ISendPostMessageEditVoditel {
  type: 'editVoditel';
  data: IEditVoditelParams;
}

/**
 * Интерфейс для запроса запуска hotspot.
 */
export interface ISendPostMessageStartHotspot {
  type: 'startHotspot';
}

/**
 * Интерфейс для запроса открытия сканера QR.
 */
export interface ISendPostMessageOpenQRScanner {
  type: 'openQRScanner';
}

export interface ISendPostMessageUserPushId {
  type: 'pushUserId';
  status: string;
}

export interface ISendPostMessageCheckAndRequestPermissions {
  type: 'checkPermissionsHotspot';
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

export interface ISendPostMessageSendPostResponse {
  type: 'sendPostResponse';
}

export interface IVoid {
  type: 'void';
}

export type ISendPostMessage =
  | ISendPostMessageLogin
  | ISendPostMessageRegistration
  | ISendPostMessageCurrentUser
  | ISendPostMessageCreateKombainer
  | ISendPostMessageEditKombainer
  | ISendPostMessageUserData
  | ISendPostMessageStartHotspot
  | ISendPostMessageOpenQRScanner
  | ISendPostMessageUserPushId
  | ISendPostMessageIsHotspotEnabled
  | ISendPostMessageSetHotspotEnabled
  | ISendPostMessageSetHotspotDisabled
  | ISendPostMessageSendPostResponse
  | ISendPostMessageCheckAndRequestPermissions
  | ISendPostMessageCreateVoditel
  | ISendPostMessageEditVoditel;

export type ISendPostResponseRes =
  | ISendPostResponseCurrentUser
  | ISendPostResponseRegistration
  | ISendPostResponseLogin
  | ISendPostResponseCreateKombainer
  | ISendPostResponseEditKombainer
  | ISendPostResponseUserData
  | ISendPostResponseStartHotspot
  | ISendPostResponseOpenQRScanner
  | ISendPostResponseUserPushId
  | ISendPostResponseIsHotspotEnabled
  | ISendPostResponseSetHotspotEnabled
  | ISendPostResponseSetHotspotDisabled
  | ISendPostResponseCheckAndRequestPermissions
  | ISendPostResponseCreateVoditel
  | ISendPostResponseEditVoditel;

export interface ISendPostMessageRequest {
  req: ISendPostMessage;
  reqId: string;
}

export type ISendNativeMessage = ISendPostMessageUserPushId | ISendPostMessageSendPostResponse;

export interface ISendNativeMessageRequest {
  native: ISendNativeMessage;
  reqId: string;
}

/**
 * Если resType === 'reject', то поле res не используется, а error обязательно.
 * Если resType === 'resolve', то поле res обязательно, а error не используется.
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
      type: 'webpackOk' | 'webpackClose' | 'webpackErrors' | 'webpackInvalid' | 'webpackHot';
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
 * Интерфейс, описывающий параметры для создания пользователя.
 */
export interface ICreateUserParams {
  fio: string;
  phone: string;
  position: string;
  password: string;
}

/**
 * Интерфейс для полей в таблице kombainers.
 */
export interface ICreateKombainerParams {
  id?: string;
  userId: string;
  combine: string;
  brigade: string;
  culture: string;
  field: string;
  created_at?: number;
  updated_at?: number;
}

/**
 * Интерфейс для полей в таблице kombainers.
 */
export interface IEditKombainerParams {
  kombainerId: string;
  userId: string;
  combine: string; // "комбайн"
  brigade: string; // "бригада"
  culture: string; // "культура"
  field: string; // "поле"
  created_at?: number;
  updated_at?: number;
}

/**
 * Интерфейс для конфигураций.
 */
export interface IConfigParams {
  key: string;
  value: string;
}

/**
 * Интерфейс, описывающий параметры для авторизации пользователя.
 */
export interface ILoginUserParams {
  phone: string;
  password: string;
}

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
