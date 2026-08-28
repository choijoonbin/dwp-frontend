import { describe, expect, it } from 'vitest';

import { resolveWorkplaceDecisionClock } from './workplace-decision-clock';

describe('workplace decision clock', () => {
  it('preserves a high-water instant for the same identity during clock rollback', () => {
    const previous = {
      identityKey: 'tenant-a:user-a',
      nowInstant: Date.parse('2026-08-19T00:01:00Z'),
    };

    expect(
      resolveWorkplaceDecisionClock(
        previous,
        'tenant-a:user-a',
        Date.parse('2026-08-19T00:00:00Z'),
        ['2026-08-19T00:00:30Z']
      )
    ).toEqual(previous);
  });

  it('synchronously resets the high-water instant when tenant or user identity changes', () => {
    expect(
      resolveWorkplaceDecisionClock(
        {
          identityKey: 'tenant-a:user-a',
          nowInstant: Date.parse('2036-08-19T00:00:00Z'),
        },
        'tenant-b:user-b',
        Date.parse('2026-08-19T00:00:00Z'),
        ['2026-08-19T00:00:05Z']
      )
    ).toEqual({
      identityKey: 'tenant-b:user-b',
      nowInstant: Date.parse('2026-08-19T00:00:05Z'),
    });
  });
});
