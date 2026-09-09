import { describe, expect, it } from 'vitest';
import { meetingFollowUpsNavigation } from './meeting-follow-ups-navigation';

const candidateId = '99000000-0000-4000-8000-000000000903';
const assignmentId = '99000000-0000-4000-8000-000000000904';

describe('meeting follow-up navigation', () => {
  it('accepts an exact candidate reference only in candidate scope', () => {
    expect(
      meetingFollowUpsNavigation(
        new URLSearchParams({ scope: 'CANDIDATES', candidateId, assignment: assignmentId })
      )
    ).toEqual({ scope: 'CANDIDATES', assignment: null, candidate: candidateId });
  });

  it.each([
    `scope=CANDIDATES&candidateId=private-title`,
    `scope=CANDIDATES&candidateId=${candidateId}&candidateId=${candidateId}`,
    `scope=ASSIGNED_TO_ME&candidateId=${candidateId}`,
  ])('never promotes an unbound URL value to a candidate selection: %s', (search) => {
    expect(meetingFollowUpsNavigation(new URLSearchParams(search)).candidate).toBeNull();
  });

  it('keeps assignment and candidate identities exclusive to their own scopes', () => {
    expect(
      meetingFollowUpsNavigation(
        new URLSearchParams({ scope: 'ASSIGNED_BY_ME', assignment: assignmentId, candidateId })
      )
    ).toEqual({ scope: 'ASSIGNED_BY_ME', assignment: assignmentId, candidate: null });
  });
});
