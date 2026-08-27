import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  isProviderControlPlaneCacheQuery,
  purgeProviderSupportTenantCache,
} from './provider-support-cache';

describe('provider support tenant cache boundary', () => {
  it('keeps provider operations data but rejects tenant and access-sensitive cache entries', () => {
    expect(isProviderControlPlaneCacheQuery({ queryKey: ['provider', 'tenants'] })).toBe(true);
    expect(isProviderControlPlaneCacheQuery({ queryKey: ['admin', 'tenant-branding'] })).toBe(
      false
    );
    expect(
      isProviderControlPlaneCacheQuery({
        queryKey: ['provider', 'tenant-experience-preview'],
      })
    ).toBe(false);
    expect(
      isProviderControlPlaneCacheQuery({
        queryKey: ['provider', 'tenant-detail'],
        meta: { accessSensitive: true },
      })
    ).toBe(false);
  });

  it('purges tenant and sensitive queries when the support identity changes', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['provider', 'tenants'], { retained: true });
    queryClient.setQueryData(['admin', 'tenant-branding'], { tenant: 'SKAX' });
    queryClient.setQueryData(['provider', 'tenant-experience-preview'], { tenant: 'SKAX' });
    await queryClient.fetchQuery({
      queryKey: ['provider', 'access-sensitive'],
      queryFn: async () => ({ tenant: 'SKAX' }),
      meta: { accessSensitive: true },
    });

    await purgeProviderSupportTenantCache(queryClient);

    expect(queryClient.getQueryData(['provider', 'tenants'])).toEqual({ retained: true });
    expect(queryClient.getQueryData(['admin', 'tenant-branding'])).toBeUndefined();
    expect(queryClient.getQueryData(['provider', 'tenant-experience-preview'])).toBeUndefined();
    expect(queryClient.getQueryData(['provider', 'access-sensitive'])).toBeUndefined();
  });
});
