import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { CalendarDayOfWeek } from './calendar-settings-api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type CalendarSchedulingCompletenessV2 = 'COMPLETE' | 'PARTIAL' | 'UNKNOWN';
export type CalendarSchedulingParticipantRoleV2 = 'ORGANIZER' | 'REQUIRED' | 'OPTIONAL';
export type CalendarSchedulingIntervalStateV2 = 'BUSY' | 'TENTATIVE' | 'OUT_OF_OFFICE' | 'UNKNOWN';
export type CalendarSchedulingSourceStatusV2 =
  'HEALTHY' | 'PARTIAL' | 'UNKNOWN' | 'STALE' | 'UNAVAILABLE';
export type CalendarSchedulingApprovalPreferenceV2 =
  'ANY' | 'PREFER_NO_APPROVAL' | 'REQUIRE_NO_APPROVAL' | 'REQUIRE_APPROVAL';

export type CalendarSchedulingParticipantInputV2 = {
  clientRef: string;
  personPublicId: string | null;
  role: Exclude<CalendarSchedulingParticipantRoleV2, 'ORGANIZER'>;
};

export type CalendarSchedulingRoomCriteriaV2 = {
  site?: string | null;
  floor?: string | null;
  minimumCapacity?: number | null;
  requiredFeatures: string[];
  preferredFeatures: string[];
  approvalPreference: CalendarSchedulingApprovalPreferenceV2;
};

export type CalendarSchedulingEvaluationInputV2 = {
  participants: CalendarSchedulingParticipantInputV2[];
  searchWindow: { from: string; to: string };
  candidateSlot: { startsAt: string; endsAt: string };
  durationMinutes: number;
  searchTimeZone: string;
  roomCriteria: CalendarSchedulingRoomCriteriaV2;
};

export type CalendarSchedulingWorkingScheduleV2 = {
  timeZone: string;
  days: Array<{
    dayOfWeek: CalendarDayOfWeek;
    windows: Array<{ startsAt: string; endsAt: string }>;
  }>;
  source: string;
  version: number;
  observedAt: string;
};

export type CalendarSchedulingParticipantAvailabilityV2 = {
  clientRef: string;
  personPublicId: string | null;
  role: CalendarSchedulingParticipantRoleV2;
  coverage: CalendarSchedulingCompletenessV2;
  workingSchedule: CalendarSchedulingWorkingScheduleV2 | null;
  intervals: Array<{
    startsAt: string;
    endsAt: string;
    state: CalendarSchedulingIntervalStateV2;
    sourceType: string;
  }>;
};

export type CalendarSchedulingCandidateV2 = {
  candidateId: string;
  startsAt: string;
  endsAt: string;
  completeness: CalendarSchedulingCompletenessV2;
  score: number;
  reasonCodes: string[];
  requiredConflictRefs: string[];
  optionalConflictRefs: string[];
  hardRecheckRequired: boolean;
};

export type CalendarSchedulingSourceEvidenceV2 = {
  sourceType: string;
  status: CalendarSchedulingSourceStatusV2;
  coverageFrom: string;
  coverageTo: string;
  lastSuccessfulSyncAt: string | null;
  observedAt: string | null;
  reasonCode: string | null;
  affectedParticipantRefs: string[];
};

export type CalendarSchedulingResourceSummaryV2 = {
  resourceId: string;
  code: string;
  name: string;
  nameKo: string;
  nameEn: string;
  type: 'ROOM' | 'DESK' | 'EQUIPMENT';
  site: string;
  floor?: string | null;
  capacity: number;
  features: string[];
  timeZone: string;
  approvalRequired: boolean;
  state: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';
  available: boolean;
  version: number;
};

export type CalendarSchedulingRoomRecommendationV2 = {
  room: CalendarSchedulingResourceSummaryV2;
  rank: number;
  score: number;
  eligible: boolean;
  eligibilityReason: string;
  reasonCodes: string[];
  resourceVersion: number;
  policyVersion: number;
  hardRecheckRequired: boolean;
};

export type CalendarSchedulingEvaluationV2 = {
  evaluationId: string;
  criteriaHash: string;
  challengeToken: string;
  completeness: CalendarSchedulingCompletenessV2;
  participants: CalendarSchedulingParticipantAvailabilityV2[];
  suggestions: CalendarSchedulingCandidateV2[];
  sources: CalendarSchedulingSourceEvidenceV2[];
  rooms: CalendarSchedulingRoomRecommendationV2[];
  generatedAt: string;
  validUntil: string;
};

export type CalendarSchedulingHardRecheckInputV2 = {
  challengeToken: string;
  criteriaHash: string;
  selection: { startsAt: string; endsAt: string };
  roomId?: string | null;
};

export type CalendarSchedulingHardRecheckV2 = {
  evaluationId: string;
  criteriaHash: string;
  status: 'PASS' | 'BLOCKED' | 'INCOMPLETE';
  hardRecheckToken: string | null;
  selectionHash: string;
  conflicts: Array<{
    clientRef: string;
    state: CalendarSchedulingIntervalStateV2;
    startsAt: string;
    endsAt: string;
    blocking: boolean;
  }>;
  room: CalendarSchedulingRoomRecommendationV2 | null;
  checkedAt: string;
  validUntil: string;
};

export type CalendarSchedulingMutationBindingV2 = Readonly<{
  hardRecheckToken: string;
}>;

export function calendarSchedulingMutationHeaders(
  binding?: CalendarSchedulingMutationBindingV2
): Record<string, string> {
  if (!binding) return {};
  const token = binding.hardRecheckToken.trim();
  if (!token) throw new Error('Calendar scheduling hard-recheck token is required.');
  return { 'X-DWP-Calendar-Hard-Recheck-Token': token };
}

export async function evaluateCalendarSchedulingV2(
  input: CalendarSchedulingEvaluationInputV2,
  signal?: AbortSignal
): Promise<CalendarSchedulingEvaluationV2> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingEvaluationV2>,
    CalendarSchedulingEvaluationInputV2
  >('/api/platform/v2/calendar/scheduling/evaluations', input, signal ? { signal } : undefined);
  return response.data.data;
}

export async function hardRecheckCalendarSchedulingV2(
  evaluationId: string,
  input: CalendarSchedulingHardRecheckInputV2,
  signal?: AbortSignal
): Promise<CalendarSchedulingHardRecheckV2> {
  if (!UUID.test(evaluationId)) {
    throw new Error('Calendar scheduling evaluationId must be a canonical UUID.');
  }
  const response = await axiosInstance.post<
    ApiResponse<CalendarSchedulingHardRecheckV2>,
    CalendarSchedulingHardRecheckInputV2
  >(
    `/api/platform/v2/calendar/scheduling/evaluations/${encodeURIComponent(evaluationId)}/hard-recheck`,
    input,
    signal ? { signal } : undefined
  );
  return response.data.data;
}
