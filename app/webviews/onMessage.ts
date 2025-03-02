//onMessage.ts
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  ILoginUserParams,
  ISendPostMessageRequest,
  ISendPostResponse,
  ISendPostResponseCurrentUserId,
  ISendPostResponseLogin,
  ISendPostResponseRegistration,
} from '../../global';
import { createUser, getAllUsers, getUserById, ICreateUsersParams, loginUser } from '../db/users';
import { getConfig, setConfig } from '../db/configs';
import { useRef } from 'react';
import { getKombainerByUserId } from '../db/kombainers';

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

  let eventData: ISendPostMessageRequest;
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

  const { req, reqId } = eventData;

  if (!req?.type) {
    console.error('onMessage|!req?.type|req=', req);
    return;
  }
  console.log('onMessage|req?.type)=', req.type);

  switch (req.type) {
    case 'login': {
      console.log('onMessage|login|req.data=', req.data);

      const createUserData = req.data as ILoginUserParams;

      try {
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

        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type: 'login',
            userId,
          } as ISendPostResponseLogin,
        });
      } catch (error: any) {
        console.error('onMessage|login|error.message=', error.message || error);
        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: {
            message: error.message || JSON.stringify(error),
          },
        });
      }
      return;
    }
    case 'registration': {
      console.log('onMessage|registration|req.data=', req.data);

      const createUserData = req.data as ICreateUsersParams;

      try {
        const userId = await createUser(createUserData);
        console.log('onMessage|registration|userId=', userId);
        //7851a25d-0ddb-4d4e-81bd-006d99036a2e

        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type: 'registration',
            userId,
          } as ISendPostResponseRegistration,
        });
      } catch (error: any) {
        console.error('onMessage|registration|error.message=', error.message || error);
        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: {
            message: error.message || JSON.stringify(error),
          },
        });
      }
      return;
    }
    case 'currentUserId': {
      try {
        const currentUserId = await getConfig('currentUserId');
        console.log('onMessage|currentUserId=', currentUserId);
        //7851a25d-0ddb-4d4e-81bd-006d99036a2e
        const userData = await getUserById(currentUserId);
        console.log('onMessage|userData=', userData);

        const kombainerData = await getKombainerByUserId(currentUserId);
        console.log('onMessage|kombainerData=', kombainerData);

        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'resolve',
          res: {
            type: 'currentUserId',
            status: currentUserId === null ? 'noAuth' : 'authOk',
            userData,
          } as ISendPostResponseCurrentUserId,
        });
      } catch (error: any) {
        console.error('onMessage|currentUserId|error.message=', error.message || error);
        sendPostResponse({
          reqId,
          type: 'sendPostResponse',
          resType: 'reject',
          error: {
            message: error.message || JSON.stringify(error),
          },
        });
      }
      return;
    }
    default:
      console.error('onMessage|eventData|switch|default|eventData=', eventData);
  }
};
