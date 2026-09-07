import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

/** Calendar-derived status, never online presence. PRIVATE/FREE_BUSY events remain BUSY. */
export type CalendarTeamAvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'FOCUS' | 'OUT_OF_OFFICE';

export type CalendarTeamBusyWindow = Readonly<{ startsAt: string; endsAt: string }>;

export type CalendarTeamAvailabilityMember = Readonly<{
  personPublicId: string;
  displayName: string | null;
  status: CalendarTeamAvailabilityStatus;
  busyUntil: string | null;
  /** First non-busy instant at/after generatedAt, or null when busy through local midnight. */
  nextAvailableAt: string | null;
  /** Union of native busy intervals clipped to the snapshot's local day, not a work-hours KPI. */
  busyMinutes: number;
  busyWindows: CalendarTeamBusyWindow[];
}>;

export type CalendarTeamAvailabilitySnapshot = Readonly<{
  date: string;
  timeZone: string;
  generatedAt: string;
  validUntil: string;
  source: 'DWP_NATIVE_CALENDAR';
  scope: 'SHARED_WITH_ME';
  members: CalendarTeamAvailabilityMember[];
  hasMore: boolean;
}>;

/**
 * Independent of CalendarHome. Cache keys must include tenant + actor + timeZone.
 * Abort on scope changes; discard all previous members on error, denial, or expiry.
 * The server chooses targets from active PERSON/GROUP shares, not arbitrary person IDs.
 */
export async function getCalendarTeamAvailabilitySnapshot(
  timeZone = 'Asia/Seoul',
  signal?: AbortSignal
): Promise<CalendarTeamAvailabilitySnapshot> {
  const response = await axiosInstance.get<ApiResponse<CalendarTeamAvailabilitySnapshot>>(
    `/api/platform/v1/calendar/team-availability/snapshot?timeZone=${encodeURIComponent(timeZone)}`,
    { signal, headers: { 'Cache-Control': 'no-cache' } }
  );
  return response.data.data;
}

/** Conservative expiry check: do not retain a privacy-sensitive snapshot as stale UI data. */
export function calendarTeamSnapshotIsFresh(
  snapshot: Pick<CalendarTeamAvailabilitySnapshot, 'generatedAt' | 'validUntil'>,
  now = Date.now()
): boolean {
  const generatedAt = Date.parse(snapshot.generatedAt);
  const validUntil = Date.parse(snapshot.validUntil);
  return (
    Number.isFinite(now) &&
    Number.isFinite(generatedAt) &&
    Number.isFinite(validUntil) &&
    generatedAt <= now &&
    now < validUntil &&
    validUntil > generatedAt &&
    validUntil - generatedAt <= 30_000
  );
}
