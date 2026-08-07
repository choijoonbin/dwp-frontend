import path from 'path';
import { defineConfig } from 'vitest/config';

const projectRoot = path.resolve(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');

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
