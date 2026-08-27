import type { QueryClient } from '@tanstack/react-query';

import { createPlaneCachePurger } from './query-cache-plane-boundary';

import type { PlaneCacheQuery } from './query-cache-plane-boundary';

/**
 * Provider estate data is control-plane metadata. Preview and explicitly access-sensitive data
 * are tenant-scoped and must be discarded whenever the support-session identity changes.
 */
export function isProviderControlPlaneCacheQuery(query: PlaneCacheQuery): boolean {
  if (query.meta?.accessSensitive === true) return false;
  const [plane, domain] = query.queryKey;
  return plane === 'provider' && domain !== 'tenant-experience-preview';
}

const purgeTenantCache = createPlaneCachePurger(isProviderControlPlaneCacheQuery);

export async function purgeProviderSupportTenantCache(queryClient: QueryClient): Promise<void> {
  await purgeTenantCache(queryClient);
}
