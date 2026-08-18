import { queryOptions } from '@tanstack/react-query';
import { getTenantBranding } from '@dwp-frontend/shared-utils/api/tenant-branding-api';

export const tenantBrandingQueryOptions = queryOptions({
  queryKey: ['tenant-branding'] as const,
  queryFn: getTenantBranding,
  staleTime: 10 * 60 * 1000,
  retry: 1,
  retryOnMount: false,
});
