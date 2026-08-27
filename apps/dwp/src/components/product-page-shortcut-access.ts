import {
  resolveCanaryProductFlags,
  resolveCanaryRouteDecision,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
} from './product-surface-canary-runtime';
import { PRODUCT_PAGE_SHORTCUT_TARGET_CATALOG } from './product-page-shortcut-target-catalog';

import type { ProductSurfaceCanaryAuthority } from './product-surface-canary-runtime';

export type ProductPageShortcutTarget = Readonly<{
  productId: string;
  surfaceId: string;
  routeContractKey: string;
}>;

export type ProductPageShortcutAccess = Readonly<{
  disclosed: boolean;
  contextScopeKey?: string;
}>;

export const PRODUCT_PAGE_SHORTCUT_TARGETS = PRODUCT_PAGE_SHORTCUT_TARGET_CATALOG;

/**
 * A shortcut to another PAGE is authorization disclosure, not merely navigation.
 * Rollouts 110/111 therefore require that PAGE's trusted direct decision. Rollouts
 * 000/100 retain the existing legacy affordance because enforcement is not active.
 */
export function resolveProductPageShortcutAccess(
  authority: ProductSurfaceCanaryAuthority,
  target: ProductPageShortcutTarget
): ProductPageShortcutAccess {
  const mode = resolveProductSurfaceRolloutMode(
    resolveCanaryProductFlags(authority, target.productId)
  );
  if (mode === 'baseline' || mode === 'shadow') return { disclosed: true };
  if (mode !== 'enforced-compatibility' && mode !== 'surface-ui') {
    return { disclosed: false };
  }
  if (authority.authorityPending || authority.pendingRoutes?.[target.routeContractKey]) {
    return { disclosed: false };
  }
  const decision = resolveCanaryRouteDecision(authority, target);
  return decision.state === 'allowed'
    ? { disclosed: true, contextScopeKey: decision.scope.key }
    : { disclosed: false };
}

export function appendProductPageShortcutScope(
  href: string,
  access: ProductPageShortcutAccess
): string {
  if (!access.contextScopeKey) return href;
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf('?');
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '');
  search.set('scope', access.contextScopeKey);
  return `${pathname}?${search.toString()}${hash}`;
}

export function useProductPageShortcutAccess(
  target: ProductPageShortcutTarget
): ProductPageShortcutAccess {
  return resolveProductPageShortcutAccess(useProductSurfaceCanaryAuthority(), target);
}
