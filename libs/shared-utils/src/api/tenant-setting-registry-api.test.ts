import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTenantSettingRegistryChange,
  decideTenantSettingRegistryChange,
  getManagedTenantEffectiveSettings,
  listTenantSettingOwners,
  listTenantSettingRegistryChanges,
  publishTenantSettingRegistryChange,
  submitTenantSettingRegistryChange,
  type TenantSettingRegistryChange,
} from './tenant-setting-registry-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('tenant setting registry API', () => {
  it('keeps draft, independent decision, and publish commands versioned', async () => {
    const change = { changeId: 'change-1', version: 4 } as TenantSettingRegistryChange;
    const changePage = { items: [change], limit: 100, hasMore: true };
    http.get
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: changePage } })
      .mockResolvedValueOnce({ data: { data: [] } });
    http.post.mockResolvedValue({ data: { data: change } });

    await listTenantSettingOwners();
    await expect(listTenantSettingRegistryChanges()).resolves.toEqual(changePage);
    await createTenantSettingRegistryChange({
      settingKey: 'authentication.requireMfa',
      desiredState: 'VALUE',
      proposedValue: true,
      justification: 'Require MFA for every tenant identity.',
    });
    await submitTenantSettingRegistryChange(change);
    await decideTenantSettingRegistryChange(change, 'APPROVE', 'Independent review completed.');
    await publishTenantSettingRegistryChange(change);
    await getManagedTenantEffectiveSettings();

    expect(http.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-setting-registry/owners',
      '/api/auth/admin/tenant-setting-registry/changes',
      '/api/auth/tenant-settings/managed-effective/me',
    ]);
    expect(http.post.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-setting-registry/changes',
      '/api/auth/admin/tenant-setting-registry/changes/change-1/submit',
      '/api/auth/admin/tenant-setting-registry/changes/change-1/decision',
      '/api/auth/admin/tenant-setting-registry/changes/change-1/publish',
    ]);
    expect(http.post.mock.calls[1]?.[1]).toEqual({ version: 4 });
    expect(http.post.mock.calls[2]?.[1]).toEqual({
      version: 4,
      decision: 'APPROVE',
      reason: 'Independent review completed.',
    });
  });
});
