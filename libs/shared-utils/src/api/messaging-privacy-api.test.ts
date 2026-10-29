import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getMessagingPrivacyPreference,
  updateMessagingPrivacyPreference,
} from './messaging-privacy-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('messaging privacy API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('reads both durable self-owned privacy choices', async () => {
    const preference = {
      readReceiptsEnabled: true,
      presenceSharingEnabled: false,
      version: 3,
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(preference));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMessagingPrivacyPreference()).resolves.toEqual(preference);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/messaging/v1/privacy-preferences');
  });

  it('allows a presence-only update so older read-status state is preserved by the server', async () => {
    const preference = {
      readReceiptsEnabled: true,
      presenceSharingEnabled: false,
      version: 4,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(preference));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateMessagingPrivacyPreference({ presenceSharingEnabled: false, version: 3 })
    ).resolves.toEqual(preference);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/messaging/v1/privacy-preferences');
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      presenceSharingEnabled: false,
      version: 3,
    });
  });
});
