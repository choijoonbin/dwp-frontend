import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createNotificationAttentionGovernanceDraft,
  getNotificationAttentionGovernance,
  publishNotificationAttentionGovernance,
  rejectNotificationAttentionGovernance,
  withdrawNotificationAttentionGovernance,
} from './notification-attention-governance-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('notification attention governance API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('reads the tenant-scoped workspace from the existing policy surface', async () => {
    const workspace = { activeRevision: null, drafts: [], changeVersion: '0' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(workspace));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotificationAttentionGovernance()).resolves.toEqual(workspace);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/notifications/v1/admin/policies/attention-governance'
    );
  });

  it('creates a versioned draft with CSRF and an exact idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ governanceId: 'gov-1', state: 'DRAFT' }));
    vi.stubGlobal('fetch', fetchMock);

    await createNotificationAttentionGovernanceDraft({
      settings: {
        maxActiveUserRules: 20,
        maxVipRules: 10,
        maxFollowRules: 15,
        approvedTopicAllowlist: ['#sec-soc-alert'],
        mandatoryPolicyPrecedence: true,
        minimumAnalyticsCohort: 10,
        independentReviewerRequired: true,
      },
      changeReason: 'Protect tenant attention governance',
      expectedVersion: '0',
      idempotencyKey: 'attention-governance:draft:1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/notifications/v1/admin/policies/attention-governance/drafts'
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.headers).toEqual(
      expect.objectContaining({
        'Idempotency-Key': 'attention-governance:draft:1',
        'X-XSRF-TOKEN': 'csrf',
      })
    );
  });

  it('publishes only through the explicit approval endpoint and optimistic version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ governanceId: 'gov-1', state: 'PUBLISHED' }));
    vi.stubGlobal('fetch', fetchMock);

    await publishNotificationAttentionGovernance('gov/1', {
      expectedVersion: '3',
      reason: 'Independent security and privacy review completed',
      idempotencyKey: 'attention-governance:publish:1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/notifications/v1/admin/policies/attention-governance/gov%2F1/publish'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      expectedVersion: '3',
      reason: 'Independent security and privacy review completed',
    });
  });

  it('uses distinct reject and withdraw commands with auditable reasons', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ governanceId: 'gov-1', state: 'REJECTED' }))
      .mockResolvedValueOnce(jsonResponse({ governanceId: 'gov-2', state: 'WITHDRAWN' }));
    vi.stubGlobal('fetch', fetchMock);

    await rejectNotificationAttentionGovernance('gov-1', {
      expectedVersion: '4',
      reason: 'Independent reviewer requires narrower rule limits',
      idempotencyKey: 'attention-governance:reject:1',
    });
    await withdrawNotificationAttentionGovernance('gov-2', {
      expectedVersion: '7',
      reason: 'The author will revise the analytics privacy threshold',
      idempotencyKey: 'attention-governance:withdraw:1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/notifications/v1/admin/policies/attention-governance/gov-1/reject'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/notifications/v1/admin/policies/attention-governance/gov-2/withdraw'
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'attention-governance:withdraw:1' })
    );
  });

  it('rejects non-canonical idempotency keys before dispatch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(() =>
      publishNotificationAttentionGovernance('gov-1', {
        expectedVersion: '1',
        reason: 'Independent security and privacy review completed',
        idempotencyKey: ' invalid ',
      })
    ).toThrow('canonical attention governance idempotency key');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
