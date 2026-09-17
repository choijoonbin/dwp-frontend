import type { CalendarEvent, WorkplaceBooking } from '@dwp-frontend/shared-utils';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { SupportedLocale } from '@dwp-frontend/shared-i18n';
import type {
  WorkplaceReservationAuthority,
  WorkplaceUnifiedReservation,
} from './workplace-unified-reservations-model';

export type WorkplaceMutationInput = {
  booking: WorkplaceBooking;
  action: 'check-in' | 'release' | 'cancel';
  commandIdentity: string;
};

export type CalendarMutationInput = {
  event: CalendarEvent;
  action: 'accept' | 'decline' | 'cancel';
  commandIdentity: string;
};

export type WorkplaceReservationConfirmation = Readonly<{
  authority: WorkplaceReservationAuthority;
  authorityId: string;
  version: number;
  action: 'release' | 'cancel';
}>;

export const WORKPLACE_RESERVATION_DETAIL_TABS = [
  'overview',
  'visitors',
  'services',
  'access',
  'audit',
] as const;

export type WorkplaceReservationDetailTab = (typeof WORKPLACE_RESERVATION_DETAIL_TABS)[number];

export function readWorkplaceReservationDetailTab(searchParams: URLSearchParams) {
  const requested = searchParams.get('tab')?.toLowerCase();
  if (requested === 'visits') return 'visitors';
  return WORKPLACE_RESERVATION_DETAIL_TABS.find((value) => value === requested) ?? 'overview';
}

export function writeWorkplaceReservationDetailTab(
  current: URLSearchParams,
  value: WorkplaceReservationDetailTab
) {
  const next = new URLSearchParams(current);
  if (value === 'overview') next.delete('tab');
  else next.set('tab', value === 'visitors' ? 'VISITS' : value.toUpperCase());
  return next;
}

export const DEFAULT_WORKPLACE_RESERVATION_FILTERS = {
  period: 'UPCOMING',
  types: 'ALL',
  status: 'ACTIVE',
  authority: 'ALL',
  q: null,
  reservation: null,
  reservationAuthority: null,
} as const;

export function formatWorkplaceReservationRange(
  item: WorkplaceUnifiedReservation,
  locale: SupportedLocale
) {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  const suffix = item.timeZone ? ` (${item.timeZone})` : '';
  return `${formatDate(item.startsAt, options, locale)} – ${formatDate(item.endsAt, options, locale)}${suffix}`;
}

export function formatWorkplaceReservationUpdatedAt(
  timestamp: number,
  locale: SupportedLocale,
  notYetVerified: string
) {
  return timestamp > 0
    ? formatDate(timestamp, { dateStyle: 'short', timeStyle: 'short' }, locale)
    : notYetVerified;
}
