<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let logs: Array<{
    id: string;
    timestamp: string;
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
  }> = [];
  
  export let isLogPanelVisible: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function toggle() {
    dispatch('toggle');
  }
  
  function clear() {
    dispatch('clear');
  }
  
  function getLogClass(level: string) {
    switch (level) {
      case 'info':
        return 'log-entry log-info';
      case 'success':
        return 'log-entry log-success';
      case 'warning':
        return 'log-entry log-warning';
      case 'error':
        return 'log-entry log-error';
      default:
        return 'log-entry log-info';
    }
  }
  
  function getLevelIcon(level: string) {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  }
</script>

<!-- Панель логов -->
<div class="bg-gray-800 border-t border-gray-600 transition-all duration-300 ease-in-out" 
     class:h-0={!isLogPanelVisible}
     class:h-64={isLogPanelVisible}
     class:overflow-hidden={!isLogPanelVisible}>
  
  <!-- Заголовок панели -->
  <div class="bg-gray-700 px-4 py-2 flex justify-between items-center border-b border-gray-600">
    <div class="flex items-center space-x-2">
      <h3 class="text-white font-medium">Журнал событий</h3>
      <span class="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded">
        {logs.length}
      </span>
    </div>
    
    <div class="flex items-center space-x-2">
      <button
        on:click={clear}
        class="text-gray-300 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-600 transition-colors"
        title="Очистить журнал"
        aria-label="Очистить журнал"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      
      <button
        on:click={toggle}
        class="text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-600 transition-colors"
        title={isLogPanelVisible ? 'Скрыть журнал' : 'Показать журнал'}
        aria-label={isLogPanelVisible ? 'Скрыть журнал' : 'Показать журнал'}
      >
        <svg class="w-4 h-4 transition-transform duration-200" 
             class:rotate-180={isLogPanelVisible}
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  </div>
  
  <!-- Область логов -->
  {#if isLogPanelVisible}
    <div class="h-52 overflow-y-auto p-3 space-y-2">
      {#if logs.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-400">Журнал событий пуст</p>
        </div>
      {:else}
        {#each logs as log (log.id)}
          <div class={getLogClass(log.level)}>
            <div class="flex items-start space-x-2">
              <span class="text-sm flex-shrink-0">{getLevelIcon(log.level)}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 text-xs">
                  <span class="font-medium opacity-75">{log.timestamp}</span>
                  <span class="uppercase font-semibold opacity-75">{log.level}</span>
                </div>
                <p class="text-sm break-words">{log.message}</p>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<!-- Кнопка-переключатель внизу экрана когда панель скрыта -->
{#if !isLogPanelVisible}
  <button
    on:click={toggle}
    class="fixed bottom-4 right-4 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-full shadow-lg transition-colors z-10"
    title="Показать журнал событий"
    aria-label="Показать журнал событий"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </button>
{/if}
