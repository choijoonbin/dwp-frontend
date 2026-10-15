import {
  resolveCanaryProductFlags,
  resolveCanaryRouteDecision,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from '../../../components/product-surface-canary-runtime';
import { appendProductPageShortcutScope } from '../../../components/product-page-shortcut-access';
import {
  HRIS_WORK_EXPLORER_PATH,
  HRIS_WORK_EXPLORER_ROUTE_CONTRACT,
  HRIS_WORK_EXPLORER_SURFACE,
} from './work-explorer-contract';

import type { ProductSurfaceCanaryAuthority } from '../../../components/product-surface-canary-runtime';

export type WorkExplorerShortcutAccess = Readonly<{
  disclosed: boolean;
  href: string;
}>;

export function resolveWorkExplorerShortcutAccess(
  authority: ProductSurfaceCanaryAuthority
): WorkExplorerShortcutAccess {
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(authority, 'hcm'));
  if (
    (mode !== 'enforced-compatibility' && mode !== 'surface-ui') ||
    authority.authorityPending ||
    authority.pendingRoutes?.[HRIS_WORK_EXPLORER_ROUTE_CONTRACT]
  ) {
    return { disclosed: false, href: HRIS_WORK_EXPLORER_PATH };
  }
  const decision = resolveCanaryRouteDecision(authority, {
    productId: 'hcm',
    surfaceId: HRIS_WORK_EXPLORER_SURFACE,
    routeContractKey: HRIS_WORK_EXPLORER_ROUTE_CONTRACT,
  });
  if (decision.state !== 'allowed') {
    return { disclosed: false, href: HRIS_WORK_EXPLORER_PATH };
  }
  return {
    disclosed: true,
    href: appendProductPageShortcutScope(HRIS_WORK_EXPLORER_PATH, {
      disclosed: true,
      contextScopeKey: decision.scope.key,
    }),
  };
}

export function useWorkExplorerShortcutAccess(): WorkExplorerShortcutAccess {
  return resolveWorkExplorerShortcutAccess(useProductSurfaceCanaryAuthority());
}
