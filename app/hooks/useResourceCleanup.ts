import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';

/**
 * Хук для безопасного управления ресурсами и их очистки при размонтировании компонента
 */
export const useResourceCleanup = () => {
  const timeoutsRef = useRef<Array<NodeJS.Timeout | number>>([]);
  const intervalsRef = useRef<Array<NodeJS.Timeout | number>>([]);
  const listenersRef = useRef<Array<{ remove: () => void }>>([]);
  const isMountedRef = useRef(true);

  // Безопасный setTimeout
  const safeSetTimeout = (callback: () => void, delay: number): NodeJS.Timeout | number => {
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      // Удаляем из массива после выполнения
      timeoutsRef.current = timeoutsRef.current.filter((id) => id !== timeoutId);
    }, delay);

    timeoutsRef.current.push(timeoutId);
    return timeoutId;
  };

  // Безопасный setInterval
  const safeSetInterval = (callback: () => void, delay: number): NodeJS.Timeout | number => {
    const intervalId = setInterval(() => {
      if (isMountedRef.current) {
        callback();
      } else {
        clearInterval(intervalId);
        intervalsRef.current = intervalsRef.current.filter((id) => id !== intervalId);
      }
    }, delay);

    intervalsRef.current.push(intervalId);
    return intervalId;
  };

  // Безопасный addEventListener для DeviceEventEmitter
  const safeAddListener = (eventName: string, listener: (...args: any[]) => void) => {
    const subscription = DeviceEventEmitter.addListener(eventName, (...args) => {
      if (isMountedRef.current) {
        listener(...args);
      }
    });

    listenersRef.current.push(subscription);
    return subscription;
  };

  // Ручная очистка конкретного таймера
  const clearSafeTimeout = (timeoutId: NodeJS.Timeout | number) => {
    clearTimeout(timeoutId);
    timeoutsRef.current = timeoutsRef.current.filter((id) => id !== timeoutId);
  };

  // Ручная очистка конкретного интервала
  const clearSafeInterval = (intervalId: NodeJS.Timeout | number) => {
    clearInterval(intervalId);
    intervalsRef.current = intervalsRef.current.filter((id) => id !== intervalId);
  };

  // Ручная очистка конкретного слушателя
  const removeSafeListener = (subscription: { remove: () => void }) => {
    subscription.remove();
    listenersRef.current = listenersRef.current.filter((listener) => listener !== subscription);
  };

  // Проверка, что компонент все еще смонтирован
  const isMounted = () => isMountedRef.current;

  // Очистка всех ресурсов
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Очищаем все таймеры
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsRef.current = [];

      // Очищаем все интервалы
      intervalsRef.current.forEach((intervalId) => clearInterval(intervalId));
      intervalsRef.current = [];

      // Удаляем все слушатели
      listenersRef.current.forEach((listener) => {
        try {
          listener.remove();
        } catch (error) {
          console.warn('useResourceCleanup: Ошибка при удалении слушателя:', error);
        }
      });
      listenersRef.current = [];
    };
  }, []);

  return {
    safeSetTimeout,
    safeSetInterval,
    safeAddListener,
    clearSafeTimeout,
    clearSafeInterval,
    removeSafeListener,
    isMounted,
  };
};
