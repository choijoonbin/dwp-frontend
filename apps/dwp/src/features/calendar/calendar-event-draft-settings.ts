import type { CalendarSettings } from '@dwp-frontend/shared-utils';

import type { CalendarEventDraft } from './calendar-event-editor-model';

export function calendarCreationDraftWithSettings(
  draft: CalendarEventDraft,
  settings: CalendarSettings | undefined,
  explicit: Readonly<{
    end: boolean;
    timeZone: boolean;
    visibility: boolean;
  }>
) {
  if (!settings) return draft;
  const startsAt = new Date(draft.startsAt);
  const speedyMinutes =
    settings.speedyMeetingMode === 'FIVE_TEN' ? (settings.defaultEventMinutes >= 60 ? 10 : 5) : 0;
  const durationMinutes = Math.max(5, settings.defaultEventMinutes - speedyMinutes);
  return {
    ...draft,
    endsAt:
      explicit.end || Number.isNaN(startsAt.getTime())
        ? draft.endsAt
        : new Date(startsAt.getTime() + durationMinutes * 60_000).toISOString(),
    timeZone: explicit.timeZone ? draft.timeZone : settings.timeZone,
    visibility: explicit.visibility
      ? draft.visibility
      : settings.defaultVisibility === 'PRIVATE'
        ? ('PRIVATE' as const)
        : ('DEFAULT' as const),
  };
}
