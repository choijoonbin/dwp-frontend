import { describe, expect, it } from 'vitest';

import {
  buildHrTeamDecisionDestinations,
  hrTeamMemberDirectoryPath,
} from './hr-team-workspace-model';

describe('HRIS team workspace model', () => {
  it('keeps time and leave decisions separate and routes them to their governed queues', () => {
    expect(
      buildHrTeamDecisionDestinations({ timePendingCount: 3, absencePendingCount: 2 })
    ).toEqual([
      { domain: 'time', count: 3, route: '/hr/team/time' },
      { domain: 'absence', count: 2, route: '/hr/team/absence' },
    ]);
  });

  it('never renders a negative pending count from a malformed response', () => {
    expect(
      buildHrTeamDecisionDestinations({ timePendingCount: -1, absencePendingCount: -8 }).map(
        ({ count }) => count
      )
    ).toEqual([0, 0]);
  });

  it('builds an encoded directory deep link for a selected team member', () => {
    expect(hrTeamMemberDirectoryPath('person/one two')).toBe(
      '/hr/directory?person=person%2Fone%20two'
    );
  });
});
