// Скрипт для инкремента версии приложения
const fs = require('fs');
const path = require('path');

// Читаем package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Читаем tauri.conf.json
const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

// Инкрементируем версию
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// Инкрементируем патч-версию
versionParts[2] += 1;
const newVersion = versionParts.join('.');

// Обновляем package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// Обновляем tauri.conf.json
tauriConf.version = newVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2));

console.log(`✅ Версия обновлена: ${currentVersion} → ${newVersion}`);
console.log(`📦 package.json: ${newVersion}`);
console.log(`🦀 tauri.conf.json: ${newVersion}`);
