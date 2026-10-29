// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { classifyMessagingReadFailure } from './messaging-read-error-state';

describe('classifyMessagingReadFailure', () => {
  it('distinguishes explicit permission loss from a generic read failure', () => {
    expect(classifyMessagingReadFailure(new HttpError('forbidden', 403))).toBe('permission');
    expect(classifyMessagingReadFailure(new HttpError('unauthorized', 401))).toBe('permission');
    expect(classifyMessagingReadFailure(new HttpError('failed', 500))).toBe('unavailable');
  });

  it('treats transport failures and the browser offline signal as offline', () => {
    expect(classifyMessagingReadFailure(new HttpTransportError('NETWORK'))).toBe('offline');
    expect(classifyMessagingReadFailure(new HttpTransportError('TIMEOUT'))).toBe('unavailable');

    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(classifyMessagingReadFailure(new HttpError('failed', 500))).toBe('offline');
    online.mockRestore();
  });
});
