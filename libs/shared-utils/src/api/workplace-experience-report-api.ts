import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import type { WorkplacePolicy } from './workplace-api';

const BASE = '/api/platform/v1/admin/workplace/experience-report';
const ADMIN = '/api/platform/v1/admin/workplace';
export type WorkplaceExperienceMetadata = {
  generatedAt: string;
  sourceUpdatedAt: string | null;
  availability: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE';
  owner: string;
  denominatorBasis: string;
  historicalRosterAvailable: boolean;
  recurringOccurrencesIncluded: boolean;
};
export type WorkplaceExperienceSummary = {
  bookingCount: number;
  cancelledCount: number;
  bookedMinutes: number;
  denominatorResourceMinutes: number;
  utilizationPercent: number | null;
  noShowEligibleCount: number;
  noShowCount: number;
  noShowPercent: number | null;
  peakUtilizationPercent: number | null;
  unresolvedPastBookings: number;
};
export type WorkplaceExperienceBookingDetail = {
  bookingId: string;
  resourceId: string;
  siteId: string;
  floorId: string;
  resourceName: string;
  resourceType: string;
  floorName: string;
  status: string;
  startsAt: string;
  endsAt: string;
  checkedInAt: string | null;
  releasedAt: string | null;
  legalHold: boolean;
  version: number;
  updatedAt: string;
  detailHref: string;
  exceptionReasons: string[];
};
export type WorkplaceExperienceBookingPage = {
  content: WorkplaceExperienceBookingDetail[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type WorkplaceExperienceReport = {
  scope: {
    siteId: string;
    floorId: string | null;
    siteName: string;
    timeZone: string;
    from: string;
    to: string;
    startsAt: string;
    endsAt: string;
    countsScope?: 'SITE' | 'FLOORS';
    allowedFloorIds?: string[] | null;
  };
  metadata: WorkplaceExperienceMetadata;
  current: {
    activeSites: number;
    configuredFloors: number;
    reservableResources: number;
    assignedResources: number;
    bookingsThisWeek: number;
    checkedInToday: number;
    utilizationPercent: number | null;
    policy: WorkplacePolicy;
  };
  summary: WorkplaceExperienceSummary;
  floors: {
    floorId: string;
    floorName: string;
    resourceCount: number;
    summary: WorkplaceExperienceSummary;
  }[];
  hourlyHeatmap: {
    date: string;
    dayOfWeek: number;
    hour: number;
    offset: string;
    startsAt: string;
    endsAt: string;
    bookedMinutes: number;
    denominatorResourceMinutes: number;
    utilizationPercent: number | null;
  }[];
  dailyTrend: {
    date: string;
    bookingCount: number;
    bookedMinutes: number;
    denominatorResourceMinutes: number;
    utilizationPercent: number | null;
    noShowCount: number;
    noShowPercent: number | null;
  }[];
  comparison: {
    previousFrom: string;
    previousTo: string;
    previous: WorkplaceExperienceSummary;
    utilizationChangePercentagePoints: number | null;
    noShowChangePercentagePoints: number | null;
  };
  exceptions: WorkplaceExperienceBookingPage;
  externalSources: {
    kind: string;
    availability: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE';
    reason: string;
    owner: string;
    integrationPath: string;
  }[];
  definitions: string[];
};
export type WorkplaceExperienceReportInput = {
  siteId: string;
  floorId?: string;
  from: string;
  to: string;
  page?: number;
  size?: number;
};
export type WorkplaceFutureBookingImpact = {
  resourceId: string;
  siteId: string;
  resourceName: string;
  owner: string;
  resourceState: string;
  from: string;
  to: string;
  metadata: WorkplaceExperienceMetadata;
  affectedBookings: WorkplaceExperienceBookingPage | null;
  mutatesBookings: boolean;
  notificationScheduled: boolean;
  replacementScheduled: boolean;
};
export type WorkplacePolicyImpactInput = {
  siteId: string;
  floorId?: string;
  from: string;
  to: string;
  requireCheckIn?: boolean;
  autoReleaseMinutes?: number;
  minimumBookingMinutes?: number;
  maximumBookingMinutes?: number;
  workingDayStart?: string;
  workingDayEnd?: string;
  page?: number;
  size?: number;
};
export type WorkplacePolicyImpact = {
  siteId: string;
  floorId: string | null;
  from: string;
  to: string;
  metadata: WorkplaceExperienceMetadata;
  countsScope?: 'SITE' | 'FLOORS';
  allowedFloorIds?: string[] | null;
  proposed: Pick<
    WorkplacePolicyImpactInput,
    | 'requireCheckIn'
    | 'autoReleaseMinutes'
    | 'minimumBookingMinutes'
    | 'maximumBookingMinutes'
    | 'workingDayStart'
    | 'workingDayEnd'
  >;
  reviewedBookings: number;
  affectedBookings: number;
  content: { booking: WorkplaceExperienceBookingDetail; knownEffects: string[] }[];
  page: number;
  size: number;
  totalPages: number;
  mutatesExistingBookings: boolean;
  limitations: string[];
  dailyImpact: {
    date: string;
    timeZone: string;
    reviewedBookings: number;
    affectedBookings: number;
  }[];
};
function query(input: Record<string, string | number | boolean | undefined>) {
  return new URLSearchParams(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}
export async function getWorkplaceExperienceReport(input: WorkplaceExperienceReportInput) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceExperienceReport>>(
    `${BASE}?${query(input)}`
  );
  return response.data.data;
}
export async function getWorkplaceExperienceBookingDetail(siteId: string, bookingId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceExperienceBookingDetail>>(
    `${BASE}/bookings/${encodeURIComponent(bookingId)}?${query({ siteId })}`
  );
  return response.data.data;
}
export async function getWorkplaceFutureBookingImpact(
  siteId: string,
  resourceId: string,
  from: string,
  to: string,
  page = 0,
  size = 20
) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceFutureBookingImpact>>(
    `${ADMIN}/resources/${encodeURIComponent(resourceId)}/future-booking-impact?${query({ siteId, from, to, page, size })}`
  );
  return response.data.data;
}
export async function getWorkplacePolicyImpact(input: WorkplacePolicyImpactInput) {
  const response = await axiosInstance.get<ApiResponse<WorkplacePolicyImpact>>(
    `${ADMIN}/policy-impact-preview?${query(input)}`
  );
  return response.data.data;
}
