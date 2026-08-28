import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  VideoMeetingIntelligenceCitation,
  VideoMeetingIntelligenceReport,
  VideoMeetingIntelligenceRun,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

export type MeetingIntelligenceSurfaceState =
  | 'UNAVAILABLE'
  | 'PROCESSING'
  | 'FAILURE'
  | 'DRAFT'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'DELETED';

export type MeetingIntelligenceGenerateBlocker =
  'NOT_HOST' | 'PROCESSING' | 'TRANSCRIPT_NOT_AVAILABLE' | 'CONTENT_PLAN_NOT_AVAILABLE';

export type MeetingIntelligenceActions = {
  canGenerate: boolean;
  generateBlocker: MeetingIntelligenceGenerateBlocker | null;
  canApprove: boolean;
  canReject: boolean;
  canPublish: boolean;
};

export function deriveMeetingIntelligenceSurfaceState(
  report: VideoMeetingIntelligenceReport | null | undefined,
  run: VideoMeetingIntelligenceRun | null | undefined
): MeetingIntelligenceSurfaceState {
  if (run?.state === 'RUNNING') return 'PROCESSING';
  if (run?.state === 'FAILED') return 'FAILURE';
  if (report) return report.state;
  if (run?.state === 'SUCCEEDED') return 'PROCESSING';
  return 'UNAVAILABLE';
}

export function selectMeetingIntelligenceReportForViewer(
  report: VideoMeetingIntelligenceReport | null | undefined,
  canHost: boolean
): VideoMeetingIntelligenceReport | null {
  if (!report || report.state === 'DELETED' || !report.analysis) return null;
  if (canHost) return report;
  return report.state === 'PUBLISHED' && report.audience === 'MEETING_PARTICIPANTS' ? report : null;
}

export function deriveMeetingIntelligenceActions(input: {
  canHost: boolean;
  transcriptArtifact?: VideoMeetingArtifact | null;
  contentPlanVersion?: number | null;
  report?: VideoMeetingIntelligenceReport | null;
  run?: VideoMeetingIntelligenceRun | null;
  mutationPending?: boolean;
}): MeetingIntelligenceActions {
  const processing = input.run?.state === 'RUNNING' || input.mutationPending === true;
  const transcriptReady =
    input.transcriptArtifact?.artifactType === 'TRANSCRIPT' &&
    input.transcriptArtifact.artifactState === 'AVAILABLE';
  const contentPlanReady =
    input.contentPlanVersion != null &&
    Number.isSafeInteger(input.contentPlanVersion) &&
    input.contentPlanVersion >= 0;
  const generateBlocker: MeetingIntelligenceGenerateBlocker | null = !input.canHost
    ? 'NOT_HOST'
    : processing
      ? 'PROCESSING'
      : !transcriptReady
        ? 'TRANSCRIPT_NOT_AVAILABLE'
        : !contentPlanReady
          ? 'CONTENT_PLAN_NOT_AVAILABLE'
          : null;
  const reviewable =
    input.canHost &&
    !processing &&
    input.report?.state === 'DRAFT' &&
    input.report.canCurrentViewerReview &&
    Boolean(input.report.analysis);

  return {
    canGenerate: generateBlocker === null,
    generateBlocker,
    canApprove: reviewable,
    canReject: reviewable,
    canPublish:
      input.canHost &&
      !processing &&
      input.report?.state === 'APPROVED' &&
      Boolean(input.report.analysis),
  };
}

function boundedMilliseconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function formatMeetingIntelligenceTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(boundedMilliseconds(milliseconds) / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${clock}` : clock;
}

export function formatMeetingIntelligenceCitation(
  citation: VideoMeetingIntelligenceCitation
): string {
  const start = formatMeetingIntelligenceTimestamp(citation.startMillis);
  const end = formatMeetingIntelligenceTimestamp(citation.endMillis);
  return citation.endMillis > citation.startMillis ? `${start}–${end}` : start;
}

export function meetingIntelligenceTimestampDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(boundedMilliseconds(milliseconds) / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${seconds}S`;
}
