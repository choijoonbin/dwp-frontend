import { describe, expect, it } from 'vitest';

import {
  appAccessFulfillmentDescriptionKey,
  appAccessFulfillmentStateLabelKey,
  appAccessRequestStateLabelKey,
} from './app-access-request-presentation';

describe('app access request presentation', () => {
  it('fails closed for unknown request and fulfillment states', () => {
    expect(appAccessRequestStateLabelKey('FUTURE')).toBe('appAccess.states.UNKNOWN');
    expect(appAccessFulfillmentStateLabelKey('FUTURE')).toBe('appAccess.fulfillmentStates.UNKNOWN');
    expect(appAccessFulfillmentDescriptionKey('FUTURE')).toBe(
      'appAccess.fulfillmentDescriptions.UNKNOWN'
    );
  });
});
