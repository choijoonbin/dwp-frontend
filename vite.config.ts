import path from 'path';
import checker from 'vite-plugin-checker';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';

import packageJson from './package.json';

// ----------------------------------------------------------------------

// Host (apps/dwp) default port
const PORT = 4200;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const isTest = Boolean(process.env.VITEST) || mode === 'test';

  return {
    root: path.resolve(__dirname, 'apps/dwp'),
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [
      react(),
      !isTest &&
        checker({
          typescript: true,
          eslint: {
            useFlatConfig: true,
            // NOTE: Vite root is `apps/dwp`, so lint paths must be workspace-root relative.
            // Also avoid crashing dev server if a glob doesn't match.
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
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      'process.env.NX_API_URL': JSON.stringify(env.NX_API_URL ?? 'http://localhost:8080'),
    },
    test: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
        'docs/**',
        'docs/_wip/**',
        '**/docs/backend-src/**',
        '**/docs/frontend-src/**',
      ],
    },
    resolve: {
      alias: [
        // Resolve src/theme, src/components to design-system (no external template dependency).
        {
          find: /^src\/theme(.*)$/,
          replacement: path.resolve(__dirname, 'libs/design-system/src/theme$1'),
        },
        {
          find: /^src\/components(.*)$/,
          replacement: path.resolve(__dirname, 'libs/design-system/src/components$1'),
        },
        {
          find: /^src\/routes\/hooks(.*)$/,
          replacement: path.resolve(__dirname, 'libs/design-system/src/hooks/router$1'),
        },
        // Default src alias -> apps/dwp
        {
          find: /^src(.*)$/,
          replacement: path.resolve(__dirname, 'apps/dwp/src$1'),
        },
        // Preferred workspace imports
        {
          find: /^@dwp-frontend\/design-system(.*)$/,
          replacement: path.resolve(__dirname, 'libs/design-system/src$1'),
        },
        {
          find: /^@dwp-frontend\/shared-utils(.*)$/,
          replacement: path.resolve(__dirname, 'libs/shared-utils/src$1'),
        },
      ],
    },
    server: { port: PORT, host: true },
    preview: { port: PORT, host: true },
  };
});
