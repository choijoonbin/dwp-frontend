import { describe, expect, it } from 'vitest';

import { resolveFieldFeedback } from './form-field';

describe('resolveFieldFeedback', () => {
  it('gives validation errors precedence over supporting guidance', () => {
    expect(
      resolveFieldFeedback({
        errorMessage: 'Enter a valid email',
        supportingText: 'Use your company email',
      })
    ).toBe('Enter a valid email');
  });

  it('can reserve feedback height without announcing empty content', () => {
    expect(resolveFieldFeedback({ reserveFeedbackSpace: true })).toBe(' ');
    expect(resolveFieldFeedback({ reserveFeedbackSpace: false })).toBeUndefined();
  });
});
