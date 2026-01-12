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

  return {
    root: path.resolve(__dirname, 'apps/dwp'),
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [
      react(),
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
    ],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      'process.env.NX_API_URL': JSON.stringify(env.NX_API_URL ?? 'http://localhost:8080'),
    },
    resolve: {
      alias: [
        // Keep existing Minimal UI imports working, but resolve shared parts from libs.
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
