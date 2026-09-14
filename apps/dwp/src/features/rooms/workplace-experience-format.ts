import { formatDate } from '@dwp-frontend/shared-i18n';

export function formatWorkplaceExperienceInstant(value: string, timeZone?: string) {
  return formatDate(value, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  });
}
