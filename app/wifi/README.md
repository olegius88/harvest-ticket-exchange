# TCP Communication Module

Модуль для TCP-соединения между двумя смартфонами в режиме hotspot/клиент.

## Обзор архитектуры

Система состоит из трех основных компонентов:

1. **TcpServer.ts** - TCP-сервер для устройства, которое создает hotspot
2. **TcpClient.ts** - TCP-клиент для устройства, которое подключается к hotspot
3. **onTcpMessage.ts** - Обработчик сообщений для обеих сторон

## Основные улучшения

### 1. Уникальные ID сообщений
- Каждое сообщение теперь имеет уникальный `messageId`
- Исключены конфликты между одноразовыми и постоянными обработчиками
- Поддержка множественных одновременных запросов

### 2. Таймауты запросов
- Автоматическое отклонение запросов через 30 секунд
- Предотвращение зависших промисов
- Очистка ресурсов при таймауте

### 3. Правильная обработка типов
- Исправлена типизация для `string | Buffer`
- Добавлены интерфейсы для heartbeat сообщений
- Улучшена type safety

### 4. Управление pending запросами
- Map для хранения активных запросов
- Автоматическая очистка при отключении
- Предотвращение утечек памяти

### 5. Heartbeat механизм
- Проверка живости соединения
- Вспомогательные функции для мониторинга состояния

### 6. Переподключение клиента
- Автоматические повторные попытки подключения
- Настраиваемое количество попыток и задержка

## Использование

### Сервер (устройство с hotspot)

```typescript
import {
  startTcpServer,
  stopTcpServer,
  tcpServerSendRequest,
  isTcpServerRunning,
  getConnectedClientsCount,
  sendHeartbeat
} from './wifi/TcpServer';

// Запуск сервера
try {
  await startTcpServer();
  console.log('Сервер запущен');
} catch (error) {
  console.error('Ошибка запуска сервера:', error);
}

// Отправка сообщения клиенту
try {
  const response = await tcpServerSendRequest({
    type: 'get_kombainer_data'
  });
  console.log('Ответ от клиента:', response);
} catch (error) {
  console.error('Ошибка отправки:', error);
}

// Проверка состояния
const isRunning = isTcpServerRunning();
const clientsCount = getConnectedClientsCount();
console.log(`Сервер работает: ${isRunning}, клиентов: ${clientsCount}`);

// Heartbeat
const isAlive = await sendHeartbeat();
console.log(`Соединение активно: ${isAlive}`);

// Остановка сервера
await stopTcpServer();
```

### Клиент (устройство, подключенное к hotspot)

```typescript
import {
  connectToTcpServer,
  disconnectTcpClient,
  sendTcpRequest,
  reconnectToTcpServer,
  isTcpClientConnected,
  sendHeartbeat
} from './wifi/TcpClient';

// Подключение к серверу
try {
  await connectToTcpServer({ ip: '192.168.1.100' });
  console.log('Подключено к серверу');
} catch (error) {
  console.error('Ошибка подключения:', error);
}

// Переподключение с повторными попытками
try {
  await reconnectToTcpServer(
    { ip: '192.168.1.100' },
    5, // максимум попыток
    2000 // задержка между попытками (мс)
  );
} catch (error) {
  console.error('Не удалось переподключиться:', error);
}

// Отправка сообщения серверу
try {
  const response = await sendTcpRequest({
    type: 'set_voditel_data',
    voditelData: { /* данные водителя */ },
    voditelUserData: { /* данные пользователя */ }
  });
  console.log('Ответ от сервера:', response);
} catch (error) {
  console.error('Ошибка отправки:', error);
}

// Проверка состояния
const isConnected = isTcpClientConnected();
console.log(`Клиент подключен: ${isConnected}`);

// Heartbeat
const isAlive = await sendHeartbeat();
console.log(`Соединение активно: ${isAlive}`);

// Отключение
await disconnectTcpClient();
```

## Обработка сообщений

Файл `onTcpMessage.ts` обрабатывает входящие сообщения для обеих сторон:

```typescript
// Поддерживаемые типы сообщений:
// - 'test' - тестовое сообщение
// - 'heartbeat' - проверка соединения
// - 'set_voditel_data' - данные водителя
// - 'set_kombainer_data' - данные комбайнера
// - 'get_kombainer_data' - запрос данных комбайнера
// - 'confirm_kombainer_ticket' - подтверждение талона
// - 'confirm_kombainer_ticket_with_weight' - подтверждение с весом
// - 'set_talon_of_kombainer' - установка талона комбайнера
```

## Типы сообщений

Все типы сообщений определены в `global.d.ts`:

- `ISendTcpRequestData` - union type всех входящих сообщений
- `ISendTcpResponseData` - union type всех ответов
- `IHeartbeatTcp` - интерфейс для heartbeat сообщений

## Обработка ошибок

### Сервер
- Проверка количества подключенных клиентов (должен быть ровно 1)
- Таймауты для pending запросов
- Автоматическая очистка ресурсов при остановке

### Клиент
- Проверка состояния подключения
- Автоматическое переподключение
- Обработка разрыва соединения

## Логирование

Все операции логируются в консоль с префиксами:
- `startTcpServer|` - события сервера
- `TCP клиент|` - события клиента
- `onTcpMessage|` - обработка сообщений

Toast-уведомления показываются для критических событий.

## Совместимость

Код сохраняет обратную совместимость со старой системой благодаря:
- Проверке `isTcpServerSendResponse` флага
- Поддержке сообщений без `messageId`
- Сохранению существующих интерфейсов
