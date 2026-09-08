import { defineConfig } from 'vite';
import applicationConfig from '../../vite.config';

// Parallel design reviewers must not rewrite one another's optimized React cache.
// All application aliases, security headers and feature flags remain canonical.
export default defineConfig(async (environment) => ({
  ...(await applicationConfig(environment)),
  cacheDir: `node_modules/.vite/meeting-review-${process.env.DWP_FRONTEND_DEV_PORT ?? '4470'}`,
}));
