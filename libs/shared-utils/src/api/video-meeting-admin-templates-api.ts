import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';
import type {
  VideoMeetingTemplate,
  VideoMeetingTemplateInput,
  VideoMeetingTemplatePage,
} from './video-meeting-templates-api';

const base = VIDEO_MEETING_API_BASE + '/admin/templates';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function path(id: string) {
  if (!uuid.test(id)) throw new Error('A valid template reference is required');
  return base + '/' + encodeURIComponent(id);
}
function command(key: string, expectedVersion = 0) {
  if (!uuid.test(key)) throw new Error('A stable UUID idempotency key is required');
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
    throw new Error('A valid template version is required');
  return { headers: { 'Idempotency-Key': key } };
}
function organization(template: VideoMeetingTemplate, expectedId?: string) {
  if (
    template.scope !== 'ORGANIZATION' ||
    !uuid.test(template.templateId) ||
    (expectedId && template.templateId !== expectedId) ||
    !Number.isSafeInteger(template.version) ||
    template.version < 0
  )
    throw new Error('The organization template binding is invalid');
  return template;
}

export async function getVideoMeetingAdminTemplates(
  options: { q: string; page: number },
  signal?: AbortSignal
): Promise<VideoMeetingTemplatePage> {
  const params = new URLSearchParams({
    scope: 'ORGANIZATION',
    q: options.q,
    page: String(options.page),
    pageSize: '20',
  });
  const result = (
    await axiosInstance.get<ApiResponse<VideoMeetingTemplatePage>>(base + '?' + params, {
      signal,
      timeoutMs: 8_000,
    })
  ).data.data;
  result.items.forEach((item) => organization(item));
  return result;
}
export async function getVideoMeetingAdminTemplate(id: string, signal?: AbortSignal) {
  return organization(
    (
      await axiosInstance.get<ApiResponse<VideoMeetingTemplate>>(path(id), {
        signal,
        timeoutMs: 8_000,
      })
    ).data.data,
    id
  );
}
export async function createVideoMeetingAdminTemplate(
  input: VideoMeetingTemplateInput,
  key: string
) {
  return organization(
    (
      await axiosInstance.post<ApiResponse<VideoMeetingTemplate>, VideoMeetingTemplateInput>(
        base,
        input,
        command(key)
      )
    ).data.data
  );
}
export async function updateVideoMeetingAdminTemplate(
  id: string,
  input: VideoMeetingTemplateInput,
  expectedVersion: number,
  key: string
) {
  const payload = { expectedVersion, template: input };
  return organization(
    (
      await axiosInstance.put<ApiResponse<VideoMeetingTemplate>, typeof payload>(
        path(id),
        payload,
        command(key, expectedVersion)
      )
    ).data.data,
    id
  );
}
export async function deleteVideoMeetingAdminTemplate(
  id: string,
  expectedVersion: number,
  key: string
) {
  const result = (
    await axiosInstance.delete<
      ApiResponse<{ resourceId: string; version: number; deleted: boolean }>
    >(path(id) + '?expectedVersion=' + expectedVersion, command(key, expectedVersion))
  ).data.data;
  if (result.resourceId !== id || result.deleted !== true)
    throw new Error('The template deletion receipt is invalid');
  return result;
}
