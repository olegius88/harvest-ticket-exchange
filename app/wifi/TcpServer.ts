// Файл: app/wifi/TcpServer.ts
import TcpSocket from 'react-native-tcp-socket';
import Server from 'react-native-tcp-socket/lib/types/Server';
import { ToastAndroid } from 'react-native';
import { IIsTcpServerSendResponse, ISendTcpRequestData, ISendTcpResponseData } from '../../global';
import { onTcpMessage } from './onTcpMessage';
import Socket from 'react-native-tcp-socket/lib/types/Socket';

let server: Server | null = null;
// Массив для хранения активных соединений (подключён может быть только один клиент)
let activeSockets: TcpSocket.Socket[] = [];

// Интерфейс для сообщений с ID
interface IMessageWithId {
  messageId?: string;
  [key: string]: unknown;
}

// Map для хранения pending запросов от сервера к клиенту
const pendingServerRequests = new Map<
  string,
  {
    resolve: (value: ISendTcpResponseData) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }
>();

// Функция для генерации уникального ID
const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Таймаут для запросов (30 секунд)
const REQUEST_TIMEOUT = 30000;

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
      socket.on('data', async (data: string | Buffer) => {
        const dataString = typeof data === 'string' ? data : data.toString();
        console.log('startTcpServer|socket|on|data=', dataString);

        let message: IMessageWithId;
        try {
          message = JSON.parse(dataString);
        } catch (error) {
          console.error('startTcpServer|Ошибка парсинга JSON:', error);
          ToastAndroid.show(
            `startTcpServer|Ошибка парсинга JSON|${JSON.stringify(error)}`,
            ToastAndroid.SHORT
          );
          return;
        }

        // Проверяем, является ли это ответом на запрос от сервера
        if (message.messageId && pendingServerRequests.has(message.messageId)) {
          const pendingRequest = pendingServerRequests.get(message.messageId)!;
          clearTimeout(pendingRequest.timeout);
          pendingServerRequests.delete(message.messageId);
          pendingRequest.resolve(message as unknown as ISendTcpResponseData);
          return;
        }

        // Проверяем, является ли это ответом сервера (для обратной совместимости)
        if ((message as unknown as IIsTcpServerSendResponse).isTcpServerSendResponse) {
          console.log('startTcpServer|isTcpServerSendResponse|message=', message);
          return;
        }

        // Обрабатываем обычное сообщение
        let res;
        try {
          res = await onTcpMessage(message as unknown as ISendTcpRequestData);
        } catch (error) {
          console.error('startTcpServer|onTcpMessage|error=', error);
          ToastAndroid.show(`startTcpServer|onTcpMessage|error`, ToastAndroid.SHORT);
          return;
        }

        console.log('startTcpServer|onTcpMessage|res=', res);
        try {
          const response = {
            ...res,
            messageId: message.messageId, // Возвращаем ID сообщения если он был
            from: 'TcpServer.ts-TcpSocket.createServer-on-data',
          };
          socket.write(JSON.stringify(response));
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
        activeSockets = activeSockets.filter((s) => s !== socket);
      });
    });

    server.on('error', (error: any) => {
      console.log('startTcpServer|Ошибка TCP-сервера|error=', error);
      ToastAndroid.show(`startTcpServer|Ошибка TCP-сервера|error`, ToastAndroid.SHORT);
      reject(error);
    });

    server.listen({ port: 3290, host: '0.0.0.0', reuseAddress: true }, () => {
      if (server) {
        const address = server.address();
        console.log('startTcpServer|TCP-сервер запущен на порту 3290', address);
        ToastAndroid.show(
          `startTcpServer|TCP-сервер успешно запущен|address=${JSON.stringify(address)}`,
          ToastAndroid.SHORT
        );
      }
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

    // Отклоняем все pending запросы
    pendingServerRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('stopTcpServer|Сервер остановлен'));
    });
    pendingServerRequests.clear();

    // Закрываем все активные соединения
    activeSockets.forEach((socket) => {
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
    const messageId = generateMessageId();

    // Создаем таймаут для запроса
    const timeout = setTimeout(() => {
      if (pendingServerRequests.has(messageId)) {
        pendingServerRequests.delete(messageId);
        reject(new Error('tcpServerSendRequest|Таймаут ожидания ответа'));
      }
    }, REQUEST_TIMEOUT);

    // Сохраняем информацию о pending запросе
    pendingServerRequests.set(messageId, { resolve, reject, timeout });

    const messageWithId = {
      ...message,
      messageId,
      fromTcpServerSendRequest: true,
      from: 'tcpServerSendRequest',
    };

    try {
      const messageString = JSON.stringify(messageWithId);
      socket.write(messageString);
      console.log('tcpServerSendRequest|Сообщение отправлено:', messageString);
    } catch (error) {
      clearTimeout(timeout);
      pendingServerRequests.delete(messageId);
      console.error('tcpServerSendRequest|Ошибка при отправке сообщения:', error);
      ToastAndroid.show(`tcpServerSendRequest|Ошибка при отправке сообщения`, ToastAndroid.SHORT);
      reject(error);
    }
  });
};

/**
 * Проверяет, запущен ли TCP-сервер
 */
export const isTcpServerRunning = (): boolean => {
  return server !== null;
};

/**
 * Получает количество подключенных клиентов
 */
export const getConnectedClientsCount = (): number => {
  return activeSockets.length;
};

/**
 * Отправляет heartbeat сообщение для проверки соединения
 */
export const sendHeartbeat = async (): Promise<boolean> => {
  try {
    await tcpServerSendRequest({ type: 'heartbeat', timestamp: Date.now() });
    return true;
  } catch (error) {
    console.error('sendHeartbeat|error=', error);
    return false;
  }
};
