import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// ----------------------------------------------------------------------

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../../../'), '');

  return {
    // [PORT_PLACEHOLDER] - 생성 시 자동으로 할당됨
    server: {
      port: 4299,
      host: true,
    },
    plugins: [react()],
    define: {
      'process.env.NX_API_URL': JSON.stringify(env.NX_API_URL || 'http://localhost:8080'),
    },
    resolve: {
      alias: {
        '@dwp-frontend/design-system': path.resolve(__dirname, '../../../libs/design-system/src'),
        '@dwp-frontend/shared-utils': path.resolve(__dirname, '../../../libs/shared-utils/src'),
        'src': path.resolve(__dirname, './src'),
      },
    },
  };
});
