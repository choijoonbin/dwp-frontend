import { describe, expect, it } from 'vitest';

import {
  adminVisitAction,
  isGetOnlyVisitRecovery,
  requesterVisitActions,
  workplaceVisitProviderTone,
  workplaceVisitTone,
} from './workplace-visits-ui-model';

describe('workplace visitor access UI policy', () => {
  it('exposes only lifecycle-valid requester actions', () => {
    expect(requesterVisitActions('PREVIEWED', false)).toEqual(['SEND_INVITATION', 'CANCEL']);
    expect(requesterVisitActions('APPROVED', false)).toEqual(['REQUEST_ACCESS', 'CANCEL']);
    expect(requesterVisitActions('CHECKED_OUT', false)).toEqual([]);
  });

  it('makes unknown results GET-only even when a stale state suggests a mutation', () => {
    expect(requesterVisitActions('RESULT_UNKNOWN', false)).toEqual([]);
    expect(requesterVisitActions('APPROVED', true)).toEqual([]);
    expect(isGetOnlyVisitRecovery('RESULT_UNKNOWN')).toBe(true);
  });

  it('maps each exception to one explicit operator action', () => {
    expect(adminVisitAction('APPROVAL_PENDING')).toBe('APPROVE');
    expect(adminVisitAction('ACCESS_FAILED')).toBe('RETRY_ACCESS');
    expect(adminVisitAction('HOST_UNRESPONSIVE')).toBe('NOTIFY_HOST');
    expect(adminVisitAction('OVERSTAY')).toBe('CONFIRM_CHECKOUT');
    expect(adminVisitAction('RESULT_UNKNOWN')).toBeNull();
  });

  it('never presents stale or unverified providers as ready', () => {
    expect(workplaceVisitProviderTone('READY')).toBe('success');
    expect(workplaceVisitProviderTone('CONFIGURED_UNVERIFIED')).toBe('warning');
    expect(workplaceVisitProviderTone('STALE')).toBe('error');
    expect(workplaceVisitTone('RESULT_UNKNOWN')).toBe('error');
  });
});
