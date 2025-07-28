// Tauri API initialization
let tauri;

// UI Elements
let mainMenu;
let loginForm;
let registrationForm;
let dashboard;
let hotspotInfo;
let outputBox;
let loadingOverlay;

// Form elements
let loginPhone, loginPassword;
let regFio, regPhone, regPassword, regPasswordConfirm;

// User state
let currentUser = null;
let isAuthenticated = false;
let hotspotActive = false;
let acceptedTalons = [];

// Initialize application
window.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  initializeOutputBoxState();
  await initializeApp();
});

function initializeElements() {
  // UI containers
  mainMenu = document.getElementById('mainMenu');
  loginForm = document.getElementById('loginForm');
  registrationForm = document.getElementById('registrationForm');
  dashboard = document.getElementById('dashboard');
  hotspotInfo = document.getElementById('hotspotInfo');
  outputBox = document.getElementById('outputBox');
  loadingOverlay = document.getElementById('loadingOverlay');

  // Login form elements
  loginPhone = document.getElementById('loginPhone');
  loginPassword = document.getElementById('loginPassword');

  // Registration form elements
  regFio = document.getElementById('regFio');
  regPhone = document.getElementById('regPhone');
  regPassword = document.getElementById('regPassword');
  regPasswordConfirm = document.getElementById('regPasswordConfirm');

  // Проверяем наличие ключевых элементов
  const requiredElements = [mainMenu, loginForm, registrationForm, dashboard, outputBox];
  const missingElements = requiredElements.filter((el) => !el);

  if (missingElements.length > 0) {
    console.error('Отсутствуют необходимые элементы DOM:', missingElements);
  } else {
    console.log('Все элементы DOM найдены успешно');
  }
}

function setupEventListeners() {
  // About button
  document.getElementById('aboutButton').onclick = showAbout;

  // Main menu buttons
  document.getElementById('loginButton').onclick = showLoginForm;
  document.getElementById('registerButton').onclick = showRegistrationForm;

  // Login form buttons
  document.getElementById('loginSubmitButton').onclick = handleLogin;
  document.getElementById('loginCancelButton').onclick = showMainMenu;

  // Registration form buttons
  document.getElementById('regSubmitButton').onclick = handleRegistration;
  document.getElementById('regCancelButton').onclick = showMainMenu;

  // Dashboard buttons
  // document.getElementById('startHotspotButton').onclick = startHotspot; // Скрыто
  document.getElementById('acceptTalonButton').onclick = acceptTalon;
  document.getElementById('logoutButton').onclick = handleLogout;

  // Output toggle button
  document.getElementById('outputToggle').onclick = toggleOutputBox;

  // Clear log button
  document.getElementById('clearLogButton').onclick = (e) => {
    e.stopPropagation(); // Prevent triggering toggle
    clearLog();
  };

  // Hotspot controls
  // document.getElementById('stopHotspotButton').onclick = stopHotspot; // Скрыто

  // Enter key handlers
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      if (loginForm.style.display !== 'none') {
        handleLogin();
      } else if (registrationForm.style.display !== 'none') {
        handleRegistration();
      }
    }
  });
}

async function initializeApp() {
  // Сначала скрываем все экраны
  hideAllScreens();

  output('Инициализация системы весовщика...', 'info');
  output('TCP сервер запущен и готов к подключениям', 'success');

  // Initialize Tauri API
  try {
    tauri = window.__TAURI__;
    if (!tauri || !tauri.core) {
      throw new Error('Tauri API не доступен');
    }
  } catch (error) {
    output('Ошибка инициализации: ' + error.message, 'error');
    showMainMenu();
    return;
  }

  // Check if user is already authenticated
  try {
    const savedUser = localStorage.getItem('vesovschik_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      if (await validateUser(currentUser)) {
        isAuthenticated = true;
        showDashboard();
        return;
      } else {
        localStorage.removeItem('vesovschik_user');
      }
    }
  } catch (error) {
    console.error('Error loading saved user:', error);
    localStorage.removeItem('vesovschik_user');
  }

  // Показываем главное меню по умолчанию
  showMainMenu();
}

function showMainMenu() {
  showScreen('mainMenu');
  output('Выберите действие для входа в систему', 'info');
}

function showLoginForm() {
  showScreen('loginForm');
  clearErrors();
  loginPhone.focus();
  output('Введите данные для входа в систему', 'info');
}

function showRegistrationForm() {
  showScreen('registrationForm');
  clearErrors();
  regFio.focus();
  output('Заполните данные для регистрации', 'info');
}

function showDashboard() {
  showScreen('dashboard');

  if (currentUser) {
    document.getElementById('userFio').textContent = currentUser.fio;
    document.getElementById('userPhone').textContent = currentUser.phone;
    document.getElementById('welcomeMessage').textContent = `Добро пожаловать, ${currentUser.fio}!`;
  }

  output(`Добро пожаловать, ${currentUser?.fio || 'Весовщик'}!`, 'success');
  output('TCP сервер активен', 'info');
  output('Устройства могут подключаться через внутреннюю WiFi сеть весовой', 'info');
  output('IP адрес для подключения будет отображен в QR-коде', 'info');

  // Загружаем сохраненные талоны
  loadAcceptedTalons();
}

function hideAllScreens() {
  // Убираем все классы active и скрываем все экраны
  const screens = document.querySelectorAll('.screen');
  screens.forEach((screen) => {
    screen.classList.remove('active');
    screen.style.display = 'none';
  });
}

function showScreen(screenId) {
  console.log(`Показываем экран: ${screenId}`);
  hideAllScreens();
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
    if (screenId === 'dashboard') {
      screen.style.display = 'flex';
    } else {
      screen.style.display = 'block';
    }
    console.log(`Экран ${screenId} отображен`);
  } else {
    console.error(`Экран ${screenId} не найден`);
  }
}

function clearErrors() {
  const errorElements = document.querySelectorAll('.error-text');
  errorElements.forEach((el) => {
    el.style.display = 'none';
    el.textContent = '';
  });

  const inputs = document.querySelectorAll('.form-control');
  inputs.forEach((input) => {
    input.style.borderColor = '';
  });
}

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorElement = document.getElementById(fieldId + 'Error');

  if (field) field.style.borderColor = 'red';
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
  }
}

function validateLoginForm() {
  clearErrors();
  let isValid = true;

  const phone = loginPhone.value.trim();
  const password = loginPassword.value.trim();

  if (!phone) {
    showError('loginPhone', 'Введите номер телефона');
    isValid = false;
  } else if (!/^\+?[78][0-9]{10}$/.test(phone)) {
    showError('loginPhone', 'Введите корректный номер телефона');
    isValid = false;
  }

  if (!password) {
    showError('loginPassword', 'Введите пароль');
    isValid = false;
  }

  return isValid;
}

function validateRegistrationForm() {
  clearErrors();
  let isValid = true;

  const fio = regFio.value.trim();
  const phone = regPhone.value.trim();
  const password = regPassword.value.trim();
  const passwordConfirm = regPasswordConfirm.value.trim();

  if (!fio) {
    showError('regFio', 'Введите ФИО');
    isValid = false;
  }

  if (!phone) {
    showError('regPhone', 'Введите номер телефона');
    isValid = false;
  } else if (!/^\+?[78][0-9]{10}$/.test(phone)) {
    showError('regPhone', 'Введите корректный номер телефона');
    isValid = false;
  }

  if (!password) {
    showError('regPassword', 'Введите пароль');
    isValid = false;
  } else if (password.length < 6) {
    showError('regPassword', 'Пароль должен содержать минимум 6 символов');
    isValid = false;
  }

  if (!passwordConfirm) {
    showError('regPasswordConfirm', 'Подтвердите пароль');
    isValid = false;
  } else if (password !== passwordConfirm) {
    showError('regPasswordConfirm', 'Пароли не совпадают');
    isValid = false;
  }

  return isValid;
}

async function handleLogin() {
  if (!validateLoginForm()) return;

  showLoading();

  try {
    const userData = {
      phone: loginPhone.value.trim(),
      password: loginPassword.value.trim(),
    };

    const user = await tauri.core.invoke('login_vesovschik', { request: userData });

    if (user) {
      currentUser = user;
      isAuthenticated = true;
      localStorage.setItem('vesovschik_user', JSON.stringify(user));

      output('Вход выполнен успешно');
      showDashboard();
    } else {
      throw new Error('Неверные данные для входа');
    }
  } catch (error) {
    console.error('Login error:', error);
    output('Ошибка входа: ' + (error.message || error));
    showError('loginPassword', error.message || error);
  } finally {
    hideLoading();
  }
}

async function handleRegistration() {
  if (!validateRegistrationForm()) return;

  showLoading();

  try {
    const userData = {
      fio: regFio.value.trim(),
      phone: regPhone.value.trim(),
      password: regPassword.value.trim(),
      position: 'vesovschik',
    };

    const userId = await tauri.core.invoke('register_vesovschik', { request: userData });

    if (userId) {
      output('Регистрация выполнена успешно');

      // Автоматически входим после регистрации
      const user = await tauri.core.invoke('login_vesovschik', {
        request: {
          phone: userData.phone,
          password: userData.password,
        },
      });

      if (user) {
        currentUser = user;
        isAuthenticated = true;
        localStorage.setItem('vesovschik_user', JSON.stringify(user));
        showDashboard();
      } else {
        showLoginForm();
      }
    } else {
      throw new Error('Ошибка при регистрации');
    }
  } catch (error) {
    console.error('Registration error:', error);
    output('Ошибка регистрации: ' + (error.message || error));
    if ((error.message || error).includes('телефон')) {
      showError('regPhone', error.message || error);
    }
  } finally {
    hideLoading();
  }
}

async function validateUser(user) {
  try {
    const result = await tauri.core.invoke('validate_vesovschik_session', user.id);
    return result;
  } catch (error) {
    console.error('User validation failed:', error);
    return false;
  }
}

function handleLogout() {
  currentUser = null;
  isAuthenticated = false;
  localStorage.removeItem('vesovschik_user');

  if (hotspotActive) {
    stopHotspot();
  }

  output('Выход из системы выполнен');
  showMainMenu();
}

async function startHotspot() {
  // Функция скрыта - hotspot создание отключено
  // Вместо этого показываем информацию о TCP сервере
  if (!isAuthenticated) {
    output('Необходимо войти в систему');
    return;
  }

  output('TCP сервер всегда активен для приема подключений');
  output('Устройства могут подключаться через внутреннюю WiFi сеть весовой');

  // Генерируем QR-код с IP адресом для подключения
  makeQRCode(
    JSON.stringify({
      mode: 'tcp_server',
      vesovschik: currentUser.fio,
      info: 'Подключение через внутреннюю сеть',
    })
  );

  // Показываем информацию о TCP сервере
  dashboard.style.display = 'none';
  hotspotInfo.style.display = 'block';
}

async function stopHotspot() {
  // Функция скрыта - hotspot остановка отключена
  // TCP сервер остается активным
  output('TCP сервер остается активным');

  // Скрываем информацию
  hotspotInfo.style.display = 'none';
  dashboard.style.display = 'block';

  // Возвращаем обычный логотип
  document.getElementById('qrcode').innerHTML =
    '<img src="assets/icon1024.png" style="width: 200px; height: 200px;">';
}

function makeQRCode(str) {
  const elem = document.getElementById('qrcode');
  elem.innerHTML = `<div style="border: 2px solid #333; padding: 20px; text-align: center; background: white; word-break: break-all; font-family: monospace;">
    <h4>Данные для подключения:</h4>
    <p>${str}</p>
    <small style="color: #666;">QR-код будет добавлен в следующей версии</small>
  </div>`;
}

function showLoading() {
  loadingOverlay.style.display = 'block';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

// Функции для работы с талонами
async function acceptTalon() {
  if (!isAuthenticated) {
    output('Необходимо войти в систему для приема талонов');
    return;
  }

  try {
    // Генерируем тестовый талон (в реальности данные будут приходить от мобильного устройства)
    const talon = {
      id: Date.now().toString(),
      talonNumber: `T${Date.now().toString().slice(-6)}`,
      kombainerFio: 'Тестовый Комбайнер',
      voditelFio: 'Тестовый Водитель',
      culture: 'Пшеница',
      weight: Math.floor(Math.random() * 5000) + 1000, // Случайный вес от 1000 до 6000 кг
      moisture: (Math.random() * 10 + 10).toFixed(1), // Влажность от 10 до 20%
      receivedAt: new Date().toLocaleString(),
      vesovschikId: currentUser.id,
      vesovschikFio: currentUser.fio,
    };

    acceptedTalons.push(talon);
    updateTalonsList();

    output(`Принят талон №${talon.talonNumber} от ${talon.kombainerFio}`);
    output(`Вес: ${talon.weight} кг, Влажность: ${talon.moisture}%`);

    // Сохраняем в localStorage для постоянства
    localStorage.setItem('acceptedTalons', JSON.stringify(acceptedTalons));
  } catch (error) {
    output('Ошибка при приеме талона: ' + error.message);
  }
}

function updateTalonsList() {
  const talonsList = document.getElementById('talonsList');
  const talonsCount = document.getElementById('talonsCount');

  if (acceptedTalons.length === 0) {
    talonsList.innerHTML =
      '<p style="text-align: center; color: #6c757d; margin: 20px 0;">Ожидание талонов от Android устройств...</p>';
  } else {
    talonsList.innerHTML = acceptedTalons
      .map(
        (talon, index) => `
      <div style="border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; margin-bottom: 10px; background-color: #f8f9fa; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="color: #007bff; font-size: 16px;">Талон №${talon.talonNumber || index + 1}</strong>
          <small style="color: #6c757d; background: #fff; padding: 2px 8px; border-radius: 12px;">${talon.receivedAt}</small>
        </div>
        <div style="font-size: 14px; line-height: 1.4;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <p style="margin: 0; padding: 4px 0;"><strong>Комбайнер:</strong> ${talon.kombainerFio || 'Не указано'}</p>
            <p style="margin: 0; padding: 4px 0;"><strong>Водитель:</strong> ${talon.voditelFio || 'Не указано'}</p>
            <p style="margin: 0; padding: 4px 0;"><strong>Культура:</strong> ${talon.culture || 'Не указано'}</p>
            <p style="margin: 0; padding: 4px 0;"><strong>Вес:</strong> ${talon.weight ? talon.weight + ' кг' : 'Не указано'}</p>
            <p style="margin: 0; padding: 4px 0;"><strong>Влажность:</strong> ${talon.moisture ? talon.moisture + '%' : 'Не указано'}</p>
            <p style="margin: 0; padding: 4px 0;"><strong>Статус:</strong> <span style="color: #28a745; font-weight: bold;">Принято</span></p>
          </div>
        </div>
      </div>
    `
      )
      .reverse() // Показываем новые талоны сверху
      .join('');
  }

  talonsCount.textContent = acceptedTalons.length;
}

function loadAcceptedTalons() {
  try {
    const saved = localStorage.getItem('acceptedTalons');
    if (saved) {
      acceptedTalons = JSON.parse(saved);
      updateTalonsList();
      output(`Загружено ${acceptedTalons.length} сохраненных талонов`);
    }
  } catch (error) {
    output('Ошибка загрузки сохраненных талонов: ' + error.message);
    acceptedTalons = [];
  }
}

function output(msg, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let colorClass = '';
  let icon = '';

  switch (type) {
    case 'error':
      colorClass = 'color: #dc3545;';
      icon = '❌';
      break;
    case 'success':
      colorClass = 'color: #28a745;';
      icon = '✅';
      break;
    case 'warning':
      colorClass = 'color: #ffc107;';
      icon = '⚠️';
      break;
    default:
      colorClass = 'color: #495057;';
      icon = 'ℹ️';
  }

  outputBox.innerHTML += `<div style="margin: 2px 0; padding: 2px; ${colorClass}">
    <span style="color: #6c757d; font-size: 12px;">[${timestamp}]</span>
    <span style="margin: 0 5px;">${icon}</span>
    ${msg}
  </div>`;
  outputBox.scrollTop = outputBox.scrollHeight;
}

function showAbout() {
  const aboutMessage = `Весовщик - TalonKombaineraV3
Версия: 1.0.0

Модуль для работы весовщиков в системе управления талонами.

Функционал:
- Авторизация и регистрация весовщиков
- Создание WiFi точки доступа для приема данных
- Обработка талонов от мобильных устройств
- Интеграция с основной системой

Copyright (c) 2025, TalonKombaineraV3
Все права защищены.`;

  alert(aboutMessage);
}

// Toggle output box visibility
function toggleOutputBox() {
  const outputBox = document.getElementById('outputBox');
  const outputIcon = document.getElementById('outputToggleIcon');

  if (outputBox.classList.contains('collapsed')) {
    // Expand
    outputBox.classList.remove('collapsed');
    outputIcon.classList.remove('collapsed');
    outputIcon.textContent = '▼';
    localStorage.setItem('outputBoxCollapsed', 'false');
  } else {
    // Collapse
    outputBox.classList.add('collapsed');
    outputIcon.classList.add('collapsed');
    outputIcon.textContent = '▶';
    localStorage.setItem('outputBoxCollapsed', 'true');
  }
}

// Clear log function
function clearLog() {
  outputBox.innerHTML =
    '<div style="color: #6c757d; font-style: italic; text-align: center; padding: 10px;">Журнал очищен</div>';
  output('Система готова к работе', 'success');
}

// Initialize output box state from localStorage
function initializeOutputBoxState() {
  const isCollapsed = localStorage.getItem('outputBoxCollapsed') === 'true';
  if (isCollapsed) {
    const outputBox = document.getElementById('outputBox');
    const outputIcon = document.getElementById('outputToggleIcon');
    outputBox.classList.add('collapsed');
    outputIcon.classList.add('collapsed');
    outputIcon.textContent = '▶';
  }
}

// Export functions for global access
window.handleLogin = handleLogin;
window.handleRegistration = handleRegistration;
window.handleLogout = handleLogout;
window.acceptTalon = acceptTalon;
window.toggleOutputBox = toggleOutputBox;
window.clearLog = clearLog;
// window.startHotspot = startHotspot; // Скрыто
// window.stopHotspot = stopHotspot; // Скрыто
window.showAbout = showAbout;
