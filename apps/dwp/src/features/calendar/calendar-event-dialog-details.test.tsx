import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DwpDateTimeProvider } from '@dwp-frontend/design-system';

import { CalendarEventDialogDetails } from './calendar-event-dialog-details';

import type { CalendarResource } from '@dwp-frontend/shared-utils';
import type { CalendarEventDraft } from './calendar-event-editor-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const draft: CalendarEventDraft = {
  title: 'Planning',
  description: '',
  type: 'MEETING',
  startsAt: '2026-09-17T01:00:00.000Z',
  endsAt: '2026-09-17T02:00:00.000Z',
  allDay: false,
  location: '',
  conferenceUrl: '',
  visibility: 'DEFAULT',
  importance: 'NORMAL',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  recurrenceUntil: '',
  responseRequired: true,
  resourceId: '',
  timeZone: 'Asia/Seoul',
  calendarId: 'calendar-1',
};

const room: CalendarResource = {
  resourceId: 'room-1',
  code: 'SEOUL-1',
  name: 'Seoul 1',
  nameKo: '서울 1',
  nameEn: 'Seoul 1',
  type: 'ROOM',
  site: 'SEOUL',
  capacity: 8,
  features: [],
  timeZone: 'Asia/Seoul',
  approvalRequired: false,
  state: 'AVAILABLE',
  available: true,
  version: 1,
};

function render(form: CalendarEventDraft) {
  return renderToStaticMarkup(
    <DwpDateTimeProvider locale="en" timeZone={form.timeZone}>
      <CalendarEventDialogDetails
        expanded
        form={form}
        attendees={[]}
        attendeeOptions={[]}
        resources={[room]}
        peopleLoading={false}
        workProtected={false}
        workReceiptLocked={false}
        occurrenceOnly={false}
        validationVisible={false}
        resourceRecurrenceError={false}
        onExpandedChange={vi.fn()}
        onFormPatch={vi.fn()}
        onResourceChange={vi.fn()}
        onReplaceAttendees={vi.fn()}
      />
    </DwpDateTimeProvider>
  );
}

describe('CalendarEventDialogDetails', () => {
  it('renders meeting people, place, resource and response controls together', () => {
    const html = render({ ...draft, resourceId: room.resourceId, location: room.name });

    expect(html).toContain('event.requiredAttendeesLabel');
    expect(html).toContain('event.optionalAttendeesLabel');
    expect(html).toContain('event.locationLabel');
    expect(html).toContain('event.resourceLabel');
    expect(html).toContain('Seoul 1');
    expect(html).toContain('event.responseRequired');
  });

  it('removes meeting-only controls while retaining shared advanced options', () => {
    const html = render({ ...draft, type: 'FOCUS', responseRequired: false });

    expect(html).not.toContain('event.requiredAttendeesLabel');
    expect(html).not.toContain('event.resourceLabel');
    expect(html).not.toContain('event.responseRequired');
    expect(html).toContain('event.recurrenceLabel');
    expect(html).toContain('event.visibilityLabel');
    expect(html).toContain('event.timeZoneLabel');
  });
});
