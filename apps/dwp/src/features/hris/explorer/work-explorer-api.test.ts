import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: transport,
}));

import {
  queryWorkExplorer,
  queryWorkExplorerActivityReceipt,
  queryWorkExplorerReceipt,
  recordWorkExplorerRecent,
  replaceWorkExplorerPreferences,
} from './work-explorer-api';

const NOW = '2026-10-15T06:00:00Z';
const ID = {
  receipt: '11111111-1111-4111-8111-111111111111',
  subject: '22222222-2222-4222-8222-222222222222',
  correlation: '33333333-3333-4333-8333-333333333333',
};
const HASH = 'a'.repeat(64);
const authority = {
  mode: 'SECURE',
  rolloutState: '111',
  expectedDecisionRevision: 'decision-9',
  contextKey: 'hcm.utility',
  contextScopeKey: 'scope:legal-entity:7',
} as const satisfies ProductSurfaceGovernedMutationAuthority;

function projection() {
  return {
    asOf: NOW,
    projectionRevision: 7,
    entitlementRevision: 8,
    favoritePreferenceRevision: 3,
    routes: [],
    favorites: [],
    recents: [],
    inProgress: [],
    nextCursor: null,
    projectionStatus: { state: 'FRESH', degradedSources: [] },
    policy: {
      maxFavorites: 20,
      maxRecents: 20,
      recentTtlDays: 30,
      maxInProgress: 20,
      entitlementRefilter: true,
      cleanupMode: 'READ_AND_WRITE_THROUGH_PURGE',
    },
  };
}

function receipt(commandType: 'EXPLORER_PREFERENCES_REPLACE' | 'EXPLORER_RECENT_RECORD') {
  return {
    receiptId: ID.receipt,
    commandType,
    originatingAction: commandType,
    subjectPrincipalPublicId: ID.subject,
    populationScopeDigest: HASH,
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_APP_DISCOVERY',
    authorizationRevision: 5,
    status: 'ACCEPTED',
    correlationId: ID.correlation,
    requestDigest: HASH,
    createdAt: NOW,
  };
}

function platformReceipt() {
  return {
    receiptId: ID.receipt,
    commandType: 'REFERENCE_CONFIGURATION_PUBLISH',
    originatingAction: 'HRIS_REFERENCE_CONFIGURATION_PUBLISH',
    subjectPrincipalPublicId: ID.subject,
    populationScopeDigest: HASH,
    fieldPolicyRevision: 4,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 5,
    status: 'RESULT_UNKNOWN',
    correlationId: ID.correlation,
    requestDigest: HASH,
    createdAt: NOW,
  };
}

describe('Work Explorer API adapter', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.put.mockReset();
    transport.post.mockReset();
  });

  it('sends the required anchored query and delegates opaque scope handling to shared transport', async () => {
    const signal = new AbortController().signal;
    transport.get.mockResolvedValue({ data: projection() });
    await queryWorkExplorer(
      { asOf: NOW, freshness: 'ALLOW_STALE', filter: 'team time', limit: 100 },
      { contextScopeKey: authority.contextScopeKey, signal }
    );
    expect(transport.get).toHaveBeenCalledWith(
      '/api/platform/v1/hris/explorer?asOf=2026-10-15T06%3A00%3A00Z&freshness=ALLOW_STALE&filter=team+time&limit=100',
      { contextScopeKey: authority.contextScopeKey, signal }
    );
  });

  it('never concatenates a malformed scope ahead of the shared transport validator', async () => {
    const invalidScope = 'scope:utility\nforged';
    transport.get.mockRejectedValue(new Error('Invalid product context scope key.'));

    await expect(
      queryWorkExplorer(
        { asOf: NOW, freshness: 'ALLOW_STALE', limit: 100 },
        { contextScopeKey: invalidScope }
      )
    ).rejects.toThrow('Invalid product context scope key.');
    expect(transport.get).toHaveBeenCalledWith(
      '/api/platform/v1/hris/explorer?asOf=2026-10-15T06%3A00%3A00Z&freshness=ALLOW_STALE&limit=100',
      { contextScopeKey: invalidScope }
    );
  });

  it('replaces ordered favorites with exact CAS, idempotency, and decision evidence', async () => {
    transport.put.mockResolvedValue({ data: receipt('EXPLORER_PREFERENCES_REPLACE') });
    await replaceWorkExplorerPreferences(['hris.explorer.team-time'], 3, {
      authority,
      idempotencyKey: ID.receipt,
    });
    expect(transport.put).toHaveBeenCalledWith(
      '/api/platform/v1/hris/explorer/preferences',
      { orderedFavoriteRouteKeys: ['hris.explorer.team-time'] },
      {
        contextScopeKey: authority.contextScopeKey,
        headers: {
          'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
          'Idempotency-Key': ID.receipt,
          'If-Match': '"pref-3"',
        },
      }
    );
  });

  it('records a recent and reconciles RESULT_UNKNOWN only through the receipt route', async () => {
    transport.post.mockResolvedValue({ data: receipt('EXPLORER_RECENT_RECORD') });
    transport.get.mockResolvedValue({
      data: { ...receipt('EXPLORER_RECENT_RECORD'), status: 'RESULT_UNKNOWN' },
    });
    await recordWorkExplorerRecent('hris.explorer.team-time', {
      authority,
      idempotencyKey: ID.receipt,
    });
    await queryWorkExplorerReceipt(ID.receipt, {
      contextScopeKey: authority.contextScopeKey,
    });
    expect(transport.post).toHaveBeenCalledWith(
      '/api/platform/v1/hris/explorer/recents',
      { routeKey: 'hris.explorer.team-time' },
      expect.objectContaining({ contextScopeKey: authority.contextScopeKey })
    );
    expect(transport.get).toHaveBeenCalledWith(
      `/api/platform/v1/admin/hris/command-receipts/${ID.receipt}`,
      { contextScopeKey: authority.contextScopeKey }
    );
  });

  it('rejects command endpoints that return another Explorer command identity', async () => {
    transport.put.mockResolvedValue({ data: receipt('EXPLORER_RECENT_RECORD') });
    await expect(
      replaceWorkExplorerPreferences([], 3, {
        authority,
        idempotencyKey: ID.receipt,
      })
    ).rejects.toThrow('Mismatched HRIS Work Explorer command receipt.');

    transport.post.mockResolvedValue({ data: receipt('EXPLORER_PREFERENCES_REPLACE') });
    await expect(
      recordWorkExplorerRecent('hris.explorer.team-time', {
        authority,
        idempotencyKey: ID.receipt,
      })
    ).rejects.toThrow('Mismatched HRIS Work Explorer command receipt.');
  });

  it('rejects a receipt lookup response for a different receipt identity', async () => {
    transport.get.mockResolvedValue({
      data: {
        ...receipt('EXPLORER_RECENT_RECORD'),
        receiptId: '44444444-4444-4444-8444-444444444444',
      },
    });
    await expect(queryWorkExplorerReceipt(ID.receipt)).rejects.toThrow(
      'Mismatched HRIS Work Explorer receipt identity.'
    );
  });

  it('keeps mutation reconciliation Explorer-only and admits the platform profile for activity', async () => {
    transport.get.mockResolvedValue({ data: platformReceipt() });

    await expect(queryWorkExplorerActivityReceipt(ID.receipt)).resolves.toMatchObject({
      profile: 'PLATFORM',
      receipt: {
        receiptId: ID.receipt,
        commandType: 'REFERENCE_CONFIGURATION_PUBLISH',
        status: 'RESULT_UNKNOWN',
      },
    });
    await expect(queryWorkExplorerReceipt(ID.receipt)).rejects.toThrow(
      'Mismatched HRIS Work Explorer receipt profile.'
    );

    transport.get.mockResolvedValue({
      data: {
        ...platformReceipt(),
        receiptId: '44444444-4444-4444-8444-444444444444',
      },
    });
    await expect(queryWorkExplorerActivityReceipt(ID.receipt)).rejects.toThrow(
      'Mismatched HRIS Work Explorer receipt identity.'
    );
  });
});
