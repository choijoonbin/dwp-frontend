import {
  resolveCanaryRouteDecision,
  type ProductSurfaceCanaryAuthority,
} from '../features/shell/product-surface-canary-runtime';

export function preserveProductRouteLocation(
  pathname: string,
  location: { search?: string; hash?: string }
): string {
  const search = location.search
    ? location.search.startsWith('?')
      ? location.search
      : `?${location.search}`
    : '';
  const hash = location.hash
    ? location.hash.startsWith('#')
      ? location.hash
      : `#${location.hash}`
    : '';
  return `${pathname}${search}${hash}`;
}

export function resolveFirstAllowedCanaryRoute(
  authority: ProductSurfaceCanaryAuthority,
  input: {
    productId: string;
    surfaceId: string;
    candidates: readonly { routeContractKey: string; path: string }[];
    requestedScopeKey?: string;
  }
): string | undefined {
  return input.candidates.find((candidate) => {
    const decision = resolveCanaryRouteDecision(authority, {
      productId: input.productId,
      surfaceId: input.surfaceId,
      routeContractKey: candidate.routeContractKey,
    });
    return (
      decision.state === 'allowed' &&
      (!input.requestedScopeKey || decision.scope.key === input.requestedScopeKey)
    );
  })?.path;
}
