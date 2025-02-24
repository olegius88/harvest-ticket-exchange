// babel.config.js

module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // Плагины для поддержки декораторов и свойств классов
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
  ],
  // Переопределяем конфигурацию для файлов приложения,
  // чтобы плагин transform-inline-environment-variables не применялся к node_modules.
  overrides: [
    {
      test: ['./app/**/*'], // Убедитесь, что путь соответствует расположению ваших исходников
      plugins: ['transform-inline-environment-variables'],
    },
  ],
};
