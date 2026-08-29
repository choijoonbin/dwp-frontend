import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, '../..');

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: [
      {
        find: /^@dwp-frontend\/shared-i18n\/(.+)$/,
        replacement: path.join(projectRoot, 'src/$1'),
      },
      {
        find: '@dwp-frontend/shared-i18n',
        replacement: path.join(projectRoot, 'src/index.ts'),
      },
      {
        find: /^@dwp-frontend\/shared-utils\/(.+)$/,
        replacement: path.join(workspaceRoot, 'libs/shared-utils/src/$1'),
      },
      {
        find: '@dwp-frontend/shared-utils',
        replacement: path.join(workspaceRoot, 'libs/shared-utils/src/index.ts'),
      },
    ],
  },
  test: {
    name: 'shared-i18n',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
