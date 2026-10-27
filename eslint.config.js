// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      'web-build/**',
      '.expo/**',
      'coverage/**',
      'backend-updates/**',
      'docs/**',
      '.aws/**',
      'src/config.ts',
      'expo-env.d.ts',
      'ios/**',
      'android/**',
    ],
  },
]);
