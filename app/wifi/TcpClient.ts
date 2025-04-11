// Файл: app/wifi/TcpClient.ts
import TcpSocket from 'react-native-tcp-socket';
import { ToastAndroid } from 'react-native';
import { IOkTcpConnectEstablished } from '../../global';

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
      ToastAndroid.show(`TCP клиент уже подключен`, ToastAndroid.SHORT);
      resolve('TCP клиент уже подключен');
      return;
    }
    client = TcpSocket.createConnection({ port: 3290, host }, () => {
      console.log('TCP клиент подключился к серверу');
      ToastAndroid.show(`TCP клиент успешно подключился`, ToastAndroid.SHORT);

      // // Отправляем JSON-тестовое сообщение на сервер
      // const testMessage = JSON.stringify({ test: 'test' });
      // client.write(testMessage, 'utf8');
      // console.log('TCP клиент|Отправлено тестовое сообщение:', testMessage);
      // ToastAndroid.show(`TCP клиент|Отправлено тестовое сообщение`, ToastAndroid.SHORT);

      resolve('TCP клиент успешно подключился');
    });

    // Обработка ответа от сервера
    // @ts-ignore
    client.on('data', (data) => {
      const dataString = data.toString();
      console.log('TCP клиент|Получены данные:', dataString);
      ToastAndroid.show(`TCP клиент|Получены данные`, ToastAndroid.SHORT);
      // let response = null;
      // try {
      //   response = JSON.parse(dataString);
      // } catch (error) {
      //   console.error('TCP клиент|Ошибка парсинга JSON:', error);
      // }
      // if (response && response.response === 'ok') {
      //   console.log('TCP клиент|Получен корректный ответ:', response);
      //   ToastAndroid.show(`TCP клиент|Получен ответ: ok`, ToastAndroid.SHORT);
      // }
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

/**
 * Функция для отправки запроса на TCP-сервер и получения ответа.
 * Принимает объект message, который необходимо отправить.
 * Объект преобразуется в JSON-строку и отправляется.
 * Функция ожидает ответа от сервера и возвращает его
 */
export const sendTcpRequest = (message: object): Promise<IOkTcpConnectEstablished> => {
  return new Promise((resolve, reject) => {
    if (!client) {
      ToastAndroid.show(`TCP клиент не подключен`, ToastAndroid.SHORT);
      reject('TCP клиент не подключен');
      return;
    }
    let jsonMessage: string;
    try {
      jsonMessage = JSON.stringify(message);
    } catch (error) {
      console.error('TCP клиент|Ошибка при сериализации объекта:', error);
      ToastAndroid.show(`TCP клиент|Ошибка сериализации объекта`, ToastAndroid.SHORT);
      reject(error);
      return;
    }

    // Устанавливаем одноразовый обработчик для получения ответа
    // @ts-ignore
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
        ToastAndroid.show(`TCP клиент|Ошибка парсинга ответа`, ToastAndroid.SHORT);
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
      ToastAndroid.show(`TCP клиент|Ошибка при отправке данных`, ToastAndroid.SHORT);
      reject(error);
    }
  });
};
