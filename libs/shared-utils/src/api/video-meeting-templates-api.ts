import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export type VideoMeetingTemplateScope = 'PERSONAL' | 'ORGANIZATION';
export type VideoMeetingTemplateFilter = 'ALL' | VideoMeetingTemplateScope;
export type VideoMeetingTemplateAgendaItem = {
  title: string;
  description: string;
  role: string;
  durationMinutes: number;
};
export type VideoMeetingTemplateInput = {
  name: string;
  purpose: string;
  category: string;
  durationMinutes: number;
  agendaItems: VideoMeetingTemplateAgendaItem[];
};
export type VideoMeetingTemplate = VideoMeetingTemplateInput & {
  templateId: string;
  scope: VideoMeetingTemplateScope;
  favorite: boolean;
  canEdit: boolean;
  version: number;
  updatedAt: string;
};
export type VideoMeetingTemplatePage = {
  items: VideoMeetingTemplate[];
  total: number;
  page: number;
  pageSize: number;
};
export type VideoMeetingTemplateScheduleDraft = {
  sourceTemplateId: string;
  sourceTemplateVersion: number;
  title: string;
  purpose: string;
  durationMinutes: number;
  agendaItems: VideoMeetingTemplateAgendaItem[];
  accessScope: 'INVITED';
  waitingRoomEnabled: true;
  defaultMicrophoneEnabled: false;
  defaultCameraEnabled: false;
  requiresPolicyRevalidation: true;
};

const base = VIDEO_MEETING_API_BASE + '/templates';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function path(templateId: string) {
  if (!uuid.test(templateId)) throw new Error('A valid template reference is required');
  return base + '/' + encodeURIComponent(templateId);
}
function version(expectedVersion: number) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
    throw new Error('A valid template version is required');
  return { expectedVersion };
}
function command(idempotencyKey: string) {
  if (!uuid.test(idempotencyKey)) throw new Error('A stable UUID idempotency key is required');
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

export async function getVideoMeetingTemplates(
  options: {
    scope?: VideoMeetingTemplateFilter;
    q?: string;
    category?: string;
    favoritesOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal
): Promise<VideoMeetingTemplatePage> {
  const params = new URLSearchParams({
    scope: options.scope ?? 'ALL',
    q: options.q ?? '',
    page: String(options.page ?? 0),
    pageSize: String(options.pageSize ?? 30),
    category: options.category ?? '',
    favoritesOnly: String(options.favoritesOnly ?? false),
  });
  return (
    await axiosInstance.get<ApiResponse<VideoMeetingTemplatePage>>(base + '?' + params, {
      signal,
      timeoutMs: 8_000,
    })
  ).data.data;
}

export async function getVideoMeetingTemplate(
  templateId: string,
  signal?: AbortSignal
): Promise<VideoMeetingTemplate> {
  return (await axiosInstance.get<ApiResponse<VideoMeetingTemplate>>(path(templateId), { signal }))
    .data.data;
}

export async function createVideoMeetingTemplate(
  input: VideoMeetingTemplateInput,
  idempotencyKey: string
): Promise<VideoMeetingTemplate> {
  return (
    await axiosInstance.post<ApiResponse<VideoMeetingTemplate>, VideoMeetingTemplateInput>(
      base,
      input,
      command(idempotencyKey)
    )
  ).data.data;
}

export async function updateVideoMeetingTemplate(
  templateId: string,
  input: VideoMeetingTemplateInput,
  expectedVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingTemplate> {
  const payload = { ...version(expectedVersion), template: input };
  return (
    await axiosInstance.put<ApiResponse<VideoMeetingTemplate>, typeof payload>(
      path(templateId),
      payload,
      command(idempotencyKey)
    )
  ).data.data;
}

export async function cloneVideoMeetingTemplate(
  templateId: string,
  name: string,
  expectedVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingTemplate> {
  const payload = { ...version(expectedVersion), name };
  return (
    await axiosInstance.post<ApiResponse<VideoMeetingTemplate>, typeof payload>(
      path(templateId) + '/clone',
      payload,
      command(idempotencyKey)
    )
  ).data.data;
}

export async function favoriteVideoMeetingTemplate(
  templateId: string,
  favorite: boolean,
  idempotencyKey: string
): Promise<VideoMeetingTemplate> {
  return (
    await axiosInstance.put<ApiResponse<VideoMeetingTemplate>, { favorite: boolean }>(
      path(templateId) + '/favorite',
      { favorite },
      command(idempotencyKey)
    )
  ).data.data;
}

export async function deleteVideoMeetingTemplate(
  templateId: string,
  expectedVersion: number,
  idempotencyKey: string
): Promise<{ resourceId: string; version: number; deleted: boolean }> {
  version(expectedVersion);
  return (
    await axiosInstance.delete<
      ApiResponse<{ resourceId: string; version: number; deleted: boolean }>
    >(path(templateId) + '?expectedVersion=' + expectedVersion, command(idempotencyKey))
  ).data.data;
}

export async function applyVideoMeetingTemplate(
  templateId: string,
  expectedVersion: number,
  idempotencyKey: string
): Promise<VideoMeetingTemplateScheduleDraft> {
  const result = (
    await axiosInstance.post<
      ApiResponse<VideoMeetingTemplateScheduleDraft>,
      { expectedVersion: number }
    >(path(templateId) + '/apply', version(expectedVersion), command(idempotencyKey))
  ).data.data;
  if (
    result.sourceTemplateId !== templateId ||
    result.sourceTemplateVersion !== expectedVersion ||
    result.accessScope !== 'INVITED' ||
    result.waitingRoomEnabled !== true ||
    result.defaultMicrophoneEnabled !== false ||
    result.defaultCameraEnabled !== false ||
    result.requiresPolicyRevalidation !== true
  )
    throw new Error('The template draft binding is invalid');
  // Template application must never carry previous identities, consent or media credentials.
  return {
    sourceTemplateId: result.sourceTemplateId,
    sourceTemplateVersion: result.sourceTemplateVersion,
    title: result.title,
    purpose: result.purpose,
    durationMinutes: result.durationMinutes,
    agendaItems: result.agendaItems.map(({ title, description, role, durationMinutes }) => ({
      title,
      description,
      role,
      durationMinutes,
    })),
    accessScope: 'INVITED',
    waitingRoomEnabled: true,
    defaultMicrophoneEnabled: false,
    defaultCameraEnabled: false,
    requiresPolicyRevalidation: true,
  };
}
