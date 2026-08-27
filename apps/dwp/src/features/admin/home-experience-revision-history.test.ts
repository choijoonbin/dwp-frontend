import { describe, expect, it } from 'vitest';

import { resolveHomeExperienceHistoryState } from './home-experience-revision-history';

describe('resolveHomeExperienceHistoryState', () => {
  it('keeps loading, error, empty, and ready states distinct', () => {
    expect(resolveHomeExperienceHistoryState(true, false, 0)).toBe('LOADING');
    expect(resolveHomeExperienceHistoryState(false, true, 0)).toBe('ERROR');
    expect(resolveHomeExperienceHistoryState(false, false, 0)).toBe('EMPTY');
    expect(resolveHomeExperienceHistoryState(false, false, 1)).toBe('READY');
  });
});
