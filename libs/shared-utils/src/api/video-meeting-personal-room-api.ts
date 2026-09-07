import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import type { ApiResponse } from '../types';
import type { VideoMeetingLifecycleState } from './video-meeting-api';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingPersonalRoom = {
  roomId: string;
  name: string;
  opaqueAlias: string;
  invitationRevision: number;
  version: number;
  updatedAt: string;
  currentMeetingId: string | null;
};
export type VideoMeetingPersonalRoomSession = {
  meetingId: string;
  title: string;
  lifecycleState: VideoMeetingLifecycleState;
  invitationRevision: number;
  createdAt: string;
  endedAt: string | null;
};
export type VideoMeetingPersonalRoomSessionPage = {
  items: VideoMeetingPersonalRoomSession[];
  total: number;
  page: number;
  pageSize: number;
};
export type VideoMeetingPersonalRoomInvitation = {
  name: string;
  meetingId: string | null;
  sessionAvailable: boolean;
};

const base = VIDEO_MEETING_API_BASE + '/personal-room';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const alias = /^[a-f0-9]{32}$/u;
const states = new Set(['DRAFT', 'SCHEDULED', 'LOBBY', 'LIVE', 'ENDED', 'CANCELLED']);
const validInteger = (value: unknown, minimum = 0) =>
  Number.isSafeInteger(value) && Number(value) >= minimum;
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const validName = (value: unknown) =>
  typeof value === 'string' && Boolean(value.trim()) && value.length <= 160;
const validId = (value: unknown) => typeof value === 'string' && uuid.test(value);
const invalid = () => new Error('Invalid personal meeting room contract.');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function parseRoom(value: unknown): VideoMeetingPersonalRoom {
  const room = object(value);
  if (
    !validId(room.roomId) ||
    !validName(room.name) ||
    typeof room.opaqueAlias !== 'string' ||
    !alias.test(room.opaqueAlias) ||
    !validInteger(room.invitationRevision, 1) ||
    !validInteger(room.version) ||
    !validDate(room.updatedAt) ||
    (room.currentMeetingId !== null && !validId(room.currentMeetingId))
  )
    throw invalid();
  return {
    roomId: room.roomId as string,
    name: room.name as string,
    opaqueAlias: room.opaqueAlias,
    invitationRevision: room.invitationRevision as number,
    version: room.version as number,
    updatedAt: room.updatedAt as string,
    currentMeetingId: room.currentMeetingId as string | null,
  };
}
function parseSession(value: unknown): VideoMeetingPersonalRoomSession {
  const session = object(value);
  if (
    !validId(session.meetingId) ||
    !validName(session.title) ||
    !states.has(String(session.lifecycleState)) ||
    !validInteger(session.invitationRevision, 1) ||
    !validDate(session.createdAt) ||
    (session.endedAt !== null && !validDate(session.endedAt))
  )
    throw invalid();
  return {
    meetingId: session.meetingId as string,
    title: session.title as string,
    lifecycleState: session.lifecycleState as VideoMeetingLifecycleState,
    invitationRevision: session.invitationRevision as number,
    createdAt: session.createdAt as string,
    endedAt: session.endedAt as string | null,
  };
}
function command(key: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/u.test(key)) throw invalid();
  return { headers: { 'Idempotency-Key': key } };
}
function version(expectedVersion: number) {
  if (!validInteger(expectedVersion)) throw invalid();
  return { expectedVersion };
}
function name(value: string) {
  if (!validName(value)) throw invalid();
  return value.trim();
}

export async function getVideoMeetingPersonalRoom(
  signal?: AbortSignal
): Promise<VideoMeetingPersonalRoom | null> {
  try {
    const envelope = object((await axiosInstance.get<ApiResponse<unknown>>(base, { signal })).data);
    if (
      envelope.success === false ||
      (envelope.status !== undefined && !['SUCCESS', 'OK'].includes(String(envelope.status)))
    )
      throw invalid();
    const result = envelope.data;
    // ApiResponse excludes null properties: a verified empty success omits `data`.
    if (result === undefined && envelope.status === 'SUCCESS' && envelope.success === true)
      return null;
    return result === null ? null : parseRoom(result);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
export async function createVideoMeetingPersonalRoom(
  roomName: string,
  idempotencyKey: string
): Promise<VideoMeetingPersonalRoom> {
  const body = { name: name(roomName) };
  return parseRoom(
    (
      await axiosInstance.post<ApiResponse<unknown>, typeof body>(
        base,
        body,
        command(idempotencyKey)
      )
    ).data.data
  );
}
export async function updateVideoMeetingPersonalRoom(
  roomName: string,
  expectedVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingPersonalRoom> {
  const body = { name: name(roomName), ...version(expectedVersion) };
  return parseRoom(
    (
      await axiosInstance.put<ApiResponse<unknown>, typeof body>(
        base,
        body,
        command(idempotencyKey)
      )
    ).data.data
  );
}
export async function rotateVideoMeetingPersonalRoomInvitation(
  expectedVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingPersonalRoom> {
  const body = version(expectedVersion);
  return parseRoom(
    (
      await axiosInstance.post<ApiResponse<unknown>, typeof body>(
        base + '/rotate-invitation',
        body,
        command(idempotencyKey)
      )
    ).data.data
  );
}
export async function createVideoMeetingPersonalRoomSession(
  expectedVersion: number,
  invitationRevision: number,
  idempotencyKey: string
): Promise<VideoMeetingPersonalRoomSession> {
  if (!validInteger(invitationRevision, 1)) throw invalid();
  const body = { ...version(expectedVersion), invitationRevision };
  return parseSession(
    (
      await axiosInstance.post<ApiResponse<unknown>, typeof body>(
        base + '/sessions',
        body,
        command(idempotencyKey)
      )
    ).data.data
  );
}
export async function getVideoMeetingPersonalRoomSessions(
  page = 0,
  pageSize = 5,
  signal?: AbortSignal
): Promise<VideoMeetingPersonalRoomSessionPage> {
  if (!validInteger(page) || !validInteger(pageSize, 1) || pageSize > 100) throw invalid();
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const result = object(
    (await axiosInstance.get<ApiResponse<unknown>>(base + '/sessions?' + params, { signal })).data
      .data
  );
  if (
    !Array.isArray(result.items) ||
    !validInteger(result.total) ||
    result.page !== page ||
    result.pageSize !== pageSize ||
    result.items.length > pageSize
  )
    throw invalid();
  return { items: result.items.map(parseSession), total: result.total as number, page, pageSize };
}
export async function resolveVideoMeetingPersonalRoomInvitation(
  opaqueAlias: string,
  revision: number,
  signal?: AbortSignal
): Promise<VideoMeetingPersonalRoomInvitation> {
  if (!alias.test(opaqueAlias) || !validInteger(revision, 1)) throw invalid();
  const result = object(
    (
      await axiosInstance.get<ApiResponse<unknown>>(
        VIDEO_MEETING_API_BASE +
          '/personal-rooms/' +
          opaqueAlias +
          '/invitation?revision=' +
          revision,
        { signal }
      )
    ).data.data
  );
  if (
    !validName(result.name) ||
    typeof result.sessionAvailable !== 'boolean' ||
    (result.meetingId !== null && !validId(result.meetingId)) ||
    result.sessionAvailable !== (result.meetingId !== null)
  )
    throw invalid();
  // An invitation resolves the ordinary meeting journey, never media credentials or consent.
  return {
    name: result.name as string,
    meetingId: result.meetingId as string | null,
    sessionAvailable: result.sessionAvailable,
  };
}
