import { describe, expect, it } from 'vitest';

import {
  providerEstateState,
  providerTenantPagination,
  providerTenantServiceHealth,
} from './provider-tenant-estate-model';

describe('provider tenant estate model', () => {
  it('uses one-based shareable URLs with bounded server page sizes', () => {
    expect(providerTenantPagination('5', '25')).toEqual({ page: 4, pageSize: 25 });
    expect(providerTenantPagination('-1', '150')).toEqual({ page: 0, pageSize: 25 });
  });

  it('prioritizes failed and transitional estate posture', () => {
    expect(
      providerEstateState({
        organizations: 1,
        tenants: 1,
        activeTenants: 0,
        provisioningTenants: 1,
        suspendedTenants: 0,
        failedTenants: 1,
        openOperations: 0,
        activeSupportSessions: 0,
        regions: [],
        serviceTiers: [],
      })
    ).toBe('CRITICAL');
    expect(
      providerEstateState({
        organizations: 1,
        tenants: 1,
        activeTenants: 0,
        provisioningTenants: 1,
        suspendedTenants: 0,
        failedTenants: 0,
        openOperations: 0,
        activeSupportSessions: 0,
        regions: [],
        serviceTiers: [],
      })
    ).toBe('ATTENTION');
  });

  it('does not claim a healthy estate when owner coverage is unavailable or incomplete', () => {
    expect(providerEstateState(undefined)).toBe('UNAVAILABLE');
    expect(
      providerEstateState({
        organizations: 1,
        tenants: 2,
        activeTenants: 1,
        provisioningTenants: 0,
        suspendedTenants: 0,
        failedTenants: 0,
        openOperations: 0,
        activeSupportSessions: 0,
        regions: [],
        serviceTiers: [],
      })
    ).toBe('UNAVAILABLE');
  });

  it('does not claim ready service health for empty or unknown owner states', () => {
    expect(providerTenantServiceHealth({ services: [] } as never)).toBe('UNAVAILABLE');
    expect(
      providerTenantServiceHealth({ services: [{ lifecycleState: 'INTERNAL_STATE' }] } as never)
    ).toBe('UNAVAILABLE');
    expect(providerTenantServiceHealth({ services: [{ lifecycleState: 'READY' }] } as never)).toBe(
      'READY'
    );
  });
});
