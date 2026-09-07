import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { VideoMeetingArtifact } from './video-meeting-api';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingTranscriptSegment = {
  segmentId: string;
  startMillis: number;
  endMillis: number;
  text: string;
};

export type VideoMeetingTranscriptPage = {
  artifactId: string;
  artifactVersion: number;
  segments: VideoMeetingTranscriptSegment[];
  nextCursor: number | null;
  hasMore: boolean;
  queryApplied: boolean;
  retentionUntil: string;
};

type WireTranscriptPage = Partial<VideoMeetingTranscriptPage>;

export function normalizeVideoMeetingTranscriptPage(
  value: WireTranscriptPage,
  artifact: VideoMeetingArtifact,
  now = Date.now()
): VideoMeetingTranscriptPage {
  const retentionUntil = typeof value.retentionUntil === 'string' ? value.retentionUntil : '';
  const retentionBoundary = Date.parse(retentionUntil);
  const segments = Array.isArray(value.segments) ? value.segments : [];
  const identifiers = new Set<string>();
  let previousStart = -1;
  let textLength = 0;
  if (
    artifact.artifactType !== 'TRANSCRIPT' ||
    value.artifactId !== artifact.artifactId ||
    value.artifactVersion !== artifact.version ||
    !Number.isSafeInteger(value.artifactVersion) ||
    artifact.retentionUntil !== retentionUntil ||
    !Number.isFinite(retentionBoundary) ||
    retentionBoundary <= now ||
    segments.length > 50 ||
    typeof value.hasMore !== 'boolean' ||
    typeof value.queryApplied !== 'boolean' ||
    (value.nextCursor !== null &&
      (!Number.isSafeInteger(value.nextCursor) ||
        value.nextCursor! < 1 ||
        value.nextCursor! > 500)) ||
    value.hasMore !== (value.nextCursor !== null)
  ) {
    throw new TypeError('The meeting transcript page is invalid.');
  }
  const normalized = segments.map((segment) => {
    if (
      !segment ||
      typeof segment.segmentId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/u.test(segment.segmentId) ||
      identifiers.has(segment.segmentId) ||
      !Number.isSafeInteger(segment.startMillis) ||
      !Number.isSafeInteger(segment.endMillis) ||
      segment.startMillis < previousStart ||
      segment.startMillis < 0 ||
      segment.endMillis <= segment.startMillis ||
      typeof segment.text !== 'string' ||
      segment.text.length < 1 ||
      segment.text.length > 4_000
    ) {
      throw new TypeError('The meeting transcript segment is invalid.');
    }
    identifiers.add(segment.segmentId);
    previousStart = segment.startMillis;
    textLength += segment.text.length;
    return {
      segmentId: segment.segmentId,
      startMillis: segment.startMillis,
      endMillis: segment.endMillis,
      text: segment.text,
    };
  });
  if (textLength > 100_000) throw new TypeError('The meeting transcript page is too large.');
  return {
    artifactId: value.artifactId!,
    artifactVersion: value.artifactVersion!,
    segments: normalized,
    nextCursor: value.nextCursor ?? null,
    hasMore: value.hasMore,
    queryApplied: value.queryApplied,
    retentionUntil,
  };
}

export async function queryVideoMeetingTranscript(
  meetingId: string,
  artifact: VideoMeetingArtifact,
  options: { cursor?: number; pageSize?: number; query?: string } = {}
): Promise<VideoMeetingTranscriptPage> {
  const response = await axiosInstance.post<ApiResponse<WireTranscriptPage>, object>(
    `${VIDEO_MEETING_API_BASE}/meetings/${encodeURIComponent(meetingId)}/artifacts/${encodeURIComponent(artifact.artifactId)}/transcript/query`,
    {
      expectedArtifactVersion: artifact.version,
      cursor: options.cursor ?? 0,
      pageSize: options.pageSize ?? 25,
      query: options.query?.trim() || null,
    }
  );
  return normalizeVideoMeetingTranscriptPage(response.data.data, artifact);
}
