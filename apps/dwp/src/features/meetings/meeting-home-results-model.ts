import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  getLatestPublishedVideoMeetingIntelligenceReport,
  getLatestVisibleVideoMeetingIntelligenceReport,
  type VideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import {
  createMeetingIntelligenceAuthorizationFence,
  MeetingIntelligenceAuthorizationSupersededError,
} from './meeting-intelligence-authorization-fence';

export type MeetingHomeResultsSection = 'queue' | 'recent';

export type MeetingHomeResult = {
  meetingId: string;
  reportId: string;
  summary: string | null;
  publishedAt: string | null;
  retentionUntil: string;
  legalHold: boolean;
};

export type MeetingHomeResultsSnapshot = {
  entries: MeetingHomeResult[];
  failedMeetingIds: string[];
};

export function meetingHomeResultReviewPath(
  result: Pick<MeetingHomeResult, 'meetingId' | 'reportId'>
) {
  const params = new URLSearchParams({
    meeting: result.meetingId,
    reportId: result.reportId,
    intent: 'review',
  });
  return `/meetings/history?${params.toString()}`;
}

export function boundMeetingHomeResults(recent: readonly VideoMeetingSummary[]) {
  return recent
    .filter(
      (meeting, index) => recent.findIndex((item) => item.meetingId === meeting.meetingId) === index
    )
    .slice(0, 4);
}

export function meetingHomeResultUnexpired(
  report: Pick<MeetingHomeResult, 'retentionUntil' | 'legalHold'>,
  now: number
) {
  return report.legalHold || Date.parse(report.retentionUntil) > now;
}

function projectReport(
  meetingId: string,
  section: MeetingHomeResultsSection,
  report: VideoMeetingIntelligenceReport | null,
  now: number
): MeetingHomeResult | null {
  if (
    !report ||
    report.meetingId !== meetingId ||
    !report.analysis ||
    !meetingHomeResultUnexpired(report, now)
  )
    return null;
  const allowed =
    section === 'queue'
      ? report.state === 'DRAFT' && report.canCurrentViewerReview
      : report.state === 'PUBLISHED' && report.audience === 'MEETING_PARTICIPANTS';
  if (!allowed) return null;
  return {
    meetingId,
    reportId: report.reportId,
    // A home review queue needs no private draft text or action-item payload.
    summary: section === 'recent' ? report.analysis.executiveSummary.text : null,
    publishedAt: section === 'recent' ? (report.publishedAt ?? null) : null,
    retentionUntil: report.retentionUntil,
    legalHold: report.legalHold,
  };
}

export function createMeetingHomeResultsLoader(
  scope: string,
  section: MeetingHomeResultsSection,
  readReport = section === 'queue'
    ? getLatestVisibleVideoMeetingIntelligenceReport
    : getLatestPublishedVideoMeetingIntelligenceReport,
  now: () => number = Date.now
) {
  const fence = createMeetingIntelligenceAuthorizationFence(scope);
  return {
    revoke: fence.revoke,
    async load(
      meetingIds: readonly string[],
      signal?: AbortSignal,
      onUnavailable?: (meetingId: string) => void
    ): Promise<MeetingHomeResultsSnapshot> {
      const validation = fence.beginValidation();
      const suppress = (meetingId: string) => {
        if (!signal?.aborted && fence.authorize(validation)) onUnavailable?.(meetingId);
      };
      const results = await Promise.allSettled(
        meetingIds.slice(0, 4).map(async (meetingId) => {
          try {
            const report = await readReport(meetingId);
            const projected = projectReport(meetingId, section, report, now());
            if (!projected) suppress(meetingId);
            return projected;
          } catch (error) {
            suppress(meetingId);
            throw error;
          }
        })
      );
      if (signal?.aborted || !fence.authorize(validation)) {
        throw new MeetingIntelligenceAuthorizationSupersededError();
      }
      const entries: MeetingHomeResult[] = [];
      const failedMeetingIds: string[] = [];
      results.forEach((result, index) => {
        const meetingId = meetingIds[index];
        if (result.status === 'rejected') {
          failedMeetingIds.push(meetingId);
          return;
        }
        if (result.value) entries.push(result.value);
      });
      return { entries, failedMeetingIds };
    },
  };
}
