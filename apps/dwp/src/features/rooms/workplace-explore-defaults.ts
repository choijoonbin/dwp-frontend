import { Temporal } from 'temporal-polyfill';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';

export function workplaceExploreDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function workplaceExploreTime() {
  const now = new Date();
  const minutes = now.getMinutes() < 30 ? 30 : 0;
  const hour = now.getHours() + (minutes === 0 ? 1 : 0);
  return `${String(Math.min(hour, 19)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function positiveWorkplaceNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function initialWorkplaceTimeZone(value: string | null) {
  if (value) {
    try {
      Temporal.Now.instant().toZonedDateTimeISO(value);
      return value;
    } catch {
      // The authoritative site response replaces malformed URL hints.
    }
  }
  return resolveSystemTimeZone('UTC');
}
