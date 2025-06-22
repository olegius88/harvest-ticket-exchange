// Файл: app/services/ConnectionManager.ts

import { setHotspotDisabled } from './MessageHandler';
import { stopTcpServer, stopTcpServerGracefully, isTcpServerRunning } from '../wifi/TcpServer';
import { disconnectTcpClient, disconnectTcpClientGracefully } from '../wifi/TcpClient';

/**
 * Интерфейс для опций закрытия соединений
 */
export interface CloseConnectionsOptions {
  /** Закрыть точку доступа Wi-Fi */
  closeHotspot?: boolean;
  /** Остановить TCP-сервер */
  closeTcpServer?: boolean;
  /** Отключить TCP-клиент */
  closeTcpClient?: boolean;
  /** Показывать логи в консоли */
  verbose?: boolean;
  /** Использовать согласованное отключение */
  graceful?: boolean;
  /** Причина отключения */
  reason?: string;
  /** Таймаут для согласованного отключения */
  timeout?: number;
}

/**
 * Тип компонента для логирования
 */
export type ComponentType = 'kombainer' | 'voditel' | 'general';

/**
 * Универсальная функция для закрытия всех типов соединений
 * @param options Опции для выбора типов соединений для закрытия
 * @param context Контекст вызова для логирования (название компонента/функции)
 */
export const closeAllConnections = async (
  options: CloseConnectionsOptions = {},
  context: string = 'Unknown'
): Promise<void> => {
  const {
    closeHotspot = true,
    closeTcpServer = true,
    closeTcpClient = true,
    verbose = true,
    graceful = false,
    reason,
    timeout = 5000,
  } = options;

  if (verbose) {
    console.log(
      `ConnectionManager[${context}]: Начинаем ${graceful ? 'согласованное ' : ''}закрытие соединений...`
    );
  }

  const errors: string[] = [];

  // Отключаем точку доступа Wi-Fi
  if (closeHotspot) {
    try {
      await setHotspotDisabled();
      if (verbose) {
        console.log(`ConnectionManager[${context}]: Точка доступа Wi-Fi отключена`);
      }
    } catch (error) {
      const errorMsg = `Ошибка при отключении точки доступа: ${error}`;
      errors.push(errorMsg);
      if (verbose) {
        console.error(`ConnectionManager[${context}]: ${errorMsg}`);
      }
    }
  }

  // Останавливаем TCP-сервер
  if (closeTcpServer) {
    try {
      if (isTcpServerRunning()) {
        const message = graceful
          ? await stopTcpServerGracefully(reason, timeout)
          : await stopTcpServer();
        if (verbose) {
          console.log(`ConnectionManager[${context}]: TCP-сервер остановлен:`, message);
        }
      } else if (verbose) {
        console.log(`ConnectionManager[${context}]: TCP-сервер не запущен, пропускаем остановку`);
      }
    } catch (error) {
      const errorMsg = `Ошибка при остановке TCP-сервера: ${error}`;
      errors.push(errorMsg);
      if (verbose) {
        console.error(`ConnectionManager[${context}]: ${errorMsg}`);
      }
    }
  }

  // Отключаем TCP-клиент
  if (closeTcpClient) {
    try {
      const message = graceful
        ? await disconnectTcpClientGracefully(reason, timeout)
        : await disconnectTcpClient();
      if (verbose) {
        console.log(`ConnectionManager[${context}]: TCP-клиент отключен:`, message);
      }
    } catch (error) {
      const errorMsg = `Ошибка при отключении TCP-клиента: ${error}`;
      errors.push(errorMsg);
      if (verbose) {
        console.error(`ConnectionManager[${context}]: ${errorMsg}`);
      }
    }
  }

  if (verbose) {
    if (errors.length > 0) {
      console.warn(
        `ConnectionManager[${context}]: Закрытие соединений завершено с ошибками:`,
        errors
      );
    } else {
      console.log(`ConnectionManager[${context}]: Все соединения успешно закрыты`);
    }
  }

  // Возвращаем ошибки, если они есть, для дальнейшей обработки
  if (errors.length > 0) {
    throw new Error(`Ошибки при закрытии соединений: ${errors.join(', ')}`);
  }
};

/**
 * Закрытие соединений для комбайнера (точка доступа + TCP-сервер)
 * @param context Контекст вызова для логирования
 * @param options Дополнительные опции (по умолчанию: отключить хотспот и TCP-сервер)
 */
export const closeKombainerConnections = async (
  context: string = 'Kombainer',
  options: Partial<CloseConnectionsOptions> = {}
): Promise<void> => {
  const defaultOptions: CloseConnectionsOptions = {
    closeHotspot: true,
    closeTcpServer: true,
    closeTcpClient: false,
    verbose: true,
  };

  return closeAllConnections({ ...defaultOptions, ...options }, context);
};

/**
 * Закрытие соединений для водителя (TCP-клиент)
 * @param context Контекст вызова для логирования
 * @param options Дополнительные опции (по умолчанию: отключить TCP-клиент)
 */
export const closeVoditelConnections = async (
  context: string = 'Voditel',
  options: Partial<CloseConnectionsOptions> = {}
): Promise<void> => {
  const defaultOptions: CloseConnectionsOptions = {
    closeHotspot: false,
    closeTcpServer: false,
    closeTcpClient: true,
    verbose: true,
  };

  return closeAllConnections({ ...defaultOptions, ...options }, context);
};

/**
 * Согласованное закрытие соединений для комбайнера (точка доступа + TCP-сервер)
 * @param context Контекст вызова для логирования
 * @param reason Причина отключения
 * @param timeout Таймаут ожидания подтверждения
 * @param options Дополнительные опции
 */
export const closeKombainerConnectionsGracefully = async (
  context: string = 'Kombainer',
  reason?: string,
  timeout: number = 5000,
  options: Partial<CloseConnectionsOptions> = {}
): Promise<void> => {
  const defaultOptions: CloseConnectionsOptions = {
    closeHotspot: true,
    closeTcpServer: true,
    closeTcpClient: false,
    verbose: true,
    graceful: true,
    reason,
    timeout,
  };

  return closeAllConnections({ ...defaultOptions, ...options }, context);
};

/**
 * Согласованное закрытие соединений для водителя (TCP-клиент)
 * @param context Контекст вызова для логирования
 * @param reason Причина отключения
 * @param timeout Таймаут ожидания подтверждения
 * @param options Дополнительные опции
 */
export const closeVoditelConnectionsGracefully = async (
  context: string = 'Voditel',
  reason?: string,
  timeout: number = 5000,
  options: Partial<CloseConnectionsOptions> = {}
): Promise<void> => {
  const defaultOptions: CloseConnectionsOptions = {
    closeHotspot: false,
    closeTcpServer: false,
    closeTcpClient: true,
    verbose: true,
    graceful: true,
    reason,
    timeout,
  };

  return closeAllConnections({ ...defaultOptions, ...options }, context);
};

/**
 * Принудительное закрытие всех соединений (используется в критических ситуациях)
 * @param context Контекст вызова для логирования
 */
export const forceCloseAllConnections = async (context: string = 'ForceClose'): Promise<void> => {
  try {
    return await closeAllConnections(
      {
        closeHotspot: true,
        closeTcpServer: true,
        closeTcpClient: true,
        verbose: true,
      },
      context
    );
  } catch (error) {
    // В случае принудительного закрытия, логируем ошибку, но не прерываем выполнение
    console.error(
      `ConnectionManager[${context}]: Принудительное закрытие завершено с ошибками:`,
      error
    );
  }
};

/**
 * Функция для безопасного закрытия соединений с повторными попытками
 * @param connectionType Тип соединения
 * @param context Контекст вызова
 * @param maxRetries Максимальное количество попыток
 */
export const safeCloseConnections = async (
  connectionType: ComponentType,
  context: string,
  maxRetries: number = 3
): Promise<void> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      switch (connectionType) {
        case 'kombainer':
          await closeKombainerConnections(context);
          break;
        case 'voditel':
          await closeVoditelConnections(context);
          break;
        case 'general':
          await forceCloseAllConnections(context);
          break;
        default:
          throw new Error(`Неизвестный тип соединения: ${connectionType}`);
      }

      // Если дошли до этой точки, то операция успешна
      if (attempt > 1) {
        console.log(`ConnectionManager[${context}]: Соединения закрыты с попытки ${attempt}`);
      }
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `ConnectionManager[${context}]: Попытка ${attempt}/${maxRetries} неудачна:`,
        lastError.message
      );

      if (attempt < maxRetries) {
        // Задержка перед повторной попыткой
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Если все попытки исчерпаны
  console.error(
    `ConnectionManager[${context}]: Не удалось закрыть соединения после ${maxRetries} попыток`
  );
  if (lastError) {
    throw lastError;
  }
};
