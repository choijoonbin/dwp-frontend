import { describe, expect, it } from 'vitest';

import {
  providerSettingMetadataPresentation,
  providerSettingWorkflowStatePresentation,
  providerSettingValuePresentation,
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

  it('presents scalars and summarizes structured effective values without raw JSON', () => {
    expect(providerSettingValuePresentation(null)).toEqual({ kind: 'unavailable' });
    expect(providerSettingValuePresentation('enabled')).toEqual({
      kind: 'scalar',
      value: 'enabled',
    });
    expect(providerSettingValuePresentation({ enabled: true })).toEqual({
      kind: 'collection',
      collection: 'OBJECT',
      count: 1,
    });
  });

  it('fails closed for unknown metadata and reason codes', () => {
    expect(providerSettingMetadataPresentation('workflow', 'DIRECT')).toBe('DIRECT');
    expect(providerSettingMetadataPresentation('riskTier', 'INTERNAL_UNKNOWN')).toBe(
      'UNAVAILABLE_VALUE'
    );
    expect(providerSettingMetadataPresentation('resolutionReason', 'SECRET_INTERNAL_REASON')).toBe(
      'UNAVAILABLE_VALUE'
    );
    expect(providerSettingMetadataPresentation('sourceType', 'INTERNAL_SOURCE')).toBe(
      'UNAVAILABLE_VALUE'
    );
    expect(providerSettingMetadataPresentation('decisionCode', 'INTERNAL_DECISION')).toBe(
      'UNAVAILABLE_VALUE'
    );
    expect(providerSettingWorkflowStatePresentation('resolution', 'INTERNAL_RESOLUTION')).toBe(
      'UNAVAILABLE_STATE'
    );
    expect(providerSettingWorkflowStatePresentation('desired', 'INTERNAL_DESIRED')).toBe(
      'UNAVAILABLE_STATE'
    );
    expect(providerSettingWorkflowStatePresentation('application', 'INTERNAL_APPLICATION')).toBe(
      'UNAVAILABLE_STATE'
    );
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
