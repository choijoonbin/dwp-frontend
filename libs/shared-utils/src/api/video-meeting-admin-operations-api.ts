import { axiosInstance } from '../axios-instance';
import { VIDEO_MEETING_API_BASE } from './video-meeting-lifecycle-api';

export async function downloadVideoMeetingAdminOperations(
  timeZone: string,
  signal?: AbortSignal
): Promise<Blob> {
  const query = new URLSearchParams({ timeZone });
  const response = await axiosInstance.get<Blob>(
    `${VIDEO_MEETING_API_BASE}/admin/operations/export?${query.toString()}`,
    { responseType: 'blob', signal, headers: { Accept: 'text/csv' } }
  );
  return response.data;
}
