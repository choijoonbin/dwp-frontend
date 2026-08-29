import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

export type PublishedMeetingRecap =
  | { state: 'UNAVAILABLE'; summary: null; decisions: []; actionItems: [] }
  | { state: 'FAILED'; summary: null; decisions: []; actionItems: [] }
  | {
      state: 'READY';
      reportId: string;
      publishedAt: string;
      summary: string;
      decisions: string[];
      actionItems: string[];
    };

export function derivePublishedMeetingRecap(
  report: VideoMeetingIntelligenceReport | null | undefined,
  authorizationOrLoadFailed: boolean
): PublishedMeetingRecap {
  if (authorizationOrLoadFailed) {
    return { state: 'FAILED', summary: null, decisions: [], actionItems: [] };
  }
  if (report == null) {
    return { state: 'UNAVAILABLE', summary: null, decisions: [], actionItems: [] };
  }
  if (
    report.state !== 'PUBLISHED' ||
    report.audience !== 'MEETING_PARTICIPANTS' ||
    !report.publishedAt ||
    !report.analysis
  ) {
    return { state: 'FAILED', summary: null, decisions: [], actionItems: [] };
  }
  return {
    state: 'READY',
    reportId: report.reportId,
    publishedAt: report.publishedAt,
    summary: report.analysis.executiveSummary.text,
    decisions: report.analysis.decisions.map((item) => item.text),
    actionItems: report.analysis.actionItems.map((item) => item.text),
  };
}
