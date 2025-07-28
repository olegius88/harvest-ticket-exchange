// Скрипт для открытия папки с результатами сборки
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const bundleDir = path.join(__dirname, '..', '..', '..', 'desktop', 'target', 'release', 'bundle');

// Проверяем существование папки
if (!fs.existsSync(bundleDir)) {
  console.log('❌ Папка с результатами сборки не найдена:', bundleDir);
  console.log('💡 Сначала выполните сборку приложения командой: npm run build:desktop');
  process.exit(1);
}

// Открываем папку в проводнике Windows
const command =
  process.platform === 'win32'
    ? `start "" "${bundleDir}"`
    : process.platform === 'darwin'
      ? `open "${bundleDir}"`
      : `xdg-open "${bundleDir}"`;

exec(command, (error) => {
  if (error) {
    console.error('❌ Ошибка при открытии папки:', error);
    console.log('📁 Путь к результатам сборки:', bundleDir);
  } else {
    console.log('📂 Открыта папка с результатами сборки:', bundleDir);
  }
});
