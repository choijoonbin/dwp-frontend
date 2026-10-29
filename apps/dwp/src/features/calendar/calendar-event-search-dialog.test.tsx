import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { CalendarEventSearchResultList } from './calendar-event-search-dialog';

import type { CalendarEvent } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const event = {
  eventId: '019a3d6e-4be8-779c-8a6d-893fe39b74ca',
  calendarId: 'calendar-1',
  calendarName: 'Team calendar',
  calendarColor: '#2563eb',
  organizerName: 'Minseo Kim',
  title: 'Release review',
  description: 'Review the release plan',
  type: 'MEETING',
  startsAt: '2026-10-28T01:00:00Z',
  endsAt: '2026-10-28T02:00:00Z',
  timeZone: 'Asia/Seoul',
  allDay: false,
  location: 'Seoul 1',
  status: 'CONFIRMED',
  visibility: 'DEFAULT',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  responseRequired: false,
  attendees: [],
  importance: 'NORMAL',
  conflict: false,
  detailLevel: 'FULL',
  redacted: false,
  version: 1,
} satisfies CalendarEvent;

describe('CalendarEventSearchResultList', () => {
  it('renders a keyboard-selectable result with useful accessible context', () => {
    const html = renderToStaticMarkup(
      <CalendarEventSearchResultList events={[event]} language="en" onSelect={vi.fn()} />
    );

    expect(html).toContain('Release review');
    expect(html).toContain('Team calendar');
    expect(html).toContain('Minseo Kim');
    expect(html).toContain('Seoul 1');
    expect(html).toContain('eventSearch.resultLabel');
    expect(html).toContain('tabindex="0"');
  });
});
