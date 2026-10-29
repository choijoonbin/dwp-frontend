import { Temporal } from 'temporal-polyfill';

export function calendarAvailabilityIsoRange(
  value: Readonly<{ start: string | null; end: string | null }>,
  timeZone: string
) {
  if (!value.start || !value.end) return null;
  try {
    const from = Temporal.ZonedDateTime.from(`${value.start}T00:00:00[${timeZone}]`);
    const to = Temporal.ZonedDateTime.from(`${value.end}T00:00:00[${timeZone}]`).add({ days: 1 });
    return { from: from.toInstant().toString(), to: to.toInstant().toString() };
  } catch {
    return null;
  }
}
