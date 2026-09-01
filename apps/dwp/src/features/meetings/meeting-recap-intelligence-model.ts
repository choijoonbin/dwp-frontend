import type {
  VideoMeetingIntelligenceConversationClimate,
  VideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

export type PublishedMeetingRecap =
  | {
      state: 'UNAVAILABLE' | 'FAILED';
      summary: null;
      topics: [];
      decisions: [];
      actionItems: [];
      openQuestions: [];
      risks: [];
      conversationClimate: null;
    }
  | {
      state: 'READY';
      reportId: string;
      publishedAt: string;
      summary: string;
      topics: string[];
      decisions: string[];
      actionItems: string[];
      openQuestions: string[];
      risks: string[];
      conversationClimate: VideoMeetingIntelligenceConversationClimate;
    };

const emptyProjection = (state: 'UNAVAILABLE' | 'FAILED'): PublishedMeetingRecap => ({
  state,
  summary: null,
  topics: [],
  decisions: [],
  actionItems: [],
  openQuestions: [],
  risks: [],
  conversationClimate: null,
});

export function derivePublishedMeetingRecap(
  report: VideoMeetingIntelligenceReport | null | undefined,
  authorizationOrLoadFailed: boolean
): PublishedMeetingRecap {
  if (authorizationOrLoadFailed) {
    return emptyProjection('FAILED');
  }
  if (report == null) {
    return emptyProjection('UNAVAILABLE');
  }
  if (
    report.state !== 'PUBLISHED' ||
    report.audience !== 'MEETING_PARTICIPANTS' ||
    !report.publishedAt ||
    !report.analysis
  ) {
    return emptyProjection('FAILED');
  }
  return {
    state: 'READY',
    reportId: report.reportId,
    publishedAt: report.publishedAt,
    summary: report.analysis.executiveSummary.text,
    topics: report.analysis.topics.map((item) => item.text),
    decisions: report.analysis.decisions.map((item) => item.text),
    actionItems: report.analysis.actionItems.map((item) => item.text),
    openQuestions: report.analysis.openQuestions.map((item) => item.text),
    risks: report.analysis.risks.map((item) => item.text),
    conversationClimate: report.analysis.conversationClimate,
  };
}
