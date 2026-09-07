import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

/** Account preferences are not device identifiers, recording consent, or tenant policy. */
export type VideoMeetingPreferences = {
  displayName: string;
  microphoneOff: boolean;
  cameraOff: boolean;
  prejoinEnabled: boolean;
  reminderEnabled: boolean;
  reminderMinutes: number;
  recapNotifications: boolean;
  version: number;
  updatedAt: string | null;
};

export type VideoMeetingPreferencesInput = Omit<
  VideoMeetingPreferences,
  'version' | 'updatedAt'
> & {
  expectedVersion: number;
  idempotencyKey: string;
};

const preferenceFlags = [
  'microphoneOff',
  'cameraOff',
  'prejoinEnabled',
  'reminderEnabled',
  'recapNotifications',
] as const;

function parsePreferences(value: unknown): VideoMeetingPreferences {
  if (typeof value !== 'object' || value === null)
    throw new Error('Invalid meeting preferences response.');
  const source = value as Record<string, unknown>;
  if (
    typeof source.displayName !== 'string' ||
    source.displayName.length > 100 ||
    preferenceFlags.some((key) => typeof source[key] !== 'boolean') ||
    !Number.isSafeInteger(source.version) ||
    Number(source.version) < 0 ||
    !Number.isInteger(source.reminderMinutes) ||
    Number(source.reminderMinutes) < 0 ||
    Number(source.reminderMinutes) > 60 ||
    (source.updatedAt !== null &&
      (typeof source.updatedAt !== 'string' || !Number.isFinite(Date.parse(source.updatedAt))))
  ) {
    throw new Error('Invalid meeting preferences response.');
  }
  return {
    displayName: source.displayName,
    microphoneOff: source.microphoneOff as boolean,
    cameraOff: source.cameraOff as boolean,
    prejoinEnabled: source.prejoinEnabled as boolean,
    reminderEnabled: source.reminderEnabled as boolean,
    reminderMinutes: source.reminderMinutes as number,
    recapNotifications: source.recapNotifications as boolean,
    version: source.version as number,
    updatedAt: source.updatedAt as string | null,
  };
}

export async function getVideoMeetingPreferences(): Promise<VideoMeetingPreferences> {
  const response = await axiosInstance.get<ApiResponse<VideoMeetingPreferences>>(
    `${VIDEO_MEETING_API_BASE}/preferences`
  );
  return parsePreferences(response.data.data);
}

export async function updateVideoMeetingPreferences(
  input: VideoMeetingPreferencesInput
): Promise<VideoMeetingPreferences> {
  if (
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    !Number.isInteger(input.reminderMinutes) ||
    input.reminderMinutes < 0 ||
    input.reminderMinutes > 60 ||
    typeof input.displayName !== 'string' ||
    input.displayName.length > 100 ||
    preferenceFlags.some((key) => typeof input[key] !== 'boolean') ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(input.idempotencyKey)
  )
    throw new Error('Invalid meeting preferences command.');

  // Explicit allowlist prevents device IDs or a recording-consent field crossing this boundary.
  const body = {
    displayName: input.displayName.trim(),
    microphoneOff: input.microphoneOff,
    cameraOff: input.cameraOff,
    prejoinEnabled: input.prejoinEnabled,
    reminderEnabled: input.reminderEnabled,
    reminderMinutes: input.reminderMinutes,
    recapNotifications: input.recapNotifications,
    expectedVersion: input.expectedVersion,
  };
  const response = await axiosInstance.put<ApiResponse<VideoMeetingPreferences>, typeof body>(
    `${VIDEO_MEETING_API_BASE}/preferences`,
    body,
    { headers: { 'Idempotency-Key': input.idempotencyKey } }
  );
  return parsePreferences(response.data.data);
}
