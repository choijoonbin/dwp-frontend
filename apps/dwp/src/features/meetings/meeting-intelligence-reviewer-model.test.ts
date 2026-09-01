import { describe, expect, it } from 'vitest';

import { deriveMeetingIntelligenceReviewerAccess } from './meeting-intelligence-reviewer-model';

describe('deriveMeetingIntelligenceReviewerAccess', () => {
  it('offers only eligible participants who do not already hold review authority', () => {
    const model = deriveMeetingIntelligenceReviewerAccess({
      reportId: 'report-1',
      reportVersion: 3,
      eligibleParticipants: [
        candidate(11, 'Requester', false, 'INTELLIGENCE_REQUESTER'),
        candidate(12, 'Reviewer', true),
        candidate(13, 'Second reviewer', true),
      ],
      activeGrants: [grant(12, 'REVIEW'), grant(13, 'VIEW')],
    });

    expect(model.assignableCandidates.map((candidate) => candidate.userId)).toEqual([13]);
    expect(model.activeReviewers).toMatchObject([
      { principalUserId: 12, permission: 'REVIEW', displayName: 'Reviewer' },
    ]);
  });

  it('projects manage authority as an active reviewer and tolerates a deleted participant', () => {
    const model = deriveMeetingIntelligenceReviewerAccess({
      reportId: 'report-1',
      reportVersion: 3,
      eligibleParticipants: [],
      activeGrants: [grant(99, 'MANAGE')],
    });

    expect(model.assignableCandidates).toEqual([]);
    expect(model.activeReviewers[0]).toMatchObject({
      principalUserId: 99,
      permission: 'MANAGE',
      displayName: null,
    });
  });

  it('returns a stable empty model while the governed projection is unavailable', () => {
    expect(deriveMeetingIntelligenceReviewerAccess(null)).toEqual({
      assignableCandidates: [],
      activeReviewers: [],
    });
  });
});

function candidate(
  userId: number,
  displayName: string,
  assignmentEligible: boolean,
  ineligibleReason: 'CURRENT_MANAGER' | 'INTELLIGENCE_REQUESTER' | null = null
) {
  return {
    userId,
    participantId: `participant-${userId}`,
    displayName,
    participantRole: 'ATTENDEE' as const,
    attendanceState: 'LEFT' as const,
    assignmentEligible,
    ineligibleReason,
  };
}

function grant(principalUserId: number, permission: 'VIEW' | 'REVIEW' | 'MANAGE') {
  return {
    aclId: `grant-${principalUserId}-${permission}`,
    reportId: 'report-1',
    principalUserId,
    permission,
    grantedAt: '2026-08-31T04:00:00Z',
    grantedBy: 10,
    expiresAt: null,
    reasonCode: 'HUMAN_REVIEW_ASSIGNED',
  };
}
