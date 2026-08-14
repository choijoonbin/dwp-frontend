import path from 'node:path';
import { defineConfig } from 'vitest/config';

const projectRoot = import.meta.dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      '@dwp-frontend/shared-utils': path.join(projectRoot, 'src/index.ts'),
      '@dwp-frontend/shared-utils/*': path.join(projectRoot, 'src'),
      '@dwp-frontend/design-system': path.join(workspaceRoot, 'libs/design-system/src/index.ts'),
      '@dwp-frontend/design-system/*': path.join(workspaceRoot, 'libs/design-system/src'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: false,
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
