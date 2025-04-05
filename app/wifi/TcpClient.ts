// Файл: app/wifi/TcpClient.ts

import TcpSocket from 'react-native-tcp-socket';
import { ToastAndroid } from 'react-native';

let client: TcpSocket.Socket | null = null;

/**
 * Функция для подключения к TCP-серверу.
 * Возвращает Promise, который резолвится сообщением об успешном подключении
 * или отклоняется при возникновении ошибки.
 */
export const connectToTcpServer = ({ ip: host }): Promise<string> => {
  console.log('connectToTcpServer|host=', host);
  return new Promise((resolve, reject) => {
    if (client) {
      resolve('TCP клиент уже подключен');
      ToastAndroid.show(`TCP клиент уже подключен`, ToastAndroid.SHORT);
      return;
    }
    // Замените 'YOUR_SERVER_IP' на фактический IP-адрес сервера, если требуется.
    client = TcpSocket.createConnection({ port: 3290, host }, () => {
      console.log('TCP клиент подключился к серверу');
      ToastAndroid.show(`TCP клиент успешно подключился`, ToastAndroid.SHORT);
      resolve('TCP клиент успешно подключился');
    });

    // @ts-ignore
    client.on('error', (error) => {
      console.error('TCP клиент|Ошибка:', error);
      ToastAndroid.show(`TCP клиент|Ошибка`, ToastAndroid.SHORT);
      reject(error);
    });

    // @ts-ignore
    client.on('close', () => {
      console.log('TCP клиент|Соединение закрыто');
      client = null;
      ToastAndroid.show(`TCP клиент|Соединение закрыто`, ToastAndroid.SHORT);
    });
  });
};

/**
 * Функция для отключения от TCP-сервера.
 * Возвращает Promise, который резолвится сообщением об успешном отключении.
 */
export const disconnectTcpClient = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (client) {
      client.end(() => {
        console.log('TCP клиент отключился');
        client = null;
        resolve('TCP клиент отключен');
      });
    } else {
      resolve('TCP клиент не был подключен');
    }
  });
};
