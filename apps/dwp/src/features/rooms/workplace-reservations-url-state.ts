export const WORKPLACE_RESERVATIONS_URL_VERSION = '1' as const;

export const WORKPLACE_RESERVATION_PERIODS = ['TODAY', 'WEEK', 'UPCOMING', 'PAST'] as const;
export type WorkplaceReservationPeriod = (typeof WORKPLACE_RESERVATION_PERIODS)[number];

export const WORKPLACE_RESERVATION_TYPES = [
  'ALL',
  'WORKSPACE',
  'MEETING',
  'DESK',
  'PARKING',
  'LOCKER',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
] as const;
export type WorkplaceReservationType = (typeof WORKPLACE_RESERVATION_TYPES)[number];

export const WORKPLACE_RESERVATION_STATUSES = [
  'ALL',
  'ACTIVE',
  'RESERVED',
  'CHECKED_IN',
  'CONFIRMED',
  'TENTATIVE',
  'COMPLETED',
  'NO_SHOW',
  'RELEASED',
  'CANCELLED',
] as const;
export type WorkplaceReservationStatus = (typeof WORKPLACE_RESERVATION_STATUSES)[number];

export const WORKPLACE_RESERVATION_AUTHORITIES = ['ALL', 'WORKPLACE', 'CALENDAR'] as const;
export type WorkplaceReservationAuthorityFilter =
  (typeof WORKPLACE_RESERVATION_AUTHORITIES)[number];

export const WORKPLACE_RESERVATION_DETAIL_TABS = ['VISITS', 'SERVICES', 'ACCESS', 'AUDIT'] as const;
export type WorkplaceReservationDetailTab = (typeof WORKPLACE_RESERVATION_DETAIL_TABS)[number];

export type WorkplaceReservationsUrlState = Readonly<{
  period: WorkplaceReservationPeriod;
  type: WorkplaceReservationType;
  status: WorkplaceReservationStatus;
  authority: WorkplaceReservationAuthorityFilter;
  query: string;
  reservationId: string | null;
  reservationAuthority: Exclude<WorkplaceReservationAuthorityFilter, 'ALL'> | null;
  detailTab: WorkplaceReservationDetailTab | null;
}>;

export type WorkplaceReservationsUrlPatch = Partial<{
  period: WorkplaceReservationPeriod | null;
  types: WorkplaceReservationType | null;
  status: WorkplaceReservationStatus | null;
  authority: WorkplaceReservationAuthorityFilter | null;
  q: string | null;
  reservation: string | null;
  reservationAuthority: Exclude<WorkplaceReservationAuthorityFilter, 'ALL'> | null;
  detailTab: WorkplaceReservationDetailTab | null;
}>;

const DEFAULT_STATE: WorkplaceReservationsUrlState = Object.freeze({
  period: 'UPCOMING',
  type: 'ALL',
  status: 'ACTIVE',
  authority: 'ALL',
  query: '',
  reservationId: null,
  reservationAuthority: null,
  detailTab: null,
});

function enumValue<const T extends readonly string[]>(
  value: string | null,
  values: T,
  fallback: T[number]
): T[number] {
  return value !== null && values.includes(value) ? (value as T[number]) : fallback;
}

function safeText(value: string | null, maxLength: number): string {
  if (!value) return '';
  return [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, maxLength);
}

function appendCanonical(state: WorkplaceReservationsUrlState): URLSearchParams {
  const next = new URLSearchParams();
  next.set('v', WORKPLACE_RESERVATIONS_URL_VERSION);
  next.set('period', state.period);
  next.set('types', state.type);
  next.set('status', state.status);
  next.set('authority', state.authority);
  if (state.query) next.set('q', state.query);
  if (state.reservationId) next.set('reservation', state.reservationId);
  if (state.reservationId && state.reservationAuthority) {
    next.set('reservationAuthority', state.reservationAuthority);
  }
  if (state.reservationId && state.detailTab) next.set('tab', state.detailTab);
  return next;
}

export function parseWorkplaceReservationsUrl(searchParams: URLSearchParams) {
  const requestedReservationAuthority = searchParams.get('reservationAuthority');
  const requestedDetailTab = searchParams.get('tab');
  const state: WorkplaceReservationsUrlState = {
    period: enumValue(
      searchParams.get('period'),
      WORKPLACE_RESERVATION_PERIODS,
      DEFAULT_STATE.period
    ),
    type: enumValue(searchParams.get('types'), WORKPLACE_RESERVATION_TYPES, DEFAULT_STATE.type),
    status: enumValue(
      searchParams.get('status'),
      WORKPLACE_RESERVATION_STATUSES,
      DEFAULT_STATE.status
    ),
    authority: enumValue(
      searchParams.get('authority'),
      WORKPLACE_RESERVATION_AUTHORITIES,
      DEFAULT_STATE.authority
    ),
    query: safeText(searchParams.get('q'), 80),
    reservationId: safeText(searchParams.get('reservation'), 160) || null,
    reservationAuthority:
      requestedReservationAuthority === 'WORKPLACE' || requestedReservationAuthority === 'CALENDAR'
        ? requestedReservationAuthority
        : null,
    detailTab:
      searchParams.get('reservation') &&
      WORKPLACE_RESERVATION_DETAIL_TABS.includes(
        requestedDetailTab as WorkplaceReservationDetailTab
      )
        ? (requestedDetailTab as WorkplaceReservationDetailTab)
        : null,
  };
  const canonicalSearchParams = appendCanonical(state);
  return {
    state,
    canonicalSearchParams,
    corrected: canonicalSearchParams.toString() !== searchParams.toString(),
  } as const;
}

export function updateWorkplaceReservationsUrl(
  current: URLSearchParams,
  patch: WorkplaceReservationsUrlPatch
) {
  const parsed = parseWorkplaceReservationsUrl(current).state;
  const next: WorkplaceReservationsUrlState = {
    period: patch.period ?? parsed.period,
    type: patch.types ?? parsed.type,
    status: patch.status ?? parsed.status,
    authority: patch.authority ?? parsed.authority,
    query: patch.q === null ? '' : safeText(patch.q ?? parsed.query, 80),
    reservationId:
      patch.reservation === null
        ? null
        : safeText(patch.reservation ?? parsed.reservationId, 160) || null,
    reservationAuthority:
      patch.reservation === null
        ? null
        : (patch.reservationAuthority ?? parsed.reservationAuthority),
    detailTab:
      patch.reservation === null
        ? null
        : patch.detailTab === undefined
          ? parsed.detailTab
          : patch.detailTab,
  };
  return appendCanonical(next);
}

export function migrateLegacyWorkplaceReservationsUrl(
  current: URLSearchParams,
  source: 'my-bookings' | 'my-meetings'
) {
  const reservation = source === 'my-bookings' ? current.get('booking') : current.get('event');
  const next = new URLSearchParams(current);
  next.delete('booking');
  next.delete('event');
  next.set('v', WORKPLACE_RESERVATIONS_URL_VERSION);
  next.set('types', source === 'my-bookings' ? 'WORKSPACE' : 'MEETING');
  next.set('authority', source === 'my-bookings' ? 'WORKPLACE' : 'CALENDAR');
  if (!next.has('period')) next.set('period', DEFAULT_STATE.period);
  if (!next.has('status')) next.set('status', DEFAULT_STATE.status);
  if (reservation) next.set('reservation', safeText(reservation, 160));
  if (reservation) {
    next.set('reservationAuthority', source === 'my-bookings' ? 'WORKPLACE' : 'CALENDAR');
  }
  return parseWorkplaceReservationsUrl(next).canonicalSearchParams;
}

export function workplaceReservationsRange(period: WorkplaceReservationPeriod, now = new Date()) {
  const from = new Date(now);
  const to = new Date(now);
  if (period === 'TODAY') {
    from.setHours(0, 0, 0, 0);
    to.setHours(24, 0, 0, 0);
  } else if (period === 'WEEK') {
    from.setHours(0, 0, 0, 0);
    to.setDate(to.getDate() + 7);
    to.setHours(0, 0, 0, 0);
  } else if (period === 'PAST') {
    from.setFullYear(from.getFullYear() - 1);
  } else {
    to.setFullYear(to.getFullYear() + 1);
  }
  return { from: from.toISOString(), to: to.toISOString() } as const;
}
