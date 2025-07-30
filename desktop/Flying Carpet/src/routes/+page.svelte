<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { Store } from '@tauri-apps/plugin-store';
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
  let store: Store | null = null;

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
    try {
      console.log('Logging out user:', currentUser);
      
      currentUser = '';
      currentUserId = '';
      isAuthenticated = false;
      
      // Очищаем сессию
      clearSession();
      
      showLogin();
      addLog('Выход из системы', 'info');
    } catch (error) {
      console.error('Error during logout:', error);
      addLog('Ошибка при выходе из системы', 'error');
    }
  }

  function handleAcceptTalon() {
    addLog('Талон принят', 'success');
  }

  // Инициализация Store
  async function initStore() {
    try {
      console.log('Initializing Tauri Store...');
      store = await Store.load('session.json');
      console.log('Store initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize store:', error);
      addLog('Ошибка инициализации хранилища', 'error');
      return false;
    }
  }

  // Сохранение сессии в Store
  async function saveSession(userId: string, userName: string) {
    if (!store) {
      console.warn('Store not initialized, trying localStorage fallback');
      try {
        localStorage.setItem('currentUserId', userId);
        localStorage.setItem('currentUserName', userName);
        console.log('Saved to localStorage as fallback');
        return;
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
        return;
      }
    }

    try {
      await store.set('currentUserId', userId);
      await store.set('currentUserName', userName);
      await store.save();
      console.log('Session saved to Store:', userId, userName);
    } catch (error) {
      console.error('Error saving to Store:', error);
      // Fallback to localStorage
      try {
        localStorage.setItem('currentUserId', userId);
        localStorage.setItem('currentUserName', userName);
        console.log('Saved to localStorage as fallback');
      } catch (fallbackError) {
        console.error('Failed to save to localStorage fallback:', fallbackError);
      }
    }
  }

  // Загрузка сессии из Store
  async function loadSession(): Promise<{ userId: string | null; userName: string | null }> {
    if (!store) {
      console.warn('Store not initialized, trying localStorage fallback');
      try {
        const userId = localStorage.getItem('currentUserId');
        const userName = localStorage.getItem('currentUserName');
        console.log('Loaded from localStorage as fallback:', userId, userName);
        return { userId, userName };
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return { userId: null, userName: null };
      }
    }

    try {
      const userId = await store.get<string>('currentUserId');
      const userName = await store.get<string>('currentUserName');
      console.log('Session loaded from Store:', userId, userName);
      return { userId: userId || null, userName: userName || null };
    } catch (error) {
      console.error('Error loading from Store:', error);
      // Fallback to localStorage
      try {
        const userId = localStorage.getItem('currentUserId');
        const userName = localStorage.getItem('currentUserName');
        console.log('Loaded from localStorage as fallback:', userId, userName);
        return { userId, userName };
      } catch (fallbackError) {
        console.error('Failed to load from localStorage fallback:', fallbackError);
        return { userId: null, userName: null };
      }
    }
  }

  // Очистка сессии
  async function clearSession() {
    if (store) {
      try {
        await store.delete('currentUserId');
        await store.delete('currentUserName');
        await store.save();
        console.log('Session cleared from Store');
      } catch (error) {
        console.error('Error clearing Store:', error);
      }
    }

    try {
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('currentUserName');
      console.log('Session cleared from localStorage');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  // Инициализация при монтировании
  onMount(async () => {
    console.log('onMount called - starting app initialization');
    addLog('Приложение Весовщик запущено', 'info');

    // Инициализируем store
    const storeInitialized = await initStore();
    
    // Проверяем сохраненное состояние
    try {
      console.log('Loading session data...');
      
      const { userId: savedUserId, userName: savedUserName } = await loadSession();

      console.log('onMount: Checking session data');
      console.log('savedUserId:', savedUserId);
      console.log('savedUserName:', savedUserName);
      addLog(`Проверка сессии: userId=${savedUserId}, userName=${savedUserName}`, 'info');

      if (savedUserId && savedUserName) {
        try {
          console.log(
            'Checking saved session for userId:',
            savedUserId,
            'userName:',
            savedUserName
          );
          addLog(`Проверка сохраненной сессии для пользователя: ${savedUserName}`, 'info');

          // Проверяем валидность сессии
          const isValid = await invoke<boolean>('validate_vesovschik_session', {
            userId: savedUserId,
          });

          console.log('Session validation result:', isValid);

          if (isValid) {
            currentUserId = savedUserId;
            currentUser = savedUserName;
            isAuthenticated = true;
            showDashboard();
            addLog(`Автовход пользователя: ${savedUserName}`, 'success');
          } else {
            // Сессия недействительна, очищаем данные
            await clearSession();
            addLog('Сессия истекла, требуется повторный вход', 'warning');
          }
        } catch (error) {
          console.error('Error validating session:', error);
          // Ошибка проверки сессии, очищаем данные
          await clearSession();
          addLog('Ошибка проверки сессии, требуется повторный вход', 'warning');
        }
      } else {
        console.log('No saved session data found');
        addLog('Сохраненная сессия не найдена', 'info');
      }
    } catch (error) {
      console.error('Error reading session data:', error);
      addLog('Ошибка чтения данных сессии', 'error');
    }
  });

  // Сохраняем состояние пользователя
    // Реактивное сохранение состояния при изменении
  $: if (currentUserId && currentUser) {
    console.log('Reactive: Saving session for:', currentUserId, currentUser);
    saveSession(currentUserId, currentUser);
    addLog(`Сессия сохранена для пользователя: ${currentUser}`, 'info');
  } else if (currentUserId === '' && currentUser === '') {
    console.log('Reactive: Clearing session');
    clearSession();
    addLog('Сессия очищена', 'info');
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
