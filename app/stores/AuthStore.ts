// app/stores/AuthStore.ts
/**
 * Простая реализация AuthStore для управления контекстом пользователя
 */

import {
  PositionOptionValue,
  IPayloadVoditelConnectSuccess,
  IPayloadConfirmKombainerTicket,
} from '../../global';

class AuthStore {
  private _context: PositionOptionValue | null = null;
  private _payloadVoditelConnectSuccess: IPayloadVoditelConnectSuccess | null = null;
  private _payloadConfirmKombainerTicket: IPayloadConfirmKombainerTicket | null = null;

  get context(): PositionOptionValue | null {
    return this._context;
  }

  set context(value: PositionOptionValue | null) {
    console.log('AuthStore: Setting context to:', value);
    this._context = value;
  }

  get payloadVoditelConnectSuccess(): IPayloadVoditelConnectSuccess | null {
    return this._payloadVoditelConnectSuccess;
  }

  set payloadVoditelConnectSuccess(value: IPayloadVoditelConnectSuccess | null) {
    console.log('AuthStore: Setting payloadVoditelConnectSuccess to:', value);
    this._payloadVoditelConnectSuccess = value;
  }

  get payloadConfirmKombainerTicket(): IPayloadConfirmKombainerTicket | null {
    return this._payloadConfirmKombainerTicket;
  }

  set payloadConfirmKombainerTicket(value: IPayloadConfirmKombainerTicket | null) {
    console.log('AuthStore: Setting payloadConfirmKombainerTicket to:', value);
    this._payloadConfirmKombainerTicket = value;
  }

  clear(): void {
    this._context = null;
    this._payloadVoditelConnectSuccess = null;
    this._payloadConfirmKombainerTicket = null;
  }
}

// Экспортируем экземпляр для использования в приложении
export const AuthStoreData = new AuthStore();
