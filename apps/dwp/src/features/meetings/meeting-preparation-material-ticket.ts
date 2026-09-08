import type {
  VideoMeetingMaterialAccessTicket,
  VideoMeetingPreparationMaterial,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';

/** A ticket is a short-lived, version-bound grant, never permanent material authorization. */
export function usablePreparationMaterialTicket(
  ticket: VideoMeetingMaterialAccessTicket | undefined,
  meetingId: string,
  material: VideoMeetingPreparationMaterial,
  now = Date.now()
): ticket is VideoMeetingMaterialAccessTicket {
  if (
    !ticket ||
    ticket.meetingId !== meetingId ||
    ticket.materialId !== material.materialId ||
    ticket.materialVersion !== material.version ||
    Date.parse(ticket.expiresAt) <= now ||
    !Number.isFinite(Date.parse(ticket.expiresAt))
  )
    return false;
  try {
    const url = new URL(ticket.accessUrl);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function preparationMaterialFormat(contentType: string) {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'PPT';
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'XLS';
  if (contentType.startsWith('image/')) return 'IMG';
  if (contentType.startsWith('video/')) return 'VID';
  return 'DOC';
}
