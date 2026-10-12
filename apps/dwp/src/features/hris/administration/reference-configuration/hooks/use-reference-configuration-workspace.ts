import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';
import {
  readReferenceConfigurationVersion,
  readReferenceConfigurationWorkbench,
} from '../api/reference-configuration-api';
import { resolveReferenceConfigurationViewState } from '../model/reference-configuration-model';

import type { ReferenceConfigurationWorkbenchQuery } from '../api/reference-configuration-api';

export function useHrisReferenceConfigurationRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
}

export function useReferenceConfigurationWorkspace() {
  const requestScope = useHrisReferenceConfigurationRequestScope();
  const [correlationId] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState<{ configurationId: string; version: number } | null>(
    null
  );
  const [statusFilter, setStatusFilter] = useState<string>('');
  const query = useMemo<ReferenceConfigurationWorkbenchQuery>(
    () => ({
      limit: 100,
      effectiveStatus: statusFilter || undefined,
      sort: ['referenceData:ASC', 'itemPublicId:ASC'],
      locale: navigator.language || 'en',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      correlationId,
    }),
    [correlationId, statusFilter]
  );
  const workbenchQuery = useQuery({
    queryKey: ['hris', 'reference-configuration', 'workbench', requestScope.cacheKey, query],
    queryFn: ({ signal }) =>
      readReferenceConfigurationWorkbench(query, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 30_000,
  });

  useEffect(() => {
    const items = workbenchQuery.data?.items;
    if (!items?.length) {
      setSelected(null);
      return;
    }
    if (selected && items.some((item) => item.itemPublicId === selected.configurationId)) return;
    const first = items[0];
    const policy = first.fieldGroups.POLICY_VERSION as
      { value?: { revision?: number } } | undefined;
    setSelected({
      configurationId: first.itemPublicId,
      version: Number(policy?.value?.revision ?? 1),
    });
  }, [selected, workbenchQuery.data]);

  const detailQuery = useQuery({
    queryKey: [
      'hris',
      'reference-configuration',
      'version',
      requestScope.cacheKey,
      selected?.configurationId,
      selected?.version,
    ],
    queryFn: ({ signal }) =>
      readReferenceConfigurationVersion(
        selected!.configurationId,
        selected!.version,
        requestScope.contextScopeKey,
        signal
      ),
    enabled: requestScope.ready && selected !== null,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });

  const status = resolveReferenceConfigurationViewState({
    loading: !requestScope.ready || workbenchQuery.isLoading,
    denied: isDenied(workbenchQuery.error),
    failed: workbenchQuery.isError,
    workbench: workbenchQuery.data,
  });

  return {
    status,
    requestScope,
    workbench: workbenchQuery.data,
    detail: detailQuery.data,
    detailLoading: detailQuery.isLoading,
    selected,
    statusFilter,
    setStatusFilter,
    select(configurationId: string, version: number) {
      setSelected({ configurationId, version });
    },
    refresh() {
      return workbenchQuery.refetch();
    },
  };
}

function isDenied(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error ? (error as { status?: unknown }).status : undefined;
  return status === 401 || status === 403;
}
