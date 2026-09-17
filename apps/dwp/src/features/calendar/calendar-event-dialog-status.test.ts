import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import { calendarEventSaveFailureKind } from './calendar-event-dialog-status';

describe('calendar event save failure classification', () => {
  it.each([401, 403, 404])('treats authoritative %s as revoked access', (status) => {
    expect(calendarEventSaveFailureKind(new HttpError('denied', status))).toBe('AUTHORITY_REVOKED');
  });

  it('separates optimistic version conflicts from recoverable transport errors', () => {
    expect(calendarEventSaveFailureKind(new HttpError('changed', 409))).toBe('VERSION_CONFLICT');
    expect(calendarEventSaveFailureKind(new Error('network'))).toBe('OTHER');
  });
});
