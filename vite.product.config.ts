import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';

import {
  findForeignProductRouteContractKeys,
  projectProductAuthorizationRoutes,
} from './apps/dwp/src/components/product-application-artifact-policy.ts';
import { buildProductApplicationDescriptor } from './apps/dwp/src/components/product-application-descriptor.ts';
import { PRODUCT_PAGE_SHORTCUT_TARGET_CATALOG } from './apps/dwp/src/components/product-page-shortcut-target-catalog.ts';
import { GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES } from './apps/dwp/src/components/product-sensitive-query-prefixes.ts';
import { PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG } from './apps/dwp/src/components/product-surface-high-risk-command-catalog.ts';
import { DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES } from './apps/dwp/src/routes/draft-product-dynamic-page-routes.ts';
import {
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  PRODUCT_SURFACE_ROLLOUT_INVENTORY_REVISION,
} from './apps/dwp/src/routes/product-surface-authorization.generated.ts';
import type {
  ProductLegacyRouteSource,
  ProductPageRouteContractSource,
} from './apps/dwp/src/routes/product-route-contract-source.ts';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const productId = process.env.DWP_PRODUCT_ID;
if (!productId || !/^[a-z][a-z0-9-]*$/.test(productId)) {
  throw new Error('DWP_PRODUCT_ID must identify the product application being built.');
}

const routeExports: Record<string, [string, string]> = {
  workspace: ['workspace-application-routes.tsx', 'workspaceApplicationRoutes'],
  dwaion: ['dwaion-routes.tsx', 'dwaionRoutes'],
  hcm: ['hcm-routes.tsx', 'hcmRoutes'],
  approvals: ['approvals-routes.tsx', 'approvalsRoutes'],
  spaces: ['spaces-routes.tsx', 'spacesRoutes'],
  calendar: ['calendar-routes.tsx', 'calendarRoutes'],
  rooms: ['rooms-routes.tsx', 'roomsRoutes'],
  mail: ['mail-routes.tsx', 'mailRoutes'],
  messaging: ['messaging-routes.tsx', 'messagingRoutes'],
  meetings: ['meetings-routes.tsx', 'meetingsRoutes'],
  communications: ['communications-routes.tsx', 'communicationsRoutes'],
  services: ['services-routes.tsx', 'servicesRoutes'],
  administration: ['administration-routes.tsx', 'administrationRoutes'],
  provider: ['provider-routes.tsx', 'providerRoutes'],
  account: ['account-routes.tsx', 'accountRoutes'],
  'platform-shell': ['platform-routes.tsx', 'platformRoutes'],
};
const manifestExports: Record<string, [string, string][]> = {
  workspace: [['notifications/notification-product-manifest.ts', 'NOTIFICATION_PRODUCT_MANIFEST']],
  dwaion: [['dwaion/dwaion-product-manifest.ts', 'DWAION_SURFACE_MANIFEST']],
  hcm: [['hcm/hcm-product-manifest.ts', 'HCM_PRODUCT_MANIFEST']],
  approvals: [['approvals/approval-product-manifest.ts', 'APPROVAL_PRODUCT_MANIFEST']],
  spaces: [['spaces/space-product-manifest.ts', 'SPACE_PRODUCT_MANIFEST']],
  calendar: [['calendar/calendar-product-manifest.ts', 'CALENDAR_PRODUCT_MANIFEST']],
  rooms: [['rooms/workplace-product-manifest.ts', 'WORKPLACE_PRODUCT_MANIFEST']],
  mail: [['mail/mail-product-manifest.ts', 'MAIL_PRODUCT_MANIFEST']],
  messaging: [['messaging/messaging-product-manifest.ts', 'MESSAGING_PRODUCT_MANIFEST']],
  meetings: [['meetings/meetings-product-manifest.ts', 'MEETINGS_PRODUCT_MANIFEST']],
  communications: [
    ['communications/communications-product-manifest.ts', 'COMMUNICATIONS_PRODUCT_MANIFEST'],
  ],
  services: [['services/services-product-manifest.ts', 'SERVICES_PRODUCT_MANIFEST']],
};
const selectedRoute = routeExports[productId];
if (!selectedRoute) throw new Error(`No route module is registered for ${productId}.`);

const virtualRouteId = 'virtual:dwp-product-routes';
const resolvedVirtualRouteId = `\0${virtualRouteId}`;
const resolvedScopedLocaleLoaderId = '\0virtual:dwp-scoped-locale-resource-loader';
const resolvedScopedOfficialRoutesId = '\0virtual:dwp-scoped-official-product-page-route-contracts';
const resolvedScopedDraftRoutesId = '\0virtual:dwp-scoped-draft-product-dynamic-page-routes';
const resolvedScopedAuthorizationId = '\0virtual:dwp-scoped-product-surface-authorization';
const resolvedScopedHighRiskCatalogId = '\0virtual:dwp-scoped-product-high-risk-catalog';
const resolvedScopedShortcutCatalogId = '\0virtual:dwp-scoped-product-shortcut-catalog';
const resolvedScopedRouterSourceId = '\0virtual:dwp-scoped-product-page-router-source';
const productApplicationShellVirtualModuleIds = new Set([
  resolvedVirtualRouteId,
  resolvedScopedOfficialRoutesId,
  resolvedScopedDraftRoutesId,
  resolvedScopedAuthorizationId,
  resolvedScopedHighRiskCatalogId,
  resolvedScopedShortcutCatalogId,
  resolvedScopedRouterSourceId,
]);
const selectedRoutePath = path.join(workspaceRoot, 'apps/dwp/src/routes', selectedRoute[0]);
const architecture = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'architecture/frontend-apps.json'), 'utf8')
) as {
  applications: Array<{ id: string; features: string[] }>;
  platformFeatures: string[];
  governedProductSurfaces: Array<{
    productId: string;
    applicationId?: string;
    platformFeature?: string;
    routePrefix: `/${string}`;
  }>;
};
const routerSource = JSON.parse(
  fs.readFileSync(path.join(workspaceRoot, 'architecture/product-page-routes.v1.json'), 'utf8')
) as {
  pageRoutes: ProductPageRouteContractSource[];
  legacyRedirects: ProductLegacyRouteSource[];
};
const product = architecture.applications.find((candidate) => candidate.id === productId);
if (!product && productId !== 'platform-shell') {
  throw new Error(`No application ownership policy is registered for ${productId}.`);
}
const allowedFeatures = new Set([...architecture.platformFeatures, ...(product?.features ?? [])]);
const baseProductNamespaces = ['common', 'shell', 'auth', 'home', 'account', 'display'] as const;
const applicationNamespaces: Record<string, readonly string[]> = {
  workspace: ['homeStudio', 'work', 'composer', 'communications', 'notifications'],
  dwaion: ['work'],
  hcm: ['hcm', 'workforce'],
  approvals: ['approvals'],
  spaces: ['spaces'],
  calendar: ['calendar'],
  rooms: ['rooms'],
  mail: ['mail'],
  messaging: ['messaging'],
  meetings: ['meetings'],
  communications: ['communications'],
  services: ['services'],
  administration: ['admin'],
  provider: ['provider'],
  account: [],
  'platform-shell': [],
};
const selectedI18nNamespaces = [
  ...new Set([...baseProductNamespaces, ...(applicationNamespaces[productId] ?? [])]),
];
const globalRuntimeHosts: readonly ('notifications' | 'dwaion')[] =
  productId === 'workspace' ? ['notifications', 'dwaion'] : [];
const mountedProductIds = architecture.governedProductSurfaces
  .filter(
    (surface) =>
      surface.applicationId === productId ||
      (productId === 'workspace' && surface.platformFeature === 'notifications')
  )
  .map((surface) => surface.productId);
const productApplicationDescriptor = buildProductApplicationDescriptor({
  applicationId: productId,
  governedProducts: architecture.governedProductSurfaces,
  mountedProductIds,
  officialPageRoutes: routerSource.pageRoutes,
  legacyRoutes: routerSource.legacyRedirects,
  sensitiveQueryPrefixRegistry: GOVERNED_PRODUCT_LEGACY_QUERY_PREFIXES,
  globalGovernance: productId === 'workspace' || productId === 'administration',
  administration: productId === 'administration',
  includeGovernedContextAuthorization: productId === 'workspace',
  globalRuntimeHosts,
  i18nNamespaces: selectedI18nNamespaces,
});
const scopedAuthorizationRoutes = projectProductAuthorizationRoutes(
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  {
    productIds: productApplicationDescriptor.authorizationProductIds,
    includeGovernedContextRoutes: productApplicationDescriptor.includeGovernedContextAuthorization,
  }
);
const scopedDynamicDraftRoutes = DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES.filter((route) =>
  productApplicationDescriptor.manifestProductIds.includes(route.productId)
);
const scopedHighRiskCommandCatalog = PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG.filter((entry) =>
  productApplicationDescriptor.authorizationProductIds.includes(entry.productKey)
);
const scopedShortcutTargetCatalog = Object.fromEntries(
  Object.entries(PRODUCT_PAGE_SHORTCUT_TARGET_CATALOG).filter(([, target]) =>
    productApplicationDescriptor.authorizationProductIds.includes(target.productId)
  )
);
const scopedOfficialPageRoutes = routerSource.pageRoutes.filter((route) =>
  mountedProductIds.includes(route.productId)
);
const allowedPages: Record<string, string[]> = {
  workspace: ['home.tsx', 'work.tsx', 'activity.tsx', 'apps.tsx', 'notifications.tsx'],
  dwaion: ['dwaion.tsx'],
  hcm: ['hcm.tsx'],
  approvals: ['approvals.tsx'],
  spaces: ['spaces.tsx'],
  calendar: ['calendar.tsx'],
  rooms: ['rooms.tsx'],
  mail: ['mail.tsx'],
  messaging: ['messaging.tsx'],
  meetings: ['meetings.tsx'],
  communications: ['communications.tsx'],
  services: ['services.tsx'],
  administration: ['admin.tsx'],
  provider: ['provider.tsx', 'provider-tenant-experience-preview.tsx'],
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
  enforce: 'pre' as const,
  resolveId(id: string, importer?: string) {
    if (id === virtualRouteId) return resolvedVirtualRouteId;
    if (!importer) return undefined;
    const importerPath = importer.split('?')[0]!;
    const candidate = path.resolve(path.dirname(importerPath), id);
    const localeLoaderModulePath = path.join(
      workspaceRoot,
      'libs/shared-i18n/src/lib/locale-resource-loader.ts'
    );
    if (candidate === localeLoaderModulePath || `${candidate}.ts` === localeLoaderModulePath) {
      return resolvedScopedLocaleLoaderId;
    }
    const officialRouteModulePath = path.join(
      workspaceRoot,
      'apps/dwp/src/routes/official-product-page-route-contracts.ts'
    );
    if (candidate === officialRouteModulePath || `${candidate}.ts` === officialRouteModulePath) {
      return resolvedScopedOfficialRoutesId;
    }
    const draftRouteModulePath = path.join(
      workspaceRoot,
      'apps/dwp/src/routes/draft-product-dynamic-page-routes.ts'
    );
    if (candidate === draftRouteModulePath || `${candidate}.ts` === draftRouteModulePath) {
      return resolvedScopedDraftRoutesId;
    }
    const authorizationModulePath = path.join(
      workspaceRoot,
      'apps/dwp/src/routes/product-surface-authorization.generated.ts'
    );
    if (candidate === authorizationModulePath || `${candidate}.ts` === authorizationModulePath) {
      return resolvedScopedAuthorizationId;
    }
    const highRiskCatalogModulePath = path.join(
      workspaceRoot,
      'apps/dwp/src/components/product-surface-high-risk-command-catalog.ts'
    );
    if (
      candidate === highRiskCatalogModulePath ||
      `${candidate}.ts` === highRiskCatalogModulePath
    ) {
      return resolvedScopedHighRiskCatalogId;
    }
    const shortcutCatalogModulePath = path.join(
      workspaceRoot,
      'apps/dwp/src/components/product-page-shortcut-target-catalog.ts'
    );
    if (
      candidate === shortcutCatalogModulePath ||
      `${candidate}.ts` === shortcutCatalogModulePath
    ) {
      return resolvedScopedShortcutCatalogId;
    }
    const routerSourceModulePath = path.join(
      workspaceRoot,
      'architecture/product-page-routes.v1.json'
    );
    if (candidate === routerSourceModulePath) {
      return resolvedScopedRouterSourceId;
    }
    return undefined;
  },
  load(id: string) {
    if (id === resolvedScopedLocaleLoaderId) {
      const loaders = ['en', 'ko'].flatMap((language) =>
        selectedI18nNamespaces.map((namespace) => {
          const localePath = path.join(
            workspaceRoot,
            'libs/shared-i18n/src/locales',
            language,
            `${namespace}.json`
          );
          if (!fs.existsSync(localePath)) {
            throw new Error(`Missing product locale resource: ${language}/${namespace}.json`);
          }
          return `${JSON.stringify(`${language}:${namespace}`)}: () => import(${JSON.stringify(
            localePath
          )})`;
        })
      );
      return [
        `const localeLoaders = { ${loaders.join(', ')} };`,
        'export async function loadLocaleResource(lang, namespace) {',
        "  const language = lang.toLowerCase().split('-')[0];",
        '  const loader = localeLoaders[`${language}:${namespace}`];',
        '  if (!loader) throw new Error(`Locale resource is outside the application descriptor: ${lang}/${namespace}`);',
        '  const module = await loader();',
        '  return module.default;',
        '}',
      ].join('\n');
    }
    if (id === resolvedScopedOfficialRoutesId) {
      const routeContractSourcePath = path.join(
        workspaceRoot,
        'apps/dwp/src/routes/product-route-contract-source.ts'
      );
      return [
        `import { defineProductRouteContractSource } from ${JSON.stringify(routeContractSourcePath)};`,
        `export const OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE = defineProductRouteContractSource(${JSON.stringify(scopedOfficialPageRoutes)});`,
        'export const OFFICIAL_PRODUCT_IDS = Object.freeze([...new Set(OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.map((route) => route.productId))]);',
        'export function officialProductPageRelativePattern(routeContractKey, parentPath) {',
        '  const matches = OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) => route.routeContractKey === routeContractKey);',
        '  if (matches.length !== 1) throw new Error(`Official product PAGE route resolved ${matches.length} records: ${routeContractKey}`);',
        '  const route = matches[0];',
        "  const prefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;",
        '  if (!route.pattern.startsWith(prefix)) throw new Error(`Product PAGE route is outside Router parent ${parentPath}: ${routeContractKey}`);',
        '  return route.pattern.slice(prefix.length);',
        '}',
      ].join('\n');
    }
    if (id === resolvedScopedDraftRoutesId) {
      return `export const DYNAMIC_DRAFT_PRODUCT_PAGE_ROUTES = ${JSON.stringify(
        scopedDynamicDraftRoutes
      )};`;
    }
    if (id === resolvedScopedAuthorizationId) {
      return [
        `export const PRODUCT_AUTHORIZATION_REGISTRY_REVISION = ${JSON.stringify(
          PRODUCT_AUTHORIZATION_REGISTRY_REVISION
        )};`,
        `export const PRODUCT_SURFACE_ROLLOUT_INVENTORY_REVISION = ${JSON.stringify(
          PRODUCT_SURFACE_ROLLOUT_INVENTORY_REVISION
        )};`,
        `export const PRODUCT_SURFACE_ROLLOUT_PRODUCTS = ${JSON.stringify(
          productApplicationDescriptor.authorizationProductIds
        )};`,
        `export const PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS = ${JSON.stringify(
          scopedAuthorizationRoutes
        )};`,
        'export const PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter((route) => route.routeKind === "PAGE");',
      ].join('\n');
    }
    if (id === resolvedScopedHighRiskCatalogId) {
      return `export const PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG = ${JSON.stringify(
        scopedHighRiskCommandCatalog
      )};`;
    }
    if (id === resolvedScopedShortcutCatalogId) {
      return `export const PRODUCT_PAGE_SHORTCUT_TARGET_CATALOG = ${JSON.stringify(
        scopedShortcutTargetCatalog
      )};`;
    }
    if (id === resolvedScopedRouterSourceId) {
      return `export default ${JSON.stringify({
        ...routerSource,
        pageRoutes: productApplicationDescriptor.pageRoutes,
        legacyRedirects: productApplicationDescriptor.legacyRoutes,
      })};`;
    }
    if (id !== resolvedVirtualRouteId) return undefined;
    const manifests = (manifestExports[productId] ?? []).map(([file, exportName], index) => {
      const manifestPath = path.join(workspaceRoot, 'apps/dwp/src/features', file);
      return {
        importLine: `import { ${exportName} as productManifest${index} } from ${JSON.stringify(manifestPath)};`,
        localName: `productManifest${index}`,
      };
    });
    return [
      ...manifests.map((manifest) => manifest.importLine),
      `export { ${selectedRoute[1]} as productRoutes } from ${JSON.stringify(selectedRoutePath)};`,
      `export const productId = ${JSON.stringify(productId)};`,
      `export const productManifests = [${manifests.map((manifest) => manifest.localName).join(', ')}];`,
      `export const productApplicationDescriptor = ${JSON.stringify(productApplicationDescriptor)};`,
    ].join('\n');
  },
};

const productIsolationPlugin = {
  name: 'dwp-product-isolation',
  generateBundle(
    _options: unknown,
    bundle: Record<string, { type: string; code?: string; modules?: object }>
  ) {
    const violations = new Set<string>();
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') continue;
      for (const moduleId of Object.keys(output.modules ?? {})) {
        const normalized = moduleId.replaceAll('\\', '/');
        const feature = normalized.match(/\/apps\/dwp\/src\/features\/([^/]+)\//)?.[1];
        if (feature && !allowedFeatures.has(feature)) {
          violations.add(`feature ${feature}: ${normalized}`);
        }
        const localeNamespace = normalized.match(
          /\/libs\/shared-i18n\/src\/locales\/(?:en|ko)\/([^/.]+)\.json$/u
        )?.[1];
        if (localeNamespace && !selectedI18nNamespaces.includes(localeNamespace)) {
          violations.add(`locale namespace ${localeNamespace}: ${normalized}`);
        }
        if (
          !globalRuntimeHosts.includes('notifications') &&
          normalized.endsWith('/apps/dwp/src/components/notification-runtime-host.tsx')
        ) {
          violations.add(`global runtime notifications: ${normalized}`);
        }
        if (
          !globalRuntimeHosts.includes('dwaion') &&
          normalized.endsWith('/apps/dwp/src/components/dwaion-assistant/dwaion-global-host.tsx')
        ) {
          violations.add(`global runtime dwaion: ${normalized}`);
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
      for (const routeContractKey of findForeignProductRouteContractKeys(output.code ?? '', {
        productIds: productApplicationDescriptor.manifestProductIds,
        exactRouteContractKeys: [
          ...productApplicationDescriptor.pageRoutes.map((route) => route.routeContractKey),
          ...scopedAuthorizationRoutes.map((route) => route.routeContractKey),
          ...scopedDynamicDraftRoutes.map((route) => route.routeContractKey),
        ],
      })) {
        violations.add(`foreign route contract ${routeContractKey}`);
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
    define: {
      'import.meta.env.VITE_PRODUCT_NOTIFICATION_RUNTIME': JSON.stringify(
        globalRuntimeHosts.includes('notifications') ? 'enabled' : 'disabled'
      ),
      'import.meta.env.VITE_PRODUCT_DWAION_RUNTIME': JSON.stringify(
        globalRuntimeHosts.includes('dwaion') ? 'enabled' : 'disabled'
      ),
    },
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
      rollupOptions: {
        output: {
          codeSplitting: {
            minSize: 32 * 1024,
            groups: [
              {
                name: 'product-initial-vendor',
                test: (moduleId) =>
                  moduleId === resolvedScopedLocaleLoaderId || moduleId.includes('/node_modules/'),
                tags: ['$initial'],
                includeDependenciesRecursively: true,
                priority: 20,
              },
              {
                name: 'product-application-shell',
                test: (moduleId) =>
                  productApplicationShellVirtualModuleIds.has(moduleId) ||
                  (!moduleId.includes('/node_modules/') && !moduleId.startsWith('\0')) ||
                  moduleId.includes('dynamic_import_helper') ||
                  moduleId.includes('dynamic-import-helper'),
                tags: ['$initial'],
                includeDependenciesRecursively: false,
                maxSize: 450 * 1024,
                priority: 10,
              },
              ...(productId === 'meetings'
                ? [
                    {
                      name: 'meetings-livekit-runtime',
                      test: (moduleId: string) =>
                        moduleId.includes('/node_modules/livekit-client/'),
                      includeDependenciesRecursively: false,
                      priority: 5,
                    },
                  ]
                : []),
            ],
          },
        },
      },
    },
  };
});
