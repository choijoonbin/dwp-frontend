import type { WorkAssignmentSourceIdentity } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

export function selectMeetingFollowUpEvidence(
  report: VideoMeetingIntelligenceReport | null | undefined,
  source: WorkAssignmentSourceIdentity,
  sourceVersion: number,
  now: number
) {
  if (
    !report ||
    report.meetingId !== source.meetingId ||
    report.reportId !== source.reportId ||
    report.version !== sourceVersion ||
    report.state !== 'PUBLISHED' ||
    report.audience !== 'MEETING_PARTICIPANTS' ||
    !report.publishedAt ||
    !report.analysis ||
    (!report.legalHold &&
      (!Number.isFinite(Date.parse(report.retentionUntil)) ||
        Date.parse(report.retentionUntil) <= now))
  )
    return null;
  const candidate = report.followUpCandidates?.find(
    (item) => item.candidateId === source.candidateId && item.sourceVersion === sourceVersion
  );
  if (
    !candidate ||
    !Number.isSafeInteger(candidate.actionItemIndex) ||
    candidate.actionItemIndex < 0
  )
    return null;
  return report.analysis.actionItems[candidate.actionItemIndex] ?? null;
}
