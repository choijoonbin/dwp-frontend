import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';

import MenuItem from '@mui/material/MenuItem';

import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { normalizeProductPath } from '../components/product-manifest';
import { GOVERNED_PRODUCT_MANIFESTS } from '../components/product-manifest-registry';
import { useProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import { canContextAccessNavigation } from '../features/shell/product-surface-context';
import { resolveProductSurfaceReturnTarget } from '../features/shell/product-surface-layout-model';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import { productSurfaceTelemetryEvent } from '../observability/product-surface-telemetry';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';

import type { ProductSurfaceAccessStateActions } from '../components/product-surface-access-state';
import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type { EffectiveScope, SurfaceDecision } from '../features/shell/product-surface-context';

function isFutureInstant(value: string | undefined, serverNowMs: number): boolean {
  if (!value) return true;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > serverNowMs;
}

export function resolveCanarySelectableScopes(
  authority: ProductSurfaceCanaryAuthority,
  decision: Exclude<SurfaceDecision, { state: 'allowed' }>,
  productId: string,
  surfaceId?: string,
  routeContractKey?: string
): readonly EffectiveScope[] {
  const envelope = authority.envelope;
  const manifest = GOVERNED_PRODUCT_MANIFESTS.find((candidate) => candidate.id === productId);
  const surface = manifest?.surfaces.find((candidate) => candidate.id === surfaceId);
  const serverNowMs = authority.serverNowMs ?? Date.now();
  if (
    !envelope?.decisionRevision.trim() ||
    !surface ||
    (routeContractKey && !decision.detail?.decisionRevision?.trim())
  ) {
    return [];
  }
  const matchingContexts = envelope.contexts.filter(
    (context) =>
      context.productKey === productId &&
      context.surfaceKey === surface.id &&
      context.accessMode === envelope.activeAccessMode
  );
  if (
    matchingContexts.length !== 1 ||
    envelope.contexts.some(
      (context) =>
        context.productKey === productId && context.accessMode !== envelope.activeAccessMode
    )
  ) {
    return [];
  }
  const context = matchingContexts[0]!;
  const scopeKeys = context.scopes.map((scope) => scope.key);
  if (
    !context.contextKey.trim() ||
    !context.appResourceKey.trim() ||
    context.plane !== surface.plane ||
    !isFutureInstant(context.revalidateAt, serverNowMs) ||
    new Set(scopeKeys).size !== scopeKeys.length ||
    context.scopes.filter((scope) => scope.isDefault).length > 1
  ) {
    return [];
  }
  const canonicalScopes = context.scopes.filter(
    (scope) =>
      scope.key.trim().length > 0 &&
      surface.supportedScopeKinds.includes(scope.kind) &&
      isFutureInstant(scope.validUntil, serverNowMs)
  );
  if (!routeContractKey) {
    const navigationItems = surface.navigation.flatMap((group) => group.items);
    return canonicalScopes.filter((scope) =>
      navigationItems.some((item) =>
        canContextAccessNavigation(item.access, context, scope.key, serverNowMs)
      )
    );
  }
  const routes = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter(
    (route) =>
      route.routeKind === 'PAGE' &&
      route.routeContractKey === routeContractKey &&
      route.productId === productId &&
      route.surfaceId === surface.id
  );
  if (routes.length !== 1) return [];
  const route = routes[0]!;
  if (route.routeKind !== 'PAGE') return [];
  const routePath = normalizeProductPath(route.pattern);
  const navigationItems = surface.navigation
    .flatMap((group) => group.items)
    .filter((item) => normalizeProductPath(item.path) === routePath);
  if (navigationItems.length === 0) return canonicalScopes;
  if (navigationItems.length !== 1) return [];
  return canonicalScopes.filter((scope) =>
    canContextAccessNavigation(navigationItems[0]!.access, context, scope.key, serverNowMs)
  );
}

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
  const capturedDenialRef = useRef<string | null>(null);
  const scopes = useMemo(
    () => resolveCanarySelectableScopes(authority, decision, productId, surfaceId, routeId),
    [authority, decision, productId, routeId, surfaceId]
  );
  const manifest = GOVERNED_PRODUCT_MANIFESTS.find((candidate) => candidate.id === productId);
  const appResourceKey = manifest?.appKey;
  const managementSurface = manifest?.surfaces.some(
    (surface) => surface.id === surfaceId && surface.plane === 'management'
  );
  const reasonCode = decision.state.replaceAll('-', '_').toUpperCase() as Parameters<
    typeof productSurfaceTelemetryEvent.routeDenied
  >[0]['reasonCode'];
  useEffect(() => {
    if (!surfaceId || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/u.test(surfaceId)) return;
    const canonicalSurfaceId = surfaceId as `${string}.${string}`;
    const identity = `${decision.state}:${decision.detail?.decisionRevision ?? ''}:${routeId ?? ''}`;
    if (capturedDenialRef.current === identity) return;
    capturedDenialRef.current = identity;
    if (decision.state !== 'scope-selection-required') {
      telemetry.failPendingScopeSwitch(productId, canonicalSurfaceId, reasonCode);
    }
    telemetry.failSurfaceSwitch(productId, canonicalSurfaceId, reasonCode);
    if (decision.state === 'expired') {
      telemetry.capture(
        productSurfaceTelemetryEvent.assignmentExpired({
          productKey: productId,
          surfaceKey: canonicalSurfaceId,
          readOnly: true,
        })
      );
    }
    if (!routeId) return;
    telemetry.capture(
      productSurfaceTelemetryEvent.routeDenied({
        productKey: productId,
        surfaceKey: canonicalSurfaceId,
        routeId,
        reasonCode,
      })
    );
  }, [
    decision.detail?.decisionRevision,
    decision.state,
    productId,
    reasonCode,
    routeId,
    surfaceId,
    telemetry,
  ]);
  const actionKinds = resolveCanaryAccessActionKinds(
    decision,
    scopes.length > 0,
    Boolean(appResourceKey),
    managementSurface
  );
  const safeReturnPath = resolveCanarySafeReturnPath(authority, productId, surfaceId);
  const actions: ProductSurfaceAccessStateActions = {
    ...(actionKinds.has('retry') ? { retry: () => void authority.revalidate?.() } : {}),
    ...(actionKinds.has('return')
      ? {
          return: () => {
            if (surfaceId) {
              telemetry.failPendingScopeSwitch(productId, surfaceId, 'CANCELLED');
            }
            navigate(safeReturnPath);
          },
        }
      : {}),
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
          const scope = scopes.find((candidate) => candidate.key === selectedScope);
          if (!scope || !surfaceId) return;
          telemetry.beginScopeSwitch(productId, surfaceId, scope.kind);
          const search = new URLSearchParams(location.search);
          search.set('scope', selectedScope);
          navigate(`${location.pathname}?${search.toString()}${location.hash}`);
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
