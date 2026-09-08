import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type MeetingRecapActionCandidate = {
  meetingId: string;
  reportId: string;
  candidateId: string;
  sourceVersion: number;
  actionItemIndex: number;
};

/** The action-index binding comes only from the currently authorized, unexpired source report. */
export function projectMeetingRecapActionCandidates(
  meetingId: string,
  report: VideoMeetingIntelligenceReport | null | undefined,
  now: number
): MeetingRecapActionCandidate[] {
  if (
    !report ||
    report.meetingId !== meetingId ||
    !uuid.test(meetingId) ||
    !uuid.test(report.reportId) ||
    report.state !== 'PUBLISHED' ||
    report.audience !== 'MEETING_PARTICIPANTS' ||
    !report.analysis ||
    !Number.isSafeInteger(report.version) ||
    report.version < 0 ||
    (!report.legalHold &&
      (!Number.isFinite(Date.parse(report.retentionUntil)) ||
        Date.parse(report.retentionUntil) <= now))
  )
    return [];
  const candidates = report.followUpCandidates ?? [];
  if (!Array.isArray(candidates) || candidates.length > 20) return [];
  return candidates.flatMap((candidate) => {
    if (
      !uuid.test(candidate.candidateId) ||
      candidate.sourceVersion !== report.version ||
      !Number.isSafeInteger(candidate.actionItemIndex) ||
      candidate.actionItemIndex < 0 ||
      !report.analysis?.actionItems[candidate.actionItemIndex] ||
      candidates.filter(
        (other) =>
          other.candidateId === candidate.candidateId ||
          other.actionItemIndex === candidate.actionItemIndex
      ).length !== 1
    )
      return [];
    return [
      {
        meetingId,
        reportId: report.reportId,
        candidateId: candidate.candidateId,
        sourceVersion: report.version,
        actionItemIndex: candidate.actionItemIndex,
      },
    ];
  });
}

export function meetingRecapCandidateHref(candidate: MeetingRecapActionCandidate): string {
  return `/meetings/history?${new URLSearchParams({ meeting: candidate.meetingId, reportId: candidate.reportId, candidateId: candidate.candidateId })}`;
}
