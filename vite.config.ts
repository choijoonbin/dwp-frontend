import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(workspaceRoot, 'apps/dwp');
const developmentPort = 4200;

function vendorGroup(moduleId: string): string | undefined {
  if (!moduleId.includes('/node_modules/')) return undefined;
  if (
    /\/(react|react-dom|react-router|scheduler|react-i18next)\//.test(moduleId) ||
    moduleId.includes('/@emotion/') ||
    /\/(@tanstack|zustand)\//.test(moduleId)
  ) {
    return 'vendor-react';
  }
  if (moduleId.includes('/lucide-react/')) return 'vendor-icons';
  if (/\/i18next\//.test(moduleId)) return 'vendor-i18n';
  return undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';
  const runningTests = mode === 'test' || Boolean(process.env.VITEST);

  return {
    root: appRoot,
    publicDir: path.join(workspaceRoot, 'public'),
    cacheDir: path.join(workspaceRoot, 'node_modules/.vite/dwp'),
    plugins: [
      react(),
      !runningTests &&
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
      },
    },
    optimizeDeps: { include: ['i18next', 'react-i18next', 'i18next-resources-to-backend'] },
    server: {
      host: true,
      port: developmentPort,
      fs: { allow: [workspaceRoot] },
      proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    preview: {
      host: true,
      port: developmentPort,
      proxy: { '/api': { target: proxyTarget, changeOrigin: true } },
    },
    build: {
      manifest: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: { manualChunks: vendorGroup },
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
