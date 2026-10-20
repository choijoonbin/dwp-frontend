import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthGuard } from '@dwp-frontend/shared-utils/auth/auth-guard';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';

import { mapLegacyHrPath } from '../features/hcm/hcm-legacy-paths';
import {
  canAccessHcmNavigationAudience,
  findHcmNavigationItem,
} from '../features/hcm/hcm-navigation';
import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { canAccessLegacyHcmSurface, useHcmAccess } from '../features/hcm/hcm-surface-access';
import {
  HrisNavigationPolicyDeepLinkGuard,
  HRIS_TASK_NAVIGATION_LAYOUT_PROPS,
  HrisNavigationPolicyRuntimeProvider,
  resolveHrisRuntimePolicyLanding,
  resolveTaskLocation,
  useHrisNavigationPolicyShellProjection,
  useHrisRuntimeNavigationPolicy,
} from '../features/hris/shell/navigation-policy';
import { useOptionalAllowedProductSurface } from '../components/allowed-product-surface-context';
import { isSegmentOwnedPath } from '../components/product-manifest';
import {
  ProductAreaAuthorizedNavigationPathsProvider,
  useProductAreaAuthorizedNavigationPaths,
} from '../components/product-area-authorized-navigation-context';
import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { buildProductCompatibilityNavigationTargets } from '../features/shell/product-surface-compatibility-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { ConfiguredProductSurfaceShell } from './configured-product-surface-shell';
import { LegacyProductFirstAllowedIndex } from './legacy-product-first-allowed-index';
import { OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './official-product-page-route-contracts';
import {
  ProductCanaryRoot,
  ProductCanaryFirstAllowedIndex,
  ProductCanaryIndexedSurfaceBoundary,
  ProductCanaryRouteBoundary,
  ProductCanarySurfaceBoundary,
  ProductCanaryUnknownRoute,
} from './product-surface-canary-routes';
import {
  authenticationFallback,
  RouteFallback,
  routeFallback,
  WorkspaceRouteGuard,
} from './route-support';

import type { HcmNavigationItem } from '../features/hcm/hcm-navigation';
import type { HcmLegacySurfaceId } from '../features/hcm/hcm-surface-access';
import type { HrisWorkbenchId } from '../features/hris/shell/navigation-policy';

const HcmPage = lazy(() => import('../pages/hcm'));
const HrisWorkExplorer = lazy(() => import('../features/hris/explorer'));
const HcmLayout = lazy(() =>
  import('../layouts/hcm-layout').then((module) => ({ default: module.HcmLayout }))
);

export const HCM_CONFIGURED_TASK_NAVIGATION_LAYOUT_PROPS = HRIS_TASK_NAVIGATION_LAYOUT_PROPS;

export function resolveLegacyHcmShellAccess({
  providerRole,
  permissionsLoaded = true,
  supportContextLoading,
  governed = false,
  entitled,
}: {
  providerRole: boolean;
  permissionsLoaded?: boolean;
  supportContextLoading: boolean;
  supportScopes?: readonly string[];
  governed?: boolean;
  entitled: boolean;
}): 'loading' | 'allowed' | 'denied' {
  if (providerRole) {
    if (supportContextLoading) return 'loading';
    return 'denied';
  }
  if (governed) return 'allowed';
  if (!permissionsLoaded) return 'loading';
  return entitled ? 'allowed' : 'denied';
}

export { canAccessLegacyHcmSurface as resolveLegacyHcmSurfaceAccess };

function HcmRouteGuard({
  surfaceId,
  children,
}: {
  surfaceId: HcmLegacySurfaceId;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { isLoaded } = usePermissions();
  const governedSurface = useOptionalAllowedProductSurface();
  const hcmAccess = useHcmAccess();
  const providerRole = isProviderIdentity(auth.user);
  const supportContext = useProviderSupportContext(providerRole);
  const access = resolveLegacyHcmShellAccess({
    providerRole,
    permissionsLoaded: isLoaded,
    supportContextLoading: supportContext.isLoading,
    supportScopes: providerRole ? supportContext.data?.scopes : undefined,
    governed: governedSurface !== null,
    entitled: canAccessLegacyHcmSurface(surfaceId, {
      canAccessPersonal: hcmAccess.canAccessPersonal,
      isManager: hcmAccess.isManager,
      canAccessOperationsOverview: hcmAccess.canAccessOperationsOverview,
      canAccessOrganizationDesign: hcmAccess.canAccessOrganizationDesign,
      canAccessReferenceData: hcmAccess.canAccessReferenceData,
      canAccessDataOperations: hcmAccess.canAccessDataOperations,
      canAccessExports: hcmAccess.canAccessExports,
    }),
  });
  if (access === 'loading') return <RouteFallback />;
  if (providerRole) return <Navigate to="/403" replace />;
  return access === 'allowed' ? children : <Navigate to="/403" replace />;
}

function HcmLegacyPageAccessGuard({
  item,
  children,
}: {
  item: HcmNavigationItem;
  children: React.ReactNode;
}) {
  const access = useHcmAccess();
  if (!canAccessHcmNavigationAudience(item, access)) {
    return <ProductSurfaceAccessState decision={{ state: 'route-denied' }} />;
  }
  return (
    <ProductAreaNavigationItemAccessGuard item={item} pending={<RouteFallback />}>
      {children}
    </ProductAreaNavigationItemAccessGuard>
  );
}

function LegacyPeopleRedirect() {
  const location = useLocation();
  const pathname = mapLegacyHrPath(location.pathname);
  return (
    <Navigate
      to={{
        pathname: pathname ?? '/hr/legacy-not-found',
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
}

const hcmPage = (
  <Suspense fallback={routeFallback}>
    <HcmPage />
  </Suspense>
);

function legacyHcmShell(surfaceId: HcmLegacySurfaceId) {
  return (
    <HcmRouteGuard surfaceId={surfaceId}>
      <Suspense fallback={routeFallback}>
        <HcmLayout />
      </Suspense>
    </HcmRouteGuard>
  );
}

const personalLegacyHcmShell = legacyHcmShell('hcm.personal');

const teamLegacyHcmShell = legacyHcmShell('hcm.team');

const operationsLegacyHcmShell = legacyHcmShell('hcm.operations');

const managementLegacyHcmShell = legacyHcmShell('hcm.management');

function legacyShellForSurface(surfaceId: string) {
  if (surfaceId === 'hcm.personal') return personalLegacyHcmShell;
  if (surfaceId === 'hcm.team') return teamLegacyHcmShell;
  if (surfaceId === 'hcm.operations') return operationsLegacyHcmShell;
  if (surfaceId === 'hcm.management') return managementLegacyHcmShell;
  throw new Error(`Unknown HCM surface: ${surfaceId}`);
}

const hcmPageRoutes = OFFICIAL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
  (route) =>
    route.productId === 'hcm' && isSegmentOwnedPath(route.pattern, HCM_PRODUCT_MANIFEST.basePath)
);
const hcmRegisteredPageRoutes = hcmPageRoutes.map((route) => ({
  ...route,
  routeKind: 'PAGE' as const,
}));

export function resolveHcmAuthorizedNavigationPaths(
  targets: ReadonlyMap<string, unknown> | undefined
): ReadonlySet<string> | null {
  return targets === undefined ? null : new Set(targets.keys());
}

function HcmNavigationPolicyRuntimeRoot() {
  const authority = useProductSurfaceCanaryAuthority();
  const authorizedPaths = useMemo(() => {
    const targets = buildProductCompatibilityNavigationTargets({
      authority,
      manifest: HCM_PRODUCT_MANIFEST,
      registeredRoutes: hcmRegisteredPageRoutes,
      rolloutMode: resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, 'hcm')),
    });
    return resolveHcmAuthorizedNavigationPaths(targets);
  }, [authority]);
  const runtime = (
    <HrisNavigationPolicyRuntimeProvider>
      <Outlet />
    </HrisNavigationPolicyRuntimeProvider>
  );
  return authorizedPaths === null ? (
    runtime
  ) : (
    <ProductAreaAuthorizedNavigationPathsProvider paths={authorizedPaths}>
      {runtime}
    </ProductAreaAuthorizedNavigationPathsProvider>
  );
}

const hcmManagementLegacyItems = hcmPageRoutes
  .filter((route) => route.surfaceId === 'hcm.management')
  .flatMap((route) => {
    const item = findHcmNavigationItem(route.pattern);
    return item ? [item] : [];
  });

function HcmLegacyManagementIndex() {
  const access = useHcmAccess();
  return (
    <LegacyProductFirstAllowedIndex
      items={hcmManagementLegacyItems}
      canAccessAudience={(item) =>
        canAccessHcmNavigationAudience(item as HcmNavigationItem, access)
      }
    />
  );
}

function hcmSurfaceShell(surfaceId: string) {
  const legacy = legacyShellForSurface(surfaceId);
  return <HcmConfiguredSurfaceShell surfaceId={surfaceId} legacy={legacy} />;
}

function HcmConfiguredSurfaceShell({
  surfaceId,
  legacy,
}: {
  surfaceId: string;
  legacy: React.ReactNode;
}) {
  const shellNavigationProjection = useHrisNavigationPolicyShellProjection();
  return (
    <ConfiguredProductSurfaceShell
      manifest={HCM_PRODUCT_MANIFEST}
      surfaceId={surfaceId}
      areaKey="hcm"
      translationNamespace="hcm"
      legacy={legacy}
      shellNavigationProjection={shellNavigationProjection}
      {...HCM_CONFIGURED_TASK_NAVIGATION_LAYOUT_PROPS}
    />
  );
}

function hcmSurfaceBoundary(surfaceId: string) {
  const legacy = legacyShellForSurface(surfaceId);
  return (
    <ProductCanarySurfaceBoundary productId="hcm" surfaceId={surfaceId} legacy={legacy}>
      {hcmSurfaceShell(surfaceId)}
    </ProductCanarySurfaceBoundary>
  );
}

function hcmIndexedSurfaceBoundary(surfaceId: string, indexPath: `/${string}`) {
  const legacy = legacyShellForSurface(surfaceId);
  return (
    <ProductCanaryIndexedSurfaceBoundary
      productId="hcm"
      surfaceId={surfaceId}
      indexPath={indexPath}
      legacy={legacy}
    >
      {hcmSurfaceShell(surfaceId)}
    </ProductCanaryIndexedSurfaceBoundary>
  );
}

function hcmGovernedPage(routeContractKey: string) {
  const route = hcmPageRoutes.find((candidate) => candidate.routeContractKey === routeContractKey);
  if (!route) throw new Error(`Unknown HCM route contract: ${routeContractKey}`);
  const navigationItem = findHcmNavigationItem(route.pattern);
  const legacyPage = navigationItem ? (
    <HcmLegacyPageAccessGuard item={navigationItem}>{hcmPage}</HcmLegacyPageAccessGuard>
  ) : (
    <ProductSurfaceAccessState decision={{ state: 'route-denied' }} />
  );
  return (
    <ProductCanaryRouteBoundary
      productId="hcm"
      surfaceId={route.surfaceId}
      routeContractKey={route.routeContractKey}
      legacy={legacyPage}
    >
      <HrisNavigationPolicyDeepLinkGuard>{hcmPage}</HrisNavigationPolicyDeepLinkGuard>
    </ProductCanaryRouteBoundary>
  );
}

function hcmRelativePath(pattern: string, parent: string): string {
  const prefix = `${parent}/`;
  if (!pattern.startsWith(prefix)) throw new Error(`HCM route is outside ${parent}: ${pattern}`);
  return pattern.slice(prefix.length);
}

export function HrisWorkbenchPolicyIndex({
  workbenchId,
  fallback,
}: {
  workbenchId: HrisWorkbenchId;
  fallback: React.ReactNode;
}) {
  const { t } = useTranslation('hcm');
  const policy = useHrisRuntimeNavigationPolicy();
  const authorizedPaths = useProductAreaAuthorizedNavigationPaths() ?? new Set<string>();
  const location = useLocation();
  if (policy.mode === 'STATIC') return fallback;
  const landing = resolveHrisRuntimePolicyLanding(policy, workbenchId, authorizedPaths);
  if (landing.decision === 'DENY' || !landing.route) {
    if (policy.denialReason === 'NAVIGATION_PROJECTION_PENDING') return routeFallback;
    const state = resolveHrisWorkbenchPolicyAccessState(policy.denialReason);
    return (
      <section aria-label={t('navigation.policyStatus')}>
        <ProductSurfaceAccessState decision={{ state }} />
      </section>
    );
  }
  const target = resolveTaskLocation(landing.route, location.search);
  return target.pathname === location.pathname ? fallback : <Navigate replace to={target} />;
}

export function resolveHrisWorkbenchPolicyAccessState(denialReason: string | null) {
  if (denialReason === 'NAVIGATION_PROJECTION_UNAVAILABLE') return 'authority-unavailable';
  if (denialReason === 'INVALID_LEGAL_ENTITY_SELECTOR') return 'scope-invalid';
  return 'route-denied';
}

function hcmChildren(
  surfaceId: string,
  parent: string,
  indexRouteKey?: string,
  indexElement?: React.ReactNode
): RouteObject[] {
  const records = hcmPageRoutes.filter((route) => route.surfaceId === surfaceId);
  return [
    ...(indexRouteKey
      ? [
          {
            index: true,
            handle: { routeContractKey: indexRouteKey },
            element: indexElement ?? hcmGovernedPage(indexRouteKey),
          },
        ]
      : []),
    ...records
      .filter((route) => route.routeContractKey !== indexRouteKey)
      .map((route) => ({
        path: hcmRelativePath(route.pattern, parent),
        handle: { routeContractKey: route.routeContractKey },
        element: hcmGovernedPage(route.routeContractKey),
      })),
    {
      path: '*',
      element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} />,
    },
  ];
}

const HRIS_WORK_EXPLORER_PAGE_ROUTE = 'route.hcm.utility.explorer.page';

function HcmWorkExplorerModuleBoundary() {
  const withheld = <ProductSurfaceAccessState decision={{ state: 'route-denied' }} />;
  return (
    <ProductCanaryRouteBoundary
      productId="hcm"
      surfaceId="hcm.utility"
      routeContractKey={HRIS_WORK_EXPLORER_PAGE_ROUTE}
      legacy={withheld}
    >
      <Suspense fallback={routeFallback}>
        <HrisWorkExplorer />
      </Suspense>
    </ProductCanaryRouteBoundary>
  );
}

function hcmSurfaceRoutes(): RouteObject[] {
  const managementCandidates = hcmPageRoutes.filter(
    (route) => route.surfaceId === 'hcm.management'
  );
  const managementByPrefix = (prefix: string) =>
    managementCandidates
      .filter((route) => route.pattern.startsWith(`${prefix}/`))
      .map((route) => ({
        path: hcmRelativePath(route.pattern, prefix),
        handle: { routeContractKey: route.routeContractKey },
        element: hcmGovernedPage(route.routeContractKey),
      }));
  return [
    {
      index: true,
      element: <ProductCanaryRoot manifest={HCM_PRODUCT_MANIFEST} legacyPath="/hr/home" />,
    },
    {
      path: 'explore',
      handle: { routeContractKey: HRIS_WORK_EXPLORER_PAGE_ROUTE },
      element: <HcmWorkExplorerModuleBoundary />,
    },
    {
      path: 'manage',
      element: hcmIndexedSurfaceBoundary('hcm.management', '/hr/manage'),
      children: [
        {
          index: true,
          element: (
            <HrisWorkbenchPolicyIndex
              workbenchId="HRIS-WB-SETTINGS"
              fallback={
                <ProductCanaryFirstAllowedIndex
                  productId="hcm"
                  surfaceId="hcm.management"
                  candidates={managementCandidates.map((route) => ({
                    routeContractKey: route.routeContractKey,
                    path: route.pattern,
                  }))}
                  legacy={<HcmLegacyManagementIndex />}
                />
              }
            />
          ),
        },
        ...managementByPrefix('/hr/manage'),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'settings',
      element: hcmSurfaceBoundary('hcm.management'),
      children: [
        ...managementByPrefix('/hr/settings'),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'design',
      element: hcmSurfaceBoundary('hcm.management'),
      children: [
        ...managementByPrefix('/hr/design'),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'data',
      element: hcmSurfaceBoundary('hcm.management'),
      children: [
        ...managementByPrefix('/hr/data'),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
    {
      path: 'operations',
      element: hcmSurfaceBoundary('hcm.operations'),
      children: hcmChildren(
        'hcm.operations',
        '/hr/operations',
        'route.hcm.operations.overview.page',
        <HrisWorkbenchPolicyIndex
          workbenchId="HRIS-WB-HR-OPERATIONS"
          fallback={hcmGovernedPage('route.hcm.operations.overview.page')}
        />
      ),
    },
    {
      path: 'team',
      element: hcmSurfaceBoundary('hcm.team'),
      children: hcmChildren(
        'hcm.team',
        '/hr/team',
        'route.hcm.team.home.page',
        <HrisWorkbenchPolicyIndex
          workbenchId="HRIS-WB-TEAM"
          fallback={hcmGovernedPage('route.hcm.team.home.page')}
        />
      ),
    },
    {
      element: hcmSurfaceBoundary('hcm.personal'),
      children: [
        ...hcmPageRoutes
          .filter((route) => route.surfaceId === 'hcm.personal')
          .map((route) => ({
            path: hcmRelativePath(route.pattern, '/hr'),
            handle: { routeContractKey: route.routeContractKey },
            element: hcmGovernedPage(route.routeContractKey),
          })),
        { path: '*', element: <ProductCanaryUnknownRoute productId="hcm" legacy={hcmPage} /> },
      ],
    },
  ];
}

export const hcmRoutes: RouteObject[] = [
  {
    path: 'hr',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <HcmNavigationPolicyRuntimeRoot />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
    children: hcmSurfaceRoutes(),
  },
  {
    path: 'people/*',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <LegacyPeopleRedirect />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  },
  {
    path: 'workforce/*',
    element: (
      <AuthGuard fallback={authenticationFallback}>
        <WorkspaceRouteGuard>
          <LegacyPeopleRedirect />
        </WorkspaceRouteGuard>
      </AuthGuard>
    ),
  },
];
