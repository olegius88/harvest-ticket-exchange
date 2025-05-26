// app/wifi/onTcpMessage.ts

import { ISendTcpRequestData } from '../../global';
import { ToastAndroid } from 'react-native';
import { setNeedRedirect } from '../webviews/onMessage';
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

      setNeedRedirect('kombainer', { voditelData, voditelUserData });

      return { status: 'ok' };
    }

    case 'set_kombainer_data': {
      const { kombainerData } = message;

      setNeedRedirect('voditel', kombainerData);

      return { status: 'ok' };
    }

    case 'confirm_kombainer_ticket': {
      const { voditelData, userData } = message;

      setNeedRedirect('kombainer', { voditelData, userData });

      return { status: 'ok' };
    }

    case 'confirm_kombainer_ticket_with_weight': {
      // const { voditelData, userData } = message;

      setNeedRedirect('kombainer', {});

      return { status: 'ok' };
    }

    case 'get_kombainer_data': {
      const {} = message;

      const currentUserId = await getConfig('currentUserId');
      console.log('currentUser|currentUserId=', currentUserId);
      if (!currentUserId) {
        ToastAndroid.show(`Ошибка: Не найден ID текущего пользователя`, ToastAndroid.SHORT);
        return { status: 'error' };
      }
      let userData: ICreateUsersParams;
      try {
        userData = await getUserById(currentUserId);
        console.log('currentUser|userData=', userData);
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
        return { status: 'error' };
      }
      if (!userData) {
        ToastAndroid.show(
          `Ошибка: не найдены данные комбайнера у пользователя`,
          ToastAndroid.SHORT
        );
        return { status: 'error' };
      }
      const kombainerData = await getKombainerByUserId(currentUserId);
      console.log('currentUser|kombainerData=', kombainerData);

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
          console.error('Ошибка при получении номера талона:', error);
        }
      }

      return { status: 'ok', kombainerData, kombainerUserData: userData, talonNumber };
    }

    case 'set_talon_of_kombainer': {
      const { kombainerData, userData, weight, talonNumber } = message;

      setNeedRedirect('voditel', { kombainerData, userData, weight, talonNumber });

      return { status: 'ok' };
    }

    default:
      console.trace(`onTcpMessage|Получено неизвестное сообщение|type=${type}`, message);
      ToastAndroid.show(
        `onTcpMessage|Получено неизвестное сообщение|type=${type}`,
        ToastAndroid.SHORT
      );
      throw new Error(`onTcpMessage|Получено неизвестное сообщение|type=${type}`);
  }
};
