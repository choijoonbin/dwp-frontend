import { describe, expect, it } from 'vitest';

import {
  calendarExternalCalendars,
  calendarExternalEvents,
  calendarExternalSourceUrl,
} from './calendar-external-projection-model';

import type { CalendarExternalProjection } from '@dwp-frontend/shared-utils';

const PROJECTION: CalendarExternalProjection = {
  events: [
    {
      externalEventId: '20000000-0000-4000-8000-000000000002',
      externalCalendarId: '10000000-0000-4000-8000-000000000001',
      provider: 'MICROSOFT_365',
      title: 'External planning',
      sourceUrl: 'https://outlook.office.com/calendar/item/2',
      startsAt: '2026-10-29T01:00:00Z',
      endsAt: '2026-10-29T02:00:00Z',
      importance: 'high',
      classification: 'CONFIDENTIAL',
      capabilities: {
        canViewDetails: true,
        canCreateEvents: false,
        canEdit: false,
        canDelete: false,
        canRestore: false,
        canRespond: false,
        canStar: false,
      },
    },
  ],
  sources: [
    {
      externalCalendarId: '10000000-0000-4000-8000-000000000001',
      provider: 'MICROSOFT_365',
      status: 'HEALTHY',
      lastSuccessfulSyncAt: '2026-10-28T23:00:00Z',
      truncated: false,
    },
  ],
  partial: false,
  truncated: false,
  generatedAt: '2026-10-28T23:30:00Z',
};

describe('calendar external projection model', () => {
  it('maps provider items into immutable Calendar events and a local-only source', () => {
    expect(calendarExternalEvents(PROJECTION)).toEqual([
      expect.objectContaining({
        eventId: '20000000-0000-4000-8000-000000000002',
        calendarName: 'Microsoft 365',
        importance: 'HIGH',
        visibility: 'CONFIDENTIAL',
        externalSourceUrl: 'https://outlook.office.com/calendar/item/2',
        capabilities: expect.objectContaining({
          canEdit: false,
          canDelete: false,
          canRespond: false,
          canStar: false,
        }),
      }),
    ]);
    expect(calendarExternalCalendars(PROJECTION)).toEqual([
      expect.objectContaining({
        calendarId: '10000000-0000-4000-8000-000000000001',
        name: 'Microsoft 365',
        selected: true,
        externalProvider: 'MICROSOFT_365',
        capabilities: expect.objectContaining({ canCreateEvents: false }),
      }),
    ]);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,calendar',
    'http://outlook.office.com/calendar/item/2',
    'https://user@outlook.office.com/calendar/item/2',
    'https://example.com/calendar/item/2',
    'https://outlook.office.com.evil.example/calendar/item/2',
  ])('redacts an unsafe provider source URL: %s', (value) => {
    expect(calendarExternalSourceUrl(value)).toBeNull();
  });
});
