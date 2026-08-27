import { describe, expect, it } from 'vitest';

import { providerEstateState, providerTenantPagination } from './provider-tenant-estate-model';

describe('provider tenant estate model', () => {
  it('uses one-based shareable URLs with bounded server page sizes', () => {
    expect(providerTenantPagination('5', '25')).toEqual({ page: 4, pageSize: 25 });
    expect(providerTenantPagination('-1', '150')).toEqual({ page: 0, pageSize: 25 });
  });

  it('prioritizes failed and transitional estate posture', () => {
    expect(providerEstateState({ failedTenants: 1 } as never)).toBe('CRITICAL');
    expect(providerEstateState({ provisioningTenants: 1 } as never)).toBe('ATTENTION');
    expect(providerEstateState(undefined)).toBe('HEALTHY');
  });
});
