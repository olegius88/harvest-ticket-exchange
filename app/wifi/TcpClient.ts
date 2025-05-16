// Файл: app/wifi/TcpClient.ts
import TcpSocket from 'react-native-tcp-socket';
import { ToastAndroid } from 'react-native';
import { ISendTcpResponseData } from '../../global';
import { onTcpMessage } from './onTcpMessage';

let client: TcpSocket.Socket | null = null;

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
    client.on('data', async (data: Buffer) => {
      const dataString = data.toString();
      console.log('TCP клиент|Получены данные:', dataString);
      // ToastAndroid.show(`TCP клиент|Получены данные`, ToastAndroid.SHORT);
      let message: any;
      try {
        message = JSON.parse(dataString);
      } catch (error) {
        console.error('TCP клиент|Ошибка парсинга JSON:', error);
        return;
      }
      // Если данные получили как результат одноразового обработчика (sendTcpRequest),
      // то данный глобальный обработчик может быть не вызван.
      try {
        // Передаём полученное сообщение в onTcpMessage для обработки
        const response = await onTcpMessage(message);
        // Отправляем ответ обратно на сервер
        if (client) {
          client.write(
            JSON.stringify({
              ...response,
              isTcpServerSendResponse: true,
              from: 'TcpClient.ts-connectToTcpServer-on-data',
            })
          );
          console.log('TCP клиент|Ответ отправлен на сервер:', JSON.stringify(response));
        }
      } catch (error) {
        console.error('TCP клиент|Ошибка в onTcpMessage:', error);
        // DEV LOGS
        // ToastAndroid.show(`TCP клиент|Ошибка в onTcpMessage`, ToastAndroid.SHORT);
      }
    });

    client.on('error', error => {
      console.error('TCP клиент|Ошибка:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка`, ToastAndroid.SHORT);
      reject(error);
    });

    client.on('close', () => {
      console.log('TCP клиент|Соединение закрыто');
      client = undefined;
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
      // @ts-ignore
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

/**
 * Функция для отправки запроса на TCP-сервер и получения ответа.
 * Принимает объект message, который необходимо отправить.
 * Объект преобразуется в JSON-строку и отправляется.
 * Функция ожидает ответа от сервера и возвращает его.
 */
export const sendTcpRequest = (message: object): Promise<ISendTcpResponseData> => {
  return new Promise((resolve, reject) => {
    if (!client) {
      ToastAndroid.show(
        `TCP клиент не подключен ${client === undefined ? 'undefined' : 'null'}`,
        ToastAndroid.SHORT
      );
      reject('TCP клиент не подключен');
      return;
    }
    let jsonMessage: string;
    try {
      jsonMessage = JSON.stringify({ ...message, from: 'TcpClient.ts-sendTcpRequest' });
    } catch (error) {
      console.error('TCP клиент|Ошибка при сериализации объекта:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка сериализации объекта`, ToastAndroid.SHORT);
      reject(error);
      return;
    }

    // Устанавливаем одноразовый обработчик для получения ответа
    client.once('data', (data: Buffer) => {
      const dataString = data.toString();
      console.log('TCP клиент|Получен ответ:', dataString);
      // ToastAndroid.show(`TCP клиент|Получен ответ`, ToastAndroid.SHORT);
      try {
        const response = JSON.parse(dataString);
        // Здесь можно добавить дополнительную проверку структуры ответа, если необходимо
        resolve(response);
      } catch (error) {
        console.error('TCP клиент|Ошибка при парсинге ответа:', error);
        // DEV LOGS
        // ToastAndroid.show(`TCP клиент|Ошибка парсинга ответа`, ToastAndroid.SHORT);
        reject(error);
      }
    });

    try {
      client.write(jsonMessage, 'utf8', () => {
        console.log('TCP клиент|Запрос отправлен:', jsonMessage);
        // ToastAndroid.show(`TCP клиент|Запрос отправлен`, ToastAndroid.SHORT);
      });
    } catch (error) {
      console.error('TCP клиент|Ошибка при отправке данных:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка при отправке данных`, ToastAndroid.SHORT);
      reject(error);
    }
  });
};
