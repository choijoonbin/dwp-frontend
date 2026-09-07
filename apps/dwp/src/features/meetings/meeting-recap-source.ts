import {
  getLatestPublishedVideoMeetingIntelligenceReport,
  getVideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export type MeetingRecapReference = {
  meetingId: string;
  reportId?: string;
  intent?: 'review';
};
export function meetingRecapReference(search: string): MeetingRecapReference | 'invalid' | null {
  const params = new URLSearchParams(search);
  const meetingId = params.get('meeting');
  const reportId = params.get('reportId');
  const intent = params.get('intent');
  if (meetingId === null && reportId === null && intent === null) return null;
  if (
    !meetingId ||
    !uuid.test(meetingId) ||
    params.getAll('meeting').length !== 1 ||
    (reportId !== null && (!uuid.test(reportId) || params.getAll('reportId').length !== 1)) ||
    (intent !== null &&
      (intent !== 'review' || params.getAll('intent').length !== 1 || reportId === null))
  )
    return 'invalid';
  return {
    meetingId,
    ...(reportId ? { reportId } : {}),
    ...(intent === 'review' ? { intent } : {}),
  };
}

/** An assignment's source report must never be substituted with the latest revision. */
export async function loadMeetingRecapReport(meetingId: string, reportId?: string) {
  if (!uuid.test(meetingId) || (reportId !== undefined && !uuid.test(reportId)))
    throw new Error('Invalid meeting report reference.');
  const report = reportId
    ? await getVideoMeetingIntelligenceReport(meetingId, reportId)
    : await getLatestPublishedVideoMeetingIntelligenceReport(meetingId);
  if (report && (report.meetingId !== meetingId || (reportId && report.reportId !== reportId)))
    throw new Error('Meeting report binding mismatch.');
  return report;
}
