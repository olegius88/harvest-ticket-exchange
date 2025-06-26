import { Component } from 'react';
import { DeviceEventEmitter, BackHandler } from 'react-native';
import KeepAwake from 'react-native-keep-awake';

/**
 * Базовый класс для React компонентов с автоматической очисткой ресурсов
 * Расширяет стандартный Component и добавляет методы для безопасного управления ресурсами
 */
export class BaseComponent<P = {}, S = {}> extends Component<P, S> {
  protected _isUnmounted = false;
  protected _timeouts: Array<NodeJS.Timeout | number> = [];
  protected _intervals: Array<NodeJS.Timeout | number> = [];
  protected _listeners: Array<{ remove: () => void }> = [];
  protected _backHandlers: Array<{ remove: () => void }> = [];

  componentWillUnmount() {
    this._isUnmounted = true;
    this.cleanupAllResources();
  }

  /**
   * Безопасный setState - проверяет, не размонтирован ли компонент
   */
  protected safeSetState = (stateUpdate: Partial<S> | ((prevState: S, props: P) => Partial<S>)) => {
    if (!this._isUnmounted) {
      this.setState(stateUpdate as any);
    }
  };

  /**
   * Безопасный setTimeout
   */
  protected safeSetTimeout = (callback: () => void, delay: number): NodeJS.Timeout | number => {
    const timeoutId = setTimeout(() => {
      if (!this._isUnmounted) {
        callback();
      }
      // Удаляем из массива после выполнения
      this._timeouts = this._timeouts.filter((id) => id !== timeoutId);
    }, delay);

    this._timeouts.push(timeoutId);
    return timeoutId;
  };

  /**
   * Безопасный setInterval
   */
  protected safeSetInterval = (callback: () => void, delay: number): NodeJS.Timeout | number => {
    const intervalId = setInterval(() => {
      if (!this._isUnmounted) {
        callback();
      } else {
        clearInterval(intervalId);
        this._intervals = this._intervals.filter((id) => id !== intervalId);
      }
    }, delay);

    this._intervals.push(intervalId);
    return intervalId;
  };

  /**
   * Безопасный addEventListener для DeviceEventEmitter
   */
  protected safeAddListener = (eventName: string, listener: (...args: any[]) => void) => {
    const subscription = DeviceEventEmitter.addListener(eventName, (...args) => {
      if (!this._isUnmounted) {
        listener(...args);
      }
    });

    this._listeners.push(subscription);
    return subscription;
  };

  /**
   * Безопасный addEventListener для BackHandler
   */
  protected safeAddBackHandler = (listener: () => boolean) => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!this._isUnmounted) {
        return listener();
      }
      return false;
    });

    this._backHandlers.push(subscription);
    return subscription;
  };

  /**
   * Ручная очистка конкретного таймера
   */
  protected clearSafeTimeout = (timeoutId: NodeJS.Timeout | number) => {
    clearTimeout(timeoutId);
    this._timeouts = this._timeouts.filter((id) => id !== timeoutId);
  };

  /**
   * Ручная очистка конкретного интервала
   */
  protected clearSafeInterval = (intervalId: NodeJS.Timeout | number) => {
    clearInterval(intervalId);
    this._intervals = this._intervals.filter((id) => id !== intervalId);
  };

  /**
   * Ручная очистка конкретного слушателя
   */
  protected removeSafeListener = (subscription: { remove: () => void }) => {
    subscription.remove();
    this._listeners = this._listeners.filter((listener) => listener !== subscription);
  };

  /**
   * Ручная очистка конкретного BackHandler
   */
  protected removeSafeBackHandler = (subscription: { remove: () => void }) => {
    subscription.remove();
    this._backHandlers = this._backHandlers.filter((handler) => handler !== subscription);
  };

  /**
   * Проверка, что компонент все еще смонтирован
   */
  protected isMounted = (): boolean => !this._isUnmounted;

  /**
   * Безопасная активация KeepAwake
   */
  protected safeKeepAwakeActivate = () => {
    if (!this._isUnmounted) {
      KeepAwake.activate();
    }
  };

  /**
   * Безопасная деактивация KeepAwake
   */
  protected safeKeepAwakeDeactivate = () => {
    KeepAwake.deactivate();
  };

  /**
   * Очистка всех ресурсов
   */
  private cleanupAllResources = () => {
    // Очищаем все таймеры
    this._timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this._timeouts = [];

    // Очищаем все интервалы
    this._intervals.forEach((intervalId) => clearInterval(intervalId));
    this._intervals = [];

    // Удаляем все слушатели DeviceEventEmitter
    this._listeners.forEach((listener) => {
      try {
        listener.remove();
      } catch (error) {
        console.warn('BaseComponent: Ошибка при удалении слушателя DeviceEventEmitter:', error);
      }
    });
    this._listeners = [];

    // Удаляем все BackHandler слушатели
    this._backHandlers.forEach((handler) => {
      try {
        handler.remove();
      } catch (error) {
        console.warn('BaseComponent: Ошибка при удалении BackHandler:', error);
      }
    });
    this._backHandlers = [];

    // Отключаем KeepAwake
    try {
      KeepAwake.deactivate();
    } catch (error) {
      console.warn('BaseComponent: Ошибка при отключении KeepAwake:', error);
    }
  };
}
