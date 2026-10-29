import type { CalendarAttendeeType, PersonSummary } from '@dwp-frontend/shared-utils';

export type CalendarEditorAttendee = Pick<
  PersonSummary,
  'personId' | 'displayName' | 'workEmail'
> & {
  userId?: number | null;
  type: Exclude<CalendarAttendeeType, 'RESOURCE'>;
};
