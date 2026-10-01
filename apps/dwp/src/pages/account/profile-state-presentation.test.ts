import { describe, expect, it } from 'vitest';

import {
  privacyConsentState,
  privacyRequestEvent,
  privacyRequestState,
  productivityConnectionState,
} from './profile-state-presentation';

describe('profile state presentation', () => {
  it('preserves only supported connected-app states', () => {
    expect(productivityConnectionState('CONNECTED')).toBe('CONNECTED');
    expect(productivityConnectionState('INTERNAL_VENDOR_STATE')).toBe('UNAVAILABLE');
    expect(productivityConnectionState(null)).toBe('UNAVAILABLE');
  });

  it('fails closed for unsupported privacy request states and events', () => {
    expect(privacyRequestState('RECEIVED')).toBe('RECEIVED');
    expect(privacyRequestState('INTERNAL_REVIEW')).toBe('UNAVAILABLE');
    expect(privacyRequestEvent('REQUEST_CANCELLED')).toBe('REQUEST_CANCELLED');
    expect(privacyRequestEvent('OWNER_DEBUG_EVENT')).toBe('UNAVAILABLE');
  });

  it('fails closed for unsupported consent states', () => {
    expect(privacyConsentState('WITHDRAWN')).toBe('WITHDRAWN');
    expect(privacyConsentState('LEGACY_IMPORT')).toBe('UNAVAILABLE');
  });
});
