import path from 'path';
import checker from 'vite-plugin-checker';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// ----------------------------------------------------------------------

const PORT = 4200;

const getVendorChunk = (id: string): string | undefined => {
  if (!id.includes('/node_modules/')) return undefined;
  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('/react-router') ||
    id.includes('/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (id.includes('/@emotion/')) return 'vendor-emotion';
  if (id.includes('/@iconify/')) return 'vendor-icons';
  if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'vendor-i18n';
  if (id.includes('/@tanstack/') || id.includes('/zustand/')) return 'vendor-state';
  return undefined;
};

export default defineConfig(({ mode }) => {
  const isTest = Boolean(process.env.VITEST) || mode === 'test';

  return {
    root: path.resolve(__dirname, 'apps/dwp'),
    cacheDir: path.resolve(__dirname, 'node_modules/.vite/apps-dwp'),
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [
      react(),
      !isTest &&
        checker({
          typescript: true,
          eslint: {
            useFlatConfig: true,
            lintCommand:
              'eslint --no-error-on-unmatched-pattern "../../apps/**/*.{js,jsx,ts,tsx}" "../../libs/**/*.{js,jsx,ts,tsx}"',
            dev: { logLevel: ['error'] },
          },
          overlay: {
            position: 'tl',
            initialIsOpen: false,
          },
        }),
    ].filter(Boolean),
    optimizeDeps: {
      include: ['i18next', 'react-i18next', 'i18next-resources-to-backend'],
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: getVendorChunk,
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
    resolve: {
      alias: [
        {
          find: /^@dwp-frontend\/design-system(.*)$/,
          replacement: path.resolve(__dirname, 'libs/design-system/src$1'),
        },
        {
          find: /^@dwp-frontend\/shared-utils(.*)$/,
          replacement: path.resolve(__dirname, 'libs/shared-utils/src$1'),
        },
        {
          find: /^@dwp-frontend\/shared-i18n(.*)$/,
          replacement: path.resolve(__dirname, 'libs/shared-i18n/src$1'),
        },
      ],
    },
    server: {
      port: PORT,
      host: true,
      fs: { allow: [__dirname] },
    },
    preview: { port: PORT, host: true },
  };
});
