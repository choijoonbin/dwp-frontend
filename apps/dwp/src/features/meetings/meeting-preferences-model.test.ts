import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MEETING_DEVICE_PREFERENCES,
  DEFAULT_MEETING_PREFERENCE_VALUES,
  meetingDevicePreferenceKey,
  meetingPreferenceValues,
  meetingPreferencesChanged,
  meetingPreferenceScope,
  readBrowserMeetingDevicePreferences,
  readMeetingDevicePreferences,
  reconcileMeetingDevices,
  reconcileMeetingDevicesFromBrowserInventory,
  resolveMeetingPreJoinPreferenceDefaults,
  writeMeetingDevicePreferences,
} from './meeting-preferences-model';

describe('meeting account and device preferences', () => {
  it('defaults to silent local preview and keeps consent out of preference values', () => {
    expect(DEFAULT_MEETING_PREFERENCE_VALUES).toMatchObject({
      microphoneOff: true,
      cameraOff: true,
      prejoinEnabled: true,
    });
    const values = meetingPreferenceValues({
      ...DEFAULT_MEETING_PREFERENCE_VALUES,
      version: 4,
      updatedAt: null,
    });
    expect(values).not.toHaveProperty('version');
    expect(values).not.toHaveProperty('consent');
    expect(meetingPreferencesChanged(values, { ...values })).toBe(false);
    expect(meetingPreferencesChanged(values, { ...values, cameraOff: false })).toBe(true);
  });
  it('separates device storage by tenant, actor and identity plane', () => {
    expect(meetingDevicePreferenceKey('NORMAL:tenant-a:user-1')).not.toBe(
      meetingDevicePreferenceKey('NORMAL:tenant-b:user-1')
    );
    expect(meetingDevicePreferenceKey('NORMAL:tenant-a:user-1')).not.toBe(
      meetingDevicePreferenceKey('SUPPORT:tenant-a:user-1')
    );
  });
  it('uses account and browser-local choices for actual prejoin defaults', () => {
    const account = {
      ...DEFAULT_MEETING_PREFERENCE_VALUES,
      displayName: '  Preferred name  ',
      microphoneOff: false,
      cameraOff: true,
    };
    expect(
      resolveMeetingPreJoinPreferenceDefaults(
        { defaultMicrophoneEnabled: false, defaultCameraEnabled: true },
        'Authenticated name',
        account,
        {
          microphoneId: 'mic-local',
          cameraId: 'camera-local',
          speakerId: 'speaker-local',
          noiseSuppression: false,
        }
      )
    ).toEqual({
      username: 'Preferred name',
      audioEnabled: true,
      videoEnabled: false,
      audioDeviceId: 'mic-local',
      videoDeviceId: 'camera-local',
      speakerDeviceId: 'speaker-local',
      noiseSuppression: false,
    });
    expect(
      meetingPreferenceScope({
        isAuthenticated: true,
        identityPlane: 'TENANT',
        tenantId: 1,
        userId: 7,
      })
    ).toBe('[true,"TENANT",1,7]');
  });
  it('falls back to meeting defaults only when account preferences are unavailable', () => {
    expect(
      resolveMeetingPreJoinPreferenceDefaults(
        { defaultMicrophoneEnabled: true, defaultCameraEnabled: false },
        ' Authenticated name ',
        null,
        DEFAULT_MEETING_DEVICE_PREFERENCES
      )
    ).toMatchObject({
      username: 'Authenticated name',
      audioEnabled: true,
      videoEnabled: false,
    });
  });
  it.each(['null', '[]', 'not-json', '42', '{"microphoneId":42,"noiseSuppression":true}'])(
    'safely restores invalid local settings: %s',
    (raw) => {
      expect(readMeetingDevicePreferences({ getItem: () => raw }, 'scope')).toEqual(
        DEFAULT_MEETING_DEVICE_PREFERENCES
      );
    }
  );
  it('handles unavailable browser storage', () => {
    expect(
      readMeetingDevicePreferences(
        {
          getItem: () => {
            throw new Error('blocked');
          },
        },
        'scope'
      )
    ).toEqual(DEFAULT_MEETING_DEVICE_PREFERENCES);
  });
  it('keeps browser preference restore safe when localStorage access itself is denied', () => {
    vi.stubGlobal(
      'window',
      Object.defineProperty({}, 'localStorage', {
        get: () => {
          throw new DOMException('Denied', 'SecurityError');
        },
      })
    );
    try {
      expect(readBrowserMeetingDevicePreferences('scope')).toEqual(
        DEFAULT_MEETING_DEVICE_PREFERENCES
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('writes only hardware selection, not arbitrary sensitive fields', () => {
    let saved = '';
    writeMeetingDevicePreferences(
      {
        setItem: (_, value) => {
          saved = value;
        },
      },
      'scope',
      {
        ...DEFAULT_MEETING_DEVICE_PREFERENCES,
        microphoneId: 'mic-1',
        token: 'never',
      } as typeof DEFAULT_MEETING_DEVICE_PREFERENCES
    );
    expect(JSON.parse(saved)).toEqual({
      ...DEFAULT_MEETING_DEVICE_PREFERENCES,
      microphoneId: 'mic-1',
    });
  });
  it('falls back for removed devices and does not confuse an output with a microphone', () => {
    expect(
      reconcileMeetingDevices(
        {
          microphoneId: 'speaker',
          cameraId: 'camera',
          speakerId: 'speaker',
          noiseSuppression: false,
        },
        [
          { kind: 'audiooutput', deviceId: 'speaker' },
          { kind: 'videoinput', deviceId: 'camera' },
        ]
      )
    ).toEqual({
      microphoneId: 'default',
      cameraId: 'camera',
      speakerId: 'speaker',
      noiseSuppression: false,
    });
  });
  it('does not erase saved IDs from a permission-gated empty or anonymous inventory', () => {
    const saved = {
      microphoneId: 'saved-mic',
      cameraId: 'saved-camera',
      speakerId: 'saved-speaker',
      noiseSuppression: true,
    };
    expect(reconcileMeetingDevicesFromBrowserInventory(saved, [])).toEqual(saved);
    expect(
      reconcileMeetingDevicesFromBrowserInventory(saved, [
        { kind: 'audioinput', deviceId: 'default', label: '' },
        { kind: 'videoinput', deviceId: 'default', label: '' },
      ])
    ).toEqual(saved);
  });
  it('falls back only stale kinds after an authoritative labelled prejoin inventory', () => {
    expect(
      reconcileMeetingDevicesFromBrowserInventory(
        {
          microphoneId: 'removed-mic',
          cameraId: 'camera-1',
          speakerId: 'speaker-1',
          noiseSuppression: false,
        },
        [
          { kind: 'audioinput', deviceId: 'mic-1', label: 'Desk microphone' },
          { kind: 'videoinput', deviceId: 'camera-1', label: 'Desk camera' },
          { kind: 'audiooutput', deviceId: 'speaker-1', label: 'Desk speaker' },
        ]
      )
    ).toEqual({
      microphoneId: 'default',
      cameraId: 'camera-1',
      speakerId: 'speaker-1',
      noiseSuppression: false,
    });
  });
});
