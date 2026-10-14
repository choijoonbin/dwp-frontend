import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';
import { readNavigationPolicyWorkspace } from '../api/navigation-policy-api';
import { resolveNavigationPolicyViewState } from '../model/navigation-policy-model';

import type { NavigationPolicyScopeKind } from '../model/navigation-policy-model';

export function useHrisNavigationPolicyRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
}

export function useNavigationPolicyWorkspace(
  scopeKind: NavigationPolicyScopeKind,
  scopePublicId?: string | null
) {
  const requestScope = useHrisNavigationPolicyRequestScope();
  const [correlationId] = useState(() => crypto.randomUUID());
  const query = useQuery({
    queryKey: [
      'hris',
      'navigation-policy',
      scopeKind,
      scopePublicId ?? null,
      requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      readNavigationPolicyWorkspace({
        scopeKind,
        scopePublicId,
        correlationId,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });
  const status = resolveNavigationPolicyViewState({
    loading: !requestScope.ready || query.isLoading,
    denied: isDenied(query.error),
    failed: query.isError,
    workspace: query.data,
  });

  return {
    status,
    workspace: query.data,
    requestScope,
    correlationId,
    refresh: query.refetch,
  } as const;
}

function isDenied(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = 'status' in error ? (error as { status?: unknown }).status : undefined;
  const responseStatus =
    'response' in error
      ? (error as { response?: { status?: unknown } }).response?.status
      : undefined;
  return status === 401 || status === 403 || responseStatus === 401 || responseStatus === 403;
}
