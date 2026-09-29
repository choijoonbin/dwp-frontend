import { useQuery } from '@tanstack/react-query';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { getHrisPayrollWorkspace } from '../api/payroll-api';
import { buildPayrollSelfServiceModel } from '../model/payroll-self-service-model';

export function useHrisPayrollWorkspace() {
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.personal',
  });
  const query = useQuery({
    queryKey: ['hcm', 'pay', ...requestScope.cacheKey],
    queryFn: async ({ signal }) => {
      const source = await getHrisPayrollWorkspace(requestScope.contextScopeKey, signal);
      return buildPayrollSelfServiceModel(source);
    },
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 60_000,
  });

  return {
    ready: requestScope.ready,
    authorityKey: JSON.stringify(requestScope.cacheKey),
    model: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
