<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  interface Props {
    currentUser: string;
    onAcceptTalon?: () => void;
    onLogout?: () => void;
    onToggleLogs?: () => void;
  }

  let { currentUser, onAcceptTalon, onLogout, onToggleLogs }: Props = $props();

  interface Talon {
    id: string;
    talon_number: string;
    kombainer_id: string;
    kombainer_data?: string;
    kombainer_user_data?: string;
    voditel_id?: string;
    voditel_user_id?: string;
    voditel_data?: string;
    voditel_user_data?: string;
    status: string;
    start_time: number;
    end_time?: number;
    weight?: number;
    comment?: string;
    cancellation_reason?: string;
    created_at: string;
    updated_at: string;
  }

  let talons: Talon[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Загрузка талонов при монтировании компонента
  onMount(async () => {
    await loadTalons();
    await checkUsers(); // Добавлено для отладки
  });

  async function checkUsers() {
    try {
      const users = await invoke<any[]>('debug_get_all_users');
      console.log('Available vesovschik users:', users);
    } catch (error) {
      console.error('Error checking users:', error);
    }
  }

  async function checkAllUsers() {
    try {
      const result = await invoke<string>('debug_get_all_users_any_position');
      console.log('All users in database:');
      console.log(result);
      alert('Проверьте консоль браузера для списка всех пользователей');
    } catch (error) {
      console.error('Error checking all users:', error);
    }
  }

  async function loadTalons() {
    try {
      loading = true;
      error = '';
      const result = await invoke<Talon[]>('get_all_talons');
      talons = result;
    } catch (err) {
      console.error('Error loading talons:', err);
      error = err instanceof Error ? err.message : 'Ошибка загрузки талонов';
    } finally {
      loading = false;
    }
  }

  function handleAcceptTalon() {
    onAcceptTalon?.();
  }

  function handleLogout() {
    onLogout?.();
  }

  function toggleLogs() {
    onToggleLogs?.();
  }

  function getDisplayNumber(talon: Talon) {
    return talon.talon_number || `T-${talon.id.slice(-6)}`;
  }

  function getDisplayTime(talon: Talon) {
    const date = new Date(talon.created_at);
    return date.toLocaleTimeString('ru-RU');
  }

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case 'created':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusText(status: string) {
    switch (status.toLowerCase()) {
      case 'created':
        return 'Создан';
      case 'assigned':
        return 'Назначен';
      case 'in_progress':
        return 'В работе';
      case 'completed':
        return 'Завершен';
      case 'cancelled':
        return 'Отменен';
      case 'pending':
        return 'Ожидание';
      default:
        return 'Неизвестно';
    }
  }

  function canAcceptTalon(status: string) {
    return ['created', 'assigned'].includes(status.toLowerCase());
  }

  function getKombainerName(talon: Talon) {
    if (talon.kombainer_user_data) {
      try {
        const userData = JSON.parse(talon.kombainer_user_data);
        return userData.fio || 'Не указано';
      } catch {
        return 'Не указано';
      }
    }
    return 'Не указано';
  }
</script>

<div class="h-full flex flex-col">
  <!-- Заголовок -->
  <div class="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Весовщик</h1>
      <p class="text-sm text-gray-600">Пользователь: {currentUser}</p>
    </div>
    <button
      onclick={toggleLogs}
      class="btn btn-outline text-sm"
      title="Открыть/закрыть журнал событий"
    >
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Журнал
    </button>

    <!-- Временная кнопка для отладки -->
    <button
      onclick={checkAllUsers}
      class="btn btn-secondary text-sm ml-2"
      title="Показать всех пользователей в базе данных"
    >
      Проверить БД
    </button>
  </div>

  <!-- Основная область - список талонов -->
  <div class="flex-1 overflow-hidden">
    <div class="h-full p-4">
      <div class="card h-full">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-lg font-medium text-gray-900">Список талонов</h2>
          <p class="text-sm text-gray-600">Всего талонов: {talons.length}</p>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          {#if loading}
            <div class="text-center py-8">
              <svg
                class="animate-spin mx-auto h-8 w-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p class="mt-2 text-gray-500">Загрузка талонов...</p>
            </div>
          {:else if error}
            <div class="text-center py-8">
              <svg
                class="mx-auto h-12 w-12 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p class="mt-2 text-red-500">Ошибка: {error}</p>
              <button onclick={loadTalons} class="mt-3 btn btn-outline text-sm"> Повторить </button>
            </div>
          {:else if talons.length === 0}
            <div class="text-center py-8">
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p class="mt-2 text-gray-500">Нет талонов для обработки</p>
              <p class="mt-1 text-sm text-gray-400">
                Талоны появятся при подключении Android устройств
              </p>
            </div>
          {:else}
            <div class="space-y-3">
              {#each talons as talon (talon.id)}
                <div
                  class="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div class="flex justify-between items-start">
                    <div class="flex-1">
                      <div class="flex items-center space-x-3">
                        <h3 class="text-lg font-medium text-gray-900">{getDisplayNumber(talon)}</h3>
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(
                            talon.status
                          )}"
                        >
                          {getStatusText(talon.status)}
                        </span>
                      </div>
                      <p class="text-sm text-gray-600 mt-1">Время: {getDisplayTime(talon)}</p>
                      <p class="text-sm text-gray-600">Комбайнер: {getKombainerName(talon)}</p>
                      {#if talon.weight}
                        <p class="text-sm text-gray-600">Вес: {talon.weight} кг</p>
                      {/if}
                      {#if talon.comment}
                        <p class="text-sm text-gray-500 mt-1">{talon.comment}</p>
                      {/if}
                    </div>

                    {#if canAcceptTalon(talon.status)}
                      <button onclick={handleAcceptTalon} class="btn btn-success text-sm">
                        Принять
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Нижние кнопки -->
  <div class="bg-white border-t border-gray-200 p-4">
    <div class="flex space-x-4">
      <button onclick={handleAcceptTalon} class="btn btn-success flex-1">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        Принять талон
      </button>

      <button onclick={handleLogout} class="btn btn-outline-danger">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        Выход
      </button>
    </div>
  </div>
</div>
