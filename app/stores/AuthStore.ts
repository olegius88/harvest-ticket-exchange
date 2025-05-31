// app/stores/AuthStore.ts
/**
 * Простая реализация AuthStore для управления контекстом пользователя
 */

import { PositionOptionValue } from '../../global';

class AuthStore {
  private _context: PositionOptionValue | null = null;

  get context(): PositionOptionValue | null {
    return this._context;
  }

  set context(value: PositionOptionValue | null) {
    console.log('AuthStore: Setting context to:', value);
    this._context = value;
  }

  clear(): void {
    this._context = null;
  }
}

// Экспортируем экземпляр для использования в приложении
export const AuthStoreData = new AuthStore();
