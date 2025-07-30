/**
 * Данные подключения к TCP серверу desktop приложения
 */
export interface TcpDesktopConnectionData {
  ip: string;
  port: number;
  auth_code: string;
}

/**
 * Запрос на взвешивание с данными талона
 */
export interface WeighingDataRequest {
  type: 'weighingData';
  auth_code: string;
  talon_data: {
    id: string;
    talonNumber?: string;
    kombainerData?: any | null;
    kombainerUserData?: any | null;
    voditelData?: any | null;
    voditelUserData?: any | null;
    status: string;
    weight?: number;
    moisture?: number;
    impurity?: number;
    created_at: number;
    notes?: string;
  };
}

/**
 * Ответ на запрос взвешивания
 */
export interface WeighingDataResponse {
  type: 'weighingDataResponse';
  status: 'ok' | 'error';
  message?: string;
  received_data?: {
    talon_id: string;
    auth_verified: boolean;
  };
}
