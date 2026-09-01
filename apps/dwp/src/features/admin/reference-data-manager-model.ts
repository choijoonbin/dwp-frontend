import { formatDate as formatLocalizedDate } from '@dwp-frontend/shared-i18n';

import type { ReferenceItem } from '@dwp-frontend/shared-utils';

export type SetDialogMode = 'create' | 'edit' | null;
export type ItemDialogState = { mode: 'create' } | { mode: 'edit'; item: ReferenceItem } | null;
export type DetailView = 'values' | 'activity';
export type ItemFilter = 'ALL' | ReferenceItem['lifecycleState'];
export type PendingAction =
  | { kind: 'activate-set' }
  | { kind: 'retire-set' }
  | { kind: 'activate-item'; item: ReferenceItem }
  | { kind: 'retire-item'; item: ReferenceItem }
  | null;

export const REQUIRED_REFERENCE_LOCALES = ['ko', 'en'] as const;

export function referenceDataErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function preferredReferenceLabel(item: ReferenceItem, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  const baseLocale = normalizedLocale.split('-')[0];
  return (
    item.labels.find((label) => label.locale.toLowerCase() === normalizedLocale)?.label ??
    item.labels.find((label) => label.locale.toLowerCase().split('-')[0] === baseLocale)?.label ??
    item.labels.find((label) => label.locale.toLowerCase().startsWith('en'))?.label ??
    item.labels[0]?.label ??
    item.code
  );
}

export function hasReferenceLocale(item: ReferenceItem, locale: string): boolean {
  return item.labels.some((label) => label.locale.toLowerCase().split('-')[0] === locale);
}

export function isReferenceItemAvailable(item: ReferenceItem, now = Date.now()): boolean {
  if (item.lifecycleState !== 'ACTIVE') return false;
  const start = item.validFrom ? Date.parse(item.validFrom) : Number.NEGATIVE_INFINITY;
  const end = item.validTo ? Date.parse(item.validTo) : Number.POSITIVE_INFINITY;
  return start <= now && now < end;
}

export function referenceValidityState(
  item: ReferenceItem,
  now = Date.now()
): 'always' | 'scheduled' | 'expired' | 'bounded' {
  if (item.validFrom && Date.parse(item.validFrom) > now) return 'scheduled';
  if (item.validTo && Date.parse(item.validTo) <= now) return 'expired';
  if (item.validFrom || item.validTo) return 'bounded';
  return 'always';
}

export function formatReferenceDate(value: string | null | undefined): string {
  if (!value) return '';
  return formatLocalizedDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatReferenceDateTime(value: string): string {
  return formatLocalizedDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
