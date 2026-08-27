import { describe, expect, it } from 'vitest';

import {
  filterWorkplaceResources,
  workplaceBookingBlockCode,
  workplaceDiscoverySort,
  workplaceDiscoveryType,
} from './workplace-discovery-model';

import type {
  CalendarPolicy,
  WorkplacePolicy,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';

const resource = (
  resourceId: string,
  name: string,
  overrides: Partial<WorkplaceResource> = {}
): WorkplaceResource => ({
  resourceId,
  floorId: 'floor-1',
  siteId: 'site-1',
  calendarResourceId: null,
  code: resourceId,
  name,
  nameKo: name,
  nameEn: name,
  type: 'DESK',
  mode: 'RESERVABLE',
  state: 'AVAILABLE',
  neighborhood: 'North',
  capacity: 1,
  features: ['MONITOR'],
  accessible: false,
  approvalRequired: false,
  positionX: 10,
  positionY: 10,
  widthPercent: 10,
  heightPercent: 10,
  rotationDegrees: 0,
  assignedToCurrentUser: false,
  assignedUserId: null,
  assignedPersonPublicId: null,
  assignedDisplayName: null,
  version: 1,
  ...overrides,
});

const workplacePolicy: WorkplacePolicy = {
  bookingWindowDays: 30,
  maximumActiveBookings: 10,
  minimumBookingMinutes: 30,
  maximumBookingMinutes: 480,
  maximumConsecutiveDays: 5,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  allowRecurring: false,
  requireCheckIn: true,
  checkInLeadMinutes: 30,
  autoReleaseMinutes: 15,
  allowAssignedDeskLending: false,
  showColleagueNames: false,
  bookingRetentionDays: 365,
  version: 1,
};

const roomPolicy: CalendarPolicy = {
  weekStart: 1,
  workingDayStart: '09:00:00',
  workingDayEnd: '18:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 30,
  maximumEventMinutes: 120,
  maximumAdvanceDays: 30,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 240,
  dailyMeetingLimitMinutes: 360,
  enforceMeetingAgenda: false,
  allowExternalAttendees: true,
  version: 1,
};

const bookability = {
  canCreateRoomBooking: true,
  canCreateWorkplaceBooking: true,
  occupancy: [],
  rangeFrom: '2026-08-27T04:00:00Z',
  rangeTo: '2026-08-27T05:00:00Z',
  roomPolicy,
  roomPolicyReady: true,
  serverNow: '2026-08-27T04:00:00Z',
  timeZone: 'Asia/Seoul',
  verified: true,
  workplacePolicy,
} as const;

describe('workplace discovery model', () => {
  it('normalizes untrusted URL values', () => {
    expect(workplaceDiscoveryType('ROOM')).toBe('ROOM');
    expect(workplaceDiscoveryType('UNKNOWN')).toBe('ALL');
    expect(workplaceDiscoverySort('capacity')).toBe('capacity');
    expect(workplaceDiscoverySort('unknown')).toBe('availability');
  });

  it('filters facets and ranks available resources first', () => {
    const resources = [
      resource('desk-b', 'Bravo', { accessible: true }),
      resource('desk-a', 'Alpha', { features: ['STANDING'] }),
      resource('room-a', 'Atlas', { type: 'ROOM', capacity: 8, accessible: true }),
    ];
    const filtered = filterWorkplaceResources(
      resources,
      [
        {
          resourceId: 'desk-b',
          bookingId: 'booking-1',
          status: 'RESERVED',
          startsAt: '2026-08-27T04:00:00Z',
          endsAt: '2026-08-27T05:00:00Z',
          bookedByDisplayName: null,
          currentUser: false,
        },
      ],
      {
        search: 'a',
        type: 'ALL',
        feature: '',
        neighborhood: '',
        accessibleOnly: true,
        sort: 'availability',
      }
    );

    expect(filtered.map((item) => item.resourceId)).toEqual(['room-a', 'desk-b']);
  });

  it('fails closed for assignment, room binding, and unverified time-zone context', () => {
    expect(
      workplaceBookingBlockCode(resource('assigned', 'Assigned', { mode: 'ASSIGNED' }), bookability)
    ).toBe('ASSIGNED');
    expect(workplaceBookingBlockCode(resource('room', 'Room', { type: 'ROOM' }), bookability)).toBe(
      'ROOM_BINDING'
    );
    expect(
      workplaceBookingBlockCode(resource('desk', 'Desk'), { ...bookability, verified: false })
    ).toBe('UNVERIFIED');
  });

  it('uses the same bookability contract to rank discovery results', () => {
    const filtered = filterWorkplaceResources(
      [resource('room', 'Alpha room', { type: 'ROOM' }), resource('desk', 'Zulu desk')],
      [],
      {
        search: '',
        type: 'ALL',
        feature: '',
        neighborhood: '',
        accessibleOnly: false,
        sort: 'availability',
      },
      bookability
    );

    expect(filtered.map((item) => item.resourceId)).toEqual(['desk', 'room']);
  });

  it('routes create permission checks to the resource booking owner', () => {
    const mappedRoom = resource('room', 'Room', {
      type: 'ROOM',
      calendarResourceId: 'calendar-room-1',
    });

    expect(
      workplaceBookingBlockCode(mappedRoom, {
        ...bookability,
        canCreateWorkplaceBooking: false,
      })
    ).toBeNull();
    expect(
      workplaceBookingBlockCode(resource('desk', 'Desk'), {
        ...bookability,
        canCreateWorkplaceBooking: false,
      })
    ).toBe('READ_ONLY');
    expect(
      workplaceBookingBlockCode(mappedRoom, {
        ...bookability,
        canCreateRoomBooking: false,
      })
    ).toBe('READ_ONLY');
  });

  it('applies the selected range to each resource owner policy', () => {
    const desk = resource('desk', 'Desk');
    const mappedRoom = resource('room', 'Room', {
      type: 'ROOM',
      calendarResourceId: 'calendar-room-1',
    });
    const longRange = {
      ...bookability,
      rangeTo: '2026-08-27T07:00:00Z',
    };

    expect(workplaceBookingBlockCode(desk, longRange)).toBeNull();
    expect(workplaceBookingBlockCode(mappedRoom, longRange)).toBe('POLICY_RANGE');
    expect(
      workplaceBookingBlockCode(desk, {
        ...bookability,
        rangeFrom: '2026-08-26T23:00:00Z',
        rangeTo: '2026-08-27T00:00:00Z',
      })
    ).toBe('POLICY_RANGE');
    expect(
      workplaceBookingBlockCode(desk, {
        ...bookability,
        rangeFrom: '2026-08-27T12:00:00Z',
        rangeTo: '2026-08-27T13:00:00Z',
      })
    ).toBe('POLICY_RANGE');
  });
});
