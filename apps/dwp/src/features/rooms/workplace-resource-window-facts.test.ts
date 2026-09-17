import { describe, expect, it } from 'vitest';
import {
  workplaceResourceWindowFacts,
  type WorkplaceResourceWindowContext,
} from './workplace-resource-window-facts';
import type { WorkplaceResource } from '@dwp-frontend/shared-utils';

const resource = {
  resourceId: '30000000-0000-4000-8000-000000000012',
  siteId: '10000000-0000-4000-8000-000000000001',
  floorId: '20000000-0000-4000-8000-000000000012',
  type: 'DESK',
} as WorkplaceResource;
const context: WorkplaceResourceWindowContext = {
  siteId: resource.siteId,
  floorId: resource.floorId,
  startsAt: '2026-08-19T00:17:00Z',
  endsAt: '2026-08-19T01:02:00Z',
  sourceReady: true,
  policy: {
    bookingWindowDays: 30,
    bookingRetentionDays: 365,
    maximumActiveBookings: 20,
    minimumBookingMinutes: 30,
    maximumBookingMinutes: 480,
    maximumConsecutiveDays: 5,
    workingDayStart: '07:00:00',
    workingDayEnd: '20:00:00',
    allowRecurring: false,
    requireCheckIn: true,
    checkInLeadMinutes: 60,
    autoReleaseMinutes: 30,
    allowAssignedDeskLending: false,
    showColleagueNames: false,
    version: 4,
  },
  occupancy: [
    {
      resourceId: resource.resourceId,
      bookingId: 'private-booking',
      bookedByDisplayName: 'Confidential person',
      currentUser: false,
      status: 'RESERVED',
      startsAt: '2026-08-19T00:10:00Z',
      endsAt: '2026-08-19T00:25:00Z',
    },
  ],
  closures: [
    {
      resourceId: resource.resourceId,
      availability: 'UNAVAILABLE',
      startsAt: '2026-08-19T00:35:00Z',
      endsAt: '2026-08-19T00:40:00Z',
    },
  ],
};
describe('native selected-window resource facts', () => {
  it('clips actual intervals to the queried window and removes person/booking identifiers', () => {
    const facts = workplaceResourceWindowFacts(resource, context);
    expect(facts?.segments).toEqual([
      {
        startsAt: '2026-08-19T00:17:00.000Z',
        endsAt: '2026-08-19T00:25:00.000Z',
        kind: 'RESERVED',
      },
      {
        startsAt: '2026-08-19T00:25:00.000Z',
        endsAt: '2026-08-19T00:35:00.000Z',
        kind: 'UNRESERVED',
      },
      { startsAt: '2026-08-19T00:35:00.000Z', endsAt: '2026-08-19T00:40:00.000Z', kind: 'CLOSED' },
      {
        startsAt: '2026-08-19T00:40:00.000Z',
        endsAt: '2026-08-19T01:02:00.000Z',
        kind: 'UNRESERVED',
      },
    ]);
    expect(JSON.stringify(facts)).not.toContain('private-booking');
    expect(JSON.stringify(facts)).not.toContain('Confidential person');
    expect(facts?.policy?.autoReleaseMinutes).toBe(30);
    expect(facts?.minutesByKind).toEqual({ RESERVED: 8, UNRESERVED: 32, CLOSED: 5 });
  });
  it('uses the actual queried empty window without manufacturing reservation intervals', () => {
    expect(
      workplaceResourceWindowFacts(resource, { ...context, occupancy: [], closures: [] })?.segments
    ).toEqual([
      {
        startsAt: '2026-08-19T00:17:00.000Z',
        endsAt: '2026-08-19T01:02:00.000Z',
        kind: 'UNRESERVED',
      },
    ]);
  });
  it.each([
    { sourceReady: false },
    { siteId: 'another-site' },
    { floorId: 'another-floor' },
    { endsAt: context.startsAt },
    { startsAt: 'invalid' },
  ])('closes an unverified or mismatched native context %o', (patch) => {
    expect(workplaceResourceWindowFacts(resource, { ...context, ...patch })).toBeNull();
  });
  it('does not apply Workplace check-in rules to a Rooms owner', () => {
    expect(workplaceResourceWindowFacts({ ...resource, type: 'ROOM' }, context)?.policy).toBeNull();
  });
  it('keeps the actual zero-minute no-show policy and optional-check-in flag', () => {
    expect(
      workplaceResourceWindowFacts(resource, {
        ...context,
        policy: { ...context.policy, autoReleaseMinutes: 0, requireCheckIn: false },
      })?.policy
    ).toMatchObject({ autoReleaseMinutes: 0, requireCheckIn: false });
  });
  it('closes unknown active booking state rather than displaying a fabricated free interval', () => {
    expect(
      workplaceResourceWindowFacts(resource, {
        ...context,
        occupancy: [{ ...context.occupancy[0], status: 'UNRECOGNIZED' as 'RESERVED' }],
      })
    ).toBeNull();
  });
});
