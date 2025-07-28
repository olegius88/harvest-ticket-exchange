<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let currentUser: string;

  const dispatch = createEventDispatcher();

  let talons = [
    { id: '001', number: 'T-12345', status: 'pending', timestamp: '14:30:15' },
    { id: '002', number: 'T-12346', status: 'completed', timestamp: '14:25:10' },
    { id: '003', number: 'T-12347', status: 'pending', timestamp: '14:20:05' },
  ];

  function handleAcceptTalon() {
    dispatch('acceptTalon');
  }

  function handleLogout() {
    dispatch('logout');
  }

  function toggleLogs() {
    dispatch('toggleLogs');
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'pending':
        return 'Ожидание';
      case 'completed':
        return 'Завершен';
      case 'error':
        return 'Ошибка';
      default:
        return 'Неизвестно';
    }
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
      on:click={toggleLogs}
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
          {#if talons.length === 0}
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
                        <h3 class="text-lg font-medium text-gray-900">{talon.number}</h3>
                        <span
                          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(
                            talon.status
                          )}"
                        >
                          {getStatusText(talon.status)}
                        </span>
                      </div>
                      <p class="text-sm text-gray-600 mt-1">Время: {talon.timestamp}</p>
                    </div>

                    {#if talon.status === 'pending'}
                      <button on:click={handleAcceptTalon} class="btn btn-success text-sm">
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
      <button on:click={handleAcceptTalon} class="btn btn-success flex-1">
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

      <button on:click={handleLogout} class="btn btn-outline-danger">
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
