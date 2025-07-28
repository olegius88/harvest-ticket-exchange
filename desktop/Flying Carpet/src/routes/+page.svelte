<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import Login from '$lib/components/Login.svelte';
  import Registration from '$lib/components/Registration.svelte';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import LogPanel from '$lib/components/LogPanel.svelte';
  
  type Screen = 'login' | 'registration' | 'dashboard';
  type LogLevel = 'info' | 'success' | 'warning' | 'error';
  
  interface LogEntry {
    id: string;
    timestamp: string;
    level: LogLevel;
    message: string;
  }
  
  // Состояние приложения
  let currentScreen: Screen = 'login';
  let isAuthenticated = false;
  let currentUser = '';
  let logs: LogEntry[] = [];
  let isLogPanelVisible = false;
  
  // Функции для работы с логами
  function addLog(message: string, level: LogLevel = 'info') {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    };
    logs = [logEntry, ...logs];
    
    // Ограничиваем количество логов
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }
  }
  
  function clearLogs() {
    logs = [];
  }
  
  function toggleLogPanel() {
    isLogPanelVisible = !isLogPanelVisible;
  }
  
  // Функции навигации
  function showLogin() {
    currentScreen = 'login';
    addLog('Переход на экран входа');
  }
  
  function showRegistration() {
    currentScreen = 'registration';
    addLog('Переход на экран регистрации');
  }
  
  function showDashboard() {
    currentScreen = 'dashboard';
    addLog('Переход в главное меню');
  }
  
  // Функции аутентификации
  function handleLogin(event: CustomEvent) {
    const { username, password } = event.detail;
    
    // Простая проверка
    if (username && password) {
      currentUser = username;
      isAuthenticated = true;
      showDashboard();
      addLog(`Успешный вход пользователя: ${username}`, 'success');
    } else {
      addLog('Ошибка входа: неверные учетные данные', 'error');
    }
  }
  
  function handleRegistration(event: CustomEvent) {
    const { username, password, confirmPassword } = event.detail;
    
    if (password !== confirmPassword) {
      addLog('Ошибка регистрации: пароли не совпадают', 'error');
      return;
    }
    
    if (username && password) {
      addLog(`Пользователь ${username} зарегистрирован`, 'success');
      showLogin();
    } else {
      addLog('Ошибка регистрации: заполните все поля', 'error');
    }
  }
  
  function handleLogout() {
    currentUser = '';
    isAuthenticated = false;
    showLogin();
    addLog('Выход из системы', 'info');
  }
  
  function handleAcceptTalon() {
    addLog('Талон принят', 'success');
  }
  
  // Инициализация при монтировании
  onMount(() => {
    addLog('Приложение Весовщик запущено', 'info');
    
    // Проверяем сохраненное состояние
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        currentUser = savedUser;
        isAuthenticated = true;
        showDashboard();
        addLog(`Автовход пользователя: ${savedUser}`, 'info');
      }
    }
  });
  
  // Сохраняем состояние пользователя
  $: if (typeof window !== 'undefined') {
    if (currentUser) {
      localStorage.setItem('currentUser', currentUser);
    } else {
      localStorage.removeItem('currentUser');
    }
  }
</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Основная область контента -->
  <div class="flex-1 relative overflow-hidden">
    {#if currentScreen === 'login'}
      <Login 
        on:login={handleLogin}
        on:showRegistration={showRegistration}
      />
    {:else if currentScreen === 'registration'}
      <Registration 
        on:register={handleRegistration}
        on:showLogin={showLogin}
      />
    {:else if currentScreen === 'dashboard'}
      <Dashboard 
        {currentUser}
        on:logout={handleLogout}
        on:acceptTalon={handleAcceptTalon}
        on:toggleLogs={toggleLogPanel}
      />
    {/if}
  </div>
  
  <!-- Панель логов -->
  <LogPanel 
    {logs}
    {isLogPanelVisible}
    on:toggle={toggleLogPanel}
    on:clear={clearLogs}
  />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow: hidden;
  }
</style>
