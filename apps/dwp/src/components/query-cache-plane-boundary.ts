import type { QueryClient } from '@tanstack/react-query';

export type PlaneCacheQuery = Readonly<{
  queryKey: readonly unknown[];
  meta?: Readonly<Record<string, unknown>>;
}>;

export type PlaneCacheRetentionPredicate = (query: PlaneCacheQuery) => boolean;
export type PlaneCachePurger = (queryClient: QueryClient) => Promise<void>;

/**
 * Creates an identity/access-plane cache transition that retains only explicitly classified
 * queries. The predicate is injected by the owning plane so this common primitive never imports
 * a product feature or its manifests.
 */
export function createPlaneCachePurger(
  retainQuery: PlaneCacheRetentionPredicate
): PlaneCachePurger {
  return async (queryClient) => {
    const purgeQuery = (query: PlaneCacheQuery) => !retainQuery(query);
    await queryClient.cancelQueries({ predicate: purgeQuery }).catch(() => undefined);
    queryClient.removeQueries({ predicate: purgeQuery });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dwp:product-surface-authority-invalidated'));
    }
  };
}
