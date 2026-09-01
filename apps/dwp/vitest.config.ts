import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineProject } from 'vitest/config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, '../..');

export default defineProject({
  root: projectRoot,
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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
