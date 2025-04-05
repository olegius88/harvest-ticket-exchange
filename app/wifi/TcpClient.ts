// Файл: app/wifi/TcpClient.ts

import TcpSocket from 'react-native-tcp-socket';
import { ToastAndroid } from 'react-native';

let client: TcpSocket.Socket | null = null;

/**
 * Функция для подключения к TCP-серверу.
 * При обнаружении IPv6-адреса, адрес оборачивается в квадратные скобки.
 * Возвращает Promise, который резолвится сообщением об успешном подключении
 * или отклоняется при возникновении ошибки.
 *
 * @param params - Объект с полем ip, содержащим IP-адрес сервера.
 */
export const connectToTcpServer = ({ ip: host }: { ip: string }): Promise<string> => {
  console.log('connectToTcpServer|host=', host);

  // Если host содержит ":", предполагается IPv6-адрес. Оборачиваем в квадратные скобки, если ещё не обернут.
  let formattedHost = host;
  if (host.includes(':') && !host.startsWith('[') && !host.endsWith(']')) {
    formattedHost = `[${host}]`;
  }

  return new Promise((resolve, reject) => {
    if (client) {
      ToastAndroid.show(`TCP клиент уже подключен`, ToastAndroid.SHORT);
      resolve('TCP клиент уже подключен');
      return;
    }

    client = TcpSocket.createConnection({ port: 3290, host: formattedHost }, () => {
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
