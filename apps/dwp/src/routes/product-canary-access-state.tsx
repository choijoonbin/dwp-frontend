import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField } from '@dwp-frontend/design-system';

import MenuItem from '@mui/material/MenuItem';

import { ProductSurfaceAccessState } from '../components/product-surface-access-state';
import { useProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import { useProductSurfaceTelemetry } from '../observability/product-surface-telemetry-context';
import { productSurfaceTelemetryEvent } from '../observability/product-surface-telemetry';

import type { ProductSurfaceAccessStateActions } from '../components/product-surface-access-state';
import type { SurfaceDecision } from '../features/shell/product-surface-context';

const PRODUCT_APP_RESOURCE: Readonly<Record<string, string>> = {
  approvals: 'APP.APPROVALS',
  communications: 'APP.COMMUNICATIONS',
  services: 'APP.EMPLOYEE_SERVICES',
};

export function resolveCanaryAccessActionKinds(
  decision: Exclude<SurfaceDecision, { state: 'allowed' }>,
  hasScopes: boolean,
  hasRequestableApp: boolean
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
  return actions;
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
  const appResourceKey = PRODUCT_APP_RESOURCE[productId];
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
    Boolean(appResourceKey)
  );
  const actions: ProductSurfaceAccessStateActions = {
    ...(actionKinds.has('retry') ? { retry: () => void authority.revalidate?.() } : {}),
    ...(actionKinds.has('return') ? { return: () => navigate('/apps') } : {}),
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
