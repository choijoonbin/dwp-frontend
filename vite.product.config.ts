import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const productId = process.env.DWP_PRODUCT_ID;
if (!productId || !/^[a-z][a-z0-9-]*$/.test(productId)) {
  throw new Error('DWP_PRODUCT_ID must identify the product application being built.');
}

const routeExports: Record<string, [string, string]> = {
  workspace: ['workspace-routes.tsx', 'workspaceRoutes'],
  dwaion: ['dwaion-routes.tsx', 'dwaionRoutes'],
  hcm: ['hcm-routes.tsx', 'hcmRoutes'],
  approvals: ['approvals-routes.tsx', 'approvalsRoutes'],
  spaces: ['spaces-routes.tsx', 'spacesRoutes'],
  calendar: ['calendar-routes.tsx', 'calendarRoutes'],
  rooms: ['rooms-routes.tsx', 'roomsRoutes'],
  mail: ['mail-routes.tsx', 'mailRoutes'],
  messaging: ['messaging-routes.tsx', 'messagingRoutes'],
  communications: ['communications-routes.tsx', 'communicationsRoutes'],
  services: ['services-routes.tsx', 'servicesRoutes'],
  administration: ['administration-routes.tsx', 'administrationRoutes'],
  provider: ['provider-routes.tsx', 'providerRoutes'],
  account: ['account-routes.tsx', 'accountRoutes'],
  'platform-shell': ['platform-routes.tsx', 'platformRoutes'],
};
const selectedRoute = routeExports[productId];
if (!selectedRoute) throw new Error(`No route module is registered for ${productId}.`);

const virtualRouteId = 'virtual:dwp-product-routes';
const resolvedVirtualRouteId = `\0${virtualRouteId}`;
const selectedRoutePath = path.join(workspaceRoot, 'apps/dwp/src/routes', selectedRoute[0]);
const architecture = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'architecture/frontend-apps.json'), 'utf8')
) as {
  applications: Array<{ id: string; features: string[] }>;
  platformFeatures: string[];
};
const product = architecture.applications.find((candidate) => candidate.id === productId);
if (!product && productId !== 'platform-shell') {
  throw new Error(`No application ownership policy is registered for ${productId}.`);
}
const allowedFeatures = new Set([...architecture.platformFeatures, ...(product?.features ?? [])]);
const allowedPages: Record<string, string[]> = {
  workspace: ['home.tsx', 'work.tsx', 'activity.tsx', 'apps.tsx'],
  dwaion: ['dwaion.tsx'],
  hcm: ['hcm.tsx'],
  approvals: ['approvals.tsx'],
  spaces: ['spaces.tsx'],
  calendar: ['calendar.tsx'],
  rooms: ['rooms.tsx'],
  mail: ['mail.tsx'],
  messaging: ['messaging.tsx'],
  communications: ['communications.tsx'],
  services: ['services.tsx'],
  administration: ['admin.tsx'],
  provider: ['provider.tsx'],
  account: ['account/'],
  'platform-shell': [
    'sign-in.tsx',
    'auth/',
    'page-403.tsx',
    'page-not-found.tsx',
    'status-page.tsx',
  ],
};

const productRoutePlugin = {
  name: 'dwp-product-route',
  resolveId(id: string) {
    return id === virtualRouteId ? resolvedVirtualRouteId : undefined;
  },
  load(id: string) {
    if (id !== resolvedVirtualRouteId) return undefined;
    return [
      `export { ${selectedRoute[1]} as productRoutes } from ${JSON.stringify(selectedRoutePath)};`,
      `export const productId = ${JSON.stringify(productId)};`,
    ].join('\n');
  },
};

const productIsolationPlugin = {
  name: 'dwp-product-isolation',
  generateBundle(_options: unknown, bundle: Record<string, { type: string; modules?: object }>) {
    const violations = new Set<string>();
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') continue;
      for (const moduleId of Object.keys(output.modules ?? {})) {
        const normalized = moduleId.replaceAll('\\', '/');
        const feature = normalized.match(/\/apps\/dwp\/src\/features\/([^/]+)\//)?.[1];
        if (feature && !allowedFeatures.has(feature)) {
          violations.add(`feature ${feature}: ${normalized}`);
        }
        const page = normalized.split('/apps/dwp/src/pages/')[1];
        if (
          page &&
          !(allowedPages[productId] ?? []).some(
            (allowed) => page === allowed || (allowed.endsWith('/') && page.startsWith(allowed))
          )
        ) {
          violations.add(`page ${page}: ${normalized}`);
        }
      }
    }
    if (violations.size > 0) {
      throw new Error(
        `Product ${productId} contains code owned by another application:\n${[...violations].join('\n')}`
      );
    }
  },
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  return {
    base: `/assets/dwp/${productId}/`,
    root: path.join(workspaceRoot, 'apps/product-runtime'),
    publicDir: path.join(workspaceRoot, 'public'),
    cacheDir: path.join(workspaceRoot, `node_modules/.vite/${productId}`),
    plugins: [productRoutePlugin, react(), productIsolationPlugin],
    resolve: {
      dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled'],
      alias: {
        '@dwp-frontend/design-system': path.join(workspaceRoot, 'libs/design-system/src'),
        '@dwp-frontend/shared-utils': path.join(workspaceRoot, 'libs/shared-utils/src'),
        '@dwp-frontend/shared-i18n': path.join(workspaceRoot, 'libs/shared-i18n/src'),
        '@dwp-frontend/api-contracts': path.join(workspaceRoot, 'libs/api-contracts/src'),
      },
    },
    server: {
      host: true,
      port: Number(env.DWP_PRODUCT_PORT || 4300),
      fs: { allow: [workspaceRoot] },
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: path.join(workspaceRoot, 'dist/apps', productId),
      emptyOutDir: true,
      manifest: true,
      chunkSizeWarningLimit: 750,
    },
  };
});
