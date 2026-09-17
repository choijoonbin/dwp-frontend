import type { VideoMeetingPreferences } from '@dwp-frontend/shared-utils/api/video-meeting-preferences-api';
import type { MeetingBackgroundMode } from './meeting-background-types';

export type MeetingPreferenceValues = Omit<VideoMeetingPreferences, 'version' | 'updatedAt'>;

export const DEFAULT_MEETING_PREFERENCE_VALUES: Readonly<MeetingPreferenceValues> = Object.freeze({
  displayName: '',
  microphoneOff: true,
  cameraOff: true,
  prejoinEnabled: true,
  reminderEnabled: true,
  reminderMinutes: 10,
  recapNotifications: true,
});

export function meetingPreferenceValues(value: VideoMeetingPreferences): MeetingPreferenceValues {
  return {
    displayName: value.displayName,
    microphoneOff: value.microphoneOff,
    cameraOff: value.cameraOff,
    prejoinEnabled: value.prejoinEnabled,
    reminderEnabled: value.reminderEnabled,
    reminderMinutes: value.reminderMinutes,
    recapNotifications: value.recapNotifications,
  };
}

export function meetingPreferencesChanged(a: MeetingPreferenceValues, b: MeetingPreferenceValues) {
  return (Object.keys(DEFAULT_MEETING_PREFERENCE_VALUES) as (keyof MeetingPreferenceValues)[]).some(
    (key) => a[key] !== b[key]
  );
}

export type MeetingDevicePreferences = {
  microphoneId: string;
  cameraId: string;
  speakerId: string;
  noiseSuppression: boolean;
  /** Local capture preference. Missing legacy values resolve to standard 720p capture. */
  hdVideo?: boolean;
  /** Canonical local-only choice. Unknown values always fail back to original. */
  backgroundMode?: MeetingBackgroundMode;
  /** Read-only migration input for v1 browser records; new writes omit it. */
  backgroundBlur?: boolean;
};

export type MeetingPreJoinPreferenceDefaults = {
  username: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  speakerDeviceId: string;
  noiseSuppression: boolean;
  hdVideo: boolean;
  backgroundMode: MeetingBackgroundMode;
};

export function resolveMeetingBackgroundMode(
  value: Pick<MeetingDevicePreferences, 'backgroundMode' | 'backgroundBlur'>
): MeetingBackgroundMode {
  if (
    value.backgroundMode === 'original' ||
    value.backgroundMode === 'blur' ||
    value.backgroundMode === 'office'
  )
    return value.backgroundMode;
  return value.backgroundBlur === true ? 'blur' : 'original';
}

export function meetingPreferenceScope(input: {
  isAuthenticated: boolean;
  identityPlane?: string | null;
  tenantId?: string | number | null;
  userId?: string | number | null;
}) {
  return JSON.stringify([input.isAuthenticated, input.identityPlane, input.tenantId, input.userId]);
}

/**
 * Account choices override the host's defaults. Hardware IDs remain local to this browser
 * and are deliberately kept out of the server preference contract.
 */
export function resolveMeetingPreJoinPreferenceDefaults(
  meeting: { defaultMicrophoneEnabled: boolean; defaultCameraEnabled: boolean },
  authenticatedDisplayName: string,
  account: MeetingPreferenceValues | null,
  devices: MeetingDevicePreferences
): MeetingPreJoinPreferenceDefaults {
  const preferredName = account?.displayName.trim();
  return {
    username: preferredName || authenticatedDisplayName.trim(),
    audioEnabled: account ? !account.microphoneOff : meeting.defaultMicrophoneEnabled,
    videoEnabled: account ? !account.cameraOff : meeting.defaultCameraEnabled,
    audioDeviceId: devices.microphoneId,
    videoDeviceId: devices.cameraId,
    speakerDeviceId: devices.speakerId,
    noiseSuppression: devices.noiseSuppression,
    hdVideo: devices.hdVideo === true,
    backgroundMode: resolveMeetingBackgroundMode(devices),
  };
}

export const DEFAULT_MEETING_DEVICE_PREFERENCES: Readonly<MeetingDevicePreferences> = Object.freeze(
  {
    microphoneId: 'default',
    cameraId: 'default',
    speakerId: 'default',
    noiseSuppression: true,
    hdVideo: false,
    backgroundMode: 'original',
  }
);

export function meetingDevicePreferenceKey(scope: string) {
  return `dwp:meetings:devices:v1:${encodeURIComponent(scope)}`;
}

export function readMeetingDevicePreferences(
  storage: Pick<Storage, 'getItem'>,
  scope: string
): MeetingDevicePreferences {
  try {
    const raw: unknown = JSON.parse(storage.getItem(meetingDevicePreferenceKey(scope)) ?? 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      return { ...DEFAULT_MEETING_DEVICE_PREFERENCES };
    const record = raw as Record<string, unknown>;
    const deviceId = (key: string) =>
      typeof record[key] === 'string' && record[key].length <= 512
        ? record[key] || 'default'
        : 'default';
    return {
      microphoneId: deviceId('microphoneId'),
      cameraId: deviceId('cameraId'),
      speakerId: deviceId('speakerId'),
      noiseSuppression: record.noiseSuppression !== false,
      hdVideo: record.hdVideo === true,
      backgroundMode:
        record.backgroundMode === 'original' ||
        record.backgroundMode === 'blur' ||
        record.backgroundMode === 'office'
          ? record.backgroundMode
          : record.backgroundBlur === true
            ? 'blur'
            : 'original',
    };
  } catch {
    return { ...DEFAULT_MEETING_DEVICE_PREFERENCES };
  }
}

export function readBrowserMeetingDevicePreferences(scope: string): MeetingDevicePreferences {
  try {
    if (typeof window === 'undefined') return { ...DEFAULT_MEETING_DEVICE_PREFERENCES };
    return readMeetingDevicePreferences(window.localStorage, scope);
  } catch {
    return { ...DEFAULT_MEETING_DEVICE_PREFERENCES };
  }
}

export function writeMeetingDevicePreferences(
  storage: Pick<Storage, 'setItem'>,
  scope: string,
  value: MeetingDevicePreferences
) {
  storage.setItem(
    meetingDevicePreferenceKey(scope),
    JSON.stringify({
      microphoneId: value.microphoneId,
      cameraId: value.cameraId,
      speakerId: value.speakerId,
      noiseSuppression: value.noiseSuppression,
      hdVideo: value.hdVideo === true,
      backgroundMode: resolveMeetingBackgroundMode(value),
    })
  );
}

export function writeBrowserMeetingDevicePreferences(
  scope: string,
  value: MeetingDevicePreferences
) {
  try {
    if (typeof window !== 'undefined')
      writeMeetingDevicePreferences(window.localStorage, scope, value);
  } catch {
    /* Local browser storage is optional and may be denied by policy. */
  }
}

/** Reconcile only after enumeration; an empty permission-gated inventory is not proof of removal. */
export function reconcileMeetingDevices(
  value: MeetingDevicePreferences,
  devices: readonly Pick<MediaDeviceInfo, 'deviceId' | 'kind'>[]
): MeetingDevicePreferences {
  const resolve = (id: string, kind: MediaDeviceKind) =>
    id === 'default' || devices.some((device) => device.kind === kind && device.deviceId === id)
      ? id
      : 'default';
  return {
    ...value,
    microphoneId: resolve(value.microphoneId, 'audioinput'),
    cameraId: resolve(value.cameraId, 'videoinput'),
    speakerId: resolve(value.speakerId, 'audiooutput'),
  };
}

/**
 * Browser enumeration before permission can be empty or anonymized. Only a labelled inventory is
 * evidence that the browser exposed that device kind, so permission-gated gaps never erase a
 * user's saved choice.
 */
export function reconcileMeetingDevicesFromBrowserInventory(
  value: MeetingDevicePreferences,
  devices: readonly Pick<MediaDeviceInfo, 'deviceId' | 'kind' | 'label'>[]
): MeetingDevicePreferences {
  const authoritative = new Set(
    devices.filter((device) => device.label.trim()).map((device) => device.kind)
  );
  const resolve = (id: string, kind: MediaDeviceKind) =>
    id === 'default' || !authoritative.has(kind)
      ? id
      : devices.some((device) => device.kind === kind && device.deviceId === id)
        ? id
        : 'default';
  return {
    ...value,
    microphoneId: resolve(value.microphoneId, 'audioinput'),
    cameraId: resolve(value.cameraId, 'videoinput'),
    speakerId: resolve(value.speakerId, 'audiooutput'),
  };
}

export function meetingDevicePreferencesEqual(
  left: MeetingDevicePreferences,
  right: MeetingDevicePreferences
) {
  return (
    left.microphoneId === right.microphoneId &&
    left.cameraId === right.cameraId &&
    left.speakerId === right.speakerId &&
    left.noiseSuppression === right.noiseSuppression &&
    (left.hdVideo === true) === (right.hdVideo === true) &&
    resolveMeetingBackgroundMode(left) === resolveMeetingBackgroundMode(right)
  );
}
