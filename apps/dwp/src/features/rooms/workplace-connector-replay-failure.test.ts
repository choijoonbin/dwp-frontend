import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  isAmbiguousWorkplaceConnectorReplayFailure,
  isDefinitiveWorkplaceConnectorReplayFailure,
} from './workplace-connector-replay-failure';

describe('workplace connector replay failure classification', () => {
  it.each([400, 401, 403, 404, 409, 422])(
    'treats an authoritative %i response as a definitive rejection',
    (status) => {
      const error = new HttpError('Rejected', status);
      expect(isDefinitiveWorkplaceConnectorReplayFailure(error)).toBe(true);
      expect(isAmbiguousWorkplaceConnectorReplayFailure(error)).toBe(false);
    }
  );

  it.each([
    new HttpTransportError('NETWORK'),
    new HttpError('Request timeout after dispatch', 408),
    new HttpError('Too early to know the outcome', 425),
    new HttpError('Admission status is not authoritative', 429),
    new HttpError('Gateway replaced the response', 502),
    new HttpError('Service unavailable', 503),
    new Error('Committed response body could not be parsed'),
  ])('preserves exact retry evidence for an uncertain outcome', (error) => {
    expect(isDefinitiveWorkplaceConnectorReplayFailure(error)).toBe(false);
    expect(isAmbiguousWorkplaceConnectorReplayFailure(error)).toBe(true);
  });
});
