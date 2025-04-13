// Файл: /global.d.ts

import { ICreateUsersParams } from './app/db/users';
import { tcpServerSendRequest } from './app/wifi/TcpServer';

/**
 * Интерфейс для ответа с pushUserId.
 */
export interface ISendPostResponseUserPushId {
  type: 'pushUserId';
  status: string | null;
}

/**
 * Интерфейс для ответа на запрос isHotspotEnabled.
 */
export interface ISendPostResponseIsHotspotEnabled {
  type: 'isHotspotEnabled';
  status: 'stopped' | 'running';
}

/**
 * Интерфейс для ответа на запрос setHotspotEnabled.
 */
export interface ISendPostResponseSetHotspotEnabled {
  type: 'setHotspotEnabled';
  ssid: string;
  password: string;
}

/**
 * Интерфейс для ответа на запрос setHotspotDisabled.
 */
export interface ISendPostResponseSetHotspotDisabled {
  type: 'setHotspotDisabled';
}

/**
 * Интерфейс для ответа на запрос проверки разрешений для hotspot.
 */
export interface ISendPostResponseCheckAndRequestPermissions {
  type: 'checkPermissionsHotspot';
}

/**
 * Интерфейсы для водителя.
 */
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

/**
 * Интерфейс для ответа currentUser.
 */
export interface ISendPostResponseCurrentUser {
  type: 'currentUser';
  status: 'authOk' | 'noAuth' | 'noUser';
  userData: ICreateUsersParams;
  kombainerData: ICreateKombainerParams | null;
  voditelData: ICreateVoditelParams | null;
}

/**
 * Интерфейс для ответа currentUser.
 */
export interface ISendPostResponseNeedRedirect {
  type: 'needRedirect';
  status: 'ok' | 'error' | 'empty';
  path: string;
  payload?: TNeedRedirectPayload;
}

// Интерфейсы ответов для создания и редактирования водителя
export interface ISendPostResponseCreateVoditel {
  type: 'createVoditel';
}
export interface ISendPostResponseEditVoditel {
  type: 'editVoditel';
}

/**
 * Интерфейс для ответа регистрации.
 */
export interface ISendPostResponseRegistration {
  type: 'registration';
  userId: string;
}

/**
 * Интерфейс для ответа создания комбайнера.
 */
export interface ISendPostResponseCreateKombainer {
  type: 'createKombainer';
}

/**
 * Интерфейс для ответа редактирования комбайнера.
 */
export interface ISendPostResponseEditKombainer {
  type: 'editKombainer';
}

/**
 * Интерфейс для ответа данных пользователя.
 */
export interface ISendPostResponseUserData {
  type: 'userData';
  userData: ICreateUsersParams;
}

/**
 * Интерфейс для ответа при авторизации.
 */
export interface ISendPostResponseLogin {
  type: 'login';
  userId: string;
}

/**
 * Интерфейс для ответа запуска hotspot.
 */
export interface ISendPostResponseStartHotspot {
  type: 'startHotspot';
  ssid: string;
  password: string;
}

/**
 * Интерфейс для ответа открытия QR-сканера.
 */
export interface ISendPostResponseOpenQRScanner {
  type: 'openCodeScannerPage';
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

export interface ISendPostMessageNeedRedirect {
  type: 'needRedirect';
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
 * Интерфейс для запроса создания водителя.
 */
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

/**
 * Интерфейс для запроса редактирования водителя.
 */
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
 * Интерфейс для запроса открытия QR-сканера.
 */
export interface ISendPostMessageOpenQRScanner {
  type: 'openCodeScannerPage';
}

/**
 * Интерфейс для запроса pushUserId.
 */
export interface ISendPostMessageUserPushId {
  type: 'pushUserId';
  status: string;
}

/**
 * Интерфейс для запроса проверки разрешений для hotspot.
 */
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

/**
 * Интерфейс для запроса присоединения к hotspot.
 */
export interface ISendPostMessageJoinHotspot {
  type: 'joinHotspot';
  data: {
    ssid: string;
    password: string;
  };
}

/**
 * Интерфейс для ответа на запрос joinHotspot.
 */
export interface ISendPostResponseJoinHotspot {
  type: 'joinHotspot';
  status: string;
}

export interface ISendPostMessageEnableKeepAwake {
  type: 'enableKeepAwake';
}

export interface ISendPostMessageDisableKeepAwake {
  type: 'disableKeepAwake';
}

export interface ISendPostResponseEnableKeepAwake {
  type: 'enableKeepAwake';
}

export interface ISendPostResponseDisableKeepAwake {
  type: 'disableKeepAwake';
}

/**
 * Интерфейс для запроса запуска TCP-сервера.
 */
export interface ISendPostMessageStartTcpServer {
  type: 'startTcpServer';
}

/**
 * Интерфейс для ответа запуска TCP-сервера.
 */
export interface ISendPostResponseStartTcpServer {
  type: 'startTcpServer';
  message: string;
}

/**
 * Интерфейс для запроса остановки TCP-сервера.
 */
export interface ISendPostMessageStopTcpServer {
  type: 'stopTcpServer';
}

/**
 * Интерфейс для ответа остановки TCP-сервера.
 */
export interface ISendPostResponseStopTcpServer {
  type: 'stopTcpServer';
  message: string;
}

/**
 * Интерфейс для запроса подключения к TCP-серверу.
 */
export interface ISendPostMessageConnectToTcpServer {
  type: 'connectToTcpServer';
  ip: string;
}

/**
 * Интерфейс для ответа подключения к TCP-серверу.
 */
export interface ISendPostResponseConnectToTcpServer {
  type: 'connectToTcpServer';
  message: string;
}

/**
 * Интерфейс для запроса подключения к TCP-серверу.
 */
export interface ISendTcpRequest {
  type: 'sendTcpRequest';
  data: ISendTcpRequestData;
}

export interface ISendTcpResponse {
  type: 'sendTcpRequest';
  data: ISendTcpResponseData;
}

export interface ITcpServerSendRequest {
  type: 'tcpServerSendRequest';
  data: ISendTcpRequestData;
}

export interface ITcpServerSendResponse {
  type: 'sendTcpRequest';
  data: ISendTcpResponseData;
}

export interface ITestTcpConnectEstablished {
  type: 'test';
}

export interface ISendTcpSetVoditelData {
  type: 'set_voditel_data';
  voditelData: ICreateVoditelParams;
}

export interface ISendTcpSetKombainerData {
  type: 'set_kombainer_data';
  kombainerData: ICreateKombainerParams;
}

export interface ISendTcpGetKombainerData {
  type: 'get_kombainer_data';
}

export interface ISendTcpConfirmKombainerTicket {
  type: 'confirm_kombainer_ticket';
  voditelData: ICreateVoditelParams;
  userData: ICreateUsersParams;
}

export interface ITcpResponseConfirmKombainerTicket {
  status: 'ok';
}

export interface ITcpResponseConnectEstablishedOk {
  status: 'ok';
}

export interface ITcpResponseKombainerData {
  kombainerData: ICreateKombainerParams;
}

/**
 *
 */
export type ISendTcpRequestData =
  | ITestTcpConnectEstablished
  | ISendTcpSetVoditelData
  | ISendTcpSetKombainerData
  | ISendTcpGetKombainerData
  | ISendTcpConfirmKombainerTicket;

export type ISendTcpResponseData =
  | ITcpResponseConnectEstablishedOk
  | ITcpResponseKombainerData
  | ITcpResponseConfirmKombainerTicket;

/**
 * Объединённый тип запросов.
 */
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
  | ISendPostMessageCheckAndRequestPermissions
  | ISendPostMessageCreateVoditel
  | ISendPostMessageEditVoditel
  | ISendPostMessageJoinHotspot
  | ISendPostMessageNeedRedirect
  | ISendPostMessageEnableKeepAwake
  | ISendPostMessageDisableKeepAwake
  | ISendPostMessageStartTcpServer
  | ISendPostMessageStopTcpServer
  | ISendPostMessageConnectToTcpServer
  | ISendTcpRequest
  | ITcpServerSendRequest;

/**
 * Объединённый тип ответов.
 */
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
  | ISendPostResponseEditVoditel
  | ISendPostResponseJoinHotspot
  | ISendPostResponseNeedRedirect
  | ISendPostResponseEnableKeepAwake
  | ISendPostResponseDisableKeepAwake
  | ISendPostResponseStartTcpServer
  | ISendPostResponseStopTcpServer
  | ISendPostResponseConnectToTcpServer
  | ISendTcpResponse
  | ITcpServerSendResponse;

/**
 * Интерфейс запроса с идентификатором.
 */
export interface ISendPostMessageRequest {
  req: ISendPostMessage;
  reqId: string;
}

/**
 * Интерфейс для нативного сообщения (если используется).
 */
export type ISendNativeMessage = ISendPostMessageUserPushId | ISendPostMessageSendPostResponse;

export interface ISendNativeMessageRequest {
  native: ISendNativeMessage;
  reqId: string;
}

/**
 * Тип ответа для postMessage.
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
  // Игнорируемые сообщения
  | {
      type: 'webpackOk' | 'webpackClose' | 'webpackErrors' | 'webpackInvalid' | 'webpackHot';
      reqId?: string;
      resType?: 'reject';
      error?: any;
    };

/**
 * Интерфейс обратного вызова для postMessage.
 */
export interface IPostMessageCallback {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  timerId: NodeJS.Timeout | number;
}

/**
 * Интерфейс для создания пользователя.
 */
export interface ICreateUserParams {
  fio: string;
  phone: string;
  position: string;
  password: string;
}

/**
 * Интерфейс для полей таблицы kombainers.
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
 * Интерфейс для редактирования комбайнера.
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
 * Интерфейс для авторизации пользователя.
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

// Строго задаём страницы для каждой роли
export interface KombainerRoutes {
  index: string;
  create_ticket: string;
  wait_ticket_confirm: string;
  ticket_detail: string;
  ticket_detail_after_voditel_confirm: string;
  qr_code: string;
}

export interface VoditelRoutes {
  index: string;
  create_trip: string;
  qr_scanner: string;
  wait_kombainer_data: string;
  ticket_detail: string;
}

export interface BunkeristRoutes {
  index: string;
  create_ticket: string;
}

export interface RolesRoutesMap {
  kombainer: KombainerRoutes;
  voditel: VoditelRoutes;
  bunkerist: BunkeristRoutes;
}

export interface JoinHotspotResponse {
  ip: string;
}

export interface IPayloadVoditelData {
  voditelData: ICreateVoditelParams;
}

export interface IPayloadConfirmKombainerTicket {
  voditelData: ICreateVoditelParams;
  userData: ICreateUsersParams;
}

export type TNeedRedirectPayload =
  | JoinHotspotResponse
  | IPayloadVoditelData
  | IPayloadConfirmKombainerTicket;
