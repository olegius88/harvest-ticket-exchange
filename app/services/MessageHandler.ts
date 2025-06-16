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

import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
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
  ISendTcpResponseData,
  TalonStatus,
  HandleReqMessageResponse,
  TNeedRedirectPayload,
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
import {
  NotFoundError,
  VoidAndNotError,
  AppError,
  SendError,
} from '../exceptions/exceptionsClasses';
import { startTcpServer, stopTcpServer, tcpServerSendRequest } from '../wifi/TcpServer';
import { connectToTcpServer, sendTcpRequest } from '../wifi/TcpClient';

// Глобальные переменные для перенаправления
export let needRedirect: string | null;
export let needRedirectStatus: 'ok' | 'error' | 'empty' = 'empty';
export let needRedirectPayload: TNeedRedirectPayload | null;

export const setNeedRedirect = (data: string, payload?: TNeedRedirectPayload): void => {
  console.log('setNeedRedirect|data=', data);
  needRedirect = data;
  needRedirectStatus = 'ok';
  needRedirectPayload = payload || null;
};

/**
 * Проверка и запрос разрешений для работы с Wi-Fi (для Android).
 */
export const checkPermissionsHotspot = async (): Promise<boolean> => {
  // Проверяем, включён ли режим определения местоположения.
  // const locationEnabled = await DeviceInfo.isLocationEnabled();
  // console.log('checkPermissionsHotspot|locationEnabled=', locationEnabled);
  // if (!locationEnabled) {
  //   console.log('checkPermissionsHotspot|locationEnabled = false');
  //   return false;
  // }

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
 * Возвращает упрощённые типы напрямую без обёртки.
 */
const _handleReqMessage = async (
  eventData: ISendPostMessageRequest
): Promise<HandleReqMessageResponse> => {
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
      return { type, userId };
    }
    case 'checkPermissionsHotspot': {
      await checkPermissionsHotspot();
      return { type: 'checkPermissionsHotspot' };
    }
    case 'registration': {
      const userData = req.data as ICreateUsersParams;
      console.log('registration|req.data=', userData);
      const userId = await createUser(userData);
      console.log('registration|userId=', userId);
      return { type, userId };
    }
    case 'createKombainer': {
      const kombainerData = req.data as ICreateKombainerParams;
      console.log('createKombainer|req.data=', kombainerData);
      const userId = await createKombainer(kombainerData);
      console.log('createKombainer|userId=', userId);
      return { type };
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
      return { type };
    }
    case 'createVoditel': {
      const voditelData = req.data as ICreateVoditelParams;
      console.log('createVoditel|req.data=', voditelData);
      const userId = await createVoditel(voditelData);
      console.log('createVoditel|userId=', userId);
      return { type };
    }
    case 'editVoditel': {
      const editData = req.data as IEditVoditelParams;
      console.log('editVoditel|req.data=', editData);
      const voditelRecord = await getVoditelByUserId(editData.userId);
      console.log('editVoditel|voditelData=', voditelRecord);
      const updatedId = await editVoditel(editData);
      console.log('editVoditel|updatedId=', updatedId);
      return { type };
    }
    case 'needRedirect': {
      const path = needRedirect;
      const payload = needRedirectPayload;
      const status = needRedirectStatus;
      needRedirect = null;
      needRedirectPayload = null;
      needRedirectStatus = 'empty';
      return {
        type,
        status,
        path: path || '',
        payload: payload || undefined,
      };
    }
    case 'currentUser': {
      const currentUserId = await getConfig('currentUserId');
      console.log('currentUser|currentUserId=', currentUserId);
      if (!currentUserId) {
        return {
          type,
          status: 'noAuth' as const,
          userData: null,
          kombainerData: null,
          kombainerUserData: null,
          voditelData: null,
        };
      }
      let userData: ICreateUsersParams;
      try {
        userData = await getUserById(currentUserId);
        console.log('currentUser|userData=', userData);
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
        return {
          type,
          status: 'noAuth' as const,
          userData: null,
          kombainerData: null,
          kombainerUserData: null,
          voditelData: null,
        };
      }
      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('currentUser|kombainerData=', kombainerData);
      const voditelData = await getVoditelByUserId(currentUserId);
      console.log('currentUser|voditelData=', voditelData);
      return {
        type,
        status: 'authOk' as const,
        userData,
        kombainerData,
        kombainerUserData: userData,
        voditelData,
      };
    }
    case 'openCodeScannerPage': {
      console.log('openCodeScannerPage|req.data=', req);
      const hasCameraAudioPermissions = await checkCameraAudioPermissions();
      if (!hasCameraAudioPermissions) {
        console.error('openCodeScannerPage|Нет разрешений для камеры и аудио');
        throw new Error('Нет разрешений для камеры и аудио');
      }
      DeviceEventEmitter.emit('openCodeScannerPage');
      return { type, status: 'scannerOpened' };
    }
    case 'isHotspotEnabled': {
      console.log('isHotspotEnabled|Checking hotspot status for React Native');
      try {
        const { HotspotBridge } = NativeModules;

        if (!HotspotBridge) {
          console.log('isHotspotEnabled|HotspotBridge not available');
          return { type: 'isHotspotEnabled', status: 'stopped' };
        }

        if (!HotspotBridge.getHotspotStatus) {
          console.log('isHotspotEnabled|HotspotBridge.getHotspotStatus not available');
          return { type: 'isHotspotEnabled', status: 'stopped' };
        }

        // Вызываем нативный метод getHotspotStatus
        const statusResStr = await HotspotBridge.getHotspotStatus(reqId);
        const statusRes = JSON.parse(statusResStr);
        console.log('isHotspotEnabled|statusRes=', statusRes);

        return { type: 'isHotspotEnabled', status: statusRes.status };
      } catch (error) {
        console.error('isHotspotEnabled error:', error);
        return { type: 'isHotspotEnabled', status: 'stopped' };
      }
    }
    case 'setHotspotEnabled': {
      console.log('setHotspotEnabled|req=', req);
      try {
        const { HotspotBridge } = NativeModules;

        if (!HotspotBridge) {
          console.log('setHotspotEnabled|HotspotBridge not available');
          throw new Error('HotspotBridge not available');
        }
        if (!HotspotBridge.startHotspot) {
          console.log('setHotspotEnabled|HotspotBridge.startHotspot not available');
          throw new Error('HotspotBridge.startHotspot not available');
        }

        // Вызываем нативный метод startHotspot
        const startResStr = await HotspotBridge.startHotspot('reqId');
        const startRes = JSON.parse(startResStr);
        console.log('setHotspotEnabled|startRes=', startRes);

        // Обрабатываем ответ так же, как в WebView-версии
        if (startRes.status === 'error') {
          return {
            type: 'setHotspotEnabled',
            status: startRes.status,
            error: startRes.error,
          };
        } else {
          return {
            type: 'setHotspotEnabled',
            status: startRes.status,
            ssid: startRes.ssid,
            password: startRes.password,
          };
        }
      } catch (error: unknown) {
        console.error('setHotspotEnabled error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Ошибка при включении hotspot';
        throw new Error(errorMessage);
      }
    }
    case 'setHotspotDisabled': {
      console.log('setHotspotDisabled|Stopping hotspot for React Native');
      try {
        const { HotspotBridge } = NativeModules;

        if (!HotspotBridge) {
          console.log('setHotspotDisabled|HotspotBridge not available');
          return { type: 'setHotspotDisabled', state: 'stopped' };
        }

        if (!HotspotBridge.stopHotspot) {
          console.log('setHotspotDisabled|HotspotBridge.stopHotspot not available');
          return { type: 'setHotspotDisabled', state: 'stopped' };
        }

        // Вызываем нативный метод stopHotspot
        const stopResStr = await HotspotBridge.stopHotspot(reqId);
        const stopRes = JSON.parse(stopResStr);
        console.log('setHotspotDisabled|stopRes=', stopRes);

        return { type: 'setHotspotDisabled', state: stopRes.status };
      } catch (error) {
        console.error('setHotspotDisabled error:', error);
        return { type: 'setHotspotDisabled', state: 'error' };
      }
    }
    case 'pushUserId': {
      const { userId } = req.data as { userId: string };
      console.log('pushUserId|Setting user ID for React Native:', userId);
      try {
        const { HotspotBridge } = NativeModules;

        if (!HotspotBridge) {
          console.log('pushUserId|HotspotBridge not available');
          return { type: 'pushUserId', success: false };
        }

        if (!HotspotBridge.setUserId) {
          console.log('pushUserId|HotspotBridge.setUserId not available');
          return { type: 'pushUserId', success: false };
        }

        // Вызываем нативный метод setUserId
        await HotspotBridge.setUserId(userId);
        console.log('pushUserId|User ID set successfully:', userId);

        return { type: 'pushUserId', success: true };
      } catch (error) {
        console.error('pushUserId error:', error);
        return { type: 'pushUserId', success: false };
      }
    }
    // Присоединение к существующему хотспоту
    case 'joinHotspot': {
      const { ssid, password } = req.data as { ssid: string; password: string };
      console.log('joinHotspot|Joining hotspot for React Native', { ssid, password });
      try {
        const { HotspotBridge } = NativeModules;

        if (!HotspotBridge) {
          console.log('joinHotspot|HotspotBridge not available');
          throw new Error('HotspotBridge not available');
        }

        if (!HotspotBridge.joinHotspot) {
          console.log('joinHotspot|HotspotBridge.joinHotspot not available');
          throw new Error('HotspotBridge.joinHotspot not available');
        }

        // Вызываем нативный метод joinHotspot
        const joinResStr = await HotspotBridge.joinHotspot(ssid, password, reqId);
        const joinRes = JSON.parse(joinResStr);
        console.log('joinHotspot|joinRes=', joinRes);

        return { type: 'joinHotspot', status: 'joining' };
      } catch (error) {
        console.error('joinHotspot error:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Ошибка при присоединении к hotspot';
        throw new Error(errorMessage);
      }
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
      return { type, userData };
    }
    case 'enableKeepAwake': {
      console.log('enableKeepAwake|активация удержания экрана');
      KeepAwake.activate();
      return { type };
    }
    case 'disableKeepAwake': {
      console.log('disableKeepAwake|деактивация удержания экрана');
      KeepAwake.deactivate();
      return { type };
    }
    case 'createTalon': {
      const talonData = req.data as ICreateTalonParams;
      console.log('createTalon|req.data=', talonData);
      const talonId = await createTalon(talonData);
      console.log('createTalon|talonId=', talonId);
      return { type, talonId };
    }
    case 'editTalon': {
      const editData = req.data as IEditTalonParams;
      console.log('editTalon|req.data=', editData);
      const talonId = await editTalon(editData);
      console.log('editTalon|talonId=', talonId);
      return { type, talonId };
    }
    case 'assignDriverToTalon': {
      const { talonId, voditelId } = req.data as { talonId: string; voditelId: string };
      console.log('assignDriverToTalon|req.data=', { talonId, voditelId });
      const updatedTalonId = await assignDriverToTalon(talonId, voditelId);
      console.log('assignDriverToTalon|updatedTalonId=', updatedTalonId);
      return { type, talonId: updatedTalonId };
    }
    case 'updateTalonStatus': {
      const { talonId, status } = req.data as { talonId: string; status: TalonStatus };
      console.log('updateTalonStatus|req.data=', { talonId, status });
      const updatedTalonId = await updateTalonStatus(talonId, status);
      console.log('updateTalonStatus|updatedTalonId=', updatedTalonId);
      return { type, talonId: updatedTalonId };
    }
    case 'updateTalonWeight': {
      const { talonId, weight } = req.data as { talonId: string; weight: number };
      console.log('updateTalonWeight|req.data=', { talonId, weight });
      const updatedTalonId = await updateTalonWeight(talonId, weight);
      console.log('updateTalonWeight|updatedTalonId=', updatedTalonId);
      return { type, talonId: updatedTalonId };
    }
    case 'getTalonById': {
      const { talonId } = req.data as { talonId: string };
      console.log('getTalonById|req.data=', { talonId });
      const talon = await getTalonById(talonId);
      console.log('getTalonById|talon=', talon);
      return { type: 'getTalonById', talon };
    }
    case 'getTalonsByKombainerId': {
      const { kombainerId } = req.data as { kombainerId: string };
      console.log('getTalonsByKombainerId|req.data=', { kombainerId });
      const talons = await getTalonsByKombainerId(kombainerId);
      console.log('getTalonsByKombainerId|talons.length=', talons.length);
      return { type: 'getTalonsByKombainerId', talons };
    }
    case 'getTalonsByVoditelId': {
      const { voditelId } = req.data as { voditelId: string };
      console.log('getTalonsByVoditelId|req.data=', { voditelId });
      const talons = await getTalonsByVoditelId(voditelId);
      console.log('getTalonsByVoditelId|talons.length=', talons.length);
      return { type, talons };
    }
    case 'checkUserRegistration': {
      try {
        const currentUserId = await getConfig('currentUserId');
        console.log('checkUserRegistration|currentUserId=', currentUserId);

        if (currentUserId) {
          try {
            const userData = await getUserById(currentUserId);
            return {
              type,
              isRegistered: true,
              userData,
            };
          } catch (error) {
            if (error instanceof NotFoundError) {
              await setConfig({ key: 'currentUserId', value: null });
            }
          }
        }

        return {
          type,
          isRegistered: false,
        };
      } catch (error: unknown) {
        console.error('checkUserRegistration|error=', error);
        throw error;
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

        await getUserById(userId);
        const updatedUserId = await editUser(userId, fio, phone, position);
        console.log('updateUserProfile|updatedUserId=', updatedUserId);

        return {
          type,
          userId: updatedUserId,
          status: 'ok' as const,
        };
      } catch (error: unknown) {
        console.error('updateUserProfile|error=', error);
        throw error;
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
 * Принимает ISendPostMessageRequest и возвращает HandleReqMessageResponse напрямую без обёртки.
 */
export const handleMessage = async (
  messageData: ISendPostMessageRequest
): Promise<HandleReqMessageResponse> => {
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
  } catch (error: unknown) {
    if (error instanceof VoidAndNotError) {
      throw error;
    }
    console.error('_handleReqMessage error:', error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(errorMessage);
  }
};
