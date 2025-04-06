// Файл: scripts/incrementVersion.js
// Этот скрипт читает файл app/android/app/build.gradle, находит строку с versionName "x.y.z",
// увеличивает последнюю цифру (z) на 1 и сохраняет изменения обратно в файл.

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'node:path';
import * as fs from 'node:fs';

// Определяем __filename и __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Current directory:', __dirname);

// Определяем путь к файлу build.gradle
const buildGradlePath = path.join(__dirname, './build.gradle');

// Читаем содержимое файла build.gradle
fs.readFile(buildGradlePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Ошибка при чтении файла build.gradle:', err);
    process.exit(1);
  }

  // Регулярное выражение для поиска строки versionName "x.y.z"
  const regex = /versionName\s+"(\d+\.\d+\.(\d+))"/;
  const match = data.match(regex);

  if (!match) {
    console.error('Не удалось найти versionName в файле build.gradle');
    process.exit(1);
  }

  const fullVersion = match[1]; // например, "1.5.0"
  const lastDigitStr = match[2]; // например, "0"
  const lastDigit = parseInt(lastDigitStr, 10);
  const newLastDigit = lastDigit + 1;
  // Заменяем последнюю цифру версии на новую
  const newVersion = fullVersion.replace(/\d+$/, newLastDigit.toString());

  console.log(`Старая версия: ${fullVersion}`);
  console.log(`Новая версия: ${newVersion}`);

  // Обновляем версию в файле
  const updatedData = data.replace(regex, `versionName "${newVersion}"`);

  // Записываем обновленные данные обратно в build.gradle
  fs.writeFile(buildGradlePath, updatedData, 'utf8', (err) => {
    if (err) {
      console.error('Ошибка при записи файла build.gradle:', err);
      process.exit(1);
    }
    console.log('Версия успешно обновлена в build.gradle');
    process.exit(0);
  });
});
