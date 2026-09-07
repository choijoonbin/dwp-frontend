import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  getVideoMeetingPreferences,
  updateVideoMeetingPreferences,
  type VideoMeetingPreferences,
  type VideoMeetingPreferencesInput,
} from './video-meeting-preferences-api';

const preferences: VideoMeetingPreferences = {
  displayName: 'Meeting user',
  microphoneOff: true,
  cameraOff: true,
  prejoinEnabled: true,
  reminderEnabled: true,
  reminderMinutes: 5,
  recapNotifications: true,
  version: 0,
  updatedAt: null,
};
const command: VideoMeetingPreferencesInput = {
  ...preferences,
  expectedVersion: 0,
  idempotencyKey: 'preferences-command-01',
};
const response = (data: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify({ data }) }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  resetCsrfToken();
});

describe('Meeting account preferences boundary', () => {
  it('reads the canonical owner path without caller-selected account identifiers', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(preferences));
    vi.stubGlobal('fetch', fetcher);
    expect(await getVideoMeetingPreferences()).toEqual(preferences);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/meetings/v1/preferences');
  });

  it('sends an explicit safe allowlist and stable version/idempotency headers', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ ...preferences, version: 1 }));
    vi.stubGlobal('fetch', fetcher);
    await updateVideoMeetingPreferences({
      ...command,
      displayName: '  Meeting user  ',
      microphoneId: 'private-device',
      tenantId: 999,
      recordingConsent: true,
    } as VideoMeetingPreferencesInput);
    const [path, request] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(path).toBe('/api/meetings/v1/preferences');
    expect(request.method).toBe('PUT');
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe(command.idempotencyKey);
    expect(JSON.parse(String(request.body))).toEqual({
      displayName: 'Meeting user',
      microphoneOff: true,
      cameraOff: true,
      prejoinEnabled: true,
      reminderEnabled: true,
      reminderMinutes: 5,
      recapNotifications: true,
      expectedVersion: 0,
    });
  });

  it.each([
    { expectedVersion: -1 },
    { expectedVersion: 0.5 },
    { reminderMinutes: -1 },
    { reminderMinutes: 61 },
    { reminderMinutes: 1.5 },
    { idempotencyKey: 'bad' },
    { displayName: 'x'.repeat(101) },
    { microphoneOff: 'true' },
  ])('rejects invalid command fields before network access: %j', async (patch) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      updateVideoMeetingPreferences({ ...command, ...patch } as VideoMeetingPreferencesInput)
    ).rejects.toThrow('Invalid meeting preferences command.');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...preferences, version: -1 },
    { ...preferences, cameraOff: 'false' },
    { ...preferences, reminderMinutes: 120 },
    { ...preferences, updatedAt: 'not-a-date' },
  ])('rejects invalid response without interpolating data into the error', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)));
    await expect(getVideoMeetingPreferences()).rejects.toThrow(
      'Invalid meeting preferences response.'
    );
  });

  it('does not carry unexpected server fields into account state', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ ...preferences, microphoneId: 'private-device', recordingConsent: true })
        )
    );
    expect(await getVideoMeetingPreferences()).toEqual(preferences);
  });
});
