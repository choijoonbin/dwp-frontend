export type MailSnoozePreset = 'LATER_TODAY' | 'TOMORROW' | 'NEXT_WEEK' | 'CUSTOM';

function atLocalTime(date: Date, hour: number, minute = 0) {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function resolveMailSnoozePreset(
  preset: Exclude<MailSnoozePreset, 'CUSTOM'>,
  now = new Date()
): string | null {
  if (preset === 'LATER_TODAY') {
    const endOfWorkday = atLocalTime(now, 17);
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const target = endOfWorkday > twoHoursLater ? endOfWorkday : twoHoursLater;
    if (target.getDate() !== now.getDate()) return null;
    return target.toISOString();
  }

  if (preset === 'TOMORROW') {
    const tomorrow = atLocalTime(now, 9);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  const nextWeek = atLocalTime(now, 9);
  const daysUntilNextMonday = (8 - nextWeek.getDay()) % 7 || 7;
  nextWeek.setDate(nextWeek.getDate() + daysUntilNextMonday);
  return nextWeek.toISOString();
}

export function isValidMailSnoozeTime(value: string | null, now = new Date()) {
  if (!value) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.getTime() > now.getTime();
}
