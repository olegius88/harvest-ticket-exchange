// copyStatic.js
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import path from 'path';

// Получаем эквивалент __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пути для копирования
const srcDir = path.resolve(__dirname, 'front/dist');
const destDir = path.resolve(__dirname, 'app/android/app/src/main/assets/web');

async function copyStaticFiles() {
  try {
    // Копируем файлы из front/dist в destDir
    await fs.copy(srcDir, destDir);
    console.log('✅ Статика успешно скопирована!');

    // Путь к index.html в директории назначения
    const indexFile = path.join(destDir, 'index.html');

    // Читаем содержимое index.html
    let htmlContent = await fs.readFile(indexFile, 'utf8');

    // Заменяем src="/main.bundle.js" на src="./main.bundle.js"
    htmlContent = htmlContent.replace(/src="\/main\.bundle\.js"/g, 'src="./main.bundle.js"');

    // Записываем обновлённое содержимое обратно в index.html
    await fs.writeFile(indexFile, htmlContent, 'utf8');
    console.log('✅ index.html успешно обновлен!');
  } catch (error) {
    console.error('❌ Ошибка копирования или обновления index.html:', error);
    process.exit(1);
  }
}

copyStaticFiles();
