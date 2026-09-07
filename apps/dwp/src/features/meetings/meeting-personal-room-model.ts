import type { VideoMeetingPersonalRoom } from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';

export function personalRoomInvitationUrl(
  origin: string,
  room: Pick<VideoMeetingPersonalRoom, 'opaqueAlias' | 'invitationRevision'>
): string {
  const url = new URL(origin);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== origin ||
    !/^[a-f0-9]{32}$/u.test(room.opaqueAlias) ||
    !Number.isSafeInteger(room.invitationRevision) ||
    room.invitationRevision < 1
  )
    throw new Error('Invalid personal room invitation.');
  url.pathname = '/meetings/join';
  url.search = new URLSearchParams({
    room: room.opaqueAlias,
    revision: String(room.invitationRevision),
  }).toString();
  return url.href;
}

export function personalRoomCommandFailure(error: unknown): 'forbidden' | 'conflict' | 'failed' {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  return 'failed';
}
