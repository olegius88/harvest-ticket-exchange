// Файл: app/wifi/TcpServer.ts
import TcpSocket from 'react-native-tcp-socket';
import Server from 'react-native-tcp-socket/lib/types/Server';
import { ToastAndroid } from 'react-native';
import { IIsTcpServerSendResponse, ISendTcpRequestData, ISendTcpResponseData } from '../../global';
import { onTcpMessage } from './onTcpMessage';
import Socket from 'react-native-tcp-socket/lib/types/Socket';

let server: Server | null = null;
// Единственное активное соединение
let activeSocket: TcpSocket.Socket | null = null;

// Текущий порт сервера
let currentPort: number = 3290;

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

// Функция для генерации случайного порта в диапазоне 3000-65535
const generateRandomPort = (): number => {
  const minPort = 3000;
  const maxPort = 65535;
  return Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
};

// Таймаут для запросов (30 секунд)
const REQUEST_TIMEOUT = 30000;

/**
 * Запускает TCP-сервер на случайном порту из диапазона 3000-65535.
 * @param port - опциональный порт. Если не указан, будет сгенерирован случайный
 * @returns Promise, который резолвится с объектом содержащим сообщение и порт сервера или отклоняется при ошибке.
 */
export const startTcpServer = (port?: number): Promise<{ message: string; port: number }> => {
  return new Promise((resolve, reject) => {
    if (server) {
      console.log('startTcpServer|TCP-сервер уже запущен');
      ToastAndroid.show(`startTcpServer|TCP-сервер уже запущен`, ToastAndroid.SHORT);
      resolve({ message: 'startTcpServer|TCP-сервер уже запущен', port: currentPort });
      return;
    }

    // Генерируем случайный порт если не передан
    const targetPort = port || generateRandomPort();
    currentPort = targetPort;

    // Сначала попробуем создать сервер
    try {
      server = TcpSocket.createServer((socket: Socket) => {
        console.log('startTcpServer|Клиент подключился к TCP-серверу');
        ToastAndroid.show(`startTcpServer|Клиент подключился к TCP-серверу`, ToastAndroid.SHORT);

        // Если уже есть активное соединение, закрываем предыдущее
        if (activeSocket) {
          activeSocket.destroy();
        }
        // Сохраняем новое активное соединение
        activeSocket = socket;

        // Обработка полученных данных от клиента
        socket.on('data', async (data: string | Buffer) => {
          if (typeof data === 'string') {
            console.log('startTcpServer|socket|on|data (string)=', data);
            try {
              const json = JSON.parse(data);
              console.log('startTcpServer|socket|on|data (parsed JSON)=', json);
            } catch (error) {
              console.error('startTcpServer|Ошибка парсинга JSON:', error);
            }
          } else {
            try {
              const json = JSON.parse(data.toString());
              console.log('startTcpServer|socket|on|data (Buffer JSON)=', json);
              if ((json as any).type === 'force_exit') {
                console.log('startTcpServer|Получено сообщение force_exit, выполняем destroy');
                ToastAndroid.show(
                  'startTcpServer|Получено force_exit, закрываем соединение',
                  ToastAndroid.SHORT
                );
                socket.destroy();
                return;
              }
            } catch (error) {
              console.error('startTcpServer|Ошибка парсинга Buffer JSON:', error);
            }
          }

          const dataString = typeof data === 'string' ? data : data.toString();

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

          // Проверяем, является ли это сообщением force_exit
          if ((message as any).type === 'force_exit') {
            console.log('startTcpServer|Получено сообщение force_exit, выполняем end');
            ToastAndroid.show(
              'startTcpServer|Получено force_exit, закрываем соединение',
              ToastAndroid.SHORT
            );
            socket.end();
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

          // Очищаем активное соединение
          if (activeSocket === socket) {
            activeSocket = null;
          }
        });
      });
    } catch (error) {
      console.error('startTcpServer|Ошибка при создании TCP-сервера:', error);
      ToastAndroid.show(`startTcpServer|Ошибка при создании TCP-сервера`, ToastAndroid.SHORT);
      reject(error);
      return;
    }

    server.on('error', (error: any) => {
      console.error(`startTcpServer|Ошибка TCP-сервера на порту ${currentPort}|error=`, error);
      ToastAndroid.show(`startTcpServer|Ошибка TCP-сервера|error`, ToastAndroid.SHORT);

      // Если порт уже используется, попробуем другой порт
      if (JSON.stringify(error).includes('EADDRINUSE')) {
        console.log(
          `startTcpServer|Порт ${currentPort} уже используется, пытаемся сгенерировать новый`
        );

        // Освобождаем ссылку на сервер
        server = null;

        // Пытаемся запустить на новом порту
        startTcpServer()
          .then((result) => resolve(result))
          .catch((retryError) => reject(retryError));
        return;
      }

      // Освобождаем ссылку на сервер, чтобы можно было повторить попытку
      server = null;

      reject(error);
    });

    server.listen({ port: currentPort, host: '0.0.0.0', reuseAddress: true }, () => {
      if (server) {
        const address = server.address();
        console.log(`startTcpServer|TCP-сервер запущен на порту ${currentPort}`, address);
        ToastAndroid.show(
          `startTcpServer|TCP-сервер успешно запущен на порту ${currentPort}`,
          ToastAndroid.SHORT
        );
      }
      resolve({
        message: `startTcpServer|TCP-сервер успешно запущен на порту ${currentPort}`,
        port: currentPort,
      });
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
      console.log('stopTcpServer|TCP-сервер не запущен');
      resolve('stopTcpServer|TCP-сервер не запущен');
      return;
    }

    // Отклоняем все pending запросы
    pendingServerRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('stopTcpServer|Сервер остановлен'));
    });
    pendingServerRequests.clear();

    // Закрываем активное соединение
    if (activeSocket) {
      try {
        activeSocket.destroy();
        activeSocket = null;
      } catch (error) {
        console.error('stopTcpServer|Ошибка при закрытии сокета:', error);
      }
    }

    // Создаем копию ссылки на сервер и очищаем глобальную переменную
    const serverToClose = server;
    server = null;

    // Закрываем сервер
    try {
      serverToClose.close(() => {
        console.log('stopTcpServer|TCP-сервер остановлен');
        ToastAndroid.show(`stopTcpServer|TCP-сервер остановлен`, ToastAndroid.SHORT);
        resolve('stopTcpServer|TCP-сервер остановлен');
      });
    } catch (error) {
      console.error('stopTcpServer|Ошибка при закрытии сервера:', error);
      // Даже при ошибке считаем, что сервер остановлен
      resolve('stopTcpServer|TCP-сервер остановлен (с ошибкой)');
    }
  });
};

/**
 * Функция для согласованного отключения TCP-сервера.
 * Сначала отправляет запрос на отключение всем подключенным клиентам и ждет подтверждения.
 * Затем останавливает сервер.
 * @param reason - причина отключения (опционально)
 * @param timeout - таймаут ожидания ответа в миллисекундах (по умолчанию 5000)
 */
export const stopTcpServerGracefully = async (
  reason?: string,
  timeout: number = 5000
): Promise<string> => {
  console.log('stopTcpServerGracefully|init|reason=', reason);

  if (!server) {
    console.log('stopTcpServerGracefully|TCP-сервер не запущен');
    return 'stopTcpServerGracefully|TCP-сервер не запущен';
  }

  if (!activeSocket) {
    console.log('stopTcpServerGracefully|Нет активного соединения, выполняем обычную остановку');
    return await stopTcpServer();
  }

  try {
    console.log('stopTcpServerGracefully|Отправляем запрос на отключение клиентам');

    // Отправляем запрос на отключение всем подключенным клиентам
    const disconnectRequest = {
      type: 'tcp_disconnect_request',
      reason: reason || 'Плановое отключение сервера',
      timestamp: Date.now(),
    };

    // Отправляем запрос клиенту и ждем подтверждения
    try {
      console.log('stopTcpServerGracefully|Отправляем запрос клиенту');
      const response = await tcpServerSendRequest(disconnectRequest);
      console.log('stopTcpServerGracefully|Получен ответ от клиента:', response);
    } catch (error) {
      console.warn('stopTcpServerGracefully|Не удалось получить подтверждение от клиента:', error);
    }

    // Отправляем финальное уведомление об отключении
    const finalMessage = {
      type: 'tcp_disconnect_final',
      timestamp: Date.now(),
    };

    // Отправляем финальное сообщение клиенту
    if (activeSocket) {
      try {
        activeSocket.write(JSON.stringify(finalMessage));
        console.log('stopTcpServerGracefully|Отправлено финальное сообщение клиенту');
      } catch (error) {
        console.warn(
          'stopTcpServerGracefully|Не удалось отправить финальное сообщение клиенту:',
          error
        );
      }
    }

    // Даем время на отправку финальных сообщений
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log('stopTcpServerGracefully|Выполняем остановку сервера');
    return await stopTcpServer();
  } catch (error) {
    console.error('stopTcpServerGracefully|Ошибка при согласованном отключении:', error);
    console.log('stopTcpServerGracefully|Выполняем принудительную остановку');

    // Если согласованное отключение не удалось, выполняем обычную остановку
    return await stopTcpServer();
  }
};

/**
 * Отправляет сообщение подключённому TCP-клиенту и ожидает ответа.
 * Предполагается, что подключён только один TCP-клиент.
 * @param message данные сообщения для отправки (любой объект, который будет сериализован в JSON).
 * @returns Promise, который резолвится с ответом от клиента или отклоняется при ошибке.
 */
export const tcpServerSendRequest = (message: object): Promise<ISendTcpResponseData> => {
  return new Promise((resolve, reject) => {
    if (!activeSocket) {
      const errMsg = 'tcpServerSendRequest|Нет подключенного TCP-клиента';
      ToastAndroid.show(errMsg, ToastAndroid.SHORT);
      return reject(new Error(errMsg));
    }

    const socket = activeSocket;
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
      console.log('tcpServerSendRequest|Сообщение отправлено|messageWithId=', messageWithId);
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
 * Получает текущий порт TCP-сервера
 */
export const getCurrentTcpServerPort = (): number => {
  return currentPort;
};

/**
 * Проверяет, запущен ли TCP-сервер
 */
export const isTcpServerRunning = (): boolean => {
  return server !== null;
};

/**
 * Получает количество подключенных клиентов (0 или 1)
 */
export const getConnectedClientsCount = (): number => {
  return activeSocket ? 1 : 0;
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
