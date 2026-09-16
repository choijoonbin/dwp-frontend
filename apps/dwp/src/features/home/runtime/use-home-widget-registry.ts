import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getEffectiveWidgetCatalog,
  getWidgetRegistryReadiness,
  resolveWidgetRegistryConnection,
} from '@dwp-frontend/shared-utils';

import {
  homeWidgetRegistryEffectiveQueryKey,
  observeHomeWidgetShadow,
  resolveHomeWidgetRuntimeDecisions,
} from './widget-registry-runtime';

export function useHomeWidgetRegistryRuntime(tenantId?: number, userId?: number, enabled = true) {
  const readinessQuery = useQuery({
    queryKey: ['widget-registry', 'readiness', tenantId, userId],
    queryFn: getWidgetRegistryReadiness,
    staleTime: 60_000,
    retry: false,
    enabled: enabled && tenantId != null && userId != null,
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
    enabled: enabled && connection.queryEffectiveCatalog,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return useMemo(
    () => ({
      decisions: resolveHomeWidgetRuntimeDecisions(connection, effectiveCatalogQuery.data),
      shadowObservation: observeHomeWidgetShadow(
        connection,
        effectiveCatalogQuery.isError ? null : effectiveCatalogQuery.data
      ),
    }),
    [connection, effectiveCatalogQuery.data, effectiveCatalogQuery.isError]
  );
}
