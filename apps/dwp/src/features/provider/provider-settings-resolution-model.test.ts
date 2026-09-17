import { describe, expect, it } from 'vitest';

import {
  displayProviderSettingValue,
  providerSettingManagementPath,
  providerSettingStateTone,
  resolveProviderSettingTenantTarget,
} from './provider-settings-resolution-model';

describe('provider setting resolution presentation', () => {
  it('does not present unobservable or stale application states as converged', () => {
    expect(providerSettingStateTone('CONVERGED')).toBe('success');
    expect(providerSettingStateTone('OBSERVATION_UNSUPPORTED')).toBe('info');
    expect(providerSettingStateTone('PUBLISHED_UNOBSERVED')).toBe('warning');
    expect(providerSettingStateTone('OBSERVATION_STALE')).toBe('warning');
    expect(providerSettingStateTone('DRIFTED')).toBe('error');
  });

  it('preserves scalar and structured effective values without inventing a value', () => {
    expect(displayProviderSettingValue(null)).toBe('-');
    expect(displayProviderSettingValue('enabled')).toBe('enabled');
    expect(displayProviderSettingValue({ enabled: true })).toBe('{\n  "enabled": true\n}');
  });

  it('only turns provider-owned internal paths into navigation targets', () => {
    expect(providerSettingManagementPath('/provider/feature-rollouts')).toBe(
      '/provider/feature-rollouts'
    );
    expect(providerSettingManagementPath(' https://example.test ')).toBeNull();
    expect(providerSettingManagementPath('/admin/security')).toBeNull();
  });

  it('keeps the exact environment for a server-searched tenant outside the initial page', () => {
    const firstPage = [{ tenantId: 'tenant-001', environmentKey: 'production' }];
    const searchedTenant = { tenantId: 'tenant-187', environmentKey: 'regulated-eu' };

    expect(resolveProviderSettingTenantTarget('tenant-187', searchedTenant, firstPage)).toEqual(
      searchedTenant
    );
    expect(resolveProviderSettingTenantTarget('', null, firstPage)).toEqual(firstPage[0]);
  });
});
