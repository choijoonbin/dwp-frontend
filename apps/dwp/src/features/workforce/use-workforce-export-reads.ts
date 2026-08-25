import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listWorkforceExportAttempts,
  listWorkforceExportDatasets,
  listWorkforceExportRequests,
  previewWorkforceExport,
} from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type { WorkforceExportDatasetKey } from '@dwp-frontend/shared-utils';

export function useWorkforceExportReads({
  datasetKey,
  searchParams,
  selectedId,
}: {
  datasetKey: WorkforceExportDatasetKey;
  searchParams: URLSearchParams;
  selectedId: string | null;
}) {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
  const datasetsQuery = useQuery({
    queryKey: ['workforce', 'exports', 'datasets', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listWorkforceExportDatasets(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const datasets = datasetsQuery.data ?? [];
  const selectedDataset =
    datasets.find((dataset) => dataset.datasetKey === datasetKey) ?? datasets[0];
  const effectiveDatasetKey = selectedDataset?.datasetKey ?? datasetKey;
  const selection = useMemo(() => {
    if (!selectedDataset) return {};
    return Object.fromEntries(
      selectedDataset.allowedSelectionKeys
        .map((key) => [key, searchParams.get(key)?.trim()] as const)
        .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    );
  }, [searchParams, selectedDataset]);
  const previewQuery = useQuery({
    queryKey: [
      'workforce',
      'exports',
      'preview',
      effectiveDatasetKey,
      selection,
      ...requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      previewWorkforceExport(effectiveDatasetKey, selection, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(selectedDataset),
    meta: requestScope.queryMeta,
  });
  const requestsQuery = useQuery({
    queryKey: ['workforce', 'exports', 'requests', ...requestScope.cacheKey],
    queryFn: ({ signal }) => listWorkforceExportRequests(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
  });
  const requests = requestsQuery.data ?? [];
  const selected = requests.find((request) => request.requestId === selectedId) ?? null;
  const attemptsQuery = useQuery({
    queryKey: ['workforce', 'exports', selectedId, 'attempts', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      listWorkforceExportAttempts(selectedId!, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(selectedId),
    meta: requestScope.queryMeta,
  });
  return {
    attemptsQuery,
    datasets,
    datasetsQuery,
    effectiveDatasetKey,
    previewQuery,
    requests,
    requestsQuery,
    selected,
    selectedDataset,
    selection,
  };
}
