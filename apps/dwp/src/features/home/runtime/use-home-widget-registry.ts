import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getEffectiveWidgetCatalog,
  getWidgetRegistryReadiness,
  resolveWidgetRegistryConnection,
} from '@dwp-frontend/shared-utils';

import {
  homeWidgetRegistryEffectiveQueryKey,
  resolveHomeWidgetRuntimeDecisions,
} from './widget-registry-runtime';

export function useHomeWidgetRegistryRuntime(tenantId?: number, userId?: number) {
  const readinessQuery = useQuery({
    queryKey: ['widget-registry', 'readiness', tenantId, userId],
    queryFn: getWidgetRegistryReadiness,
    staleTime: 60_000,
    retry: false,
    enabled: tenantId != null && userId != null,
  });
  const connection = useMemo(
    () =>
      resolveWidgetRegistryConnection(readinessQuery.isSuccess ? readinessQuery.data : undefined),
    [readinessQuery.data, readinessQuery.isSuccess]
  );
  const readiness = readinessQuery.data;
  const effectiveCatalogQuery = useQuery({
    queryKey: homeWidgetRegistryEffectiveQueryKey(tenantId, userId, readiness),
    queryFn: () => getEffectiveWidgetCatalog('workspace-home'),
    enabled: connection.queryEffectiveCatalog,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return useMemo(
    () => resolveHomeWidgetRuntimeDecisions(connection, effectiveCatalogQuery.data),
    [connection, effectiveCatalogQuery.data]
  );
}
