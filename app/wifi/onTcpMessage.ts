// app/wifi/onTcpMessage.ts

import { ISendTcpRequestData } from '../../global';
import { ToastAndroid } from 'react-native';
import { setNeedRedirect } from '../webviews/onMessage';

/**
 * Основная функция обработки сообщений
 */
export const onTcpMessage = async (message: ISendTcpRequestData) => {
  console.log('onTcpMessage|message=', message);
  const { type } = message;

  switch (type) {
    case 'test':
      return { status: 'ok' };
    case 'set_voditel_data':
      const { voditelData } = message;

      setNeedRedirect('create_ticket', voditelData);

      return { status: 'ok' };
    default:
      console.log('server|Получено неизвестное сообщение');
      ToastAndroid.show(`server|Получено неизвестное сообщение`, ToastAndroid.SHORT);
      throw new Error('server|Получено неизвестное сообщение');
  }
};
