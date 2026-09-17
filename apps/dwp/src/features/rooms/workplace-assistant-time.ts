import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { Temporal } from 'temporal-polyfill';

export function workplaceAssistantBrowserTimeZone() {
  const candidate = resolveSystemTimeZone('UTC');
  try {
    Temporal.Now.zonedDateTimeISO(candidate);
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function workplaceAssistantLocalDateTimeToInstant(value: string, timeZone: string) {
  const plain = Temporal.PlainDateTime.from(value);
  return plain.toZonedDateTime(timeZone, { disambiguation: 'reject' }).toInstant().toString();
}

export function workplaceAssistantInitialLocalRange(timeZone: string, now?: string) {
  const start = (now ? Temporal.Instant.from(now) : Temporal.Now.instant())
    .toZonedDateTimeISO(timeZone)
    .add({ days: 1 })
    .with({ hour: 9, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  return {
    startsAt: start.toPlainDateTime().toString({ smallestUnit: 'minute' }),
    endsAt: start.add({ hours: 9 }).toPlainDateTime().toString({ smallestUnit: 'minute' }),
  };
}
