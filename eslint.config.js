// Flat ESLint config for the Expo / React Native app.
// Run with `npm run lint`. Uses Expo's shared config (eslint-config-expo).
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/*',
      'dist/*',
      '.expo/*',
      '.expo-export-check/*',
      'web/*',
      'server/*',
      'reference/*',
      'assets/*',
      '*.config.js',
      'tsconfig.tsbuildinfo',
    ],
  },
];
