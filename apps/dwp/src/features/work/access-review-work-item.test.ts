import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { classifyAccessReviewWorkError } from './access-review-work-item';

describe('access review Work owner states', () => {
  it('renders foreign and revoked assignments as local not found', () => {
    expect(classifyAccessReviewWorkError(new HttpError('foreign', 404))).toBe('not-found');
    expect(classifyAccessReviewWorkError(new HttpError('forbidden', 403))).toBe('not-found');
  });

  it('keeps optimistic concurrency conflicts distinct and everything else unavailable', () => {
    expect(classifyAccessReviewWorkError(new HttpError('stale', 409))).toBe('stale');
    expect(classifyAccessReviewWorkError(new Error('offline'))).toBe('unavailable');
  });
});
