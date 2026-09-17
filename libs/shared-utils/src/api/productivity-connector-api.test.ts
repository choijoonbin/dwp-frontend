import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  beginWorkspaceProductivityAuthorization,
  disconnectWorkspaceProductivityConnection,
  listWorkspaceProductivityConnections,
  syncWorkspaceProductivityConnection,
  syncWorkspaceProductivityResources,
  type WorkspaceProductivityConnection,
} from './productivity-connector-api';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../axios-instance', () => ({ axiosInstance: http }));

const connectorId = '90000000-0000-4000-8000-000000000001';
const connection: WorkspaceProductivityConnection = {
  connectorId,
  connectorKey: 'MICROSOFT_365',
  displayName: 'Microsoft 365',
  providerType: 'MICROSOFT_GRAPH',
  lifecycleState: 'ACTIVE',
  healthState: 'HEALTHY',
  consentState: 'CONNECTED',
  requestedScopes: ['Mail.ReadBasic', 'Calendars.Read'],
  grantedScopes: ['Mail.ReadBasic'],
  lastSuccessfulSyncAt: '2026-09-17T00:05:00Z',
  actionRequiredCode: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('workspace productivity connection API', () => {
  it('reads the current user connection DTO from the workspace owner route', async () => {
    http.get.mockResolvedValue({ data: { data: [connection] } });

    await expect(listWorkspaceProductivityConnections()).resolves.toEqual([connection]);
    expect(http.get).toHaveBeenCalledWith('/api/platform/v1/workspace/productivity/connections');
  });

  it('uses the owner authorization and sync commands without inventing client state', async () => {
    const authorization = {
      transactionId: '91000000-0000-4000-8000-000000000001',
      authorizationUrl: 'https://login.microsoftonline.com/authorize',
      expiresAt: '2026-09-17T01:00:00Z',
    };
    const run = { runId: '92000000-0000-4000-8000-000000000001' };
    http.post
      .mockResolvedValueOnce({ data: { data: authorization } })
      .mockResolvedValueOnce({ data: { data: run } });

    await expect(beginWorkspaceProductivityAuthorization(connectorId)).resolves.toEqual(
      authorization
    );
    await expect(syncWorkspaceProductivityConnection(connectorId, 'MAIL', true)).resolves.toEqual(
      run
    );
    expect(http.post).toHaveBeenNthCalledWith(
      1,
      `/api/platform/v1/workspace/productivity/connections/${connectorId}/authorization`,
      {}
    );
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      `/api/platform/v1/workspace/productivity/connections/${connectorId}/sync`,
      { resourceKind: 'MAIL', reset: true }
    );
  });

  it('disconnects through the audited owner endpoint and returns its authoritative state', async () => {
    const revoked = {
      ...connection,
      consentState: 'REVOKED' as const,
      grantedScopes: [],
      lastSuccessfulSyncAt: null,
      actionRequiredCode: 'REVOKED',
    };
    http.delete.mockResolvedValue({ data: { data: revoked } });

    await expect(disconnectWorkspaceProductivityConnection(connectorId)).resolves.toEqual(revoked);
    expect(http.delete).toHaveBeenCalledWith(
      `/api/platform/v1/workspace/productivity/connections/${connectorId}`
    );
  });

  it('reports partial dispatch without hiding the resource command that succeeded', async () => {
    const run = { runId: '92000000-0000-4000-8000-000000000001' };
    http.post
      .mockResolvedValueOnce({ data: { data: run } })
      .mockRejectedValueOnce(new Error('503'));

    await expect(
      syncWorkspaceProductivityResources(connectorId, ['MAIL', 'CALENDAR'])
    ).resolves.toEqual({ startedKinds: ['MAIL'], failedKinds: ['CALENDAR'] });
  });

  it('rejects when no resource synchronization command starts', async () => {
    http.post.mockRejectedValue(new Error('503'));

    await expect(
      syncWorkspaceProductivityResources(connectorId, ['MAIL', 'CALENDAR'])
    ).rejects.toThrow('ALL_SYNC_COMMANDS_FAILED');
  });
});
