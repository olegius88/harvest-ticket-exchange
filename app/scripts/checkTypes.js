/**
 * Скрипт для проверки типов TypeScript
 */
const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue('Проверка типизации TypeScript...'));

try {
  execSync('tsc --noEmit', { stdio: 'inherit' });
  console.log(chalk.green('✓ Проверка типов успешно пройдена'));
} catch (error) {
  console.error(chalk.red('✗ Обнаружены ошибки типизации'));
  process.exit(1); // Завершаем процесс с ошибкой
}
