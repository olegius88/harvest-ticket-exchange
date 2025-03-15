// Файл: app/webviews/onMessage.ts

import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  ICreateKombainerParams,
  ILoginUserParams,
  ISendNativeMessageRequest,
  ISendPostMessageRequest,
  ISendPostResponse,
} from '../../global';
import { createUser, getAllUsers, getUserById, ICreateUsersParams, loginUser } from '../db/users';
import { getConfig, setConfig } from '../db/configs';
import { useRef } from 'react';
import { createKombainer, getKombainerByUserId } from '../db/kombainers';
import { NotFoundError, VoidAndNotError } from '../exceptions/exceptionsClasses';
import { PermissionsAndroid, Platform } from 'react-native';

export const webviewRef = useRef<WebView>(null);

const sendPostResponse = (obj: ISendPostResponse): void => {
  console.log('sendPostResponse|obj=', obj);
  if (!webviewRef.current) {
    console.error('sendPostResponse|!webviewRef.current');
    return;
  }
  // obj.os = Platform.OS;
  webviewRef.current.postMessage(JSON.stringify(obj));
};

export const onMessage = async (event: WebViewMessageEvent): Promise<void> => {
  console.log('onMessage');

  if (!event || !event.nativeEvent || !event.nativeEvent.data) {
    console.log({ event });
    console.log('nativeEvent: ', event.nativeEvent);
    console.log('data: ', event.nativeEvent.data);
    return;
  }
  const nativeEventData = event.nativeEvent.data;

  let eventData: ISendPostMessageRequest & ISendNativeMessageRequest;
  try {
    eventData = JSON.parse(nativeEventData);
  } catch (error) {
    console.error('onMessage|JSON.parse|error=', error);
    console.error('onMessage|JSON.parse|nativeEventData=', nativeEventData);
    return;
  }
  console.log('onMessage|eventData=', eventData);
  if (!eventData) {
    console.error('onMessage|eventData|!eventData|eventData=', eventData);
    return;
  }

  if (!eventData?.req?.type && !eventData?.native?.type) {
    console.error('onMessage|!req?.type|req=', JSON.stringify(eventData));
    return;
  }

  if (eventData?.native?.type) {
    // console.error('eventData?.native?.type|eventData=', eventData);
    try {
      const res = await _handleNativeMessage(eventData);
      sendPostResponse(res);
    } catch (error) {
      console.error('onMessage|_handleNativeMessage|error=', error.message || error);
      sendPostResponse({
        reqId: eventData.reqId,
        type: 'sendPostResponse',
        resType: 'reject',
        error: {
          message: error.message || JSON.stringify(error),
        },
      });
    }
    return;
  }

  try {
    const res = await _handleReqMessage(eventData);
    sendPostResponse(res);
  } catch (error) {
    if (error instanceof VoidAndNotError) {
      return;
    }
    console.error('onMessage|_handleReqMessage|error=', error.message || error);
    sendPostResponse({
      reqId: eventData.reqId,
      type: 'sendPostResponse',
      resType: 'reject',
      error: {
        message: error.message || JSON.stringify(error),
      },
    });
  }
};

const _handleNativeMessage = async (
  eventData: ISendNativeMessageRequest
): Promise<ISendPostResponse> => {
  console.log('_handleNativeMessage|eventData=', eventData);
  const { native, reqId } = eventData;

  console.log('_handleNativeMessage|native.type=', native.type);

  switch (native.type) {
    case 'sendPostResponse': {
      return eventData.native as unknown as ISendPostResponse;
    }
    case 'pushUserId': {
      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type: 'pushUserId',
          status: native.status,
        },
      };
    }
  }
};

const _handleReqMessage = async (
  eventData: ISendPostMessageRequest
): Promise<ISendPostResponse> => {
  const { req, reqId } = eventData;

  console.log('_handleReqMessage|req.type=', req.type);
  const { type } = req;

  switch (type) {
    case 'login': {
      console.log('onMessage|login|req.data=', req.data);

      const createUserData = req.data as ILoginUserParams;

      const users = await getAllUsers();
      console.log('onMessage|login|users=', users);

      const userId = await loginUser(createUserData);
      console.log('onMessage|login|userId=', userId);
      //7851a25d-0ddb-4d4e-81bd-006d99036a2e

      try {
        await setConfig({
          key: 'currentUserId',
          value: userId,
        });
      } catch (error) {
        console.error('onMessage|login|setConfig|error=', error);
        new Error(
          'Внутрення ошибка при авторизации. Переустановите приложение. (все данные будут утеряны)'
        );
      }

      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
          userId,
        },
      };
    }
    case 'checkAndRequestPermissions': {
      console.log('onMessage|checkAndRequestPermissions|req.data=');

      await checkAndRequestPermissions();

      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
        },
      };
    }
    case 'registration': {
      console.log('onMessage|registration|req.data=', req.data);

      const createUserData = req.data as ICreateUsersParams;

      const userId = await createUser(createUserData);
      console.log('onMessage|registration|userId=', userId);
      //7851a25d-0ddb-4d4e-81bd-006d99036a2e

      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
          userId,
        },
      };
    }
    case 'createKombainer': {
      console.log('onMessage|createKombainer|req.data=', req.data);

      const createUserData = req.data as ICreateKombainerParams;

      const userId = await createKombainer(createUserData);
      console.log('onMessage|createKombainer|userId=', userId);
      //7851a25d-0ddb-4d4e-81bd-006d99036a2e

      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
        },
      };
    }
    case 'currentUser': {
      const currentUserId = await getConfig('currentUserId');
      console.log('onMessage|currentUserId=', currentUserId);
      if (!currentUserId) {
        return {
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type: 'currentUser',
            status: 'noAuth',
            userData: null,
            kombainerData: null,
          },
        };
      }
      //7851a25d-0ddb-4d4e-81bd-006d99036a2e
      let userData = null;
      try {
        userData = await getUserById(currentUserId);
        console.log('onMessage|userData=', userData);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }

      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('onMessage|kombainerData=', kombainerData);

      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
          status: !userData ? 'noAuth' : 'authOk',
          userData,
          kombainerData,
        },
      };
    }
    case 'isHotspotEnabled': {
      console.log('onMessage|isHotspotEnabled=');
      const callNativeBridge = `
    if (window.NativeBridge && window.NativeBridge.getHotspotStatus) {
      const statusRes = window.NativeBridge.getHotspotStatus('${reqId}');
      window.ReactNativeWebView.postMessage(JSON.stringify({native:{
         reqId: '${reqId}',
         type: 'sendPostResponse',
         resType: 'resolve',
         res: {
           type: 'isHotspotEnabled',
           state: JSON.parse(statusRes).status,
        },
      }}));
      console.log('onMessage|getHotspotStatus|statusRes=', statusRes);
    } else {
      console.log('onMessage|getHotspotStatus|NativeBridge не доступен');
      window.ReactNativeWebView.postMessage("NativeBridge не доступен");
    }
    true; // обязательно true для корректной работы на Android
  `;
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'setHotspotEnabled': {
      console.log('onMessage|setHotspotEnabled=');

      const callNativeBridge = `
    if (window.NativeBridge && window.NativeBridge.startHotspot) {
      const startRes = JSON.parse(window.NativeBridge.startHotspot('${reqId}'));
      console.log('onMessage|startHotspot|startRes=', startRes);
      if (startRes.status === 'error') {
        window.ReactNativeWebView.postMessage(JSON.stringify({native:{
           reqId: '${reqId}',
           type: 'sendPostResponse',
           resType: 'reject',
           res: {
             type: 'setHotspotEnabled',
             status: startRes.status,
             error: startRes.error,
          },
        }}));
      } else {
        window.ReactNativeWebView.postMessage(JSON.stringify({native:{
           reqId: '${reqId}',
           type: 'sendPostResponse',
           resType: 'resolve',
           res: {
             type: 'setHotspotEnabled',
             status: startRes.status,
             ssid: startRes.ssid,
             password: startRes.password,
          },
        }}));
      }
    } else {
      console.log('onMessage|startHotspot|NativeBridge не доступен');
      window.ReactNativeWebView.postMessage("NativeBridge не доступен");
    }
    true; // обязательно true для корректной работы на Android
  `;
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'setHotspotDisabled': {
      console.log('onMessage|setHotspotDisabled=');

      const callNativeBridge = `
    if (window.NativeBridge && window.NativeBridge.stopHotspot) {
      const stopRes = window.NativeBridge.stopHotspot('${reqId}');
      window.ReactNativeWebView.postMessage(JSON.stringify({native:{
        reqId: '${reqId}',
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type: 'setHotspotDisabled',
          state: JSON.parse(stopRes).status,
        },
      }}));
      console.log('onMessage|stopHotspot|stopRes=', stopRes);
    } else {
      console.log('onMessage|stopHotspot|NativeBridge не доступен');
      window.ReactNativeWebView.postMessage("NativeBridge не доступен");
    }
    true; // обязательно true для корректной работы на Android
  `;
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'pushUserId': {
      const callNativeBridge = `
    if (window.NativeBridge && window.NativeBridge.getPushUserId) {
      const userId = window.NativeBridge.getPushUserId('${reqId}');
      window.ReactNativeWebView.postMessage(userId);
      console.log('onMessage|pushUserId|userId=', userId);
    } else {
      console.log('onMessage|pushUserId|NativeBridge не доступен');
      window.ReactNativeWebView.postMessage("NativeBridge не доступен");
    }
    true; // обязательно true для корректной работы на Android
  `;
      webviewRef.current.injectJavaScript(callNativeBridge);
      throw new VoidAndNotError('');
    }
    case 'userData': {
      const currentUserId = await getConfig('currentUserId');
      console.log('onMessage|userData=', currentUserId);
      //7851a25d-0ddb-4d4e-81bd-006d99036a2e
      const userData = await getUserById(currentUserId);
      console.log('onMessage|userData=', userData);

      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('onMessage|userData=', kombainerData);

      return {
        reqId,
        type: 'sendPostResponse',
        resType: 'resolve',
        res: {
          type,
          userData,
        },
      };
    }
    default:
      console.error('onMessage|eventData|switch|default|eventData=', eventData);
      throw new Error(`onMessage|eventData|switch|default|eventData=${JSON.stringify(eventData)}`);
  }
};

/**
 * Проверка и запрос необходимых разрешений для работы с Wi‑Fi.
 * Если платформа не Android, возвращается true.
 */
const checkAndRequestPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    // Для не Android платформ разрешения не требуются
    return true;
  }
  const permissions = [
    PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ];
  const granted = await PermissionsAndroid.requestMultiple(permissions);
  // Проверяем, что все разрешения предоставлены
  const allGranted = permissions.every(
    (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED
  );
  console.log('onMessage|checkAndRequestPermissions|allGranted=', allGranted);
  return allGranted;
};
