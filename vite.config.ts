import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(workspaceRoot, 'apps/dwp');
const configuredDevelopmentPort = Number(process.env.DWP_FRONTEND_DEV_PORT ?? 4200);
const developmentPort =
  Number.isSafeInteger(configuredDevelopmentPort) &&
  configuredDevelopmentPort >= 1024 &&
  configuredDevelopmentPort <= 65_535
    ? configuredDevelopmentPort
    : 4200;
const trustedHttpOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : '';
  } catch {
    return '';
  }
};

const securityHeaders = (development = false, apiOrigin = '') => {
  const trustedApiSource = apiOrigin ? ` ${apiOrigin}` : '';
  return {
    'Content-Security-Policy':
      `default-src 'self'; script-src 'self'${development ? " 'unsafe-inline'" : ''}; ` +
      "style-src 'self' 'unsafe-inline'; " +
      `img-src 'self' data: blob:${trustedApiSource}; font-src 'self' data:; ` +
      `connect-src 'self' ws:${trustedApiSource}; ` +
      "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
};

const packagePath = (moduleId: string, packageName: string) =>
  moduleId.includes(`/node_modules/${packageName}/`) ||
  moduleId.includes(`/node_modules/.pnpm/${packageName.replace('/', '+')}@`);

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';
  const apiOrigin = trustedHttpOrigin(process.env.VITE_API_URL || env.VITE_API_URL || proxyTarget);
  const runningTests = mode === 'test' || Boolean(process.env.VITEST);

  return {
    root: appRoot,
    publicDir: path.join(workspaceRoot, 'public'),
    cacheDir: path.join(workspaceRoot, 'node_modules/.vite/dwp'),
    plugins: [
      react(),
      !runningTests &&
        command === 'serve' &&
        checker({
          typescript: true,
          eslint: {
            useFlatConfig: true,
            lintCommand: `eslint --no-error-on-unmatched-pattern "${path.join(workspaceRoot, 'apps')}/**/*.{js,jsx,ts,tsx}" "${path.join(workspaceRoot, 'libs')}/**/*.{js,jsx,ts,tsx}"`,
            dev: { logLevel: ['error'] },
          },
          overlay: { position: 'tl', initialIsOpen: false },
        }),
    ].filter(Boolean),
    resolve: {
      dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
      alias: {
        '@dwp-frontend/design-system': path.join(workspaceRoot, 'libs/design-system/src'),
        '@dwp-frontend/shared-utils': path.join(workspaceRoot, 'libs/shared-utils/src'),
        '@dwp-frontend/shared-i18n': path.join(workspaceRoot, 'libs/shared-i18n/src'),
        '@dwp-frontend/api-contracts': path.join(workspaceRoot, 'libs/api-contracts/src'),
      },
    },
    optimizeDeps: { include: ['i18next', 'react-i18next', 'i18next-resources-to-backend'] },
    server: {
      host: true,
      port: developmentPort,
      headers: securityHeaders(true, apiOrigin),
      fs: { allow: [workspaceRoot] },
      proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    preview: {
      host: true,
      port: developmentPort,
      headers: securityHeaders(false, apiOrigin),
      proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    build: {
      manifest: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          codeSplitting: {
            minSize: 50 * 1024,
            groups: [
              {
                name: 'vendor-mui-x-grid',
                test: (moduleId) =>
                  packagePath(moduleId, '@mui/x-data-grid') ||
                  packagePath(moduleId, '@mui/x-virtualizer'),
                includeDependenciesRecursively: false,
                priority: 30,
              },
              {
                name: 'vendor-mui-x-date',
                test: (moduleId) => packagePath(moduleId, '@mui/x-date-pickers'),
                includeDependenciesRecursively: false,
                priority: 30,
              },
              {
                name: 'vendor-mui-x-shared',
                test: (moduleId) => packagePath(moduleId, '@mui/x-internals'),
                includeDependenciesRecursively: false,
                minSize: 0,
                priority: 30,
              },
              {
                name: 'initial-vendor',
                test: (moduleId) => moduleId.includes('/node_modules/'),
                tags: ['$initial'],
                includeDependenciesRecursively: true,
                priority: 20,
              },
              {
                name: 'async-vendor',
                test: (moduleId) => moduleId.includes('/node_modules/'),
                entriesAware: true,
                entriesAwareMergeThreshold: 30 * 1024,
                includeDependenciesRecursively: false,
                minSize: 0,
                maxSize: 430 * 1024,
                priority: 15,
              },
              {
                name: 'application-shell',
                test: (moduleId) =>
                  (!moduleId.includes('/node_modules/') && !moduleId.startsWith('\0')) ||
                  moduleId.includes('dynamic_import_helper') ||
                  moduleId.includes('dynamic-import-helper'),
                tags: ['$initial'],
                includeDependenciesRecursively: false,
                maxSize: 430 * 1024,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{vite,vitest,eslint,prettier}.config.*',
        'docs/**',
      ],
    },
  };
});
