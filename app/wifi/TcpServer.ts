// Файл: app/wifi/TcpServer.ts
import TcpSocket from 'react-native-tcp-socket';
import Server from 'react-native-tcp-socket/lib/types/Server';
import { ToastAndroid } from 'react-native';

let server: Server = null;

/**
 * Запускает TCP-сервер на порту 3290.
 * @returns Promise, который резолвится с сообщением об успешном запуске или отклоняется при ошибке.
 */
export const startTcpServer = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (server) {
      // Если сервер уже запущен, возвращаем сообщение
      ToastAndroid.show(`server|TCP-сервер уже запущен`, ToastAndroid.SHORT);
      resolve('server|TCP-сервер уже запущен');
      return;
    }

    server = TcpSocket.createServer((socket) => {
      console.log('server|Клиент подключился к TCP-серверу');
      ToastAndroid.show(`server|Клиент подключился к TCP-серверу`, ToastAndroid.SHORT);

      // Обработка полученных данных от клиента
      // @ts-ignore
      socket.on('data', (data) => {
        const dataString = data.toString();
        console.log('server|socket|on|data=', dataString);
        ToastAndroid.show(`server|socket|on|data`, ToastAndroid.SHORT);
        let message = null;
        try {
          message = JSON.parse(dataString);
        } catch (error) {
          console.error('server|Ошибка парсинга JSON:', error);
        }
        // Если получено тестовое сообщение, отправляем ответ "ok"
        if (message && message.test === 'test') {
          const response = JSON.stringify({ response: 'ok' });
          socket.write(response, 'utf8');
          console.log('server|Отправлено:', response);
          ToastAndroid.show(`server|Отправлено: ${response}`, ToastAndroid.SHORT);
        }
      });

      // @ts-ignore
      socket.on('error', (error) => {
        console.error('server|socket|on|error=', error);
        ToastAndroid.show(`server|socket|on|error`, ToastAndroid.SHORT);
      });

      // @ts-ignore
      socket.on('close', () => {
        console.log('server|socket|close');
        ToastAndroid.show(`server|socket|close`, ToastAndroid.SHORT);
      });
    });

    // @ts-ignore
    server.on('error', (error: any) => {
      console.log('server|Ошибка TCP-сервера|error=', error);
      ToastAndroid.show(`server|Ошибка TCP-сервера|error`, ToastAndroid.SHORT);
      reject(error);
    });

    server.listen({ port: 3290, host: '0.0.0.0', reuseAddress: true }, () => {
      const address = server.address();
      console.log('server|TCP-сервер запущен на порту 3290', address);
      ToastAndroid.show(
        `server|TCP-сервер успешно запущен|address=${JSON.stringify(address)}`,
        ToastAndroid.SHORT
      );
      resolve('server|TCP-сервер успешно запущен');
    });
  });
};

/**
 * Останавливает запущенный TCP-сервер.
 * @returns Promise, который резолвится с сообщением об успешной остановке или отклоняется при ошибке.
 */
export const stopTcpServer = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!server) {
      ToastAndroid.show(`stopTcpServer|TCP-сервер не запущен`, ToastAndroid.SHORT);
      resolve('stopTcpServer|TCP-сервер не запущен');
      return;
    }
    server.close(() => {
      console.log('stopTcpServer|TCP-сервер остановлен');
      server = null;
      ToastAndroid.show(`stopTcpServer|TCP-сервер остановлен`, ToastAndroid.SHORT);
      resolve('stopTcpServer|TCP-сервер остановлен');
    });
  });
};
