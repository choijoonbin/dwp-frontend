import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  applyNotificationBulkAction,
  applyNotificationTriage,
  getNotificationInbox,
  getNotificationCapabilities,
  getNotificationTypeContracts,
  parseNotificationLiveSignal,
  updateNotificationDeliveryProfile,
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

  it('accepts only content-free live signals', () => {
    const notificationId = '93af7315-2271-462e-a819-3d238a28830f';
    expect(
      parseNotificationLiveSignal({
        changeVersion: '42',
        counterVersion: '84',
        changedIds: [notificationId],
      })
    ).toEqual({
      changeVersion: '42',
      counterVersion: '84',
      changedIds: [notificationId],
    });
    expect(
      parseNotificationLiveSignal({ changeVersion: '1', changedIds: [notificationId] })
    ).toEqual({ changeVersion: '1', changedIds: [notificationId] });
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
    });
    expect(parseNotificationLiveSignal({ changeVersion: 2, changedIds: [] })).toBeNull();
    expect(parseNotificationLiveSignal({ changeVersion: '-1', changedIds: [] })).toBeNull();
  });
});
