import { Temporal } from 'temporal-polyfill';

export type MessagingScheduleTimeResolution =
  { kind: 'valid'; scheduledFor: string } | { kind: 'invalid' | 'nonexistent' | 'ambiguous' };

const LOCAL_MINUTE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function resolveMessagingScheduleTime(
  localValue: string,
  timeZone: string
): MessagingScheduleTimeResolution {
  if (!LOCAL_MINUTE_PATTERN.test(localValue)) return { kind: 'invalid' };
  try {
    const local = Temporal.PlainDateTime.from(localValue, { overflow: 'reject' });
    const zonedFields = {
      timeZone,
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    };
    const earlier = Temporal.ZonedDateTime.from(zonedFields, { disambiguation: 'earlier' });
    const later = Temporal.ZonedDateTime.from(zonedFields, { disambiguation: 'later' });
    const earlierMatches = earlier.toPlainDateTime().equals(local);
    const laterMatches = later.toPlainDateTime().equals(local);

    if (!earlierMatches && !laterMatches) return { kind: 'nonexistent' };
    if (earlierMatches && laterMatches && earlier.epochNanoseconds !== later.epochNanoseconds) {
      return { kind: 'ambiguous' };
    }
    const resolved = earlierMatches ? earlier : later;
    return { kind: 'valid', scheduledFor: resolved.toInstant().toString() };
  } catch {
    return { kind: 'invalid' };
  }
}
