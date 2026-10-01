import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getMyTenantEffectiveSettings,
  getMyTenantPreferredLocale,
  getCompleteTenantAccessProjection,
  getTenantGovernanceSnapshot,
  getTenantSsoTestLoginReceipt,
  listTenantAuthPolicyChanges,
  listTenantSsoTestLoginReceipts,
  requestTenantSsoTestLogin,
  restoreMyTenantPreferredLocale,
} from './tenant-settings-control-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('tenant settings governance API', () => {
  it('reads authentication policy changes through the generated bounded page contract', async () => {
    const page = {
      items: [{ changeSetId: 'change-1', lifecycleState: 'PUBLISHED' }],
      limit: 100,
      hasMore: true,
    };
    http.get.mockResolvedValueOnce({ data: { data: page } });

    await expect(listTenantAuthPolicyChanges()).resolves.toEqual(page);
    expect(http.get).toHaveBeenCalledWith(
      '/api/auth/admin/tenant-settings/auth-policy/changes?limit=100'
    );
  });

  it('reads source evidence and uses the observed preference version for inheritance restore', async () => {
    const snapshot = { observedAt: '2026-09-29T01:00:00Z', effectiveSettings: [] };
    const settings = [{ settingKey: 'identity.preferredLocale', effectiveValue: 'en-US' }];
    const preference = {
      userId: 42,
      preferredLocale: 'en-US',
      tenantDefaultLocale: 'ko-KR',
      version: 5,
      updatedAt: '2026-09-29T01:00:00Z',
    };
    http.get
      .mockResolvedValueOnce({ data: { data: snapshot } })
      .mockResolvedValueOnce({ data: { data: settings } })
      .mockResolvedValueOnce({ data: { data: preference } });
    http.post.mockResolvedValue({
      data: { data: { ...preference, preferredLocale: null, version: 6 } },
    });

    await expect(getTenantGovernanceSnapshot()).resolves.toEqual(snapshot);
    await expect(getMyTenantEffectiveSettings()).resolves.toEqual(settings);
    await expect(getMyTenantPreferredLocale()).resolves.toEqual(preference);
    await restoreMyTenantPreferredLocale(preference);

    expect(http.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-settings/governance-snapshot',
      '/api/auth/tenant-settings/effective-settings/me',
      '/api/auth/tenant-settings/effective-settings/me/preferred-locale',
    ]);
    expect(http.post).toHaveBeenCalledWith(
      '/api/auth/tenant-settings/effective-settings/me/preferred-locale/restore',
      { version: 5 }
    );
  });

  it('creates and reads bounded immutable SSO test-login receipts', async () => {
    const receipt = {
      testLoginJobId: '10000000-0000-4000-8000-000000000001',
      tenantId: 1,
      providerKey: 'entra-primary',
      lifecycleState: 'UNAVAILABLE',
      internalPrerequisiteState: 'READY_FOR_EXTERNAL_PROBE',
      externalProbeState: 'UNAVAILABLE',
      blockingReasons: ['EXTERNAL_IDP_LOGIN_EXECUTOR_NOT_CONNECTED'],
      executionBoundary: 'UNCONNECTED_EXTERNAL_IDP_EXECUTOR',
      requestedBy: 42,
      idempotencyKey: '20000000-0000-4000-8000-000000000002',
      requestedAt: '2026-09-30T01:00:00Z',
      completedAt: '2026-09-30T01:00:01Z',
      receiptPayloadCanonical: '{"externalProbeState":"UNAVAILABLE"}',
      receiptSha256: 'a'.repeat(64),
    };
    const page = { items: [receipt], limit: 20, hasMore: true };
    const command = {
      idempotencyKey: receipt.idempotencyKey,
      justification: 'Verify the configured enterprise sign-in before rollout.',
    };
    http.post.mockResolvedValueOnce({ data: { data: receipt } });
    http.get
      .mockResolvedValueOnce({ data: { data: page } })
      .mockResolvedValueOnce({ data: { data: receipt } });

    await expect(requestTenantSsoTestLogin(command)).resolves.toEqual(receipt);
    await expect(listTenantSsoTestLoginReceipts()).resolves.toEqual(page);
    await expect(getTenantSsoTestLoginReceipt(receipt.testLoginJobId)).resolves.toEqual(receipt);

    expect(http.post).toHaveBeenCalledWith(
      '/api/auth/admin/tenant-settings/sso-test-login-jobs',
      command
    );
    expect(http.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-settings/sso-test-login-jobs?limit=20',
      `/api/auth/admin/tenant-settings/sso-test-login-jobs/${receipt.testLoginJobId}`,
    ]);
  });

  it('collects every access projection page and preserves complete owner evidence', async () => {
    const coverage = {
      state: 'COMPLETE_INTERNAL_OWNERS',
      includedOwners: ['AUTH'],
      exclusions: [],
      freshestSourceUpdatedAt: '2026-09-29T01:00:00Z',
      owners: [
        {
          ownerKey: 'AUTH',
          state: 'OBSERVED',
          freshnessState: 'FRESH',
          observedAt: '2026-09-29T01:00:00Z',
          sourceUpdatedAt: '2026-09-29T01:00:00Z',
          allowedActions: ['VIEW_DETAIL'],
          exclusions: [],
        },
      ],
    };
    const projectionPage = (page: number, userId: number) => ({
      data: {
        data: {
          snapshotId: 'snapshot-1',
          observedAt: `2026-09-29T0${page + 1}:00:00Z`,
          coverage,
          principals: [
            {
              userId,
              displayName: `User ${userId}`,
              status: 'ACTIVE',
              mfaEnabled: true,
              grants: [],
              pendingApprovalCount: 0,
              sourceUpdatedAt: '2026-09-29T01:00:00Z',
            },
          ],
          page,
          size: 100,
          totalElements: 2,
          totalPages: 2,
        },
      },
    });
    http.get
      .mockResolvedValueOnce(projectionPage(0, 101))
      .mockResolvedValueOnce(projectionPage(1, 202));

    await expect(getCompleteTenantAccessProjection('admin')).resolves.toMatchObject({
      principals: [{ userId: 101 }, { userId: 202 }],
      collectedPages: 2,
      observedAt: '2026-09-29T02:00:00Z',
    });
    expect(http.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-settings/access-projection?page=0&size=100&query=admin',
      '/api/auth/admin/tenant-settings/access-projection?page=1&size=100&query=admin',
    ]);
  });

  it('fails closed when access projection snapshot identity changes between pages', async () => {
    const projection = {
      snapshotId: 'snapshot-1',
      observedAt: '2026-09-29T01:00:00Z',
      coverage: {
        state: 'COMPLETE_INTERNAL_OWNERS',
        includedOwners: ['AUTH'],
        exclusions: [],
        owners: [
          {
            ownerKey: 'AUTH',
            state: 'OBSERVED',
            freshnessState: 'FRESH',
            observedAt: '2026-09-29T01:00:00Z',
            allowedActions: ['VIEW_DETAIL'],
            exclusions: [],
          },
        ],
      },
      principals: [
        {
          userId: 101,
          displayName: 'User 101',
          status: 'ACTIVE',
          mfaEnabled: true,
          grants: [],
          pendingApprovalCount: 0,
          sourceUpdatedAt: '2026-09-29T01:00:00Z',
        },
      ],
      size: 100,
      totalElements: 2,
      totalPages: 2,
    };
    http.get
      .mockResolvedValueOnce({ data: { data: { ...projection, page: 0 } } })
      .mockResolvedValueOnce({
        data: { data: { ...projection, page: 1, snapshotId: 'snapshot-2' } },
      });

    await expect(getCompleteTenantAccessProjection()).rejects.toThrow(
      'TENANT_ACCESS_PROJECTION_PAGINATION_CHANGED'
    );
  });
});
