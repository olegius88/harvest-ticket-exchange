// app/wifi/TcpServer.ts
import TcpSocket from 'react-native-tcp-socket';
import Server from 'react-native-tcp-socket/lib/types/Server';

let server: Server = null;

/**
 * Запускает TCP-сервер на порту 3290.
 * @returns Promise, который резолвится с сообщением об успешном запуске или отклоняется при ошибке.
 */
export const startTcpServer = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (server) {
      // Если сервер уже запущен, возвращаем сообщение
      resolve('server|TCP-сервер уже запущен');
      return;
    }

    server = TcpSocket.createServer((socket) => {
      console.log('server|Клиент подключился к TCP-серверу');

      // @ts-ignore
      socket.on('data', (data) => {
        console.log('server|socket|data=', data.toString());
      });

      // @ts-ignore
      socket.on('error', (error) => {
        console.error('server|socket|error=', error);
      });

      // @ts-ignore
      socket.on('close', () => {
        console.log('server|socket|close');
      });
    });

    // @ts-ignore
    server.on('error', (error: any) => {
      console.log('server|Ошибка TCP-сервера|error=', error);
      reject(error);
    });

    server.listen({ port: 3290, host: '0.0.0.0', reuseAddress: true }, () => {
      console.log('server|TCP-сервер запущен на порту 3290');
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
      resolve('TCP-сервер не запущен');
      return;
    }
    server.close(() => {
      console.log('TCP-сервер остановлен');
      server = null;
      resolve('TCP-сервер остановлен');
    });
  });
};
