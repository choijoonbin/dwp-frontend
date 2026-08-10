import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'dwp-app',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
