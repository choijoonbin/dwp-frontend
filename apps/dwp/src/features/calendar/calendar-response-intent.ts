import type { CalendarEvent, CalendarResponseStatus } from '@dwp-frontend/shared-utils';

type Response = Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>;

export type CalendarResponseIntent = Readonly<{
  fingerprint: string;
  idempotencyKey: string;
}>;

export type CalendarResponseCommand = Readonly<{
  eventId: string;
  response: Response;
  expectedVersion: number;
  idempotencyKey: string;
}>;

function newIdempotencyKey() {
  return globalThis.crypto.randomUUID();
}

export function prepareCalendarResponseCommand(
  current: CalendarResponseIntent | null,
  event: Pick<CalendarEvent, 'eventId' | 'version'>,
  response: Response,
  keyFactory: () => string = newIdempotencyKey
): Readonly<{ intent: CalendarResponseIntent; command: CalendarResponseCommand }> {
  const fingerprint = `${event.eventId}:${event.version}:${response}`;
  const intent =
    current?.fingerprint === fingerprint
      ? current
      : { fingerprint, idempotencyKey: keyFactory() };
  return {
    intent,
    command: {
      eventId: event.eventId,
      response,
      expectedVersion: event.version,
      idempotencyKey: intent.idempotencyKey,
    },
  };
}

export function completeCalendarResponseIntent(
  current: CalendarResponseIntent | null,
  completedKey: string
) {
  return current?.idempotencyKey === completedKey ? null : current;
}
