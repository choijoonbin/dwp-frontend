import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

const sourceFiles = ['**/*.{js,jsx,mjs,cjs,ts,tsx}'];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '**/playwright-report/**',
      '**/playwright-report-*/**',
      '**/test-results/**',
      '**/test-results-*/**',
      '**/artifacts/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  {
    files: sourceFiles,
    plugins: {
      'react-hooks': reactHooks,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-key': 'error',
      'react/self-closing-comp': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'class-variance-authority',
              message: 'Use MUI variants and the DWP token contract.',
            },
            {
              name: 'tailwind-merge',
              message: 'Use MUI style APIs and the DWP token contract.',
            },
          ],
          patterns: [
            {
              group: ['@radix-ui/*', '**/components/ui/**'],
              message: 'Use approved DWP design-system components.',
            },
          ],
        },
      ],
    },
  },
];
