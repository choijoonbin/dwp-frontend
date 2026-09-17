import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  applyNotificationAttentionControl,
  createNotificationAttentionRule,
  createNotificationTestDelivery,
  deleteNotificationAttentionRule,
  getNotificationAttentionControls,
  getNotificationNoiseQuality,
  listNotificationAttentionContexts,
  listNotificationAttentionRules,
  previewNotificationAttentionControl,
} from './notification-attention-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('notification attention API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('returns server-authoritative attention rule capacity', async () => {
    const collection = { items: [], maxActiveRules: 75 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(collection));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listNotificationAttentionRules()).resolves.toEqual(collection);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/notifications/v1/me/attention-rules');
  });

  it('discovers only bounded recent resource and topic contexts through the user boundary', async () => {
    const collection = {
      items: [
        {
          scopeKind: 'RESOURCE',
          contextKind: 'PROJECT',
          scopeKey: 'project:alpha',
          displayLabel: 'Project Alpha',
          lastSeenAt: '2026-09-17T00:00:00Z',
        },
      ],
      limit: 50,
      generatedAt: '2026-09-17T00:00:01Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(collection));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      listNotificationAttentionContexts({
        kind: 'RESOURCE',
        query: '  Design Ops  ',
        limit: 100,
      })
    ).resolves.toEqual(collection);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/notifications/v1/me/attention-contexts?kind=RESOURCE&query=Design+Ops&limit=50'
    );
    expect(() => listNotificationAttentionContexts({ kind: 'TOPIC_TOKEN', limit: 0 })).toThrow(
      'positive integer'
    );
    expect(() =>
      listNotificationAttentionContexts({ kind: 'TOPIC_TOKEN', query: 'x'.repeat(301) })
    ).toThrow('300 characters or fewer');
  });

  it('creates an exact attention rule with idempotency and CSRF evidence', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ruleId: 'rule-1', version: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await createNotificationAttentionRule({
      scopeKind: 'ACTOR',
      scopeKey: 'person:42',
      effect: 'PRIORITIZE',
      idempotencyKey: 'attention:create:1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/notifications/v1/me/attention-rules');
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'attention:create:1', 'X-XSRF-TOKEN': 'csrf' })
    );
    expect(JSON.parse(String(request.body))).toEqual({
      scopeKind: 'ACTOR',
      scopeKey: 'person:42',
      effect: 'PRIORITIZE',
    });
  });

  it('keeps current-notification controls server-owned', async () => {
    const controls = {
      notificationId: 'notice-1',
      controls: [],
      generatedAt: '2026-09-16T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(controls));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotificationAttentionControls('notice/1')).resolves.toEqual(controls);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/notifications/v1/inbox/notice%2F1/attention-controls'
    );
  });

  it('previews and applies an exact server-fingerprinted attention control', async () => {
    const preview = {
      controlKey: 'FOLLOW_CONTEXT',
      allowed: true,
      policyLocked: false,
      effectiveEffect: 'FOLLOW',
      previewFingerprint: 'a'.repeat(64),
      asOf: '2026-09-17T00:00:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(preview))
      .mockResolvedValueOnce(jsonResponse({ ruleId: 'rule-1', version: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      previewNotificationAttentionControl('notice/1', {
        controlKey: 'FOLLOW_CONTEXT',
        effect: 'FOLLOW',
        expiresAt: null,
      })
    ).resolves.toEqual(preview);
    await applyNotificationAttentionControl('notice/1', {
      controlKey: 'FOLLOW_CONTEXT',
      effect: 'FOLLOW',
      expiresAt: null,
      expectedVersion: null,
      previewFingerprint: preview.previewFingerprint,
      idempotencyKey: 'attention-control:1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/notifications/v1/inbox/notice%2F1/attention-controls/preview'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/notifications/v1/inbox/notice%2F1/attention-controls'
    );
    const apply = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(JSON.parse(String(apply.body))).toEqual({
      controlKey: 'FOLLOW_CONTEXT',
      effect: 'FOLLOW',
      expiresAt: null,
      expectedVersion: null,
      previewFingerprint: 'a'.repeat(64),
    });
    expect(apply.headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'attention-control:1' })
    );
  });

  it('deletes with canonical optimistic version and an idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await deleteNotificationAttentionRule('rule/1', {
      expectedVersion: '7',
      idempotencyKey: 'attention:delete:1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/notifications/v1/me/attention-rules/rule%2F1?expectedVersion=7'
    );
  });

  it('deduplicates test channels without materializing a business notification', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ testId: 'test-1', state: 'PENDING' }));
    vi.stubGlobal('fetch', fetchMock);

    await createNotificationTestDelivery({
      channels: ['IN_APP', 'IN_APP'],
      idempotencyKey: 'test-delivery:1',
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({ channels: ['IN_APP'] });
  });

  it('reads privacy-guarded noise quality from the admin boundary', async () => {
    const result = {
      partial: false,
      unavailableSources: [],
      sufficientCohort: false,
      minimumCohortSize: 10,
      noisyTypes: [],
      generatedAt: '2026-09-16T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(result));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotificationNoiseQuality()).resolves.toEqual(result);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/notifications/v1/admin/noise-quality');
  });

  it('sends bounded quality investigation filters without leaking raw search syntax', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ noisyTypes: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getNotificationNoiseQuality({
      range: 'LAST_7_DAYS',
      query: '  IT Operations  ',
      severity: 'WARNING',
      risk: 'HIGH_MUTE_RATE',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/notifications/v1/admin/noise-quality?range=LAST_7_DAYS&query=IT+Operations&severity=WARNING&risk=HIGH_MUTE_RATE'
    );
    expect(() => getNotificationNoiseQuality({ query: 'x'.repeat(121) })).toThrow(
      '120 characters or fewer'
    );
  });
});
