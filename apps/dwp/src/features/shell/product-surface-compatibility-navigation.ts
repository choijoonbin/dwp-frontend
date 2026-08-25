import {
  normalizeProductPath,
  type ProductSurfaceDefinition,
  type ProductSurfaceNavigationGroup,
  type ProductSurfaceNavigationItem,
  type ProductSurfaceManifest,
} from '../../components/product-manifest';
import {
  resolveCanaryRouteDecision,
  type ProductSurfaceCanaryAuthority,
  type ProductSurfaceRolloutMode,
} from './product-surface-canary-runtime';
import { canContextAccessNavigation } from './product-surface-context';

import type { RegisteredProductRoute } from '../../routes/product-route-contract-source';

export type ProductCompatibilityNavigationTarget =
  | { state: 'allowed'; targetScopeKey: string }
  | { state: 'scope-selection-required' };

function isRequiredFutureInstant(value: string | undefined, serverNowMs: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > serverNowMs;
}

function isOptionalFutureInstant(value: string | undefined, serverNowMs: number): boolean {
  return value === undefined || isRequiredFutureInstant(value, serverNowMs);
}

function hasTrustedScopeSelectionContext(
  authority: ProductSurfaceCanaryAuthority,
  manifest: ProductSurfaceManifest,
  surface: ProductSurfaceDefinition,
  item: ProductSurfaceNavigationItem,
  directDecisionRevision: string | undefined,
  serverNowMs: number
): boolean {
  const envelope = authority.envelope;
  if (!envelope?.decisionRevision.trim() || !directDecisionRevision?.trim()) return false;
  const candidates = envelope.contexts.filter((context) => context.surfaceKey === surface.id);
  if (candidates.length !== 1) return false;
  const context = candidates[0]!;
  const scopeKeys = context.scopes.map((scope) => scope.key);
  if (
    context.productKey !== manifest.id ||
    !context.contextKey.trim() ||
    context.surfaceKey !== surface.id ||
    context.plane !== surface.plane ||
    context.accessMode !== envelope.activeAccessMode ||
    context.appResourceKey !== manifest.appKey ||
    envelope.contexts.some(
      (candidate) =>
        candidate.productKey === manifest.id && candidate.accessMode !== envelope.activeAccessMode
    ) ||
    !isRequiredFutureInstant(context.revalidateAt, serverNowMs) ||
    context.scopes.length < 2 ||
    context.scopes.some(
      (scope) =>
        !scope.key.trim() ||
        scope.isDefault ||
        !surface.supportedScopeKinds.includes(scope.kind) ||
        !isOptionalFutureInstant(scope.validUntil, serverNowMs)
    ) ||
    new Set(scopeKeys).size !== scopeKeys.length
  ) {
    return false;
  }
  return context.scopes.some((scope) =>
    canContextAccessNavigation(item.access, context, scope.key, serverNowMs)
  );
}

/** Preserves the legacy group order while combining every manifest-owned Surface menu. */
export function buildProductCompatibilityNavigation(
  manifest: ProductSurfaceManifest
): readonly ProductSurfaceNavigationGroup[] {
  const groups = new Map<string, { id: string; items: ProductSurfaceNavigationItem[] }>();
  for (const surface of manifest.surfaces) {
    for (const group of surface.navigation) {
      const existing = groups.get(group.id);
      if (existing) {
        existing.items.push(...group.items);
      } else {
        groups.set(group.id, { id: group.id, items: [...group.items] });
      }
    }
  }
  return [...groups.values()];
}

/**
 * Rollout 110 keeps the legacy combined menu, but every item is still projected from its own
 * exact PAGE decision. A Work decision can never authorize a Management item (or vice versa).
 */
export function buildProductCompatibilityNavigationTargets({
  authority,
  manifest,
  registeredRoutes,
  rolloutMode,
}: {
  authority: ProductSurfaceCanaryAuthority;
  manifest: ProductSurfaceManifest;
  registeredRoutes: readonly RegisteredProductRoute[];
  rolloutMode: ProductSurfaceRolloutMode;
}): ReadonlyMap<string, ProductCompatibilityNavigationTarget> | undefined {
  if (rolloutMode !== 'enforced-compatibility') {
    return undefined;
  }

  const serverNowMs = authority.serverNowMs ?? Date.now();
  const targets = new Map<string, ProductCompatibilityNavigationTarget>();
  for (const surface of manifest.surfaces) {
    for (const item of surface.navigation.flatMap((group) => group.items)) {
      const normalizedPath = normalizeProductPath(item.path);
      const routes = registeredRoutes.filter(
        (route) =>
          route.routeKind === 'PAGE' &&
          route.productId === manifest.id &&
          route.surfaceId === surface.id &&
          normalizeProductPath(route.pattern) === normalizedPath
      );
      if (routes.length !== 1) continue;
      const route = routes[0]!;
      const decision = resolveCanaryRouteDecision(authority, {
        productId: manifest.id,
        surfaceId: surface.id,
        routeContractKey: route.routeContractKey,
      });
      if (
        decision.state === 'allowed' &&
        decision.context.plane === surface.plane &&
        canContextAccessNavigation(
          item.access,
          decision.context,
          decision.scope.key,
          serverNowMs
        ) &&
        decision.scope.key.trim().length > 0
      ) {
        targets.set(normalizedPath, {
          state: 'allowed',
          targetScopeKey: decision.scope.key,
        });
      } else if (
        decision.state === 'scope-selection-required' &&
        hasTrustedScopeSelectionContext(
          authority,
          manifest,
          surface,
          item,
          decision.detail?.decisionRevision,
          serverNowMs
        )
      ) {
        targets.set(normalizedPath, { state: 'scope-selection-required' });
      }
    }
  }
  return targets;
}

/** Replaces only the authority-bearing scope while retaining opaque route UI state. */
export function resolveProductCompatibilityNavigationLocation(
  pathname: string,
  target: ProductCompatibilityNavigationTarget,
  current: { search?: string; hash?: string }
): { pathname: string; search: string; hash: string } {
  const search = new URLSearchParams(current.search ?? '');
  if (target.state === 'allowed') {
    search.set('scope', target.targetScopeKey);
  } else {
    search.delete('scope');
  }
  const serializedSearch = search.toString();
  return {
    pathname,
    search: serializedSearch ? `?${serializedSearch}` : '',
    hash: current.hash ?? '',
  };
}
