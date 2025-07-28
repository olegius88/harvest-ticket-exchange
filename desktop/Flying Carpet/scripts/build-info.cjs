// Скрипт для отображения информации о сборке
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const bundleDir = path.join(__dirname, '..', '..', '..', 'desktop', 'target', 'release', 'bundle');

console.log('\n🚀 ===========================================');
console.log('📦 СБОРКА DESKTOP ПРИЛОЖЕНИЯ');
console.log('============================================');
console.log(`📋 Название: ${packageJson.name}`);
console.log(`🔢 Версия: ${packageJson.version}`);
console.log(`📅 Дата: ${new Date().toLocaleString('ru-RU')}`);
console.log('============================================');

if (fs.existsSync(bundleDir)) {
  console.log('📁 Результаты сборки:');

  // Ищем файлы сборки
  const findFiles = (dir, extensions) => {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...findFiles(fullPath, extensions));
      } else if (extensions.some((ext) => item.name.endsWith(ext))) {
        const stats = fs.statSync(fullPath);
        files.push({
          path: fullPath,
          name: item.name,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
        });
      }
    }
    return files;
  };

  const exeFiles = findFiles(bundleDir, ['.exe', '.msi']);

  if (exeFiles.length > 0) {
    exeFiles.forEach((file) => {
      console.log(`   📦 ${file.name} (${file.size})`);
    });
  } else {
    console.log('   ⚠️ Исполняемые файлы не найдены');
  }

  console.log(`📂 Папка: ${bundleDir}`);
} else {
  console.log('❌ Результаты сборки не найдены');
}

console.log('============================================\n');
