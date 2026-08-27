import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  classifySavedViewOwnershipExecutionFailure,
  classifySavedViewTargetEligibilityFailure,
  countSavedViewScopes,
  daysUntil,
  filterOrphanedSavedViews,
  isDueWithin,
  isEligibleSavedViewCustodyTarget,
  isValidOrphanRetentionExtension,
  isValidSavedViewRetentionDate,
  sortCustodySourceUsers,
} from './saved-view-custody-model';

describe('saved view custody model', () => {
  it('requires a new impact review after an execution conflict', () => {
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError('Saved-view ownership changed after preview.', 409)
      )
    ).toBe('STALE_REVIEW');
    expect(
      classifySavedViewOwnershipExecutionFailure(new HttpError('Service unavailable.', 503))
    ).toBe('UNKNOWN');
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError(
          'The target owner already has an active personal saved view with the same name and surface. Choose another steward.',
          409
        )
      )
    ).toBe('PERSONAL_NAME_CONFLICT');
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError('Localized personal conflict.', 409, {
          errorCode: 'SAVED_VIEW_PERSONAL_NAME_CONFLICT',
        })
      )
    ).toBe('PERSONAL_NAME_CONFLICT');
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError('Localized shared conflict.', 409, {
          errorCode: 'SAVED_VIEW_SHARED_NAME_CONFLICT',
        })
      )
    ).toBe('SHARED_NAME_CONFLICT');
    expect(
      classifySavedViewOwnershipExecutionFailure(new HttpError('Unclassified conflict.', 409))
    ).toBe('UNKNOWN');
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError('Localized conflict.', 409, {
          errorCode: 'SAVED_VIEW_CUSTODY_STALE',
        })
      )
    ).toBe('STALE_REVIEW');
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError('The retained saved view changed. Refresh it and retry.', 409)
      )
    ).toBe('STALE_REVIEW');
    expect(
      classifySavedViewOwnershipExecutionFailure(
        new HttpError('The saved view is no longer retained and cannot be changed.', 409)
      )
    ).toBe('STALE_REVIEW');
    expect(classifySavedViewOwnershipExecutionFailure(new Error('Network failed.'))).toBe(
      'UNKNOWN'
    );
  });

  it('preserves only allowlisted non-sensitive target eligibility reasons', () => {
    expect(
      classifySavedViewTargetEligibilityFailure(
        new HttpError('The target is no longer eligible.', 400, {
          errorCode: 'SAVED_VIEW_TARGET_INELIGIBLE',
        })
      )
    ).toBe('TARGET_INELIGIBLE');
    expect(
      classifySavedViewTargetEligibilityFailure(
        new HttpError('Localized reason.', 400, {
          eligibilityReason: 'MISSING_TEAM_MEMBERSHIP',
        })
      )
    ).toBe('MISSING_TEAM_MEMBERSHIP');
    expect(
      classifySavedViewTargetEligibilityFailure(
        new HttpError('The target user must be a tenant shared-view administrator.', 400, {
          errorCode: 'E3002',
        })
      )
    ).toBe('MISSING_SHARED_VIEW_ADMIN_ROLE');
    expect(
      classifySavedViewTargetEligibilityFailure(
        new HttpError(
          'The target user is not entitled to every affected saved-view surface.',
          400,
          { errorCode: 'E3002' }
        )
      )
    ).toBe('MISSING_SURFACE_ACCESS');
    expect(
      classifySavedViewTargetEligibilityFailure(
        new HttpError('Untrusted backend detail.', 400, { errorCode: 'E3002' })
      )
    ).toBe('UNKNOWN');
  });

  it('summarizes the reviewed impact by visibility scope', () => {
    expect(
      countSavedViewScopes([
        { scope: 'PERSONAL' },
        { scope: 'TEAM' },
        { scope: 'TEAM' },
        { scope: 'TENANT' },
      ])
    ).toEqual({ PERSONAL: 1, TEAM: 2, TENANT: 1 });
  });

  it('surfaces inactive owners before active owner-correction candidates', () => {
    const users = sortCustodySourceUsers([
      {
        tenantId: 1,
        userId: 1,
        displayName: 'Active',
        status: 'ACTIVE',
      },
      {
        tenantId: 1,
        userId: 2,
        displayName: 'Departed',
        status: 'INACTIVE',
      },
    ]);

    expect(users.map((user) => user.userId)).toEqual([2, 1]);
  });

  it('uses calendar-day urgency for automatic archival', () => {
    const now = Date.parse('2026-08-26T00:00:00.000Z');
    expect(daysUntil('2026-08-29T00:00:00.000Z', now)).toBe(3);
    expect(isDueWithin('2026-09-02T00:00:00.000Z', 7, now)).toBe(true);
    expect(isDueWithin('2026-09-03T00:00:00.000Z', 7, now)).toBe(false);
  });

  it('only extends orphan retention beyond the current date and within one year', () => {
    const now = Date.parse('2026-08-27T00:00:00.000Z');
    const current = '2026-09-30T00:00:00.000Z';
    expect(isValidOrphanRetentionExtension('2026-09-29T00:00:00.000Z', current, now)).toBe(false);
    expect(isValidOrphanRetentionExtension('2027-08-01T00:00:00.000Z', current, now)).toBe(true);
    expect(isValidOrphanRetentionExtension('2027-08-28T00:00:01.000Z', current, now)).toBe(false);
  });

  it('keeps initial saved-view retention within the server one-year boundary', () => {
    const now = Date.parse('2026-08-27T00:00:00.000Z');
    expect(isValidSavedViewRetentionDate('2026-08-27T00:00:01.000Z', now)).toBe(true);
    expect(isValidSavedViewRetentionDate('2027-08-27T00:00:00.000Z', now)).toBe(true);
    expect(isValidSavedViewRetentionDate('2027-08-27T00:00:01.000Z', now)).toBe(false);
  });

  it('never treats the signed-in administrator or source owner as an eligible target', () => {
    const active = {
      tenantId: 1,
      userId: 7,
      displayName: 'Active user',
      status: 'ACTIVE',
    };
    expect(isEligibleSavedViewCustodyTarget(active, [1, 6])).toBe(true);
    expect(isEligibleSavedViewCustodyTarget(active, [1, 7])).toBe(false);
    expect(isEligibleSavedViewCustodyTarget({ ...active, status: 'INVITED' }, [1])).toBe(false);
  });

  it('searches retained views by localized surface name as well as raw key', () => {
    const rows = [
      {
        savedViewId: 'view-1',
        surfaceKey: 'communications.management',
        name: '게시 예정 공지',
        scope: 'TEAM' as const,
        retentionUntil: '2026-09-01T00:00:00.000Z',
        version: 3,
        updatedAt: '2026-08-25T00:00:00.000Z',
      },
    ];

    expect(
      filterOrphanedSavedViews(rows, '소식 운영', () => '소식 운영').map((view) => view.savedViewId)
    ).toEqual(['view-1']);
  });
});
