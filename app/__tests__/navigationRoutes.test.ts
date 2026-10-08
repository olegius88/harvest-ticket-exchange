/**
 * Регрессионный тест: каждый экран, на который код делает navigate('...'), должен быть
 * зарегистрирован в стеке навигации App.tsx.
 *
 * Баг: VoditelTicketDetailAfterSetWeight по кнопке «Просмотреть» после взвешивания вызывал
 * navigate('VoditelTicketDetailAfterWeighingScreen'), а такого экрана никогда не было ни в
 * App.tsx, ни в RootStackParamList. В рантайме React Navigation не обрабатывает такой переход
 * («The action 'NAVIGATE' ... was not handled»), и кнопка ничего не делает.
 * Почему не всплыл раньше: ветка срабатывает только после события взвешивания от весовой,
 * то есть на живом обмене двух устройств; tsc ловил ошибку, но typecheck не входил в обязательные
 * проверки.
 * Что гарантируется: тест падает, если любой литерал navigate/push/replace в коде приложения
 * ссылается на имя экрана, которого нет среди <Stack.Screen name="..."> в App.tsx.
 */
import fs from 'fs';
import path from 'path';

const APP_DIR = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['pages', 'components', 'services', 'stores', 'hooks', 'views', 'wifi', 'utils'];

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(full);
    }
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });
}

function registeredScreens(): Set<string> {
  const appSource = fs.readFileSync(path.join(APP_DIR, 'App.tsx'), 'utf8');
  const names = [...appSource.matchAll(/<Stack\.Screen\s+name="([A-Za-z]+)"/g)].map((m) => m[1]);
  return new Set(names);
}

describe('navigation routes', () => {
  it('every navigate() target is registered in App.tsx', () => {
    const screens = registeredScreens();
    expect(screens.size).toBeGreaterThan(0);

    const files = [
      path.join(APP_DIR, 'App.tsx'),
      ...SOURCE_DIRS.flatMap((d) => collectSourceFiles(path.join(APP_DIR, d))),
    ];
    const unknown: string[] = [];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\.(?:navigate|push|replace)\(\s*'([A-Za-z]+)'/g)) {
        if (!screens.has(match[1])) {
          unknown.push(`${path.relative(APP_DIR, file)} -> ${match[1]}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});
