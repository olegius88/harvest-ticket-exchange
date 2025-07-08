/**
 * Утилиты для работы со статусами талонов
 */

/**
 * Функция для преобразования статуса в читаемый вид
 */
export const getReadableStatus = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    created: 'Создан',
    assigned: 'Назначен',
    in_progress: 'В процессе',
    voditel_signed: 'Подписан водителем',
    completed: 'Завершен',
    cancelled: 'Отменен',
    cancelled_by_kombainer: 'Отменен комбайнером',
    cancelled_by_voditel: 'Отменен водителем',
  };

  return statusMap[status] || status;
};

/**
 * Функция для получения цвета статуса
 */
export const getStatusColor = (status: string): string => {
  const colorMap: { [key: string]: string } = {
    created: '#2196F3', // синий
    assigned: '#FF9800', // оранжевый
    in_progress: '#9C27B0', // фиолетовый
    voditel_signed: '#4CAF50', // зеленый
    completed: '#4CAF50', // зеленый
    cancelled: '#F44336', // красный
    cancelled_by_kombainer: '#F44336', // красный
    cancelled_by_voditel: '#F44336', // красный
  };

  return colorMap[status] || '#5a7d2b'; // по умолчанию
};

/**
 * Функция для проверки является ли статус отменой
 */
export const isCancelledStatus = (status: string): boolean => {
  return ['cancelled', 'cancelled_by_kombainer', 'cancelled_by_voditel'].includes(status);
};

/**
 * Функция для проверки является ли статус завершенным
 */
export const isCompletedStatus = (status: string): boolean => {
  return ['completed', 'voditel_signed'].includes(status);
};

/**
 * Функция для проверки является ли статус активным (в работе)
 */
export const isActiveStatus = (status: string): boolean => {
  return ['created', 'assigned', 'in_progress'].includes(status);
};
