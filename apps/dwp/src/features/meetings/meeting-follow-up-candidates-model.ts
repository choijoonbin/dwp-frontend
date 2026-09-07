import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type {
  VideoMeetingIntelligenceFollowUpCandidate,
  VideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';
import type {
  WorkAssignmentMutationResult,
  WorkAssignmentSourceIdentity,
  WorkAssignmentTask,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { checkedFollowUpTask } from './meeting-follow-ups-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const FOLLOW_UP_CANDIDATE_LIMIT = 20;

export type MeetingFollowUpCandidate = {
  source: WorkAssignmentSourceIdentity;
  sourceVersion: number;
  meetingTitle: string;
  title: string;
};

function checkedCandidate(
  meeting: VideoMeetingSummary,
  report: VideoMeetingIntelligenceReport,
  candidate: VideoMeetingIntelligenceFollowUpCandidate
): MeetingFollowUpCandidate {
  const actionItems = report.analysis?.actionItems ?? [];
  const action = actionItems[candidate.actionItemIndex];
  if (
    !uuid.test(meeting.meetingId) ||
    !uuid.test(report.reportId) ||
    report.meetingId !== meeting.meetingId ||
    report.state !== 'PUBLISHED' ||
    report.audience !== 'MEETING_PARTICIPANTS' ||
    !Number.isSafeInteger(report.version) ||
    report.version < 0 ||
    candidate.sourceVersion !== report.version ||
    !uuid.test(candidate.candidateId) ||
    !Number.isSafeInteger(candidate.actionItemIndex) ||
    candidate.actionItemIndex < 0 ||
    !action ||
    typeof action.text !== 'string' ||
    !action.text.trim() ||
    action.text.length > 500
  ) {
    throw new Error('Invalid authorized Meeting follow-up candidate binding');
  }
  return {
    source: {
      sourceSystem: 'MEETING_FOLLOWUP',
      meetingId: meeting.meetingId,
      reportId: report.reportId,
      candidateId: candidate.candidateId,
    },
    sourceVersion: report.version,
    meetingTitle: meeting.title,
    title: action.text.trim(),
  };
}

export function projectMeetingFollowUpCandidates(
  meeting: VideoMeetingSummary,
  report: VideoMeetingIntelligenceReport | null,
  now: number
): MeetingFollowUpCandidate[] {
  if (!report) return [];
  if (
    (!report.legalHold && Date.parse(report.retentionUntil) <= now) ||
    !Array.isArray(report.followUpCandidates) ||
    report.followUpCandidates.length > FOLLOW_UP_CANDIDATE_LIMIT
  ) {
    return [];
  }
  return report.followUpCandidates.map((candidate) => checkedCandidate(meeting, report, candidate));
}

export function checkedCandidateAssignment(
  task: WorkAssignmentTask,
  candidate: MeetingFollowUpCandidate,
  actorId: number
) {
  const checked = checkedFollowUpTask(task, actorId);
  if (
    checked.createdByUserId !== actorId ||
    checked.assigneeUserId !== actorId ||
    checked.source.availability !== 'AVAILABLE' ||
    checked.source.sourceVersion !== candidate.sourceVersion ||
    JSON.stringify(checked.source.reference) !== JSON.stringify(candidate.source)
  ) {
    throw new Error('Invalid created Work assignment binding');
  }
  return checked;
}

export function checkedCandidateCreation(
  result: WorkAssignmentMutationResult,
  candidate: MeetingFollowUpCandidate,
  actorId: number,
  commandId: string
) {
  const task = checkedCandidateAssignment(result.assignment, candidate, actorId);
  if (
    result.receipt.commandId !== commandId ||
    result.receipt.assignmentId !== task.assignmentId ||
    result.receipt.operation !== 'CREATE' ||
    result.receipt.appliedVersion > task.version ||
    result.receipt.appliedAssignmentRevision > task.assignmentRevision
  ) {
    throw new Error('Invalid Work creation receipt binding');
  }
  return { task, receipt: result.receipt };
}
