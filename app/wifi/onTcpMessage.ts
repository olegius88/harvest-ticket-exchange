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
import { getTalonsByKombainerId, ICreateTalonsParams } from '../db/talons_of_combainers';

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

    case 'kombainer_sign_ticket': {
      const {} = message;

      setTimeout(() => {
        // Отправляем событие о подключении водителя
        DeviceEventEmitter.emit('kombainerSignTicket', {});
      });

      return { status: 'ok' };
    }

    case 'voditel_sign_ticket': {
      const {} = message;

      setTimeout(() => {
        // Отправляем событие о подключении водителя
        DeviceEventEmitter.emit('voditelSignTicket', {});
      });

      return { status: 'ok' };
    }

    case 'set_voditel_data': {
      const { voditelData, voditelUserData } = message;

      setTimeout(() => {
        // Отправляем событие о подключении водителя
        DeviceEventEmitter.emit('voditelConnected', {
          voditelData,
          voditelUserData,
        } as IVoditelConnectedPayload);
      });

      return { status: 'ok' };
    }

    case 'accept_voditel_connect': {
      const { talonId } = message;

      setTimeout(() => {
        // Отправляем событие о принятии подключения водителя
        DeviceEventEmitter.emit('acceptVoditelConnect', {
          talonId,
        });
      });

      return { status: 'ok' };
    }

    // case 'set_kombainer_data': {
    //   const { kombainerData } = message;

    //   // Создаем payload с правильной структурой для передачи данных комбайнера
    //   const payload: IPayloadSetTalonOfKombainer = {
    //     kombainerData: kombainerData as ICreateKombainerParams,
    //     userData: {} as ICreateUsersParams, // Будет заполнено позже
    //     weight: 0, // Будет заполнено позже
    //   };

    //   setNeedRedirect('voditel', payload);

    //   return { status: 'ok' };
    // }

    case 'confirm_kombainer_ticket': {
      const { voditelData, userData } = message;
      console.log('confirm_kombainer_ticket|message=', message);

      setTimeout(() => {
        DeviceEventEmitter.emit('voditelConfirmAfterConnect', {
          voditelData,
          userData,
        } as IPayloadConfirmKombainerTicket);
      });

      return { status: 'ok' };
    }

    case 'confirm_kombainer_ticket_with_weight': {
      // const { voditelData, userData } = message;
      console.log('confirm_kombainer_ticket_with_weight|message=', message);

      setTimeout(() => {
        // Отправляем событие о подтверждении веса водителем
        DeviceEventEmitter.emit('voditelConfirmWithWeight', message);
      });

      return { status: 'ok' };
    }

    case 'get_kombainer_data': {
      const { talonId } = message;

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
      let talonData = null;
      if (kombainerData && kombainerData.id) {
        try {
          const talons = await getTalonsByKombainerId(kombainerData.id);
          if (talons && talons.length > 0) {
            // Если передан talonId, ищем конкретный талон
            if (talonId) {
              talonData = talons.find((talon) => talon.id === talonId);
              if (talonData) {
                talonNumber = talonData.talonNumber || '';
              }
            } else {
              // Находим последний созданный талон
              const latestTalon = talons.reduce((latest, current) => {
                return latest.created_at > current.created_at ? latest : current;
              });
              talonData = latestTalon;
              talonNumber = latestTalon.talonNumber || '';
            }
          }
        } catch (error) {
          console.error('get_kombainer_data|error=', error);
        }
      }

      return { status: 'ok', kombainerData, kombainerUserData: userData, talonNumber, talonData };
    }

    case 'set_talon_of_kombainer': {
      console.log('onTcpMessage|set_talon_of_kombainer|message=', message);
      const { kombainerData, userData, talonData, weight } = message;

      const payload: IPayloadSetTalonOfKombainer = {
        kombainerData: kombainerData as ICreateKombainerParams,
        userData: userData as ICreateUsersParams,
        weight: weight as number,
        talonData: talonData as ICreateTalonsParams,
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

    case 'tcp_disconnect_request': {
      console.log('onTcpMessage|tcp_disconnect_request|message=', message);

      // Уведомляем приложение о запросе на отключение
      DeviceEventEmitter.emit('tcpDisconnectRequested', {
        reason: message.reason,
        timestamp: message.timestamp,
      });

      // Добавляем асинхронный таймаут в 1 секунду
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Подтверждаем готовность к отключению
      return {
        type: 'tcp_disconnect_confirmation',
        status: 'ok',
        ready: true,
        timestamp: Date.now(),
      };
    }

    case 'tcp_disconnect_confirmation': {
      console.log('onTcpMessage|tcp_disconnect_confirmation|message=', message);

      // Уведомляем о подтверждении готовности к отключению
      DeviceEventEmitter.emit('tcpDisconnectConfirmed', {
        ready: message.ready,
        reason: message.reason,
        timestamp: message.timestamp,
      });

      return { status: 'ok' };
    }

    case 'tcp_disconnect_final': {
      console.log('onTcpMessage|tcp_disconnect_final|message=', message);

      // Уведомляем о финальном отключении
      DeviceEventEmitter.emit('tcpDisconnectFinal', {
        timestamp: message.timestamp,
      });

      return { status: 'ok' };
    }

    default:
      if (message?.status === 'ok') {
        // Если сообщение уже содержит статус 'ok', просто возвращаем его
        console.log('onTcpMessage|Получено сообщение со статусом ok, возвращаем его');
        return { status: 'ok' };
      }
      console.error(`onTcpMessage|Получено неизвестное сообщение|type=`, type);
      console.error(`onTcpMessage|Получено неизвестное сообщение|message=`, message);
      ToastAndroid.show(
        `onTcpMessage|Получено неизвестное сообщение|type=${type}`,
        ToastAndroid.SHORT
      );
      throw new Error(`onTcpMessage|Получено неизвестное сообщение|type=${type}`);
  }
};
