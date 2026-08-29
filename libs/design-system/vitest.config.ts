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
        find: /^@dwp-frontend\/design-system\/(.+)$/,
        replacement: path.join(projectRoot, 'src/$1'),
      },
      {
        find: '@dwp-frontend/design-system',
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
    name: 'design-system',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
