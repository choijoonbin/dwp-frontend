import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  applyNotificationBulkAction,
  applyNotificationTriage,
  getNotificationInbox,
  getNotificationCapabilities,
  getNotificationTypeContracts,
  createNotificationTemplateDraft,
  createNotificationSuppression,
  publishNotificationTemplate,
  previewNotificationSuppression,
  getNotificationConnectionState,
  parseNotificationConnectionStateSignal,
  parseNotificationLiveSignal,
  publishNotificationConnectionState,
  resolveNotificationTarget,
  updateNotificationDeliveryProfile,
  undoNotificationBulkAction,
} from './notification-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('notification API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('builds a bounded keyset inbox query without leaking ALL filters', async () => {
    const page = { items: [], hasMore: false, changeVersion: '1' };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getNotificationInbox({
        view: 'PRIORITY',
        cursor: 'signed cursor',
        limit: 500,
        query: '  approval  ',
        priority: 'ALL',
        readState: 'ALL',
      })
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/v1/inbox?view=PRIORITY&cursor=signed+cursor&limit=100&query=approval',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('reads server-owned delivery capabilities instead of assuming omnichannel support', async () => {
    const capabilities = {
      enabledChannels: ['IN_APP'],
      unavailableChannels: ['EMAIL', 'WEB_PUSH', 'MOBILE_PUSH', 'TEAMS', 'SLACK'],
      canonicalStore: 'POSTGRESQL',
      realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
      externalDeliveryState: 'DISABLED',
      generatedAt: '2026-08-19T00:00:00Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(capabilities));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getNotificationCapabilities()).resolves.toEqual(capabilities);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/notifications/v1/capabilities');
  });

  it('resolves a deep link through the authoritative target endpoint', async () => {
    const resolution = {
      notificationId: 'notice-1',
      targetState: 'AVAILABLE',
      action: {
        actionKey: 'OPEN',
        label: '대화 열기',
        href: '/messages/direct?conversation=42',
        enabled: true,
        primary: true,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(resolution));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resolveNotificationTarget('notice/1')).resolves.toEqual(resolution);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/notifications/v1/inbox/notice%2F1/target');
  });

  it('sends triage with optimistic version, CSRF, and idempotency headers', async () => {
    const result = { item: { notificationId: 'notice-1', version: '4' }, changeVersion: '4' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(result));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      applyNotificationTriage('notice-1', {
        action: 'SNOOZE',
        expectedVersion: '3',
        snoozedUntil: '2026-08-19T12:00:00Z',
        idempotencyKey: 'triage:test-1',
      })
    ).resolves.toEqual(result);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/notifications/v1/inbox/notice-1/snooze');
    expect(request.headers).toEqual(
      expect.objectContaining({
        'X-XSRF-TOKEN': 'csrf-token',
        'Idempotency-Key': 'triage:test-1',
      })
    );
    expect(JSON.parse(String(request.body))).toEqual({
      expectedVersion: '3',
      snoozedUntil: '2026-08-19T12:00:00Z',
    });
  });

  it('rejects oversized bulk work before opening a network request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(() =>
      applyNotificationBulkAction({
        notificationIds: Array.from({ length: 101 }, (_, index) => `notice-${index}`),
        action: 'READ',
        idempotencyKey: 'bulk:test-1',
      })
    ).toThrow('limited to 100');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('undoes a durable bulk receipt through the scoped idempotent endpoint', async () => {
    const undoToken = 'c12f7fb3-1cc5-4f69-a26d-f3cc04a67a21';
    const result = {
      results: [],
      changeVersion: '12',
      summary: { unread: 0 },
      undoToken: null,
      undoExpiresAt: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(result));
    vi.stubGlobal('fetch', fetchMock);

    await expect(undoNotificationBulkAction(undoToken, 'bulk-undo:test-1')).resolves.toEqual(
      result
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/notifications/v1/inbox/bulk-actions/${undoToken}/undo`
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual(
      expect.objectContaining({
        'X-XSRF-TOKEN': 'csrf-token',
        'Idempotency-Key': 'bulk-undo:test-1',
      })
    );
  });

  it('updates the complete delivery profile through the managed mutation contract', async () => {
    const profile = {
      channels: {
        IN_APP: true,
        EMAIL: true,
        WEB_PUSH: false,
        MOBILE_PUSH: false,
        TEAMS: false,
        SLACK: false,
      },
      quietHours: {
        enabled: true,
        start: '19:00',
        end: '08:00',
        timeZone: 'Asia/Seoul',
        days: [1, 2, 3, 4, 5],
        allowUrgentBypass: true,
      },
      digest: { mode: 'DAILY' as const, deliveryTime: '08:30', dayOfWeek: null },
      presentation: { bannerMode: 'SMART' as const, previewMode: 'TITLE_ONLY' as const },
      version: '7',
      updatedAt: '2026-08-19T01:00:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ...profile, version: '8' }));
    vi.stubGlobal('fetch', fetchMock);

    await updateNotificationDeliveryProfile(profile, 'profile:test-1');

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/notifications/v1/me/delivery-profile');
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.method).toBe('PUT');
    expect(request.headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'profile:test-1' })
    );
    expect(JSON.parse(String(request.body))).toEqual(profile);
  });

  it('keeps admin contract pagination opaque and URL encoded', async () => {
    const page = { items: [], hasMore: false };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(page));
    vi.stubGlobal('fetch', fetchMock);

    await getNotificationTypeContracts({
      cursor: 'opaque+/=',
      query: 'security notice',
      state: 'ACTIVE',
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/notifications/v1/admin/types?cursor=opaque%2B%2F%3D&limit=40&query=security+notice&state=ACTIVE'
    );
  });

  it('uses immutable template draft and independent publish endpoints', async () => {
    const revisionId = '93af7315-2271-462e-a819-3d238a28830f';
    const typeVersionId = 'e9802f96-423d-4b34-8e42-b87287a37c19';
    const draft = {
      revisionId,
      typeVersionId,
      typeKey: 'MESSAGING.DIRECT_MESSAGE',
      appKey: 'messaging',
      channel: 'IN_APP',
      locale: 'ko-KR',
      state: 'DRAFT',
      revision: 1,
      version: '1',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(draft))
      .mockResolvedValueOnce(jsonResponse({ ...draft, state: 'PUBLISHED' }));
    vi.stubGlobal('fetch', fetchMock);

    await createNotificationTemplateDraft(
      {
        typeVersionId,
        channel: 'IN_APP',
        locale: 'ko-KR',
        title: '{{senderName}}님의 메시지',
        preview: '{{messagePreview}}',
        body: '{{messagePreview}}',
        actionLabel: '대화 열기',
        changeReason: '회사 표현 기준에 맞춘 메시지 문구입니다.',
        expectedVersion: '0',
      },
      'template-draft:test-1'
    );
    await publishNotificationTemplate(
      revisionId,
      { expectedVersion: '1', reason: '표현 정확성과 개인정보 노출을 검토했습니다.' },
      'template-publish:test-1'
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/notifications/v1/admin/templates/drafts');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/notifications/v1/admin/templates/${revisionId}/publish`
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'template-draft:test-1' })
    );
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'template-publish:test-1' })
    );
  });

  it('previews governed delivery suppression before the idempotent mutation', async () => {
    const input = {
      scopeType: 'APP' as const,
      scopeKey: 'messaging',
      channel: 'IN_APP' as const,
      startsAt: null,
      expiresAt: '2026-08-19T12:00:00Z',
      criticalBypass: true,
      reason: 'Incident INC-2047 is producing duplicate direct-message events.',
    };
    const preview = { ...input, affectedTypeCount: 3, observedNotifications7Days: 240 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(preview))
      .mockResolvedValueOnce(jsonResponse({ ...input, suppressionId: 'suppression-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await previewNotificationSuppression(input);
    await createNotificationSuppression(input, 'suppression:test-1');

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/notifications/v1/admin/suppressions/preview');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/notifications/v1/admin/suppressions');
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).headers).toEqual(
      expect.objectContaining({ 'Idempotency-Key': 'suppression:test-1' })
    );
  });

  it('accepts only content-free live signals', () => {
    const notificationId = '93af7315-2271-462e-a819-3d238a28830f';
    expect(
      parseNotificationLiveSignal({
        changeVersion: '42',
        counterVersion: '84',
        changedIds: [notificationId],
        arrivalIds: [notificationId],
      })
    ).toEqual({
      changeVersion: '42',
      counterVersion: '84',
      changedIds: [notificationId],
      arrivalIds: [notificationId],
    });
    expect(
      parseNotificationLiveSignal({ changeVersion: '1', changedIds: [notificationId] })
    ).toEqual({ changeVersion: '1', changedIds: [notificationId], arrivalIds: [] });
    expect(
      parseNotificationLiveSignal({
        changeVersion: '1',
        counterVersion: '1',
        changedIds: [notificationId],
        title: 'must not be trusted by the parser',
      })
    ).toBeNull();
    expect(parseNotificationLiveSignal({ changeVersion: '2' })).toEqual({
      changeVersion: '2',
      changedIds: [],
      arrivalIds: [],
    });
    expect(
      parseNotificationLiveSignal({
        changeVersion: '2',
        changedIds: [],
        arrivalIds: [notificationId],
      })
    ).toBeNull();
    expect(parseNotificationLiveSignal({ changeVersion: 2, changedIds: [] })).toBeNull();
    expect(parseNotificationLiveSignal({ changeVersion: '-1', changedIds: [] })).toBeNull();
  });

  it('owns a replayable content-free connection state for late-mounted views', () => {
    expect(parseNotificationConnectionStateSignal({ state: 'live' })).toEqual({ state: 'live' });
    expect(parseNotificationConnectionStateSignal({ state: 'offline' })).toBeNull();
    expect(
      parseNotificationConnectionStateSignal({ state: 'live', title: 'not allowed' })
    ).toBeNull();

    publishNotificationConnectionState({ state: 'live' });
    expect(getNotificationConnectionState()).toBe('live');
    publishNotificationConnectionState({ state: 'polling' });
    expect(getNotificationConnectionState()).toBe('polling');
  });
});
