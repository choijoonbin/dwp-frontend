import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';
import { hrisSystemDataSource } from '../api/hris-system-api';
import { buildHrisSystemWorkspaceModel } from '../model/hris-system-model';

import type { HrisSystemDataSource } from '../api/hris-system-api';
import type { ProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';

export const HRIS_SYSTEM_QUERY_KEY = ['hris', 'administration', 'system-access', 'v2'] as const;
export const HRIS_SYSTEM_QUERY_PURPOSE = 'HRIS_SYSTEM_CONFIGURATION' as const;

export function hrisSystemQueryKey(
  requestScope: ProductSurfaceRequestScope,
  authorityCacheKey: string
) {
  return [
    ...HRIS_SYSTEM_QUERY_KEY,
    ...requestScope.cacheKey,
    authorityCacheKey,
    HRIS_SYSTEM_QUERY_PURPOSE,
  ] as const;
}

export function useHrisSystemRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.management',
  });
}

export function useHrisSystemWorkspace(dataSource: HrisSystemDataSource = hrisSystemDataSource) {
  const requestScope = useHrisSystemRequestScope();
  const { permissions } = usePermissions();
  const authorityCacheKey = useMemo(
    () =>
      permissions
        .map(
          (permission) =>
            `${permission.resourceType}:${permission.resourceKey}:${permission.permissionCode}:${permission.effect}`
        )
        .sort()
        .join('|'),
    [permissions]
  );
  const contextScopeKey = requestScope.contextScopeKey;
  const ready =
    requestScope.governed === true && requestScope.ready === true && Boolean(contextScopeKey);
  return useQuery({
    queryKey: hrisSystemQueryKey(requestScope, authorityCacheKey),
    queryFn: async ({ signal }) => {
      if (!contextScopeKey) throw new Error('HRIS system scope is unavailable.');
      const snapshot = await dataSource.load(contextScopeKey, signal);
      return buildHrisSystemWorkspaceModel(snapshot.access, snapshot.projection);
    },
    enabled: ready,
    meta: requestScope.queryMeta,
    staleTime: 30_000,
  });
}
