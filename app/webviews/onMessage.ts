// Файл: app/webviews/onMessage.ts
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
import { useRef } from 'react';
import { DeviceEventEmitter, PermissionsAndroid, Platform } from 'react-native';
import {
  ICreateKombainerParams,
  ICreateVoditelParams,
  IEditKombainerParams,
  IEditVoditelParams,
  ILoginUserParams,
  ISendNativeMessageRequest,
  ISendPostMessageRequest,
  ISendPostResponse,
} from '../../global';
import { createUser, getAllUsers, getUserById, ICreateUsersParams, loginUser } from '../db/users';
import { getConfig, setConfig } from '../db/configs';
import {
  createKombainer,
  editKombainer,
  getKombainerById,
  getKombainerByUserId,
} from '../db/kombainers';
import { createVoditel, editVoditel, getVoditelByUserId } from '../db/viditels';
import { NotFoundError, VoidAndNotError } from '../exceptions/exceptionsClasses';

// Ссылка на WebView
export const webviewRef = useRef<WebView>(null);

/**
 * Утилита отправки ответа в WebView.
 */
const sendPostResponse = (obj: ISendPostResponse): void => {
  console.log('sendPostResponse|obj=', obj);
  if (!webviewRef.current) {
    console.error('sendPostResponse|!webviewRef.current');
    return;
  }
  webviewRef.current.postMessage(JSON.stringify(obj));
};

/**
 * Проверка и запрос разрешений для работы с Wi-Fi (для Android).
 */
const checkPermissionsHotspot = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
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
  console.log('_handleReqMessage|req.type=', req.type);
  const type = req.type;

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
            voditelData: null,
          },
        };
      }
      let userData = null;
      try {
        userData = await getUserById(currentUserId);
        console.log('currentUser|userData=', userData);
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
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
          status: userData ? 'authOk' : 'noAuth',
          userData,
          kombainerData,
          voditelData,
        },
      };
    }
    // открытие сканера QR
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
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'setHotspotDisabled': {
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
      webviewRef.current.injectJavaScript(callNativeBridge);
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
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    // присоединение к существующему хотспоту
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
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'userData': {
      const currentUserId = await getConfig('currentUserId');
      console.log('userData|currentUserId=', currentUserId);
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
    default:
      console.error('_handleReqMessage|eventData|switch|default|eventData=', eventData);
      throw new Error(
        `_handleReqMessage|eventData|switch|default|eventData=${JSON.stringify(eventData)}`
      );
  }
};

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

  if (eventData?.native?.type) {
    try {
      const res = await _handleNativeMessage(eventData);
      sendPostResponse(res);
    } catch (error) {
      console.error('_handleNativeMessage error:', error.message || error);
      sendPostResponse({
        reqId: eventData.reqId,
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
      reqId: eventData.reqId,
      type: 'sendPostResponse',
      resType: 'reject',
      error: { message: error.message || JSON.stringify(error) },
    });
  }
};
