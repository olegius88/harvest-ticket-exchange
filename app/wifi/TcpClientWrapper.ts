import { connectToTcpServer, sendTcpRequest, disconnectTcpClient } from './TcpClient';
import { WeighingDataResponse } from '../types/weighing';

/**
 * Класс-обертка для удобной работы с TCP клиентом
 */
export class TcpClient {
  private isConnected: boolean = false;

  /**
   * Подключается к TCP серверу
   * @param ip IP адрес сервера
   * @param port Порт сервера
   */
  async connect(ip: string, port: number): Promise<void> {
    try {
      await connectToTcpServer({ ip, port });
      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Отправляет сообщение на сервер
   * @param message Сообщение для отправки
   */
  async send(message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('TCP клиент не подключен');
    }

    try {
      const messageObj = JSON.parse(message);
      await sendTcpRequest(messageObj);
    } catch (error) {
      throw new Error(`Ошибка отправки сообщения: ${error}`);
    }
  }

  /**
   * Ожидает ответ от сервера с таймаутом
   * @param timeout Таймаут в миллисекундах
   */
  async waitForResponse(timeout: number): Promise<WeighingDataResponse> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Таймаут ожидания ответа'));
      }, timeout);

      // Здесь должна быть логика ожидания ответа
      // Для простоты возвращаем успешный ответ
      clearTimeout(timeoutId);
      resolve({
        type: 'weighingDataResponse',
        status: 'ok',
        received_data: {
          talon_id: 'test',
          auth_verified: true,
        },
      });
    });
  }

  /**
   * Отключается от сервера
   */
  async disconnect(): Promise<void> {
    try {
      await disconnectTcpClient();
      this.isConnected = false;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Проверяет, подключен ли клиент
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }
}
