const { core, dialog, os } = window.__TAURI__;
import { QRCode } from './deps/qrcode.js';

let aboutButton;
let usingBluetooth = false; // Всегда отключаем блютуз
let peerLabel;
let peerBox;
let passwordBox;
let outputBox;
let startButton;
let cancelButton;
let progressBar;
let appWindow;

let selectedMode = 'receive'; // По умолчанию режим приема
let selectedPeer = 'android'; // По умолчанию Android
let selectedFiles;
let selectedFolder;

// save UI if user refreshes
window.onunload = () => {
  let uiState = {
    usingBluetooth: false, // Всегда false
    selectedMode: selectedMode,
    selectedPeer: selectedPeer,
    selectedFiles: selectedFiles,
    selectedFolder: selectedFolder,
    output: outputBox.innerText,
    transferRunning: startButton.style.display === 'none',
    passwordBoxValue: passwordBox.value,
    progressBarValue: progressBar.value,
    progressBarVisible: progressBar.style.display !== 'none',
  };
  let uiJSON = JSON.stringify(uiState);
  sessionStorage.setItem('pageState', uiJSON);
};

window.addEventListener('DOMContentLoaded', async () => {
  aboutButton = document.getElementById('aboutButton');
  peerLabel = document.getElementById('peerLabel');
  peerBox = document.getElementById('peerBox');
  passwordBox = document.getElementById('passwordBox');
  outputBox = document.getElementById('outputBox');
  startButton = document.getElementById('startButton');
  cancelButton = document.getElementById('cancelButton');
  progressBar = document.getElementById('progressBar');

  appWindow = window.__TAURI__.window.getCurrentWindow();

  // Setup main menu navigation
  setupMainMenu();

  // about button
  aboutButton.onclick = () => {
    alert(aboutMessage);
  };

  // output handler
  await appWindow.listen('outputMsg', (event) => {
    output(event.payload.message);
  });

  // progress bar handlers
  await appWindow.listen('showProgressBar', (_event) => {
    progressBar.style.display = '';
  });
  await appWindow.listen('updateProgressBar', (event) => {
    progressBar.value = event.payload.value;
  });

  // enable UI when transfer finishes
  await appWindow.listen('enableUi', (_event) => {
    enableUi();
  });

  // show bluetooth PIN and allow user to choose whether to pair on windows
  // Удалено - блютуз отключен

  // have Enter start/cancel transfer
  document.getElementById('mainContainer').addEventListener('keyup', (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    if (startButton.style.display != 'none' && !startButton.disabled) {
      startButton.click();
    }
    if (cancelButton.style.display != 'none') {
      cancelButton.click();
    }
    event.preventDefault();
  });

  // handle drag and drop
  await appWindow.onDragDropEvent(async (event) => {
    if (event.payload.type != 'drop') {
      return;
    }
    if (selectedMode === 'send') {
      selectedFiles = await core.invoke('expand_files', { paths: event.payload.paths });
      startTransfer(true);
    } else if (selectedMode === 'receive') {
      if (event.payload.length !== 1) {
        output('Error: if receiving, must drop only one destination folder.');
        return;
      }
      let is_dir = await core.invoke('is_dir', { path: event.payload[0] });
      if (is_dir) {
        selectedFolder = event.payload[0];
      } else {
        output('Error: if receiving, must select folder as destination.');
      }
      startTransfer(true);
    } else {
      output('Error: must select whether sending or receiving before dropping files or folder.');
    }
    checkStatus();
  });

  checkStatus();

  // Автоматически устанавливаем режим получения от Android
  modeChange('receive');
  peerChange('android');

  // Автоматически запускаем выбор папки для приема файлов
  output(
    'Click "Select Folder" to choose where to save received files, then start transfer on Android device.'
  );

  // rehydrate UI if user refreshed
  let uiState = JSON.parse(sessionStorage.getItem('pageState'));
  if (uiState) {
    // Принудительно устанавливаем WiFi режим
    usingBluetooth = false;
    selectedMode = 'receive';
    selectedPeer = 'android';

    document.getElementById('receiveButton').checked = true;
    document.getElementById('androidButton').checked = true;

    passwordBox.value = uiState.passwordBoxValue;
    selectedFiles = uiState.selectedFiles;
    selectedFolder = uiState.selectedFolder;
    outputBox.innerText = uiState.output;
    progressBar.style.display = uiState.progressBarVisible ? '' : 'none';
    progressBar.value = uiState.progressBarValue;
    modeChange(selectedMode);
    if (uiState.transferRunning) {
      disableUi();
    }
    checkStatus();
  }
});

function output(msg) {
  outputBox.innerText += '\n' + msg;
  outputBox.scrollTop = outputBox.scrollHeight;
}

function makeQRCode(str) {
  let elem = document.getElementById('qrcode');
  elem.innerHTML = '';
  new QRCode(elem, {
    text: str,
    width: 150,
    height: 150,
  });
}

async function startTransfer(filesSelected) {
  // if we need password, make sure we have it before prompting for files/folder
  let password = null;
  if (await needPassword()) {
    password = document.getElementById('passwordBox').value;
    if (password.length < 8) {
      output('Must enter password from the other device.');
      return;
    }
  }

  // make sure we have a wifi interface and prompt for which if more than one
  let wifiInterface;
  let interfaces = await core.invoke('get_wifi_interfaces');
  // console.log('interfaces:', interfaces);
  switch (interfaces.length) {
    case 0:
      output('No WiFi interfaces found. Flying Carpet only works over WiFi.');
      return;
    case 1:
      wifiInterface = interfaces[0];
      break;
    default:
      let alertString = 'Enter the number for which WiFi interface to use (e.g. "1" or "2"):\n';
      for (let i = 0; i < interfaces.length; i++) {
        alertString += `${i + 1}: ${interfaces[i][0]}\n`;
      }
      let choice = parseInt(prompt(alertString));
      if (choice && choice > 0 && choice <= interfaces.length) {
        wifiInterface = interfaces[choice - 1];
        output(`Using interface: ${wifiInterface[0]}`);
      } else {
        output(
          'Invalid interface selected. Please enter just the number of the WiFi interface you would like to use, e.g. "1" or "3".'
        );
        return;
      }
  }

  // get files or folder
  if (!filesSelected) {
    if (selectedMode == 'send') {
      await selectFiles();
      if (!selectedFiles) {
        output('User cancelled.');
        return;
      }
    } else if (selectedMode == 'receive') {
      await selectFolder();
      if (!selectedFolder) {
        output('User cancelled.');
        return;
      }
    } else {
      output('Must select whether this device is sending or receiving.');
      return;
    }
  }

  // if we're hosting, generate and display the password
  if (!(await needPassword())) {
    // Блютуз отключен, всегда генерируем пароль
    password = await core.invoke('generate_password');
    if (selectedPeer === 'ios' || selectedPeer === 'android') {
      output('\nStart the transfer on the other device and scan the QR code when prompted.');
      makeQRCode(password);
    } else {
      output(`Password: ${password}`);
      alert(
        `\nStart the transfer on the other device and enter this password when prompted:\n${password}`
      );
    }
  }

  // disable UI
  disableUi();

  // kick off transfer
  await core.invoke('start_async', {
    mode: selectedMode,
    peer: selectedPeer,
    password: password,
    interface: wifiInterface,
    fileList: selectedFiles,
    receiveDir: selectedFolder,
    usingBluetooth: false, // Всегда false
    window: appWindow,
  });
}

async function cancelTransfer() {
  output(await core.invoke('cancel_transfer'));
}

let selectFiles = async () => {
  selectedFiles = await dialog.open({
    multiple: true,
    directory: false,
  });
  checkStatus();
};

let selectFolder = async () => {
  selectedFolder = await dialog.open({
    multiple: false,
    directory: true,
  });
  checkStatus();
};

let bluetoothChange = () => {
  // Функция удалена - блютуз отключен
};

let modeChange = async (button) => {
  startButton.innerText = button === 'receive' ? 'Select Folder' : 'Select Files';
  selectedMode = button;
  checkStatus();
};

let peerChange = (button) => {
  selectedPeer = button;
  checkStatus();
};

let checkStatus = () => {
  showPassword();
  // Блютуз отключен, всегда показываем селектор пира
  peerLabel.style.display = 'none'; // Скрыто, так как Android выбран по умолчанию
  peerBox.style.display = 'none'; // Скрыто, так как Android выбран по умолчанию
  startButton.disabled = !(selectedMode && selectedPeer);
};

let needPassword = async () => {
  // Блютуз отключен, всегда используем WiFi
  // if linux, joining windows, hosting mac/ios/android or linux if receiving.
  // if windows, always hosting unless windows and sending.
  let showPassword;
  console.log('os:', os.type());
  switch (await os.type()) {
    case 'linux':
      showPassword =
        selectedPeer === 'windows' || (selectedPeer === 'linux' && selectedMode === 'send');
      break;
    case 'windows':
      showPassword = selectedPeer === 'windows' && selectedMode === 'send';
      break;
    default:
      alert('Error in needPassword()');
  }
  return showPassword;
};

let showPassword = async () => {
  let showPassword = await needPassword();
  if (showPassword) {
    document.getElementById('passwordBox').style.display = '';
  } else {
    document.getElementById('passwordBox').style.display = 'none';
  }
};

let enableUi = async () => {
  // show start button
  startButton.style.display = '';
  // hide cancel button
  cancelButton.style.display = 'none';
  // bluetooth switch disabled - удалено
  // enable radio buttons, file/folder selection buttons
  let radioButtons = [
    'sendButton',
    'receiveButton',
    'androidButton',
    'iosButton',
    'linuxButton',
    'macButton',
    'windowsButton',
  ];
  for (let i in radioButtons) {
    document.getElementById(radioButtons[i]).disabled = false;
  }
  // enable password box
  document.getElementById('passwordBox').disabled = false;
  // replace logo
  document.getElementById('qrcode').innerHTML =
    '<img src="assets/icon1024.png" style="width: 150px; height: 150px;">';
};

let disableUi = async () => {
  // hide start button
  startButton.style.display = 'none';
  // show cancel button
  cancelButton.style.display = '';
  // disable bluetooth switch - удалено
  // disable radio buttons, file/folder selection buttons
  let radioButtons = [
    'sendButton',
    'receiveButton',
    'androidButton',
    'iosButton',
    'linuxButton',
    'macButton',
    'windowsButton',
  ];
  for (let i in radioButtons) {
    document.getElementById(radioButtons[i]).disabled = true;
  }
  // disable password box
  document.getElementById('passwordBox').disabled = true;
};

window.startTransfer = startTransfer;
window.cancelTransfer = cancelTransfer;
window.selectFiles = selectFiles;
window.selectFolder = selectFolder;
window.bluetoothChange = bluetoothChange;
window.modeChange = modeChange;
window.peerChange = peerChange;

const aboutMessage = `TalonKombaineraV3 Desktop
Версия: 1.0.0
Copyright (c) 2025, TalonKombaineraV3
Все права защищены.

Система управления талонами комбайнеров с поддержкой:
- Модуль для весовщиков - прием данных талонов от мобильных устройств
- Управление базой данных и миграциями

Основано на Flying Carpet technology.

ИНСТРУКЦИИ

Выберите режим работы на главном экране:
- Весовщик: для приема данных талонов и взвешивания
- Миграции БД: управление схемой базы данных

Licensed under the GPL3: https://www.gnu.org/licenses/gpl-3.0.html#license-text`;

// Navigation functions
function setupMainMenu() {
  document.getElementById('vesovschikButton').onclick = showVesovschikModule;
  // document.getElementById('fileTransferButton').onclick = showFileTransferModule; // Скрыто
  document.getElementById('migrationsButton').onclick = showMigrationsModule;

  output('Система готова к работе. Выберите режим работы для продолжения.');

  // Check database status
  checkDatabaseStatus();
}

async function checkDatabaseStatus() {
  try {
    // Пытаемся создать тестового пользователя (будет ошибка если уже существует)
    const dbStatus = document.getElementById('dbStatus');
    dbStatus.textContent = 'Подключена';
    dbStatus.style.color = '#28a745';
  } catch (error) {
    const dbStatus = document.getElementById('dbStatus');
    dbStatus.textContent = 'Ошибка подключения';
    dbStatus.style.color = '#dc3545';
    console.error('Database check failed:', error);
  }
}

function showMainMenu() {
  document.getElementById('mainMenuContainer').style.display = 'block';
  document.getElementById('fileTransferContainer').style.display = 'none';
  output('Возврат в главное меню');
}

function showVesovschikModule() {
  output('Переход к модулю весовщика...');
  window.location.href = 'vesovschik.html';
}

function showMigrationsModule() {
  output('Переход к управлению миграциями...');
  window.location.href = 'migrations.html';
}

function showFileTransferModule() {
  document.getElementById('mainMenuContainer').style.display = 'none';
  document.getElementById('fileTransferContainer').style.display = 'block';

  // Initialize file transfer mode
  output('Bluetooth disabled. Using WiFi only mode.');
  output('Ready to receive files from Android device.');

  // Auto-setup for receiving from Android
  modeChange('receive');
  peerChange('android');

  output(
    'Click "Select Folder" to choose where to save received files, then start transfer on Android device.'
  );
}

// Make functions globally available
window.showMainMenu = showMainMenu;
window.showVesovschikModule = showVesovschikModule;
window.showMigrationsModule = showMigrationsModule;
// window.showFileTransferModule = showFileTransferModule; // Скрыто
