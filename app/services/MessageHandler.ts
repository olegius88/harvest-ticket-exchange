// filepath: app\services\MessageHandler.ts
// app/services/MessageHandler.ts
/**
 * Этот файл отвечает за обработку сообщений в React Native приложении.
 * Адаптирован из onMessage.ts для работы без WebView.
 * Разделы:
 * 1. Импорты и объявления
 * 2. Утилиты: проверка разрешений
 * 3. Обработчики сообщений запроса (_handleReqMessage)
 * 4. Основная функция handleMessage
 */

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
      // TODO: Implement hotspot status check for React Native
      console.log('isHotspotEnabled|Hotspot functionality not implemented for React Native');
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'isHotspotEnabled', status: 'stopped' },
      };
    }
    case 'setHotspotEnabled': {
      // TODO: Implement hotspot enable for React Native
      console.log('setHotspotEnabled|Hotspot functionality not implemented for React Native');
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'reject',
        error: { message: 'Hotspot functionality not implemented for React Native' },
      };
    }
    case 'setHotspotDisabled': {
      // TODO: Implement hotspot disable for React Native
      console.log('setHotspotDisabled|Hotspot functionality not implemented for React Native');
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'setHotspotDisabled' },
      };
    }
    case 'pushUserId': {
      // TODO: Implement push notification functionality for React Native
      console.log('pushUserId|Push notification functionality not implemented for React Native');
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: { type: 'pushUserId', status: 'not_implemented' },
      };
    }
    // Присоединение к существующему хотспоту
    case 'joinHotspot': {
      const { ssid, password } = req.data as { ssid: string; password: string };
      // TODO: Implement hotspot join for React Native
      console.log('joinHotspot|Hotspot functionality not implemented for React Native', {
        ssid,
        password,
      });
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'reject',
        error: { message: 'Hotspot functionality not implemented for React Native' },
      };
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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
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
      } catch (error: any) {
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

/**
 * Основная функция обработки сообщений для React Native.
 * Принимает ISendPostMessageRequest и возвращает ISendPostResponse.
 */
export const handleMessage = async (
  messageData: ISendPostMessageRequest
): Promise<ISendPostResponse> => {
  console.log('handleMessage|messageData=', messageData);

  if (!messageData) {
    console.error('Empty messageData');
    throw new Error('Empty messageData');
  }

  const { reqId } = messageData;

  if (reqId === 'ignore') {
    throw new VoidAndNotError('Ignored message');
  }

  try {
    const res = await _handleReqMessage(messageData);
    return res;
  } catch (error: any) {
    if (error instanceof VoidAndNotError) {
      throw error;
    }
    console.error('_handleReqMessage error:', error);
    return {
      reqId,
      type: 'sendPostResponse',
      resType: 'reject',
      error: { message: error.message || JSON.stringify(error) },
    };
  }
};
