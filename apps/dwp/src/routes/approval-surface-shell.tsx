import { useTranslation } from 'react-i18next';

import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { useProductApplicationRuntime } from '../components/product-application-runtime';
import { useAllowedProductSurface } from '../features/shell/allowed-product-surface-context';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';
import { ApprovalLayout } from '../layouts/approval-layout';
import { ApprovalManagementLayout, ApprovalWorkLayout } from '../layouts/approval-surface-layouts';
import { buildProductCanaryLayoutRuntime } from './product-surface-canary-routes';
import { useProductSurfaceScopeTransition } from '../features/shell/use-product-surface-scope-transition';

export function ApprovalSurfaceShell({
  surfaceId,
}: {
  surfaceId: 'approvals.work' | 'approvals.admin';
}) {
  const decision = useAllowedProductSurface();
  const applicationRuntime = useProductApplicationRuntime();
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
    returnLabels: {
      work: tCommon('productSurface.actions.returnToWork'),
      catalog: tCommon('productSurface.actions.returnToCatalog'),
    },
    registeredRoutes: applicationRuntime.registeredRoutes,
    rolloutMode: mode,
    onScopeChange: (scopeKey) => void transitionScope(scopeKey),
  });

  if (mode === 'surface-ui') {
    return surface.plane === 'management' ? (
      <ApprovalManagementLayout manifest={APPROVAL_PRODUCT_MANIFEST} surface={runtime} />
    ) : (
      <ApprovalWorkLayout manifest={APPROVAL_PRODUCT_MANIFEST} surface={runtime} />
    );
  }
  return <ApprovalLayout surface={runtime} />;
}
