// Файл: app/wifi/TcpServer.ts
import TcpSocket from 'react-native-tcp-socket';
import Server from 'react-native-tcp-socket/lib/types/Server';
import { ToastAndroid } from 'react-native';
import { IIsTcpServerSendResponse, ISendTcpRequestData, ISendTcpResponseData } from '../../global';
import { onTcpMessage } from './onTcpMessage';
import Socket from 'react-native-tcp-socket/lib/types/Socket';

let server: Server = null;
// Массив для хранения активных соединений (подключён может быть только один клиент)
let activeSockets: TcpSocket.Socket[] = [];

/**
 * Запускает TCP-сервер на порту 3290.
 * @returns Promise, который резолвится с сообщением об успешном запуске или отклоняется при ошибке.
 */
export const startTcpServer = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (server) {
      ToastAndroid.show(`startTcpServer|TCP-сервер уже запущен`, ToastAndroid.SHORT);
      resolve('startTcpServer|TCP-сервер уже запущен');
      return;
    }

    server = TcpSocket.createServer((socket: Socket) => {
      console.log('startTcpServer|Клиент подключился к TCP-серверу');
      ToastAndroid.show(`startTcpServer|Клиент подключился к TCP-серверу`, ToastAndroid.SHORT);

      // Добавляем сокет в массив активных соединений
      activeSockets.push(socket);

      // Обработка полученных данных от клиента
      socket.on('data', async (data: Buffer) => {
        const dataString = data.toString();
        console.log('startTcpServer|socket|on|data=', dataString);
        // ToastAndroid.show(`startTcpServer|socket|on|data`, ToastAndroid.SHORT);
        let message: ISendTcpRequestData;
        try {
          message = JSON.parse(dataString);
          if ((message as unknown as IIsTcpServerSendResponse).isTcpServerSendResponse) {
            console.log('startTcpServer|isTcpServerSendResponse|message=', message);
            return;
          }
        } catch (error) {
          console.error('startTcpServer|Ошибка парсинга JSON:', error);
          ToastAndroid.show(
            `startTcpServer|Ошибка парсинга JSON|${JSON.stringify(error)}`,
            ToastAndroid.SHORT
          );
          return;
        }

        let res;
        try {
          res = await onTcpMessage(message);
        } catch (error) {
          console.error('startTcpServer|onTcpMessage|error=', error);
          ToastAndroid.show(`startTcpServer|onTcpMessage|error`, ToastAndroid.SHORT);
          return;
        }

        console.log('startTcpServer|onTcpMessage|res=', res);
        try {
          socket.write(
            JSON.stringify({ ...res, ...{ from: 'TcpServer.ts-TcpSocket.createServer-on-data' } })
          );
        } catch (error) {
          console.error('startTcpServer|socket|write|error=', error);
          ToastAndroid.show(`startTcpServer|socket|write|error`, ToastAndroid.SHORT);
        }
      });

      socket.on('error', (error: any) => {
        console.error('startTcpServer|socket|on|error=', error);
        ToastAndroid.show(`startTcpServer|socket|on|error`, ToastAndroid.SHORT);
      });

      socket.on('close', () => {
        console.log('startTcpServer|socket|close');
        ToastAndroid.show(`startTcpServer|socket|close`, ToastAndroid.SHORT);
        // Удаляем сокет из массива активных соединений
        activeSockets = activeSockets.filter(s => s !== socket);
      });
    });

    server.on('error', (error: any) => {
      console.log('startTcpServer|Ошибка TCP-сервера|error=', error);
      ToastAndroid.show(`startTcpServer|Ошибка TCP-сервера|error`, ToastAndroid.SHORT);
      reject(error);
    });

    server.listen({ port: 3290, host: '0.0.0.0', reuseAddress: true }, () => {
      const address = server.address();
      console.log('startTcpServer|TCP-сервер запущен на порту 3290', address);
      ToastAndroid.show(
        `startTcpServer|TCP-сервер успешно запущен|address=${JSON.stringify(address)}`,
        ToastAndroid.SHORT
      );
      resolve('startTcpServer|TCP-сервер успешно запущен');
    });
  });
};

/**
 * Останавливает запущенный TCP-сервер.
 * Сначала закрывает все активные соединения, а затем сервер.
 * @returns Promise, который резолвится с сообщением об успешной остановке или отклоняется при ошибке.
 */
export const stopTcpServer = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve('stopTcpServer|TCP-сервер не запущен');
      return;
    }

    // Закрываем все активные соединения
    activeSockets.forEach(socket => {
      try {
        socket.destroy();
      } catch (error) {
        console.error('stopTcpServer|Ошибка при закрытии сокета:', error);
      }
    });
    activeSockets = [];

    // Закрываем сервер
    server.close(() => {
      console.log('stopTcpServer|TCP-сервер остановлен');
      ToastAndroid.show(`stopTcpServer|TCP-сервер остановлен`, ToastAndroid.SHORT);
      server = null;
      resolve('stopTcpServer|TCP-сервер остановлен');
    });
  });
};

/**
 * Отправляет сообщение подключённому TCP-клиенту и ожидает ответа.
 * Предполагается, что подключён только один TCP-клиент.
 * @param message данные сообщения для отправки (любой объект, который будет сериализован в JSON).
 * @returns Promise, который резолвится с ответом от клиента или отклоняется при ошибке.
 */
export const tcpServerSendRequest = (message: object): Promise<ISendTcpResponseData> => {
  return new Promise((resolve, reject) => {
    if (activeSockets.length !== 1) {
      const errMsg =
        activeSockets.length === 0
          ? 'tcpServerSendRequest|Нет подключенных TCP-клиентов'
          : 'tcpServerSendRequest|Подключено более одного TCP-клиента';
      ToastAndroid.show(errMsg, ToastAndroid.SHORT);
      return reject(new Error(errMsg));
    }
    const socket = activeSockets[0];
    const messageString = JSON.stringify({
      ...message,
      ...{ fromTcpServerSendRequest: true, from: 'tcpServerSendRequest-once-data' },
    });

    // Устанавливаем одноразовый обработчик для получения ответа от клиента
    socket.once('data', (data: Buffer) => {
      const dataString = data.toString();
      console.log('tcpServerSendRequest|sendMessage|Получен ответ от клиента:', dataString);
      try {
        const response = JSON.parse(dataString);
        resolve(response);
      } catch (error) {
        console.error('tcpServerSendRequest|sendMessage|Ошибка парсинга ответа:', error);
        ToastAndroid.show(
          `tcpServerSendRequest|sendMessage|Ошибка парсинга ответа`,
          ToastAndroid.SHORT
        );
        reject(error);
      }
    });

    try {
      socket.write(messageString);
      console.log('tcpServerSendRequest|sendMessage|Сообщение отправлено:', messageString);
    } catch (error) {
      console.error('tcpServerSendRequest|sendMessage|Ошибка при отправке сообщения:', error);
      ToastAndroid.show(
        `tcpServerSendRequest|sendMessage|Ошибка при отправке сообщения`,
        ToastAndroid.SHORT
      );
      reject(error);
    }
  });
};
