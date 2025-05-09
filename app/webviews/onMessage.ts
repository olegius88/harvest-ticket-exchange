// app/webviews/onMessage.ts
/**
 * Этот файл отвечает за обработку входящих сообщений от WebView.
 * Он разбит на следующие разделы:
 * 1. Импорты и объявления
 * 2. Утилиты: отправка ответа, проверка разрешений
 * 3. Обработчики нативных сообщений (_handleNativeMessage)
 * 4. Обработчики сообщений запроса (_handleReqMessage)
 * 5. Основная функция onMessage
 */

import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { createRef } from 'react';
import { DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import KeepAwake from 'react-native-keep-awake';
import DeviceInfo from 'react-native-device-info';
import {
  ICreateKombainerParams,
  ICreateTalonParams,
  ICreateVoditelParams,
  IEditKombainerParams,
  IEditTalonParams,
  IEditVoditelParams,
  ILoginUserParams,
  ISendNativeMessageRequest,
  ISendPostMessageRequest,
  ISendPostResponse,
  ISendTcpResponseData,
  TalonStatus,
} from '../../global';
import {
  createUser,
  getAllUsers,
  getUserById,
  ICreateUsersParams,
  loginUser,
  editUser,
} from '../db/users';
import { getConfig, setConfig } from '../db/configs';
import {
  createKombainer,
  editKombainer,
  getKombainerById,
  getKombainerByUserId,
} from '../db/kombainers';
import { createVoditel, editVoditel, getVoditelByUserId } from '../db/viditels';
import {
  assignDriverToTalon,
  createTalon,
  editTalon,
  getTalonById,
  getTalonsByKombainerId,
  getTalonsByVoditelId,
  updateTalonStatus,
  updateTalonWeight,
} from '../db/talons_of_combainers';
import { NotFoundError, VoidAndNotError } from '../exceptions/exceptionsClasses';
import { startTcpServer, stopTcpServer, tcpServerSendRequest } from '../wifi/TcpServer';
import { connectToTcpServer, sendTcpRequest } from '../wifi/TcpClient';

// Глобальные переменные для перенаправления
export let needRedirect: string | null;
export let needRedirectStatus: 'ok' | 'error' | 'empty' = 'empty';
export let needRedirectPayload: any;
export const setNeedRedirect = (data: string, payload?: any): void => {
  console.log('setNeedRedirect|data=', data);
  needRedirect = data;
  needRedirectStatus = 'ok';
  needRedirectPayload = payload;
};

// Создаем реф для WebView с помощью createRef (а не хука useRef)
export const webviewRef = createRef<WebView>();

/**
 * Утилита отправки ответа в WebView.
 */
const sendPostResponse = (obj: ISendPostResponse): void => {
  // console.log('sendPostResponse|obj=', obj);
  if (!webviewRef.current) {
    console.error('sendPostResponse|!webviewRef.current');
    return;
  }
  webviewRef.current.postMessage(JSON.stringify(obj));
};

/**
 * Проверка и запрос разрешений для работы с Wi-Fi (для Android).
 */
export const checkPermissionsHotspot = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  // Проверяем, включён ли режим определения местоположения.
  const locationEnabled = await DeviceInfo.isLocationEnabled();
  if (!locationEnabled) {
    console.log('checkPermissionsHotspot|locationEnabled = false');
    return false;
  }

  const permissions = [
    PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];

  const granted = await PermissionsAndroid.requestMultiple(permissions);
  const allGranted = permissions.every(
    (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
  );

  console.log('checkPermissionsHotspot|allGranted=', allGranted);
  return allGranted;
};

/**
 * Проверка и запрос разрешений для работы с камерой и записи аудио (для Android).
 */
const checkCameraAudioPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const permissions = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];
  const granted = await PermissionsAndroid.requestMultiple(permissions);
  const allGranted = permissions.every(
    (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
  );
  console.log('checkCameraAudioPermissions|allGranted=', allGranted);
  return allGranted;
};

/**
 * Обработчик нативных сообщений.
 */
const _handleNativeMessage = async (
  eventData: ISendNativeMessageRequest
): Promise<ISendPostResponse> => {
  console.log('_handleNativeMessage|eventData=', eventData);
  const { native, reqId } = eventData;
  console.log('_handleNativeMessage|native.type=', native.type);

  switch (native.type) {
    case 'sendPostResponse':
      return eventData.native as unknown as ISendPostResponse;
    case 'pushUserId':
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'pushUserId', status: native.status },
      };
    default:
      console.error('_handleNativeMessage|native|switch|default|eventData=', eventData);
      throw new Error(
        `_handleNativeMessage|native|switch|default|eventData=${JSON.stringify(eventData)}`
      );
  }
};

/**
 * Обработчик сообщений запроса.
 */
const _handleReqMessage = async (
  eventData: ISendPostMessageRequest
): Promise<ISendPostResponse> => {
  const { req, reqId } = eventData;
  console.log('_handleReqMessage|req.type=', req.type, req);
  const type = req.type;

  if (reqId === 'ignore') {
    throw new VoidAndNotError('');
  }

  switch (type) {
    case 'login': {
      const loginData = req.data as ILoginUserParams;
      console.log('login|req.data=', loginData);
      const users = await getAllUsers();
      console.log('login|users=', users);
      const userId = await loginUser(loginData);
      console.log('login|userId=', userId);
      try {
        await setConfig({ key: 'currentUserId', value: userId });
      } catch (error) {
        console.error('login|setConfig|error=', error);
        throw new Error('Ошибка установки конфигурации');
      }
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, userId },
      };
    }
    case 'checkPermissionsHotspot': {
      await checkPermissionsHotspot();
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'checkPermissionsHotspot' },
      };
    }
    case 'registration': {
      const userData = req.data as ICreateUsersParams;
      console.log('registration|req.data=', userData);
      const userId = await createUser(userData);
      console.log('registration|userId=', userId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, userId },
      };
    }
    case 'createKombainer': {
      const kombainerData = req.data as ICreateKombainerParams;
      console.log('createKombainer|req.data=', kombainerData);
      const userId = await createKombainer(kombainerData);
      console.log('createKombainer|userId=', userId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type },
      };
    }
    case 'editKombainer': {
      const editData = req.data as IEditKombainerParams;
      console.log('editKombainer|req.data=', editData);
      try {
        const kombData = await getKombainerById(editData.kombainerId);
        console.log('editKombainer|kombainerData=', kombData);
      } catch (e) {
        console.error('editKombainer|getKombainerById|error=', e);
        throw e;
      }
      const updatedId = await editKombainer(editData);
      console.log('editKombainer|updatedId=', updatedId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type },
      };
    }
    case 'createVoditel': {
      const voditelData = req.data as ICreateVoditelParams;
      console.log('createVoditel|req.data=', voditelData);
      const userId = await createVoditel(voditelData);
      console.log('createVoditel|userId=', userId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type },
      };
    }
    case 'editVoditel': {
      const editData = req.data as IEditVoditelParams;
      console.log('editVoditel|req.data=', editData);
      const voditelRecord = await getVoditelByUserId(editData.userId);
      console.log('editVoditel|voditelData=', voditelRecord);
      const updatedId = await editVoditel(editData);
      console.log('editVoditel|updatedId=', updatedId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type },
      };
    }
    case 'needRedirect': {
      const path = needRedirect;
      const payload = needRedirectPayload;
      const status = needRedirectStatus;
      needRedirect = null;
      needRedirectPayload = null;
      needRedirectStatus = 'empty';
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
          status,
          path: path || '', // Provide empty string as fallback when path is null
          payload,
        },
      };
    }
    case 'currentUser': {
      const currentUserId = await getConfig('currentUserId');
      console.log('currentUser|currentUserId=', currentUserId);
      if (!currentUserId) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type,
            status: 'noAuth',
            userData: null,
            kombainerData: null,
            kombainerUserData: null,
            voditelData: null,
          },
        };
      }
      let userData: ICreateUsersParams;
      try {
        userData = await getUserById(currentUserId);
        console.log('currentUser|userData=', userData);
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type,
            status: 'noAuth',
            userData: null,
            kombainerData: null,
            kombainerUserData: null,
            voditelData: null,
          },
        };
      }
      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('currentUser|kombainerData=', kombainerData);
      const voditelData = await getVoditelByUserId(currentUserId);
      console.log('currentUser|voditelData=', voditelData);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
          status: 'authOk',
          userData,
          kombainerData,
          kombainerUserData: userData,
          voditelData,
        },
      };
    }
    // Открытие сканера QR
    case 'openCodeScannerPage': {
      console.log('openCodeScannerPage|req.data=', req);
      const hasCameraAudioPermissions = await checkCameraAudioPermissions();
      if (!hasCameraAudioPermissions) {
        console.error('openCodeScannerPage|Нет разрешений для камеры и аудио');
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: 'Нет разрешений для камеры и аудио' },
        };
      }
      // Отправляем событие, которое можно отловить в главном компоненте приложения для навигации на экран сканера QR
      DeviceEventEmitter.emit('openCodeScannerPage');
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, status: 'scannerOpened' },
      };
    }
    case 'isHotspotEnabled': {
      const callNativeBridge = `
        if (window.NativeBridge && window.NativeBridge.getHotspotStatus) {
          const statusRes = window.NativeBridge.getHotspotStatus('${reqId}');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            native: {
              reqId: '${reqId}',
              type: 'sendPostResponse',
              resType: 'resolve',
              res: { type: 'isHotspotEnabled', state: JSON.parse(statusRes).status }
            }
          }));
          console.log('isHotspotEnabled|statusRes=', statusRes);
        } else {
          console.log('isHotspotEnabled|NativeBridge не доступен');
          window.ReactNativeWebView.postMessage("NativeBridge не доступен");
        }
        true;
      `;
      if (!webviewRef.current) {
        console.error('isHotspotEnabled|webviewRef.current is null');
        throw new Error('webviewRef.current is null');
      }
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'setHotspotEnabled': {
      const callNativeBridge = `
        if (window.NativeBridge && window.NativeBridge.startHotspot) {
          const startRes = JSON.parse(window.NativeBridge.startHotspot('${reqId}'));
          console.log('setHotspotEnabled|startRes=', startRes);
          if (startRes.status === 'error') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              native: {
                reqId: '${reqId}',
                type: 'sendPostResponse',
                resType: 'reject',
                res: { type: 'setHotspotEnabled', status: startRes.status, error: startRes.error }
              }
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              native: {
                reqId: '${reqId}',
                type: 'sendPostResponse',
                resType: 'resolve',
                res: { type: 'setHotspotEnabled', status: startRes.status, ssid: startRes.ssid, password: startRes.password }
              }
            }));
          }
        } else {
          console.log('setHotspotEnabled|NativeBridge не доступен');
          window.ReactNativeWebView.postMessage("NativeBridge не доступен");
        }
        true;
      `;
      if (!webviewRef.current) {
        console.error('setHotspotEnabled|webviewRef.current is null');
        throw new Error('webviewRef.current is null');
      }
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'setHotspotDisabled': {
      await setHotspotDisabled(reqId);
      throw new VoidAndNotError('');
    }
    case 'pushUserId': {
      const callNativeBridge = `
        if (window.NativeBridge && window.NativeBridge.getPushUserId) {
          const userId = window.NativeBridge.getPushUserId('${reqId}');
          window.ReactNativeWebView.postMessage(userId);
          console.log('pushUserId|userId=', userId);
        } else {
          console.log('pushUserId|NativeBridge не доступен');
          window.ReactNativeWebView.postMessage("NativeBridge не доступен");
        }
        true;
      `;
      if (!webviewRef.current) {
        console.error('pushUserId|webviewRef.current is null');
        throw new Error('webviewRef.current is null');
      }
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    // Присоединение к существующему хотспоту
    case 'joinHotspot': {
      const { ssid, password } = req.data as { ssid: string; password: string };
      const callNativeBridge = `
        if (window.NativeBridge && window.NativeBridge.joinHotspot) {
          window.NativeBridge.joinHotspot('${ssid}', '${password}');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            native: {
              reqId: '${reqId}',
              type: 'sendPostResponse',
              resType: 'resolve',
              res: { type: 'joinHotspot', status: 'joining' }
            }
          }));
          console.log('joinHotspot|NativeBridge.joinHotspot вызван с ssid: ${ssid} и password: ${password}');
        } else {
          console.log('joinHotspot|NativeBridge не доступен');
          window.ReactNativeWebView.postMessage(JSON.stringify({
            native: {
              reqId: '${reqId}',
              type: 'sendPostResponse',
              resType: 'reject',
              res: { type: 'joinHotspot', error: 'NativeBridge.joinHotspot not available' }
            }
          }));
        }
        true;
      `;
      if (!webviewRef.current) {
        console.error('joinHotspot|webviewRef.current is null');
        throw new Error('webviewRef.current is null');
      }
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'userData': {
      const currentUserId = await getConfig('currentUserId');
      console.log('userData|currentUserId=', currentUserId);
      if (!currentUserId) {
        throw new NotFoundError(`Пользователь с ID ${currentUserId} не найден.`);
      }
      const userData = await getUserById(currentUserId);
      console.log('userData|data=', userData);
      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('userData|kombainerData=', kombainerData);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, userData },
      };
    }
    case 'enableKeepAwake': {
      console.log('enableKeepAwake|активация удержания экрана');
      KeepAwake.activate();
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'enableKeepAwake' },
      };
    }
    case 'disableKeepAwake': {
      console.log('disableKeepAwake|деактивация удержания экрана');
      KeepAwake.deactivate();
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'disableKeepAwake' },
      };
    }
    case 'startTcpServer': {
      try {
        const message = await startTcpServer();
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: { type: 'startTcpServer', message },
        };
      } catch (error) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }
    case 'stopTcpServer': {
      try {
        const message = await stopTcpServer();
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: { type: 'stopTcpServer', message },
        };
      } catch (error) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }
    case 'connectToTcpServer': {
      try {
        const message = await connectToTcpServer({ ip: req.ip });
        console.log('connectToTcpServer|message=', message);
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: { type: 'connectToTcpServer', message },
        };
      } catch (error) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }
    case 'sendTcpRequest': {
      try {
        const data: ISendTcpResponseData = await sendTcpRequest(req.data);
        console.log('sendTcpRequest|data=', data);
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: { type: 'sendTcpRequest', data },
        };
      } catch (error) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }
    case 'tcpServerSendRequest': {
      try {
        const data: ISendTcpResponseData = await tcpServerSendRequest(req.data);
        console.log('sendTcpRequest|data=', data);
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: { type: 'sendTcpRequest', data },
        };
      } catch (error) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }
    case 'createTalon': {
      const talonData = req.data as ICreateTalonParams;
      console.log('createTalon|req.data=', talonData);
      const talonId = await createTalon(talonData);
      console.log('createTalon|talonId=', talonId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, talonId },
      };
    }

    case 'editTalon': {
      const editData = req.data as IEditTalonParams;
      console.log('editTalon|req.data=', editData);
      const talonId = await editTalon(editData);
      console.log('editTalon|talonId=', talonId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, talonId },
      };
    }

    case 'assignDriverToTalon': {
      const { talonId, voditelId } = req.data as { talonId: string; voditelId: string };
      console.log('assignDriverToTalon|req.data=', { talonId, voditelId });
      const updatedTalonId = await assignDriverToTalon(talonId, voditelId);
      console.log('assignDriverToTalon|updatedTalonId=', updatedTalonId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, talonId: updatedTalonId },
      };
    }

    case 'updateTalonStatus': {
      const { talonId, status } = req.data as { talonId: string; status: TalonStatus };
      console.log('updateTalonStatus|req.data=', { talonId, status });
      const updatedTalonId = await updateTalonStatus(talonId, status);
      console.log('updateTalonStatus|updatedTalonId=', updatedTalonId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, talonId: updatedTalonId },
      };
    }

    case 'updateTalonWeight': {
      const { talonId, weight } = req.data as { talonId: string; weight: number };
      console.log('updateTalonWeight|req.data=', { talonId, weight });
      const updatedTalonId = await updateTalonWeight(talonId, weight);
      console.log('updateTalonWeight|updatedTalonId=', updatedTalonId);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, talonId: updatedTalonId },
      };
    }

    case 'getTalonById': {
      const { talonId } = req.data as { talonId: string };
      console.log('getTalonById|req.data=', { talonId });
      const talon = await getTalonById(talonId);
      console.log('getTalonById|talon=', talon);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'getTalonById', talon },
      };
    }

    case 'getTalonsByKombainerId': {
      const { kombainerId } = req.data as { kombainerId: string };
      console.log('getTalonsByKombainerId|req.data=', { kombainerId });
      const talons = await getTalonsByKombainerId(kombainerId);
      console.log('getTalonsByKombainerId|talons.length=', talons.length);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'getTalonsByKombainerId', talons },
      };
    }

    case 'getTalonsByVoditelId': {
      const { voditelId } = req.data as { voditelId: string };
      console.log('getTalonsByVoditelId|req.data=', { voditelId });
      const talons = await getTalonsByVoditelId(voditelId);
      console.log('getTalonsByVoditelId|talons.length=', talons.length);
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type, talons },
      };
    }

    case 'checkUserRegistration': {
      // Проверка, зарегистрирован ли пользователь
      try {
        const currentUserId = await getConfig('currentUserId');
        console.log('checkUserRegistration|currentUserId=', currentUserId);

        // Если ID пользователя есть в конфигурации, проверяем существование записи
        if (currentUserId) {
          try {
            const userData = await getUserById(currentUserId);
            return {
              reqId,
              type: 'sendPostResponse',
              resType: 'resolve',
              res: {
                type,
                isRegistered: true,
                userData,
              },
            };
          } catch (error) {
            // Если пользователь не найден, сбрасываем ID в конфигурации
            if (error instanceof NotFoundError) {
              await setConfig({ key: 'currentUserId', value: null });
            }
          }
        }

        // Если пользователь не найден или ID отсутствует
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type,
            isRegistered: false,
          },
        };
      } catch (error) {
        console.error('checkUserRegistration|error=', error);
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }

    case 'updateUserProfile': {
      try {
        const { userId, fio, phone, position } = req.data as {
          userId: string;
          fio: string;
          phone: string;
          position: string;
        };

        console.log('updateUserProfile|req.data=', { userId, fio, phone, position });

        // Проверяем существование пользователя
        await getUserById(userId);

        // Обновляем данные пользователя
        const updatedUserId = await editUser(userId, fio, phone, position);
        console.log('updateUserProfile|updatedUserId=', updatedUserId);

        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type,
            userId: updatedUserId,
            status: 'ok',
          },
        };
      } catch (error) {
        console.error('updateUserProfile|error=', error);
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: { message: error.message || JSON.stringify(error) },
        };
      }
    }
    default:
      console.error('_handleReqMessage|eventData|switch|default|eventData=', eventData);
      throw new Error(
        `_handleReqMessage|eventData|switch|default|eventData=${JSON.stringify(eventData)}`
      );
  }
};

// todo вынести в эту отдельную функцию все что касается talons_of_combainers
const _talonsofCombainers = () => {};

/**
 * Основная функция обработки сообщений, полученных из WebView.
 */
export const onMessage = async (event: WebViewMessageEvent): Promise<void> => {
  console.log('onMessage');
  if (!event || !event.nativeEvent || !event.nativeEvent.data) {
    console.log('Invalid event data', { event });
    return;
  }

  const nativeEventData = event.nativeEvent.data;
  let eventData: ISendPostMessageRequest & ISendNativeMessageRequest;

  try {
    eventData = JSON.parse(nativeEventData);
  } catch (error) {
    console.error('JSON.parse error:', error, 'Data:', nativeEventData);
    return;
  }

  console.log('onMessage|eventData=', eventData);
  if (!eventData) {
    console.error('Empty eventData');
    return;
  }

  const { reqId, native } = eventData;

  if (reqId === 'ignore') {
    return;
  }

  if (native?.type) {
    try {
      const res = await _handleNativeMessage(eventData);
      sendPostResponse(res);
    } catch (error) {
      console.error('_handleNativeMessage error:', error.message || error);
      sendPostResponse({
        reqId,
        type: 'sendPostResponse',
        resType: 'reject',
        error: { message: error.message || JSON.stringify(error) },
      });
    }
    return;
  }

  try {
    const res = await _handleReqMessage(eventData);
    sendPostResponse(res);
  } catch (error) {
    if (error instanceof VoidAndNotError) return;
    console.error('_handleReqMessage error:', error);
    sendPostResponse({
      reqId,
      type: 'sendPostResponse',
      resType: 'reject',
      error: { message: error.message || JSON.stringify(error) },
    });
  }
};

export const setHotspotDisabled = async (reqId: string): Promise<void> => {
  const callNativeBridge = `
    if (window.NativeBridge && window.NativeBridge.stopHotspot) {
      const stopRes = window.NativeBridge.stopHotspot('${reqId}');
      window.ReactNativeWebView.postMessage(JSON.stringify({
        native: {
          reqId: '${reqId}',
          type: 'sendPostResponse',
          resType: 'resolve',
          res: { type: 'setHotspotDisabled', state: JSON.parse(stopRes).status }
        }
      }));
      console.log('setHotspotDisabled|stopRes=', stopRes);
    } else {
      console.log('setHotspotDisabled|NativeBridge не доступен');
      window.ReactNativeWebView.postMessage("NativeBridge не доступен");
    }
    true;
  `;
  if (!webviewRef.current) {
    console.error('setHotspotDisabled|webviewRef.current is null');
    throw new Error('webviewRef.current is null');
  }
  webviewRef.current.injectJavaScript(callNativeBridge);
};
