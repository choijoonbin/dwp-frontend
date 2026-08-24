import { useTranslation } from 'react-i18next';

import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { ApprovalLayout } from '../layouts/approval-layout';
import { ApprovalManagementLayout, ApprovalWorkLayout } from '../layouts/approval-surface-layouts';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';
import { buildProductCanaryLayoutRuntime } from './product-surface-canary-routes';
import { useAllowedProductSurface } from './product-surface-guard';
import { useProductSurfaceScopeTransition } from '../features/shell/use-product-surface-scope-transition';

export function ApprovalSurfaceShell({
  surfaceId,
}: {
  surfaceId: 'approvals.work' | 'approvals.admin';
}) {
  const decision = useAllowedProductSurface();
  const authority = useProductSurfaceCanaryAuthority();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, 'approvals'));
  const { t } = useTranslation('approvals');
  const { t: tCommon } = useTranslation('common');
  const transitionScope = useProductSurfaceScopeTransition(decision);
  const surface = APPROVAL_PRODUCT_MANIFEST.surfaces.find(
    (candidate) => candidate.id === surfaceId
  )!;
  const runtime = buildProductCanaryLayoutRuntime({
    authority,
    manifest: APPROVAL_PRODUCT_MANIFEST,
    decision,
    label: t(surface.labelKey),
    returnLabel: tCommon(
      decision.context.plane === 'management'
        ? 'productSurface.actions.returnToWork'
        : 'productSurface.actions.returnToCatalog'
    ),
    registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
    compatibilityNavigation: mode === 'enforced-compatibility',
    onScopeChange: (scopeKey) => void transitionScope(scopeKey),
  });

  if (mode === 'surface-ui') {
    return surface.plane === 'management' ? (
      <ApprovalManagementLayout surface={runtime} />
    ) : (
      <ApprovalWorkLayout surface={runtime} />
    );
  }
  return <ApprovalLayout surface={runtime} />;
}
