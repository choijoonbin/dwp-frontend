import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';

import MenuItem from '@mui/material/MenuItem';

import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import { useProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import { resolveProductSurfaceReturnTarget } from '../features/shell/product-surface-layout-model';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import { productSurfaceTelemetryEvent } from '../observability/product-surface-telemetry';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';

import type { ProductSurfaceAccessStateActions } from '../components/product-surface-access-state';
import type { SurfaceDecision } from '../features/shell/product-surface-context';

export function resolveCanaryAccessActionKinds(
  decision: Exclude<SurfaceDecision, { state: 'allowed' }>,
  hasScopes: boolean,
  hasRequestableApp: boolean,
  managementSurface = false
): ReadonlySet<keyof ProductSurfaceAccessStateActions> {
  const actions = new Set<keyof ProductSurfaceAccessStateActions>(['return']);
  if (decision.state === 'authority-unavailable' || decision.state === 'step-up-required') {
    actions.add('retry');
  }
  if (
    hasScopes &&
    (decision.state === 'scope-selection-required' || decision.state === 'scope-invalid')
  ) {
    actions.add('select-scope');
  }
  if (hasRequestableApp && decision.state === 'app-denied') actions.add('request-access');
  if (
    hasRequestableApp &&
    managementSurface &&
    ['surface-denied', 'route-denied', 'expired'].includes(decision.state)
  ) {
    actions.add('request-responsibility');
  }
  if (decision.state === 'activation-required') actions.add('activate-access');
  return actions;
}

export function resolveCanarySafeReturnPath(
  authority: ReturnType<typeof useProductSurfaceCanaryAuthority>,
  productId: string,
  surfaceId?: string
): string {
  const manifest = GOVERNED_PRODUCT_MANIFESTS.find((candidate) => candidate.id === productId);
  const surface = manifest?.surfaces.find((candidate) => candidate.id === surfaceId);
  if (!manifest || surface?.plane !== 'management') return '/apps';
  const allowedRouteIds = new Set(
    REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.flatMap((route) =>
      authority.routeDecisions?.[route.routeContractKey]?.state === 'allowed' &&
      typeof route.routeId === 'string'
        ? [route.routeId]
        : []
    )
  );
  const returnSurfaceId =
    surface.returnSurfaceId ??
    manifest.surfaces.find((candidate) => candidate.plane === 'work')?.id;
  const hasAllowedWorkRoute = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.some(
    (route) =>
      route.surfaceId === returnSurfaceId &&
      typeof route.routeId === 'string' &&
      allowedRouteIds.has(route.routeId)
  );
  if (!hasAllowedWorkRoute) return '/apps';
  return resolveProductSurfaceReturnTarget(
    manifest,
    surface.id,
    authority.envelope?.contexts ?? [],
    REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
    authority.lastAllowedWorkRouteIds,
    allowedRouteIds,
    authority.serverNowMs
  ).path;
}

export function ProductCanaryAccessState({
  decision,
  productId,
  surfaceId,
  routeId,
}: {
  decision: Exclude<SurfaceDecision, { state: 'allowed' }>;
  productId: string;
  surfaceId?: string;
  routeId?: string;
}) {
  const { t } = useTranslation('common');
  const authority = useProductSurfaceCanaryAuthority();
  const telemetry = useProductSurfaceTelemetry();
  const navigate = useNavigate();
  const location = useLocation();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState('');
  const scopes = useMemo(() => {
    if (!surfaceId) return [];
    const matching =
      authority.envelope?.contexts.filter(
        (context) => context.productKey === productId && context.surfaceKey === surfaceId
      ) ?? [];
    return matching.length === 1 ? matching[0]!.scopes : [];
  }, [authority.envelope?.contexts, productId, surfaceId]);
  const manifest = GOVERNED_PRODUCT_MANIFESTS.find((candidate) => candidate.id === productId);
  const appResourceKey = manifest?.appKey;
  const managementSurface = manifest?.surfaces.some(
    (surface) => surface.id === surfaceId && surface.plane === 'management'
  );
  useEffect(() => {
    if (!surfaceId || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/u.test(surfaceId)) return;
    const canonicalSurfaceId = surfaceId as `${string}.${string}`;
    const reasonCode = decision.state.replaceAll('-', '_').toUpperCase() as Parameters<
      typeof productSurfaceTelemetryEvent.routeDenied
    >[0]['reasonCode'];
    telemetry.failSurfaceSwitch(productId, canonicalSurfaceId, reasonCode);
    if (!routeId) return;
    telemetry.capture(
      productSurfaceTelemetryEvent.routeDenied({
        productKey: productId,
        surfaceKey: canonicalSurfaceId,
        routeId,
        reasonCode,
      })
    );
  }, [decision.state, productId, routeId, surfaceId, telemetry]);
  const actionKinds = resolveCanaryAccessActionKinds(
    decision,
    scopes.length > 0,
    Boolean(appResourceKey),
    managementSurface
  );
  const safeReturnPath = resolveCanarySafeReturnPath(authority, productId, surfaceId);
  const actions: ProductSurfaceAccessStateActions = {
    ...(actionKinds.has('retry') ? { retry: () => void authority.revalidate?.() } : {}),
    ...(actionKinds.has('return') ? { return: () => navigate(safeReturnPath) } : {}),
    ...(actionKinds.has('select-scope')
      ? {
          'select-scope': () => {
            setSelectedScope(scopes.find((scope) => scope.isDefault)?.key ?? scopes[0]?.key ?? '');
            setScopeOpen(true);
          },
        }
      : {}),
    ...(actionKinds.has('request-access')
      ? {
          'request-access': () =>
            navigate(`/apps?${new URLSearchParams({ requestResource: appResourceKey! })}`),
        }
      : {}),
    ...(actionKinds.has('request-responsibility')
      ? {
          'request-responsibility': () =>
            navigate(
              `/apps?${new URLSearchParams({
                requestManagement: appResourceKey!,
                ...(surfaceId ? { requestSurface: surfaceId } : {}),
              })}`
            ),
        }
      : {}),
    ...(actionKinds.has('activate-access')
      ? { 'activate-access': () => navigate('/account/security#privileged-access') }
      : {}),
  };

  return (
    <>
      <ProductSurfaceAccessState decision={decision} actions={actions} />
      <FormDialog
        open={scopeOpen}
        title={t('productSurface.scopeChooser.title')}
        description={t('productSurface.scopeChooser.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('productSurface.actions.selectScope')}
        submitDisabled={!selectedScope}
        onClose={() => setScopeOpen(false)}
        onSubmit={() => {
          if (!selectedScope) return;
          const search = new URLSearchParams(location.search);
          search.set('scope', selectedScope);
          navigate(`${location.pathname}?${search.toString()}${location.hash}`, { replace: true });
          setScopeOpen(false);
        }}
      >
        <FormField
          select
          label={t('productSurface.labels.scope')}
          value={selectedScope}
          onChange={(event) => setSelectedScope(event.target.value)}
        >
          {scopes.map((scope) => (
            <MenuItem key={scope.key} value={scope.key}>
              {scope.displayName}
            </MenuItem>
          ))}
        </FormField>
      </FormDialog>
    </>
  );
}
