// Tauri API initialization
let tauri;

// DOM elements
let dbStatus;
let appliedMigrationsDiv;
let pendingMigrationsDiv;
let rollbackForm;
let targetVersionInput;
let outputLog;

// Initialize application
window.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  setupEventListeners();
  await initializeApp();
});

function initializeElements() {
  dbStatus = document.getElementById('dbStatus');
  appliedMigrationsDiv = document.getElementById('appliedMigrations');
  pendingMigrationsDiv = document.getElementById('pendingMigrations');
  rollbackForm = document.getElementById('rollbackForm');
  targetVersionInput = document.getElementById('targetVersion');
  outputLog = document.getElementById('outputLog');
}

function setupEventListeners() {
  rollbackForm.addEventListener('submit', handleRollback);
}

async function initializeApp() {
  try {
    // Initialize Tauri API
    tauri = window.__TAURI__;
    if (!tauri || !tauri.core) {
      throw new Error('Tauri API не доступен');
    }

    output('Инициализация системы миграций...');
    await refreshMigrations();
  } catch (error) {
    output('Ошибка инициализации: ' + error.message);
  }
}

async function refreshMigrations() {
  try {
    output('Обновление информации о миграциях...');

    // Get applied migrations
    const appliedMigrations = await tauri.core.invoke('get_applied_migrations');
    displayAppliedMigrations(appliedMigrations);

    // Get pending migrations
    const pendingMigrations = await tauri.core.invoke('get_pending_migrations');
    displayPendingMigrations(pendingMigrations);

    updateDatabaseStatus(appliedMigrations, pendingMigrations);
    output('Информация обновлена успешно');
  } catch (error) {
    output('Ошибка при обновлении: ' + error);
    dbStatus.innerHTML = `<span class="text-danger">Ошибка: ${error}</span>`;
  }
}

function displayAppliedMigrations(migrations) {
  if (migrations.length === 0) {
    appliedMigrationsDiv.innerHTML = '<p class="text-muted">Нет примененных миграций</p>';
    return;
  }

  let html = '<div class="table-responsive">';
  html += '<table class="table table-sm">';
  html += '<thead><tr><th>Версия</th><th>Описание</th><th>Применена</th></tr></thead>';
  html += '<tbody>';

  migrations.forEach(([version, description, appliedAt]) => {
    const date = new Date(appliedAt).toLocaleString('ru-RU');
    html += `<tr>
      <td><span class="badge bg-success">${version}</span></td>
      <td>${description}</td>
      <td><small class="text-muted">${date}</small></td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  appliedMigrationsDiv.innerHTML = html;
}

function displayPendingMigrations(migrations) {
  if (migrations.length === 0) {
    pendingMigrationsDiv.innerHTML = '<p class="text-success">Все миграции применены ✅</p>';
    return;
  }

  let html = '<div class="alert alert-info">';
  html += `<strong>Найдено ${migrations.length} ожидающих миграций:</strong></div>`;
  html += '<div class="table-responsive">';
  html += '<table class="table table-sm">';
  html += '<thead><tr><th>Версия</th><th>Описание</th></tr></thead>';
  html += '<tbody>';

  migrations.forEach(([version, description]) => {
    html += `<tr>
      <td><span class="badge bg-warning">${version}</span></td>
      <td>${description}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  html += '<div class="alert alert-warning">';
  html +=
    '<strong>Примечание:</strong> Перезапустите приложение для автоматического применения ожидающих миграций.';
  html += '</div>';

  pendingMigrationsDiv.innerHTML = html;
}

function updateDatabaseStatus(appliedMigrations, pendingMigrations) {
  const currentVersion =
    appliedMigrations.length > 0 ? Math.max(...appliedMigrations.map((m) => m[0])) : 0;

  let statusHtml = '<div class="row">';
  statusHtml += `<div class="col-md-4">
    <strong>Текущая версия:</strong><br>
    <span class="badge bg-primary fs-6">${currentVersion}</span>
  </div>`;

  statusHtml += `<div class="col-md-4">
    <strong>Примененных миграций:</strong><br>
    <span class="badge bg-success fs-6">${appliedMigrations.length}</span>
  </div>`;

  statusHtml += `<div class="col-md-4">
    <strong>Ожидающих миграций:</strong><br>
    <span class="badge bg-warning fs-6">${pendingMigrations.length}</span>
  </div>`;

  statusHtml += '</div>';

  dbStatus.innerHTML = statusHtml;
}

async function handleRollback(event) {
  event.preventDefault();

  const targetVersion = parseInt(targetVersionInput.value);
  if (isNaN(targetVersion) || targetVersion < 0) {
    output('Ошибка: Введите корректный номер версии');
    return;
  }

  if (
    !confirm(
      `Вы уверены, что хотите откатить базу данных к версии ${targetVersion}?\\n\\nЭто может привести к потере данных!`
    )
  ) {
    return;
  }

  try {
    output(`Выполняем откат к версии ${targetVersion}...`);
    const result = await tauri.core.invoke('rollback_migration', targetVersion);
    output('Откат выполнен: ' + result);

    // Refresh migrations info
    setTimeout(() => refreshMigrations(), 1000);
  } catch (error) {
    output('Ошибка при откате: ' + error);
  }
}

function output(message) {
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  outputLog.innerHTML += `[${timestamp}] ${message}<br>`;
  outputLog.scrollTop = outputLog.scrollHeight;
}

// Global functions for HTML onclick
window.refreshMigrations = refreshMigrations;
