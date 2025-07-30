import { connectToTcpServer, sendTcpRequest, disconnectTcpClient } from './TcpClient';
import { WeighingDataResponse, WeighingDataRequest } from '../types/weighing';

/**
 * Класс-обертка для работы с TCP клиентом Desktop приложения
 * Адаптирует Android TCP протокол для работы с Desktop сервером
 */
class TcpClientDesktopWrapper {
  private isConnected: boolean = false;
  private currentIp: string = '';
  private currentPort: number = 0;

  /**
   * Подключается к TCP серверу Desktop приложения
   * @param ip IP адрес сервера
   * @param port Порт сервера
   */
  async connect(ip: string, port: number): Promise<void> {
    try {
      console.log(`TcpClientWrapper: Подключение к Desktop TCP серверу ${ip}:${port}`);
      await connectToTcpServer({ ip, port });
      this.isConnected = true;
      this.currentIp = ip;
      this.currentPort = port;
      console.log('TcpClientWrapper: Успешно подключились к Desktop серверу');
    } catch (error) {
      this.isConnected = false;
      console.error('TcpClientWrapper: Ошибка подключения к Desktop серверу:', error);
      throw error;
    }
  }

  /**
   * Отправляет данные талона для взвешивания на Desktop приложение
   * @param request Запрос с данными взвешивания
   */
  async sendWeighingData(request: WeighingDataRequest): Promise<WeighingDataResponse> {
    console.log('TcpClientWrapper: sendWeighingData начал выполнение');

    if (!this.isConnected) {
      console.log('TcpClientWrapper: Клиент не подключен');
      throw new Error('TCP клиент не подключен');
    }

    try {
      console.log('TcpClientWrapper: Отправляем данные талона на Desktop:', request);

      // Desktop ожидает простой JSON без дополнительных символов
      console.log('TcpClientWrapper: Вызываем sendTcpRequest...');
      const response = await sendTcpRequest(request, 10000); // 10 секунд таймаут
      console.log('TcpClientWrapper: sendTcpRequest завершился');

      console.log('TcpClientWrapper: Получен ответ от Desktop:', response);

      // Преобразуем ответ в нужный формат
      if (response && typeof response === 'object') {
        const desktopResponse = response as any;

        if (desktopResponse.status === 'success') {
          return {
            type: 'weighingDataResponse',
            status: 'ok',
            message: desktopResponse.message || 'Данные талона успешно переданы на весовую',
            received_data: {
              talon_id: request.talon_data.id,
              auth_verified: true,
            },
          };
        } else {
          return {
            type: 'weighingDataResponse',
            status: 'error',
            message: desktopResponse.message || 'Ошибка обработки данных на Desktop',
          };
        }
      }

      // Если ответ не соответствует ожидаемому формату
      throw new Error('Неожиданный формат ответа от Desktop сервера');
    } catch (error) {
      console.error('TcpClientWrapper: Ошибка отправки данных:', error);
      throw new Error(`Ошибка отправки данных на Desktop: ${error}`);
    }
  }

  /**
   * Отправляет сообщение на сервер (универсальный метод)
   * @param message Сообщение для отправки (JSON строка или объект)
   */
  async send(message: string | object): Promise<void> {
    if (!this.isConnected) {
      throw new Error('TCP клиент не подключен');
    }

    try {
      let messageObj: object;

      if (typeof message === 'string') {
        messageObj = JSON.parse(message);
      } else {
        messageObj = message;
      }

      console.log('TcpClientWrapper: Отправляем сообщение:', messageObj);
      await sendTcpRequest(messageObj);
    } catch (error) {
      console.error('TcpClientWrapper: Ошибка отправки сообщения:', error);
      throw new Error(`Ошибка отправки сообщения: ${error}`);
    }
  }

  /**
   * Ожидает ответ от сервера с таймаутом
   * @param timeout Таймаут в миллисекундах
   */
  async waitForResponse(timeout: number): Promise<WeighingDataResponse> {
    // В текущей реализации TCP клиента ответ приходит сразу в sendTcpRequest
    // Этот метод оставлен для совместимости с интерфейсом
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          type: 'weighingDataResponse',
          status: 'ok',
          message: 'Данные обработаны',
        });
      }, 100);
    });
  }

  /**
   * Отключается от сервера
   */
  async disconnect(): Promise<void> {
    try {
      console.log('TcpClientWrapper: Отключение от Desktop сервера');
      await disconnectTcpClient();
      this.isConnected = false;
      this.currentIp = '';
      this.currentPort = 0;
      console.log('TcpClientWrapper: Успешно отключились от Desktop сервера');
    } catch (error) {
      this.isConnected = false;
      this.currentIp = '';
      this.currentPort = 0;
      console.error('TcpClientWrapper: Ошибка отключения:', error);
      throw error;
    }
  }

  /**
   * Проверяет, подключен ли клиент
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Получает информацию о текущем подключении
   */
  getConnectionInfo(): { ip: string; port: number; connected: boolean } {
    return {
      ip: this.currentIp,
      port: this.currentPort,
      connected: this.isConnected,
    };
  }
}

// Экспортируем класс по умолчанию и именованный экспорт для гибкости
export default TcpClientDesktopWrapper;
export { TcpClientDesktopWrapper as TcpClient };
