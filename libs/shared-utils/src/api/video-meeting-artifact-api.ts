import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

const PLAYABLE_RECORDING_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
]);

export type VideoMeetingArtifactAccessTicket = {
  artifactId: string;
  artifactVersion: number;
  accessUrl: string;
  expiresAt: string;
  contentType: string;
};

type WireArtifactAccessTicket = Partial<VideoMeetingArtifactAccessTicket>;

function validHttpsAccessUrl(value: string): boolean {
  if (value.length > 8_192) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      Boolean(host) &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.port === '' || url.port === '443') &&
      host !== 'localhost' &&
      !host.endsWith('.local') &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) &&
      !host.includes(':')
    );
  } catch {
    return false;
  }
}

export function normalizeVideoMeetingArtifactAccessTicket(
  value: WireArtifactAccessTicket,
  expectedArtifactId: string,
  expectedArtifactVersion: number,
  expectedContentType: string,
  retentionUntil: string,
  now = Date.now()
): VideoMeetingArtifactAccessTicket {
  const contentType = value.contentType?.trim().toLowerCase();
  const expiresAt = typeof value.expiresAt === 'string' ? Date.parse(value.expiresAt) : Number.NaN;
  const retentionBoundary = Date.parse(retentionUntil);
  if (
    value.artifactId !== expectedArtifactId ||
    value.artifactVersion !== expectedArtifactVersion ||
    !Number.isSafeInteger(value.artifactVersion) ||
    value.artifactVersion < 0 ||
    typeof value.accessUrl !== 'string' ||
    !validHttpsAccessUrl(value.accessUrl) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    !Number.isFinite(retentionBoundary) ||
    expiresAt > retentionBoundary ||
    !contentType ||
    !PLAYABLE_RECORDING_CONTENT_TYPES.has(contentType) ||
    contentType !== expectedContentType.trim().toLowerCase()
  ) {
    throw new TypeError('The meeting recording access ticket is invalid.');
  }
  return {
    artifactId: value.artifactId,
    artifactVersion: value.artifactVersion,
    accessUrl: value.accessUrl,
    expiresAt: value.expiresAt!,
    contentType,
  };
}

export async function createVideoMeetingArtifactAccessTicket(
  meetingId: string,
  artifactId: string,
  expectedArtifactVersion: number,
  expectedContentType: string,
  retentionUntil: string
): Promise<VideoMeetingArtifactAccessTicket> {
  const response = await axiosInstance.post<
    ApiResponse<WireArtifactAccessTicket>,
    { expectedArtifactVersion: number }
  >(
    `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/artifacts/${encodeURIComponent(artifactId)}/access-ticket`,
    { expectedArtifactVersion }
  );
  return normalizeVideoMeetingArtifactAccessTicket(
    response.data.data,
    artifactId,
    expectedArtifactVersion,
    expectedContentType,
    retentionUntil
  );
}
