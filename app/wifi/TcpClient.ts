// Файл: app/wifi/TcpClient.ts
//
// ПРОТОКОЛ СООБЩЕНИЙ:
// Все JSON сообщения должны заканчиваться символом новой строки '\n'
// Это позволяет корректно обрабатывать большие сообщения, которые могут
// приходить по частям через несколько вызовов события 'data'
//
import TcpSocket from 'react-native-tcp-socket';
import { ToastAndroid } from 'react-native';
import { ISendTcpResponseData, ISendTcpRequestData } from '../../global';
import { onTcpMessage } from './onTcpMessage';

let client: TcpSocket.Socket | null = null;

/**
 * Функция для подключения к TCP-серверу.
 * Возвращает Promise, который резолвится сообщением об успешном подключении
 * или отклоняется при возникновении ошибки.
 */
export const connectToTcpServer = ({
  ip: host,
  port = 3290,
}: {
  ip: string;
  port?: number;
}): Promise<string> => {
  console.log('connectToTcpServer|host=', host, 'port=', port);
  return new Promise((resolve, reject) => {
    if (client) {
      ToastAndroid.show(`TCP клиент уже подключен`, ToastAndroid.SHORT);
      resolve('TCP клиент уже подключен');
      return;
    }
    client = TcpSocket.createConnection({ port, host }, () => {
      console.log(`TCP клиент подключился к серверу ${host}:${port}`);
      ToastAndroid.show(`TCP клиент успешно подключился к ${host}:${port}`, ToastAndroid.SHORT);
      resolve(`TCP клиент успешно подключился к ${host}:${port}`);
    });

    // Буфер для накопления неполных сообщений
    let messageBuffer = '';

    // Глобальный обработчик входящих сообщений от сервера,
    // если сообщение не получено как ответ на sendTcpRequest.
    client.on('data', async (data: Buffer) => {
      const dataString = data.toString();
      console.log('TCP клиент|Получен chunk данных:', dataString);

      // Добавляем новые данные к буферу
      messageBuffer += dataString;

      // Обрабатываем все полные сообщения в буфере
      let newlineIndex;
      while ((newlineIndex = messageBuffer.indexOf('\n')) !== -1) {
        // Извлекаем полное сообщение (без символа новой строки)
        const completeMessage = messageBuffer.substring(0, newlineIndex);
        // Удаляем обработанное сообщение из буфера
        messageBuffer = messageBuffer.substring(newlineIndex + 1);

        if (!completeMessage.trim()) {
          continue; // Пропускаем пустые сообщения
        }

        console.log('TCP клиент|Обрабатываем полное сообщение:', completeMessage);

        let message: any;
        try {
          message = JSON.parse(completeMessage);
        } catch (error) {
          console.error('TCP клиент|Ошибка парсинга JSON:', error);
          continue;
        }

        // Если данные получили как результат одноразового обработчика (sendTcpRequest),
        // то данный глобальный обработчик может быть не вызван.
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
            const responseMessage = JSON.stringify(responseWithId) + '\n';
            client.write(responseMessage);
            console.log('TCP клиент|Ответ отправлен на сервер:', responseMessage);
          }
        } catch (error) {
          console.error('TCP клиент|Ошибка в onTcpMessage:', error);
          // DEV LOGS
          // ToastAndroid.show(`TCP клиент|Ошибка в onTcpMessage`, ToastAndroid.SHORT);
        }
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
      // Устанавливаем одноразовый обработчик для события close
      client.once('close', () => {
        console.log('TCP клиент отключился');
        client = null;
        resolve('TCP клиент отключен');
      });

      // Закрываем соединение
      client.end();
    } else {
      resolve('TCP клиент не был подключен');
    }
  });
};

/**
 * Функция для согласованного отключения от TCP-сервера.
 * Сначала отправляет запрос на отключение и ждет подтверждения от сервера.
 * Возвращает Promise, который резолвится сообщением об успешном отключении.
 * @param reason - причина отключения (опционально)
 * @param timeout - таймаут ожидания ответа в миллисекундах (по умолчанию 5000)
 */
export const disconnectTcpClientGracefully = async (
  reason?: string,
  timeout: number = 5000
): Promise<string> => {
  console.log('disconnectTcpClientGracefully|init|reason=', reason);

  if (!client) {
    return 'TCP клиент не был подключен';
  }

  try {
    // Отправляем запрос на согласованное отключение
    const disconnectRequest = {
      type: 'tcp_disconnect_request',
      reason: reason || 'Плановое отключение клиента',
      timestamp: Date.now(),
    };

    console.log('disconnectTcpClientGracefully|Отправляем запрос на отключение');

    // Отправляем запрос и ждем подтверждения
    const response = await Promise.race([
      sendTcpRequest(disconnectRequest),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Таймаут ожидания подтверждения отключения')), timeout)
      ),
    ]);

    console.log('disconnectTcpClientGracefully|Получено подтверждение:', response);

    // Отправляем финальное уведомление об отключении
    const finalMessage = {
      type: 'tcp_disconnect_final',
      timestamp: Date.now(),
    };

    try {
      // Пытаемся отправить финальное сообщение, но не ждем ответа
      const finalMessageString = JSON.stringify(finalMessage) + '\n';
      client.write(finalMessageString);
      // Даем время на отправку сообщения
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.warn(
        'disconnectTcpClientGracefully|Не удалось отправить финальное сообщение:',
        error
      );
    }

    // Теперь отключаемся
    return await disconnectTcpClient();
  } catch (error) {
    console.error('disconnectTcpClientGracefully|Ошибка при согласованном отключении:', error);
    console.log('disconnectTcpClientGracefully|Выполняем принудительное отключение');

    // Если согласованное отключение не удалось, выполняем обычное отключение
    return await disconnectTcpClient();
  }
};

/**
 * Функция для отправки запроса на TCP-сервер и получения ответа.
 * Принимает объект message, который необходимо отправить.
 * Объект преобразуется в JSON-строку и отправляется.
 * Функция ожидает ответа от сервера и возвращает его.
 */
export const sendTcpRequest = (
  message: object,
  timeoutMs: number = 30000
): Promise<ISendTcpResponseData> => {
  return new Promise((resolve, reject) => {
    if (!client) {
      ToastAndroid.show(
        `TCP клиент не подключен ${client === undefined ? 'undefined' : 'null'}`,
        ToastAndroid.SHORT
      );
      reject('TCP клиент не подключен');
      return;
    }

    const messageWithId = {
      ...message,
      from: 'TcpClient.ts-sendTcpRequest',
    };

    let jsonMessage: string;
    try {
      jsonMessage = JSON.stringify(messageWithId) + '\n'; // Добавляем разделитель
    } catch (error) {
      console.error('TCP клиент|Ошибка при сериализации объекта:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка сериализации объекта`, ToastAndroid.SHORT);
      reject(error);
      return;
    }

    // Флаг для отслеживания завершения запроса
    let isRequestCompleted = false;
    // Буфер для накопления ответа
    let responseBuffer = '';

    // Таймер для ограничения времени ожидания ответа
    const timeoutId = setTimeout(() => {
      if (!isRequestCompleted) {
        isRequestCompleted = true;
        cleanupHandlers();
        reject(new Error(`Таймаут ожидания ответа (${timeoutMs}мс)`));
      }
    }, timeoutMs);

    // Функция для очистки всех обработчиков
    const cleanupHandlers = () => {
      if (client) {
        client.removeListener('data', onData);
        client.removeListener('error', onError);
        client.removeListener('close', onClose);
      }
      clearTimeout(timeoutId);
    };

    // Обработчик получения данных
    const onData = (data: Buffer) => {
      if (isRequestCompleted) return;

      const dataString = data.toString();
      console.log('TCP клиент|Получен chunk ответа:', dataString);

      // Добавляем новые данные к буферу
      responseBuffer += dataString;

      // Проверяем, есть ли полное сообщение (с символом новой строки или без)
      let completeResponse = '';
      const newlineIndex = responseBuffer.indexOf('\n');
      
      if (newlineIndex !== -1) {
        // Есть символ новой строки - извлекаем сообщение до него
        completeResponse = responseBuffer.substring(0, newlineIndex);
      } else {
        // Нет символа новой строки - проверяем, является ли буфер валидным JSON
        try {
          JSON.parse(responseBuffer.trim());
          completeResponse = responseBuffer.trim();
        } catch {
          // JSON пока неполный, ждем еще данных
          return;
        }
      }

      console.log('TCP клиент|Получен полный ответ:', completeResponse);

      try {
        const response = JSON.parse(completeResponse);
        isRequestCompleted = true;
        cleanupHandlers();
        resolve(response);
      } catch (error) {
        console.error('TCP клиент|Ошибка при парсинге ответа:', error);
        // DEV LOGS
        // ToastAndroid.show(`TCP клиент|Ошибка парсинга ответа`, ToastAndroid.SHORT);
        isRequestCompleted = true;
        cleanupHandlers();
        reject(error);
      }
    };

    // Обработчик ошибок соединения
    const onError = (error: any) => {
      if (isRequestCompleted) return;

      console.error('TCP клиент|Ошибка во время ожидания ответа:', error);
      isRequestCompleted = true;
      cleanupHandlers();
      reject(error);
    };

    // Обработчик закрытия соединения
    const onClose = () => {
      if (isRequestCompleted) return;

      console.log('TCP клиент|Соединение закрыто во время ожидания ответа');
      
      // Проверяем, есть ли полные данные в буфере перед закрытием
      if (responseBuffer.trim().length > 0) {
        console.log('TCP клиент|Пытаемся обработать данные из буфера перед закрытием:', responseBuffer.trim());
        try {
          const response = JSON.parse(responseBuffer.trim());
          console.log('TCP клиент|Успешно обработали данные из буфера:', response);
          isRequestCompleted = true;
          cleanupHandlers();
          resolve(response);
          return;
        } catch (error) {
          console.error('TCP клиент|Ошибка парсинга данных из буфера:', error);
        }
      }
      
      isRequestCompleted = true;
      cleanupHandlers();
      reject(new Error('Соединение закрыто до получения ответа'));
    };

    // Устанавливаем обработчики событий
    client.on('data', onData);
    client.on('error', onError);
    client.on('close', onClose);

    try {
      client.write(jsonMessage, 'utf8', () => {
        console.log('TCP клиент|Запрос отправлен:', JSON.parse(jsonMessage.slice(0, -1))); // Убираем \n для логирования
        // ToastAndroid.show(`TCP клиент|Запрос отправлен`, ToastAndroid.SHORT);
      });
    } catch (error) {
      console.error('TCP клиент|Ошибка при отправке данных:', error);
      // DEV LOGS
      // ToastAndroid.show(`TCP клиент|Ошибка при отправке данных`, ToastAndroid.SHORT);
      isRequestCompleted = true;
      cleanupHandlers();
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
