import { describe, expect, it } from 'vitest';

import { resolveHomeRecommendationCommandUiState } from './use-home-recommendation-command';

describe('Home recommendation command UI authority', () => {
  it('removes a pending or confirming command as soon as its capability is withdrawn', () => {
    expect(
      resolveHomeRecommendationCommandUiState({
        availability: 'DISABLED',
        confirming: true,
        pending: true,
        terminal: 'ACCEPTED',
      })
    ).toBe('DISABLED');
    expect(
      resolveHomeRecommendationCommandUiState({
        availability: 'DENIED',
        confirming: false,
        pending: true,
        terminal: null,
      })
    ).toBe('DENIED');
  });

  it.each([
    [{ pending: false, confirming: false, terminal: null }, 'READY'],
    [{ pending: false, confirming: true, terminal: null }, 'CONFIRMING'],
    [{ pending: true, confirming: true, terminal: null }, 'PENDING'],
    [{ pending: false, confirming: false, terminal: 'CONFLICT' }, 'CONFLICT'],
    [{ pending: false, confirming: false, terminal: 'UNKNOWN' }, 'UNKNOWN'],
  ] as const)('projects an authorized action state %#', (state, expected) => {
    expect(resolveHomeRecommendationCommandUiState({ availability: 'READY', ...state })).toBe(
      expected
    );
  });
});
