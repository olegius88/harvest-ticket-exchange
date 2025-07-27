const { core, dialog, os } = window.__TAURI__;
import { QRCode } from './deps/qrcode.js';

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

// Initialize application
window.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
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
  document.getElementById('startHotspotButton').onclick = startHotspot;
  document.getElementById('logoutButton').onclick = handleLogout;

  // Hotspot controls
  document.getElementById('stopHotspotButton').onclick = stopHotspot;

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
  output('Инициализация системы весовщика...');

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

  showMainMenu();
}

function showMainMenu() {
  hideAllScreens();
  mainMenu.style.display = 'block';
  output('Выберите действие для входа в систему');
}

function showLoginForm() {
  hideAllScreens();
  loginForm.style.display = 'block';
  clearErrors();
  loginPhone.focus();
  output('Введите данные для входа в систему');
}

function showRegistrationForm() {
  hideAllScreens();
  registrationForm.style.display = 'block';
  clearErrors();
  regFio.focus();
  output('Заполните данные для регистрации');
}

function showDashboard() {
  hideAllScreens();
  dashboard.style.display = 'block';

  if (currentUser) {
    document.getElementById('userFio').textContent = currentUser.fio;
    document.getElementById('userPhone').textContent = currentUser.phone;
  }

  output(`Добро пожаловать, ${currentUser?.fio || 'Весовщик'}!`);
}

function hideAllScreens() {
  mainMenu.style.display = 'none';
  loginForm.style.display = 'none';
  registrationForm.style.display = 'none';
  dashboard.style.display = 'none';
  hotspotInfo.style.display = 'none';
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

    const user = await core.invoke('login_vesovschik', userData);

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
    output('Ошибка входа: ' + error.message);
    showError('loginPassword', error.message);
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

    const userId = await core.invoke('register_vesovschik', userData);

    if (userId) {
      output('Регистрация выполнена успешно');

      // Автоматически входим после регистрации
      const user = await core.invoke('login_vesovschik', {
        phone: userData.phone,
        password: userData.password,
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
    output('Ошибка регистрации: ' + error.message);
    if (error.message.includes('телефон')) {
      showError('regPhone', error.message);
    }
  } finally {
    hideLoading();
  }
}

async function validateUser(user) {
  try {
    const result = await core.invoke('validate_vesovschik_session', { userId: user.id });
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
  if (!isAuthenticated) {
    output('Необходимо войти в систему');
    return;
  }

  showLoading();

  try {
    output('Создание точки доступа...');

    const result = await core.invoke('start_vesovschik_hotspot', {
      userId: currentUser.id,
    });

    if (result && result.ssid && result.password) {
      hotspotActive = true;

      // Update UI
      document.getElementById('ssidDisplay').textContent = result.ssid;
      document.getElementById('passwordDisplay').textContent = result.password;

      // Generate QR code
      makeQRCode(
        JSON.stringify({
          ssid: result.ssid,
          password: result.password,
          vesovschik: currentUser.fio,
        })
      );

      dashboard.style.display = 'none';
      hotspotInfo.style.display = 'block';

      output(`Точка доступа создана: ${result.ssid}`);
      output('Мобильные устройства могут подключиться к сети и отправить данные талонов');
    } else {
      throw new Error('Не удалось создать точку доступа');
    }
  } catch (error) {
    output('Ошибка создания точки доступа: ' + error.message);
  } finally {
    hideLoading();
  }
}

async function stopHotspot() {
  showLoading();

  try {
    output('Остановка точки доступа...');

    await core.invoke('stop_vesovschik_hotspot');

    hotspotActive = false;

    // Clear QR code
    document.getElementById('qrcode').innerHTML =
      '<img src="assets/icon1024.png" style="width: 200px; height: 200px;">';

    hotspotInfo.style.display = 'none';
    dashboard.style.display = 'block';

    output('Точка доступа остановлена');
  } catch (error) {
    output('Ошибка остановки точки доступа: ' + error.message);
  } finally {
    hideLoading();
  }
}

function makeQRCode(str) {
  const elem = document.getElementById('qrcode');
  elem.innerHTML = '';
  new QRCode(elem, {
    text: str,
    width: 200,
    height: 200,
  });
}

function showLoading() {
  loadingOverlay.style.display = 'block';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

function output(msg) {
  const timestamp = new Date().toLocaleTimeString();
  outputBox.innerHTML += `<br>[${timestamp}] ${msg}`;
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

// Export functions for global access
window.handleLogin = handleLogin;
window.handleRegistration = handleRegistration;
window.handleLogout = handleLogout;
window.startHotspot = startHotspot;
window.stopHotspot = stopHotspot;
window.showAbout = showAbout;
