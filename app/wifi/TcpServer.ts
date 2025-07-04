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

// Текущий порт сервера
let currentPort: number = 3290;

// Функция для генерации случайного порта в диапазоне 3000-65535
const generateRandomPort = (): number => {
  const minPort = 3000;
  const maxPort = 65535;
  return Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
};

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
        activeSockets = activeSockets.filter((s) => s !== socket);
      });
    });

    server.on('error', (error: any) => {
      console.error(`startTcpServer|Ошибка TCP-сервера на порту ${currentPort}|error=`, error);
      ToastAndroid.show(`startTcpServer|Ошибка TCP-сервера|error`, ToastAndroid.SHORT);
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
