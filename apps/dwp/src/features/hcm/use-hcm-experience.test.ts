import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { shouldFallbackToHcmIdentitySearch } from './use-hcm-experience';

describe('HCM identity fallback policy', () => {
  it('searches by verified email only when the linked person does not exist', () => {
    expect(shouldFallbackToHcmIdentitySearch(new HttpError('not found', 404))).toBe(true);
  });

  it('does not turn authorization or transport failures into another directory request', () => {
    expect(shouldFallbackToHcmIdentitySearch(new HttpError('forbidden', 403))).toBe(false);
    expect(shouldFallbackToHcmIdentitySearch(new HttpError('unavailable', 503))).toBe(false);
    expect(shouldFallbackToHcmIdentitySearch(new HttpTransportError('NETWORK'))).toBe(false);
  });
});
