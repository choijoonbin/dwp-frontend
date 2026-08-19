// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { findRoomsNavigationItem } from './rooms-navigation';
import {
  canForceCancelBooking,
  initialOperationsRange,
  operationsRangeIssue,
  operationsRangeToIso,
  parseOperationUserId,
} from './workplace-admin-operations';

describe('Workplace administrator operations', () => {
  it('uses tenant-local calendar boundaries and preserves daylight-saving transitions', () => {
    expect(
      operationsRangeToIso({ start: '2026-03-08', end: '2026-03-08' }, 'America/New_York')
    ).toEqual({ from: '2026-03-08T05:00:00Z', to: '2026-03-09T04:00:00Z' });
    expect(operationsRangeToIso({ start: '2026-08-19', end: '2026-08-19' }, 'Asia/Seoul')).toEqual({
      from: '2026-08-18T15:00:00Z',
      to: '2026-08-19T15:00:00Z',
    });
  });

  it('builds the default operating window around today in the selected time zone', () => {
    expect(initialOperationsRange('Asia/Seoul', '2026-08-19T00:00:00Z')).toEqual({
      start: '2026-08-12',
      end: '2026-09-18',
    });
  });

  it('enforces the backend 400-day search limit and ordered complete dates', () => {
    expect(operationsRangeIssue({ start: null, end: '2026-08-19' })).toBe('required');
    expect(operationsRangeIssue({ start: '2026-08-20', end: '2026-08-19' })).toBe('order');
    expect(operationsRangeIssue({ start: '2026-01-01', end: '2027-02-04' })).toBeNull();
    expect(operationsRangeIssue({ start: '2026-01-01', end: '2027-02-05' })).toBe('tooLong');
  });

  it('accepts only positive whole-number user identifiers', () => {
    expect(parseOperationUserId('')).toBeNull();
    expect(parseOperationUserId(' 42 ')).toBe(42);
    expect(parseOperationUserId('1.5')).toBeNull();
    expect(parseOperationUserId('-1')).toBeNull();
    expect(parseOperationUserId('user-42')).toBeNull();
  });

  it('offers force cancellation only for active booking states', () => {
    expect(canForceCancelBooking('RESERVED')).toBe(true);
    expect(canForceCancelBooking('CHECKED_IN')).toBe(true);
    expect(canForceCancelBooking('COMPLETED')).toBe(false);
    expect(canForceCancelBooking('NO_SHOW')).toBe(false);
    expect(canForceCancelBooking('RELEASED')).toBe(false);
    expect(canForceCancelBooking('CANCELLED')).toBe(false);
  });

  it('registers the operations route as a Workplace VIEW administration surface', () => {
    expect(findRoomsNavigationItem('/workplace/admin/operations')).toMatchObject({
      view: 'admin-operations',
      requiredResourceKey: 'ADMIN.WORKPLACE',
      requiredPermissionCode: 'VIEW',
    });
  });
});
