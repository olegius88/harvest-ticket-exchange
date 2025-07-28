// Клиентские хуки для SPA режима
import { dev } from '$app/environment';

// Отключаем SSR для всего приложения в dev режиме
if (dev) {
  console.log('SPA режим активирован');
}
