// app/wifi/onTcpMessage.ts

import {
  ISendTcpRequestData,
  IPayloadVoditelConnectSuccess,
  IPayloadConfirmKombainerTicket,
  IPayloadSetTalonOfKombainer,
  ICreateKombainerParams,
  ISendTcpSetVoditelData,
  IVoditelConnectedPayload,
  ICreateVoditelParams,
} from '../../global';
import { ToastAndroid, DeviceEventEmitter } from 'react-native';
import { setNeedRedirect } from '../services/MessageHandler';
import { getConfig } from '../db/configs';
import { getUserById, ICreateUsersParams } from '../db/users';
import { NotFoundError } from '../exceptions/exceptionsClasses';
import { getKombainerByUserId } from '../db/kombainers';
import { getTalonsByKombainerId } from '../db/talons_of_combainers';

/**
 * Основная функция обработки сообщений
 */
export const onTcpMessage = async (message: ISendTcpRequestData) => {
  console.log('onTcpMessage|message=', message);
  const { type } = message;

  switch (type) {
    case 'test': {
      return { status: 'ok' };
    }

    case 'set_voditel_data': {
      const { voditelData, voditelUserData } = message;
      // Отправляем событие о подключении водителя
      DeviceEventEmitter.emit('voditelConnected', {
        voditelData,
        voditelUserData,
      } as IVoditelConnectedPayload);

      return { status: 'ok' };
    }

    case 'set_kombainer_data': {
      const { kombainerData } = message;

      // Создаем payload с правильной структурой для передачи данных комбайнера
      const payload: IPayloadSetTalonOfKombainer = {
        kombainerData: kombainerData as ICreateKombainerParams,
        userData: {} as ICreateUsersParams, // Будет заполнено позже
        weight: 0, // Будет заполнено позже
      };

      setNeedRedirect('voditel', payload);

      return { status: 'ok' };
    }

    case 'confirm_kombainer_ticket': {
      const { voditelData, userData } = message;
      console.log('confirm_kombainer_ticket|message=', message);

      DeviceEventEmitter.emit('voditelConfirmAfterConnect', {
        voditelData,
        userData,
      } as IPayloadConfirmKombainerTicket);

      return { status: 'ok' };
    }

    case 'confirm_kombainer_ticket_with_weight': {
      // const { voditelData, userData } = message;

      // Передаем undefined для случая подтверждения с весом без конкретных данных
      setNeedRedirect('kombainer', undefined);

      return { status: 'ok' };
    }

    case 'get_kombainer_data': {
      const {} = message;

      const currentUserId = await getConfig('currentUserId');
      console.log('get_kombainer_data|currentUserId=', currentUserId);
      if (!currentUserId) {
        ToastAndroid.show(`Ошибка: Не найден ID текущего пользователя`, ToastAndroid.SHORT);
        return { status: 'error' };
      }
      let userData: ICreateUsersParams;
      try {
        userData = await getUserById(currentUserId);
        console.log('get_kombainer_data|userData=', userData);
      } catch (e) {
        console.error('get_kombainer_data|getUserById|e=', e);
        if (!(e instanceof NotFoundError)) throw e;
        return { status: 'error' };
      }
      if (!userData) {
        console.error('get_kombainer_data|Не найдены данные комбайнера у пользователя');
        ToastAndroid.show(
          `Ошибка: не найдены данные комбайнера у пользователя`,
          ToastAndroid.SHORT
        );
        return { status: 'error' };
      }
      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('get_kombainer_data|kombainerData=', kombainerData);

      // Получаем номер последнего талона комбайнера, если есть
      let talonNumber = '';
      if (kombainerData && kombainerData.id) {
        try {
          const talons = await getTalonsByKombainerId(kombainerData.id);
          if (talons && talons.length > 0) {
            // Находим последний созданный талон
            const latestTalon = talons.reduce((latest, current) => {
              return latest.created_at > current.created_at ? latest : current;
            });

            talonNumber = latestTalon.talonNumber || '';
          }
        } catch (error) {
          console.error('get_kombainer_data|error=', error);
        }
      }

      return { status: 'ok', kombainerData, kombainerUserData: userData, talonNumber };
    }

    case 'set_talon_of_kombainer': {
      const { kombainerData, userData, weight } = message;
      const talonNumber = message.talonNumber || '';

      const payload: IPayloadSetTalonOfKombainer = {
        kombainerData: kombainerData as ICreateKombainerParams,
        userData: userData as ICreateUsersParams,
        weight: weight as number,
        talonNumber,
      };

      console.log('confirm_kombainer_ticket|payload=', payload);

      DeviceEventEmitter.emit('setTalonOfKombainer', payload);

      return { status: 'ok' };
    }

    case 'heartbeat': {
      const { timestamp } = message;
      console.log('onTcpMessage|heartbeat received|timestamp=', timestamp);
      return {
        status: 'ok',
        type: 'heartbeat_response',
        originalTimestamp: timestamp,
        responseTimestamp: Date.now(),
      };
    }

    default:
      console.error(`onTcpMessage|Получено неизвестное сообщение|type=`, type);
      console.error(`onTcpMessage|Получено неизвестное сообщение|message=`, message);
      ToastAndroid.show(
        `onTcpMessage|Получено неизвестное сообщение|type=${type}`,
        ToastAndroid.SHORT
      );
      throw new Error(`onTcpMessage|Получено неизвестное сообщение|type=${type}`);
  }
};
