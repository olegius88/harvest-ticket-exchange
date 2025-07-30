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
  let currentUserId = '';
  let logs: LogEntry[] = [];
  let isLogPanelVisible = false;

  // Функции для работы с логами
  function addLog(message: string, level: LogLevel = 'info') {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
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
  async function handleLogin(data: { phoneNumber: string; password: string }) {
    const { phoneNumber, password } = data;

    console.log('Attempting login for:', phoneNumber);

    try {
      const result = await invoke<{
        id: string;
        fio: string;
        phone: string;
        position: string;
        created_at: string;
        updated_at: string;
        from_remote: boolean;
      }>('login_vesovschik', {
        request: {
          phone: phoneNumber,
          password: password,
        },
      });

      console.log('Login result:', result);

      currentUser = result.fio;
      currentUserId = result.id;
      isAuthenticated = true;
      showDashboard();
      addLog(`Успешный вход пользователя: ${result.fio} (${result.phone})`, 'success');
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Ошибка входа: ${errorMessage}`, 'error');
      throw error; // Пробрасываем ошибку обратно в Login компонент
    }
  }

  async function handleRegistration(data: {
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) {
    const { phoneNumber, password, confirmPassword } = data;

    if (password !== confirmPassword) {
      addLog('Ошибка регистрации: пароли не совпадают', 'error');
      return;
    }

    if (!phoneNumber || !password) {
      addLog('Ошибка регистрации: заполните все поля', 'error');
      return;
    }

    console.log('Attempting registration for:', phoneNumber);
    addLog(`Попытка регистрации пользователя: ${phoneNumber}`, 'info');

    try {
      const result = await invoke<string>('register_vesovschik', {
        request: {
          fio: `Пользователь ${phoneNumber}`, // Временно используем номер телефона как ФИО
          phone: phoneNumber,
          password: password,
          position: 'весовщик',
        },
      });

      console.log('Registration result:', result);
      addLog(`Пользователь ${phoneNumber} успешно зарегистрирован (ID: ${result})`, 'success');
      showLogin();
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Ошибка регистрации: ${errorMessage}`, 'error');
      throw error; // Пробрасываем ошибку, если нужно
    }
  }

  function handleLogout() {
    currentUser = '';
    currentUserId = '';
    isAuthenticated = false;
    showLogin();
    addLog('Выход из системы', 'info');
  }

  function handleAcceptTalon() {
    addLog('Талон принят', 'success');
  }

  // Инициализация при монтировании
  onMount(async () => {
    addLog('Приложение Весовщик запущено', 'info');

    // Проверяем сохраненное состояние
    const savedUserId = localStorage.getItem('currentUserId');
    const savedUserName = localStorage.getItem('currentUserName');

    if (savedUserId && savedUserName) {
      try {
        // Проверяем валидность сессии
        const isValid = await invoke<boolean>('validate_vesovschik_session', {
          userId: savedUserId,
        });

        if (isValid) {
          currentUserId = savedUserId;
          currentUser = savedUserName;
          isAuthenticated = true;
          showDashboard();
          addLog(`Автовход пользователя: ${savedUserName}`, 'info');
        } else {
          // Сессия недействительна, очищаем данные
          localStorage.removeItem('currentUserId');
          localStorage.removeItem('currentUserName');
          addLog('Сессия истекла, требуется повторный вход', 'warning');
        }
      } catch (error) {
        // Ошибка проверки сессии, очищаем данные
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('currentUserName');
        addLog('Ошибка проверки сессии, требуется повторный вход', 'warning');
      }
    }
  });

  // Сохраняем состояние пользователя
  $: if (currentUserId && currentUser) {
    localStorage.setItem('currentUserId', currentUserId);
    localStorage.setItem('currentUserName', currentUser);
  } else {
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentUserName');
  }
</script>

<div class="h-screen flex flex-col bg-gray-50">
  <!-- Основная область контента -->
  <div class="flex-1 relative overflow-hidden">
    {#if currentScreen === 'login'}
      <Login onLogin={handleLogin} onShowRegistration={showRegistration} />
    {:else if currentScreen === 'registration'}
      <Registration onRegister={handleRegistration} onShowLogin={showLogin} />
    {:else if currentScreen === 'dashboard'}
      <Dashboard
        {currentUser}
        onLogout={handleLogout}
        onAcceptTalon={handleAcceptTalon}
        onToggleLogs={toggleLogPanel}
      />
    {/if}
  </div>

  <!-- Панель логов -->
  <LogPanel {logs} {isLogPanelVisible} onToggle={toggleLogPanel} onClear={clearLogs} />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow: hidden;
  }
</style>
