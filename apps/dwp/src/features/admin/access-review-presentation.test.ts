import { describe, expect, it } from 'vitest';

import { accessReviewLabelKey } from './access-review-presentation';

describe('access review presentation', () => {
  it('uses localized unavailable labels for every unknown runtime enum', () => {
    expect(accessReviewLabelKey('recommendations', 'FUTURE')).toBe(
      'accessReviews.recommendations.UNKNOWN'
    );
    expect(accessReviewLabelKey('sources', 'FUTURE')).toBe('accessReviews.sources.UNKNOWN');
    expect(accessReviewLabelKey('states', 'FUTURE')).toBe('accessReviews.states.UNKNOWN');
    expect(accessReviewLabelKey('reviewerStrategies', 'FUTURE')).toBe(
      'accessReviews.reviewerStrategies.UNKNOWN'
    );
  });
});
