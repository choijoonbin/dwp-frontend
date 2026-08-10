import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, '../..');

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      '@dwp-frontend/shared-i18n': path.join(projectRoot, 'src/index.ts'),
      '@dwp-frontend/shared-i18n/*': path.join(projectRoot, 'src'),
      '@dwp-frontend/shared-utils': path.join(workspaceRoot, 'libs/shared-utils/src/index.ts'),
      '@dwp-frontend/shared-utils/*': path.join(workspaceRoot, 'libs/shared-utils/src'),
    },
  },
  test: {
    name: 'shared-i18n',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
