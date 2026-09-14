import { describe, expect, it } from 'vitest';

import { workplacePlanWeek, workplaceSharingOptions } from './workplace-team-model';

describe('workplace team plans', () => {
  it('keeps local plan dates across a DST and month boundary', () => {
    expect(workplacePlanWeek('2026-11-01')).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
      days: [
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
      ],
    });
  });
  it.each([
    { enabled: false, optIn: true, hasGroups: true },
    { enabled: true, optIn: false, hasGroups: true },
    { enabled: true, optIn: true, hasGroups: false },
  ])('closes shared plan choices when a consent prerequisite is absent', (prerequisites) => {
    expect(
      workplaceSharingOptions({
        ...prerequisites,
        maximumVisibility: 'RESOURCE',
        preferredVisibility: 'RESOURCE',
      })
    ).toEqual(['PRIVATE']);
  });
  it('limits disclosure to both tenant policy and saved consent', () => {
    expect(
      workplaceSharingOptions({
        enabled: true,
        optIn: true,
        hasGroups: true,
        maximumVisibility: 'RESOURCE',
        preferredVisibility: 'SITE',
      })
    ).toEqual(['PRIVATE', 'SITE']);
    expect(
      workplaceSharingOptions({
        enabled: true,
        optIn: true,
        hasGroups: true,
        maximumVisibility: 'FLOOR',
        preferredVisibility: 'RESOURCE',
      })
    ).toEqual(['PRIVATE', 'SITE', 'FLOOR']);
  });
});
