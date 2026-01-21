import path from 'path';
import { loadEnv, defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

import packageJson from '../../../package.json';

// ----------------------------------------------------------------------

// Remote apps use 4204 (4200 host, 4201 mail, 4204 admin)
const PORT = 4204;

export default defineConfig(({ mode }) => {
  // Load env files from workspace root (not from apps/remotes/admin)
  const workspaceRoot = path.resolve(__dirname, '../../../');
  const env = loadEnv(mode, workspaceRoot, '');

  return {
    root: path.resolve(__dirname),
    publicDir: path.resolve(__dirname, '../../../public'),
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      'process.env.NX_API_URL': JSON.stringify(env.NX_API_URL ?? 'http://localhost:8080'),
    },
    resolve: {
      alias: [
        {
          find: /^@admin\/(.*)$/,
          replacement: path.resolve(__dirname, './src/$1'),
        },
        {
          find: /^@dwp-frontend\/design-system(.*)$/,
          replacement: path.resolve(__dirname, '../../../libs/design-system/src$1'),
        },
        {
          find: /^@dwp-frontend\/shared-utils(.*)$/,
          replacement: path.resolve(__dirname, '../../../libs/shared-utils/src$1'),
        },
      ],
    },
    server: { port: PORT, host: true },
    preview: { port: PORT, host: true },
  };
});
