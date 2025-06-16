// Файл: app/wifi/TcpClient.ts
import TcpSocket from 'react-native-tcp-socket';
import { ToastAndroid } from 'react-native';
import { ISendTcpResponseData, ISendTcpRequestData } from '../../global';
import { onTcpMessage } from './onTcpMessage';

let client: TcpSocket.Socket | null = null;

// Интерфейс для сообщений с ID
interface IMessageWithId {
  messageId?: string;
  [key: string]: unknown;
}

// Map для хранения pending запросов от клиента к серверу
const pendingClientRequests = new Map<
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
 * Функция для подключения к TCP-серверу.
 * Возвращает Promise, который резолвится сообщением об успешном подключении
 * или отклоняется при возникновении ошибки.
 */
export const connectToTcpServer = ({ ip: host }: { ip: string }): Promise<string> => {
  console.log('connectToTcpServer|host=', host);
  return new Promise((resolve, reject) => {
    if (client) {
      ToastAndroid.show(`TCP клиент уже подключен`, ToastAndroid.SHORT);
      resolve('TCP клиент уже подключен');
      return;
    }
    client = TcpSocket.createConnection({ port: 3290, host }, () => {
      console.log('TCP клиент подключился к серверу');
      ToastAndroid.show(`TCP клиент успешно подключился`, ToastAndroid.SHORT);
      resolve('TCP клиент успешно подключился');
    });

    // Глобальный обработчик входящих сообщений от сервера,
    // если сообщение не получено как ответ на sendTcpRequest.
    client.on('data', async (data: string | Buffer) => {
      const dataString = typeof data === 'string' ? data : data.toString();
      console.log('TCP клиент|Получены данные:', dataString);

      let message: IMessageWithId;
      try {
        message = JSON.parse(dataString);
      } catch (error) {
        console.error('TCP клиент|Ошибка парсинга JSON:', error);
        return;
      }

      console.log('TCP клиент|Получены данные|message=', message);

      // Проверяем, является ли это ответом на запрос от клиента
      if (message.messageId && pendingClientRequests.has(message.messageId)) {
        const pendingRequest = pendingClientRequests.get(message.messageId)!;
        clearTimeout(pendingRequest.timeout);
        pendingClientRequests.delete(message.messageId);
        pendingRequest.resolve(message as unknown as ISendTcpResponseData);
        return;
      }

      // Обрабатываем обычное сообщение от сервера
      try {
        // Передаём полученное сообщение в onTcpMessage для обработки
        const response = await onTcpMessage(message as unknown as ISendTcpRequestData);
        // Отправляем ответ обратно на сервер
        if (client) {
          const responseWithId = {
            ...response,
            messageId: message.messageId, // Возвращаем ID сообщения если он был
            isTcpServerSendResponse: true,
            from: 'TcpClient.ts-connectToTcpServer-on-data',
          };
          client.write(JSON.stringify(responseWithId));
          console.log('TCP клиент|Ответ отправлен на сервер:', JSON.stringify(responseWithId));
        }
      } catch (error) {
        console.error('TCP клиент|Ошибка в onTcpMessage:', error);
        // DEV LOGS
        // ToastAndroid.show(`TCP клиент|Ошибка в onTcpMessage`, ToastAndroid.SHORT);
      }
    });

    client.on('error', (error) => {
      console.error('TCP клиент|Ошибка:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка`, ToastAndroid.SHORT);
      reject(error);
    });

    client.on('close', () => {
      console.log('TCP клиент|Соединение закрыто');

      // Отклоняем все pending запросы
      pendingClientRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('TCP клиент|Соединение закрыто'));
      });
      pendingClientRequests.clear();

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
  return new Promise((resolve) => {
    if (client) {
      // Отклоняем все pending запросы
      pendingClientRequests.forEach(({ reject, timeout }) => {
        clearTimeout(timeout);
        reject(new Error('disconnectTcpClient|Клиент отключается'));
      });
      pendingClientRequests.clear();

      client.destroy();
      console.log('TCP клиент отключился');
      client = null;
      resolve('TCP клиент отключен');
    } else {
      resolve('TCP клиент не был подключен');
    }
  });
};

/**
 * Функция для отправки запроса на TCP-сервер и получения ответа.
 * Принимает объект message, который необходимо отправить.
 * Объект преобразуется в JSON-строку и отправляется.
 * Функция ожидает ответа от сервера и возвращает его.
 */
export const sendTcpRequest = (message: object): Promise<ISendTcpResponseData> => {
  return new Promise((resolve, reject) => {
    if (!client) {
      const errorMsg = `TCP клиент не подключен ${client === null ? 'null' : 'undefined'}`;
      ToastAndroid.show(errorMsg, ToastAndroid.SHORT);
      reject(new Error(errorMsg));
      return;
    }

    const messageId = generateMessageId();

    // Создаем таймаут для запроса
    const timeout = setTimeout(() => {
      if (pendingClientRequests.has(messageId)) {
        pendingClientRequests.delete(messageId);
        reject(new Error('sendTcpRequest|Таймаут ожидания ответа'));
      }
    }, REQUEST_TIMEOUT);

    // Сохраняем информацию о pending запросе
    pendingClientRequests.set(messageId, { resolve, reject, timeout });

    const messageWithId = {
      ...message,
      messageId,
      from: 'TcpClient.ts-sendTcpRequest',
    };

    let jsonMessage: string;
    try {
      jsonMessage = JSON.stringify(messageWithId);
    } catch (error) {
      clearTimeout(timeout);
      pendingClientRequests.delete(messageId);
      console.error('TCP клиент|Ошибка при сериализации объекта:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка сериализации объекта`, ToastAndroid.SHORT);
      reject(error);
      return;
    }

    try {
      client.write(jsonMessage, 'utf8', () => {
        console.log('TCP клиент|Запрос отправлен:', jsonMessage);
        // ToastAndroid.show(`TCP клиент|Запрос отправлен`, ToastAndroid.SHORT);
      });
    } catch (error) {
      clearTimeout(timeout);
      pendingClientRequests.delete(messageId);
      console.error('TCP клиент|Ошибка при отправке данных:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка при отправке данных`, ToastAndroid.SHORT);
      reject(error);
    }
  });
};

/**
 * Проверяет, подключен ли TCP-клиент
 */
export const isTcpClientConnected = (): boolean => {
  return client !== null;
};

/**
 * Отправляет heartbeat сообщение для проверки соединения
 */
export const sendHeartbeat = async (): Promise<boolean> => {
  try {
    await sendTcpRequest({ type: 'heartbeat', timestamp: Date.now() });
    return true;
  } catch (error) {
    console.error('sendHeartbeat|error=', error);
    return false;
  }
};

/**
 * Функция для переподключения к TCP-серверу с повторными попытками
 */
export const reconnectToTcpServer = async (
  { ip }: { ip: string },
  maxRetries: number = 5,
  retryDelay: number = 2000
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`reconnectToTcpServer|Попытка ${attempt} из ${maxRetries}`);
      const result = await connectToTcpServer({ ip });
      return result;
    } catch (error) {
      console.error(`reconnectToTcpServer|Попытка ${attempt} неудачна:`, error);

      if (attempt === maxRetries) {
        throw new Error(`reconnectToTcpServer|Не удалось подключиться после ${maxRetries} попыток`);
      }

      // Ждем перед следующей попыткой
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error('reconnectToTcpServer|Неожиданная ошибка');
};
