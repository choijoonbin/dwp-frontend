import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/dwp/vitest.config.ts',
      'libs/shared-utils/vitest.config.ts',
      'libs/design-system/vitest.config.ts',
    ],
  },
});
