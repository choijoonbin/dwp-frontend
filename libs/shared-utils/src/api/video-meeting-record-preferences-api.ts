import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingRecordBookmark = {
  meetingId: string;
  favorite: boolean;
  version: number;
  updatedAt: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function reference(value: string) {
  if (!uuid.test(value)) throw new Error('A valid meeting bookmark reference is required');
  return value;
}
function readBookmark(value: VideoMeetingRecordBookmark, meetingId: string) {
  if (
    !value ||
    value.meetingId !== meetingId ||
    typeof value.favorite !== 'boolean' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
    (value.updatedAt !== null &&
      (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)))) ||
    (value.version === 0 && (value.favorite || value.updatedAt !== null)) ||
    (value.version > 0 && value.updatedAt === null)
  )
    throw new Error('The meeting bookmark binding is invalid');
  return {
    meetingId: value.meetingId,
    favorite: value.favorite,
    version: value.version,
    updatedAt: value.updatedAt,
  };
}

/** Reads only the current authorized page. Missing or substituted items are not defaults. */
export async function getVideoMeetingRecordBookmarks(
  meetingIds: readonly string[],
  signal?: AbortSignal
): Promise<VideoMeetingRecordBookmark[]> {
  if (
    !meetingIds.length ||
    meetingIds.length > 100 ||
    new Set(meetingIds).size !== meetingIds.length
  )
    throw new Error('A bounded unique meeting bookmark page is required');
  const params = new URLSearchParams();
  meetingIds.forEach((id) => params.append('meetingIds', reference(id)));
  const result = (
    await axiosInstance.get<ApiResponse<{ items: VideoMeetingRecordBookmark[] }>>(
      `${VIDEO_MEETING_API_BASE}/history/bookmarks?${params}`,
      { signal, timeoutMs: 8_000 }
    )
  ).data.data;
  if (!Array.isArray(result?.items) || result.items.length !== meetingIds.length)
    throw new Error('The meeting bookmark page binding is invalid');
  const mapped = new Map(result.items.map((item) => [item?.meetingId, item]));
  if (mapped.size !== meetingIds.length)
    throw new Error('The meeting bookmark page binding is invalid');
  return meetingIds.map((id) => readBookmark(mapped.get(id)!, id));
}

export async function setVideoMeetingRecordBookmark(
  meetingId: string,
  favorite: boolean,
  expectedVersion: number,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<VideoMeetingRecordBookmark> {
  reference(meetingId);
  reference(idempotencyKey);
  if (
    typeof favorite !== 'boolean' ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  )
    throw new Error('A boolean bookmark and valid expected version are required');
  const result = (
    await axiosInstance.put<
      ApiResponse<VideoMeetingRecordBookmark>,
      { favorite: boolean; expectedVersion: number }
    >(
      `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/bookmark`,
      { favorite, expectedVersion },
      { headers: { 'Idempotency-Key': idempotencyKey }, signal, timeoutMs: 8_000 }
    )
  ).data.data;
  // Replayed commands return the current authorized state, which may have advanced.
  const bookmark = readBookmark(result, meetingId);
  if (bookmark.version <= expectedVersion)
    throw new Error('The meeting bookmark mutation version did not advance');
  return bookmark;
}
