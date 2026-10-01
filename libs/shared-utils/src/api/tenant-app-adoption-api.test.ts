import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activateTenantCapabilityOverride,
  activateTenantAppAssignment,
  activateTenantAppInstallation,
  createTenantCapabilityOverride,
  createTenantAppAssignment,
  createTenantAppInstallation,
  decideTenantCapabilityOverride,
  decideTenantAppAssignment,
  decideTenantAppInstallation,
  getTenantCapabilityOverrideProjection,
  getTenantAppAdoptionProjection,
  listTenantAppAssignments,
  revokeTenantCapabilityOverride,
  revokeTenantAppAssignment,
  submitTenantCapabilityOverride,
  submitTenantAppInstallation,
  type TenantAppAssignment,
  type TenantAppInstallation,
  type TenantCapabilityOverrideChange,
} from './tenant-app-adoption-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

beforeEach(() => vi.resetAllMocks());

describe('tenant app adoption API', () => {
  it('keeps installation and workforce assignment lifecycle commands separate', async () => {
    const installation = {
      installationId: 'installation-1',
      version: 3,
    } as TenantAppInstallation;
    const assignment = { assignmentId: 'assignment-1', version: 7 } as TenantAppAssignment;
    const assignmentPage = { items: [assignment], limit: 100, hasMore: true };
    http.get
      .mockResolvedValueOnce({
        data: {
          data: {
            installations: [],
            installationsLimit: 100,
            installationsHasMore: false,
          },
        },
      })
      .mockResolvedValueOnce({ data: { data: assignmentPage } });
    http.post.mockResolvedValue({ data: { data: installation } });

    await getTenantAppAdoptionProjection();
    await expect(listTenantAppAssignments('installation-1')).resolves.toEqual(assignmentPage);
    await createTenantAppInstallation({
      productKey: 'approvals',
      appResourceKey: 'APP.APPROVALS',
      installationKind: 'INTERNAL_AUTH_CONTROLLED',
      seatCapacity: 25,
      justification: 'Adopt approvals for the tenant workforce.',
    });
    await submitTenantAppInstallation(installation);
    await decideTenantAppInstallation(installation, 'APPROVE', 'Independent review completed.');
    await activateTenantAppInstallation(installation, 'Independent activation completed.');
    await createTenantAppAssignment({
      installationId: 'installation-1',
      userId: 42,
      justification: 'Assign approvals for operational review work.',
    });
    await decideTenantAppAssignment(assignment, 'APPROVE', 'Assignment scope verified.');
    await activateTenantAppAssignment(assignment, 'Seat and approval verified.');
    await revokeTenantAppAssignment(assignment, 'Workforce responsibility ended.');

    expect(http.get).toHaveBeenNthCalledWith(1, '/api/auth/admin/tenant-app-adoption');
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/api/auth/admin/tenant-app-adoption/assignments?installationId=installation-1'
    );
    expect(http.post.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-app-adoption/installations',
      '/api/auth/admin/tenant-app-adoption/installations/installation-1/submit',
      '/api/auth/admin/tenant-app-adoption/installations/installation-1/decision',
      '/api/auth/admin/tenant-app-adoption/installations/installation-1/activate',
      '/api/auth/admin/tenant-app-adoption/assignments',
      '/api/auth/admin/tenant-app-adoption/assignments/assignment-1/decision',
      '/api/auth/admin/tenant-app-adoption/assignments/assignment-1/activate',
      '/api/auth/admin/tenant-app-adoption/assignments/assignment-1/revoke',
    ]);
    expect(http.post.mock.calls[1]?.[1]).toEqual({ version: 3 });
    expect(http.post.mock.calls[2]?.[1]).toEqual({
      version: 3,
      decision: 'APPROVE',
      reason: 'Independent review completed.',
    });
    expect(http.post.mock.calls[5]?.[1]).toEqual({
      version: 7,
      decision: 'APPROVE',
      reason: 'Assignment scope verified.',
    });
  });

  it('uses the versioned capability suppression workflow endpoints', async () => {
    const change = {
      overrideChangeId: 'override-1',
      version: 4,
    } as TenantCapabilityOverrideChange;
    http.get.mockResolvedValue({ data: { data: { capabilities: [], changes: [] } } });
    http.post.mockResolvedValue({ data: { data: change } });

    await getTenantCapabilityOverrideProjection();
    await createTenantCapabilityOverride({
      contractKey: 'mail.admin.policy.update',
      desiredState: 'DISABLED',
      validTo: '2026-12-31T00:00:00Z',
      justification: 'Temporarily suppress the capability during the tenant control review.',
    });
    await submitTenantCapabilityOverride(change);
    await decideTenantCapabilityOverride(
      change,
      'APPROVE',
      'Independent capability review passed.'
    );
    await activateTenantCapabilityOverride(change, 'Independent activation checks passed.');
    await revokeTenantCapabilityOverride(change, 'The temporary tenant restriction is complete.');

    expect(http.get).toHaveBeenCalledWith(
      '/api/auth/admin/tenant-app-adoption/capability-overrides'
    );
    expect(http.post.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/tenant-app-adoption/capability-overrides',
      '/api/auth/admin/tenant-app-adoption/capability-overrides/override-1/submit',
      '/api/auth/admin/tenant-app-adoption/capability-overrides/override-1/decision',
      '/api/auth/admin/tenant-app-adoption/capability-overrides/override-1/activate',
      '/api/auth/admin/tenant-app-adoption/capability-overrides/override-1/revoke',
    ]);
    expect(http.post.mock.calls[1]?.[1]).toEqual({ version: 4 });
    expect(http.post.mock.calls[2]?.[1]).toEqual({
      version: 4,
      decision: 'APPROVE',
      reason: 'Independent capability review passed.',
    });
  });
});
