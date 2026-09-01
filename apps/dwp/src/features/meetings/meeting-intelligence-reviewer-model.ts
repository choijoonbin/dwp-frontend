import type {
  VideoMeetingIntelligenceGrant,
  VideoMeetingIntelligenceReviewerAssignments,
  VideoMeetingIntelligenceReviewerCandidate,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

type ReviewAuthorityPermission = Extract<
  VideoMeetingIntelligenceGrant['permission'],
  'REVIEW' | 'MANAGE'
>;

export type ActiveMeetingIntelligenceReviewer = Omit<
  VideoMeetingIntelligenceGrant,
  'permission'
> & {
  permission: ReviewAuthorityPermission;
  displayName: string | null;
};

export type MeetingIntelligenceReviewerAccessModel = {
  assignableCandidates: VideoMeetingIntelligenceReviewerCandidate[];
  activeReviewers: ActiveMeetingIntelligenceReviewer[];
};

export function deriveMeetingIntelligenceReviewerAccess(
  assignments: VideoMeetingIntelligenceReviewerAssignments | null | undefined
): MeetingIntelligenceReviewerAccessModel {
  if (!assignments) return { assignableCandidates: [], activeReviewers: [] };

  const candidatesByUserId = new Map(
    assignments.eligibleParticipants.map((candidate) => [candidate.userId, candidate])
  );
  const activeReviewGrants = assignments.activeGrants.filter(
    (grant): grant is VideoMeetingIntelligenceGrant & { permission: ReviewAuthorityPermission } =>
      grant.permission === 'REVIEW' || grant.permission === 'MANAGE'
  );
  const assignedUserIds = new Set(activeReviewGrants.map((grant) => grant.principalUserId));

  return {
    assignableCandidates: assignments.eligibleParticipants.filter(
      (candidate) => candidate.assignmentEligible && !assignedUserIds.has(candidate.userId)
    ),
    activeReviewers: activeReviewGrants.map((grant) => ({
      ...grant,
      displayName: candidatesByUserId.get(grant.principalUserId)?.displayName ?? null,
    })),
  };
}
