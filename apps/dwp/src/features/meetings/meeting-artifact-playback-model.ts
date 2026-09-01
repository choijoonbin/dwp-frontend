import { HttpError } from '@dwp-frontend/shared-utils';
import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';

const PLAYABLE_CONTENT_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
]);

export type MeetingArtifactPlaybackAvailability =
  | { state: 'READY'; mediaKind: 'audio' | 'video' }
  | {
      state:
        | 'NOT_RECORDING'
        | 'NOT_AVAILABLE'
        | 'RETENTION_UNVERIFIED'
        | 'RETENTION_EXPIRED'
        | 'MEDIA_UNSUPPORTED';
    };

export type MeetingArtifactAccessFailure =
  | 'STALE'
  | 'NOT_AVAILABLE'
  | 'NOT_AUTHORIZED'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_TICKET'
  | 'UNKNOWN';

export function deriveMeetingArtifactPlaybackAvailability(
  artifact: VideoMeetingArtifact,
  now = Date.now()
): MeetingArtifactPlaybackAvailability {
  if (artifact.artifactType !== 'RECORDING') return { state: 'NOT_RECORDING' };
  if (artifact.artifactState !== 'AVAILABLE') return { state: 'NOT_AVAILABLE' };
  const retentionUntil = artifact.retentionUntil ? Date.parse(artifact.retentionUntil) : Number.NaN;
  if (!Number.isFinite(retentionUntil)) return { state: 'RETENTION_UNVERIFIED' };
  if (retentionUntil <= now) return { state: 'RETENTION_EXPIRED' };
  const contentType = artifact.contentType?.trim().toLowerCase();
  if (!contentType || !PLAYABLE_CONTENT_TYPES.has(contentType)) {
    return { state: 'MEDIA_UNSUPPORTED' };
  }
  return { state: 'READY', mediaKind: contentType.startsWith('audio/') ? 'audio' : 'video' };
}

function errorCode(error: HttpError): string | null {
  if (!error.details || typeof error.details !== 'object' || Array.isArray(error.details)) {
    return null;
  }
  const details = error.details as Record<string, unknown>;
  const value = details.errorCode ?? details.reasonCode ?? details.code;
  return typeof value === 'string' ? value.trim().toUpperCase() : null;
}

export function classifyMeetingArtifactAccessFailure(error: unknown): MeetingArtifactAccessFailure {
  if (error instanceof TypeError) return 'INVALID_TICKET';
  if (!(error instanceof HttpError)) return 'UNKNOWN';
  const code = errorCode(error);
  if (code === 'OBJECT_VERSION_CONFLICT') return 'STALE';
  if (code === 'RESOURCE_NOT_AVAILABLE') return 'NOT_AVAILABLE';
  if (code === 'ENTITY_NOT_FOUND' || error.status === 403 || error.status === 404) {
    return 'NOT_AUTHORIZED';
  }
  if (code === 'EXTERNAL_SERVICE_ERROR' || error.status >= 500) return 'SERVICE_UNAVAILABLE';
  return 'UNKNOWN';
}
