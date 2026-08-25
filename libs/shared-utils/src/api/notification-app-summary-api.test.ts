import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getNotificationSummaryByApp,
  parseAppNotificationSummary,
} from './notification-app-summary-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

const generatedAt = '2026-08-21T00:30:00Z';

describe('notification app summary API boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the current actor summary through the gateway and preserves freshness', async () => {
    const summary = {
      partial: false,
      unavailableSources: [],
      apps: [
        {
          appKey: 'messaging',
          totalUnread: 6,
          actionableUnread: 2,
          urgentUnread: 0,
          lastActivityAt: '2026-08-21T00:29:10Z',
        },
      ],
      changeVersion: '128',
      counterVersion: '54',
      generatedAt,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(summary));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(getNotificationSummaryByApp(controller.signal)).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/v1/summary/by-app',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('keeps a partial source failure distinct from a healthy empty summary', () => {
    expect(
      parseAppNotificationSummary({
        partial: true,
        unavailableSources: ['USER_NOTIFICATION_PROJECTION'],
        apps: [],
        changeVersion: '0',
        counterVersion: '0',
        generatedAt,
      })
    ).toEqual({
      partial: true,
      unavailableSources: ['USER_NOTIFICATION_PROJECTION'],
      apps: [],
      changeVersion: '0',
      counterVersion: '0',
      generatedAt,
    });
  });

  it('rejects unstable keys, invalid counters, and inconsistent partial metadata', () => {
    const valid = {
      partial: false,
      unavailableSources: [],
      apps: [
        {
          appKey: 'messaging',
          totalUnread: 2,
          actionableUnread: 1,
          urgentUnread: 0,
          lastActivityAt: generatedAt,
        },
      ],
      changeVersion: '1',
      counterVersion: '1',
      generatedAt,
    };

    expect(() =>
      parseAppNotificationSummary({
        ...valid,
        apps: [{ ...valid.apps[0], appKey: 'Messaging/Internal' }],
      })
    ).toThrow('stable appKey');
    expect(() =>
      parseAppNotificationSummary({
        ...valid,
        apps: [{ ...valid.apps[0], actionableUnread: 3 }],
      })
    ).toThrow('cannot exceed');
    expect(() =>
      parseAppNotificationSummary({
        ...valid,
        unavailableSources: ['USER_NOTIFICATION_PROJECTION'],
      })
    ).toThrow('partial=true');
  });
});
