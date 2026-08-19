import { describe, expect, it } from 'vitest';

import {
  isWorkplaceGovernancePeriodValid,
  isWorkplaceGovernanceUuid,
  parseWorkplaceGovernanceTab,
  parseWorkplaceGovernanceUserId,
  validateWorkplaceGovernancePolicyPatch,
  workplaceGovernanceRevisionActions,
} from './workplace-admin-governance-model';
import { findFirstAccessibleRoomsPath, findRoomsNavigationItem } from './rooms-navigation';

describe('Workplace governance model', () => {
  it('validates identifier-only subjects', () => {
    expect(parseWorkplaceGovernanceUserId('900018')).toBe(900018);
    expect(parseWorkplaceGovernanceUserId('0')).toBeNull();
    expect(isWorkplaceGovernanceUuid('52bdc100-b924-4b5c-bff4-1da349f3d359')).toBe(true);
    expect(isWorkplaceGovernanceUuid('team-finance')).toBe(false);
  });

  it('rejects reversed validity periods', () => {
    expect(isWorkplaceGovernancePeriodValid(null, null)).toBe(true);
    expect(isWorkplaceGovernancePeriodValid('2026-08-20T10:00:00Z', '2026-08-20T09:00:00Z')).toBe(
      false
    );
  });

  it('validates partial policy patches against server ranges', () => {
    expect(validateWorkplaceGovernancePolicyPatch({ bookingWindowDays: 90 })).toBe(true);
    expect(validateWorkplaceGovernancePolicyPatch({ bookingRetentionDays: 29 })).toBe(false);
    expect(validateWorkplaceGovernancePolicyPatch({ workingDayStart: '09:00' })).toBe(true);
    expect(validateWorkplaceGovernancePolicyPatch({})).toBe(false);
    expect(
      validateWorkplaceGovernancePolicyPatch({
        minimumBookingMinutes: 120,
        maximumBookingMinutes: 60,
      })
    ).toBe(false);
    expect(
      validateWorkplaceGovernancePolicyPatch({ workingDayStart: '18:00', workingDayEnd: '09:00' })
    ).toBe(false);
    expect(
      validateWorkplaceGovernancePolicyPatch({
        bookingWindowDays: 3,
        maximumConsecutiveDays: 5,
      })
    ).toBe(false);
  });

  it('normalizes governance deep links and rejects unknown tab values', () => {
    expect(parseWorkplaceGovernanceTab('floorPlans')).toBe('floorPlans');
    expect(parseWorkplaceGovernanceTab('unknown')).toBe('hierarchy');
    expect(parseWorkplaceGovernanceTab(null)).toBe('hierarchy');
  });

  it('allows only legal floor-plan transitions', () => {
    const revision = (state: 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED') =>
      ({ state }) as Parameters<typeof workplaceGovernanceRevisionActions>[0];
    expect(workplaceGovernanceRevisionActions(revision('DRAFT'))).toEqual(['REVIEW']);
    expect(workplaceGovernanceRevisionActions(revision('REVIEW'))).toEqual(['PUBLISH']);
    expect(workplaceGovernanceRevisionActions(revision('ARCHIVED'))).toEqual(['RESTORE']);
  });

  it('registers governance as a Workplace VIEW administration surface', () => {
    expect(findRoomsNavigationItem('/workplace/admin/governance')).toMatchObject({
      view: 'admin-governance',
      requiredResourceKey: 'ADMIN.WORKPLACE',
      requiredPermissionCode: 'VIEW',
    });
  });

  it('selects a permitted fallback instead of redirecting to an inaccessible default', () => {
    expect(
      findFirstAccessibleRoomsPath(
        (resource, permission) => resource === 'APP.ROOMS' && permission === 'VIEW'
      )
    ).toBe('/workplace/rooms');
    expect(findFirstAccessibleRoomsPath(() => false)).toBe('/');
  });
});
