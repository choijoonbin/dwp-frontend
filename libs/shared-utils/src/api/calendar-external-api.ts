import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type CalendarExternalProvider = 'MICROSOFT_365' | 'GOOGLE_WORKSPACE';
export type CalendarExternalSourceStatus =
  'HEALTHY' | 'STALE' | 'AUTH_REQUIRED' | 'UNAVAILABLE' | 'PARTIAL';

export type CalendarExternalReadOnlyCapabilities = {
  canViewDetails: boolean;
  canCreateEvents: false;
  canEdit: false;
  canDelete: false;
  canRestore: false;
  canRespond: false;
  canStar: false;
};

export type CalendarExternalEvent = {
  externalEventId: string;
  externalCalendarId: string;
  provider: CalendarExternalProvider;
  title: string;
  sourceUrl?: string | null;
  startsAt: string;
  endsAt: string;
  importance?: string | null;
  classification?: string | null;
  capabilities: CalendarExternalReadOnlyCapabilities;
};

export type CalendarExternalSourceEvidence = {
  externalCalendarId?: string | null;
  provider: CalendarExternalProvider;
  status: CalendarExternalSourceStatus;
  lastSuccessfulSyncAt?: string | null;
  safeReasonCode?: string | null;
  truncated: boolean;
};

export type CalendarExternalProjection = {
  events: CalendarExternalEvent[];
  sources: CalendarExternalSourceEvidence[];
  partial: boolean;
  truncated: boolean;
  generatedAt: string;
};

export async function getCalendarExternalProjection(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<CalendarExternalProjection> {
  const query = new URLSearchParams({ from, to, limit: '100' });
  const path = `/api/platform/v2/calendar/external-events?${query.toString()}`;
  const response = signal
    ? await axiosInstance.get<ApiResponse<CalendarExternalProjection>>(path, { signal })
    : await axiosInstance.get<ApiResponse<CalendarExternalProjection>>(path);
  return response.data.data;
}
