import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineProject } from 'vitest/config';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineProject({
  resolve: {
    alias: {
      '@dwp-frontend/design-system': path.join(workspaceRoot, 'libs/design-system/src'),
      '@dwp-frontend/shared-i18n': path.join(workspaceRoot, 'libs/shared-i18n/src'),
      '@dwp-frontend/shared-utils': path.join(workspaceRoot, 'libs/shared-utils/src'),
    },
  },
  test: {
    name: 'dwp-app',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
