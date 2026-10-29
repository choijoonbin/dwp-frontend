import { describe, expect, it } from 'vitest';

import {
  firstNotificationSupportId,
  notificationRouteSupportId,
} from './notification-route-error-support';

describe('notification route error support reference', () => {
  it('reads direct and transport-envelope correlation identifiers', () => {
    expect(notificationRouteSupportId({ correlationId: 'corr-direct-123' })).toBe(
      'corr-direct-123'
    );
    expect(notificationRouteSupportId({ details: { correlationId: 'corr-envelope-456' } })).toBe(
      'corr-envelope-456'
    );
  });

  it('accepts a bounded request identifier when correlation is unavailable', () => {
    expect(notificationRouteSupportId({ requestId: 'request_abc-123' })).toBe('request_abc-123');
  });

  it('prefers the transport correlation header and can select the first safe query failure', () => {
    const transportError = {
      correlationId: 'payload-correlation-ignored',
      headers: new Headers({ 'X-Correlation-ID': 'header-correlation-789' }),
    };

    expect(notificationRouteSupportId(transportError)).toBe('header-correlation-789');
    expect(firstNotificationSupportId([new Error('no identifier'), transportError])).toBe(
      'header-correlation-789'
    );
  });

  it('does not expose free-form or oversized error data', () => {
    expect(notificationRouteSupportId(new Error('customer@example.com failed'))).toBeNull();
    expect(notificationRouteSupportId({ correlationId: 'unsafe\nsecret' })).toBeNull();
    expect(notificationRouteSupportId({ correlationId: 'x'.repeat(129) })).toBeNull();
    expect(
      notificationRouteSupportId({
        headers: { get: () => 'unsafe\nsecret' },
        details: { message: 'private customer data' },
      })
    ).toBeNull();
  });
});
