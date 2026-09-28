// eslint.config.ts
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import unicornPlugin from 'eslint-plugin-unicorn';

const config = [
  {
    ignores: [
      'apps/test-manager/backend/functions/lib/**',
      'node_modules/**',
      '**/out/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/_data/**',
      '**/firebase-export-*/**',
      'tsconfig.json',
      'README.md',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}', '!**/coverage/**'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
      unicorn: unicornPlugin,
      import: importPlugin,
    },
    rules: {
      'eslint:all': 'off',
      'unicorn/filename-case': [
        'error',
        {
          cases: {
            camelCase: true,
            pascalCase: true,
          },
        },
      ],
      'no-unused-disable-directive': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];

export default config;