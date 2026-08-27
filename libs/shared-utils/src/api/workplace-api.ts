import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type WorkplaceSiteType = 'HEADQUARTERS' | 'SHARED_OFFICE' | 'SATELLITE' | 'CLIENT_SITE';
export type WorkplaceSiteState = 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
export type WorkplaceFloorState = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type WorkplaceResourceType =
  'ROOM' | 'DESK' | 'LOCKER' | 'PARKING' | 'FOCUS_POD' | 'PHONE_BOOTH' | 'EQUIPMENT';
export type WorkplaceBookingMode = 'RESERVABLE' | 'DROP_IN' | 'ASSIGNED' | 'UNAVAILABLE';
export type WorkplaceResourceState = 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';
export type WorkplaceBookingStatus =
  'RESERVED' | 'CHECKED_IN' | 'COMPLETED' | 'NO_SHOW' | 'RELEASED' | 'CANCELLED';

export type WorkplaceSite = {
  siteId: string;
  campusId?: string | null;
  code: string;
  name: string;
  nameKo: string;
  nameEn: string;
  type: WorkplaceSiteType;
  address: string | null;
  timeZone: string;
  totalFloorCount: number;
  configuredFloorCount: number;
  resourceCount: number;
  state: WorkplaceSiteState;
  version: number;
};

export type WorkplaceFloor = {
  floorId: string;
  siteId: string;
  siteName: string;
  floorNumber: number;
  name: string;
  nameKo: string;
  nameEn: string;
  planWidth: number;
  planHeight: number;
  backgroundAssetPath: string | null;
  state: WorkplaceFloorState;
  resourceCount: number;
  version: number;
};

export type WorkplaceResource = {
  resourceId: string;
  floorId: string;
  siteId: string;
  calendarResourceId: string | null;
  code: string;
  name: string;
  nameKo: string;
  nameEn: string;
  type: WorkplaceResourceType;
  mode: WorkplaceBookingMode;
  state: WorkplaceResourceState;
  neighborhood: string | null;
  capacity: number;
  features: string[];
  accessible: boolean;
  approvalRequired: boolean;
  positionX: number;
  positionY: number;
  widthPercent: number;
  heightPercent: number;
  rotationDegrees: number;
  assignedToCurrentUser: boolean;
  assignedUserId: number | null;
  assignedPersonPublicId: string | null;
  assignedDisplayName: string | null;
  version: number;
};

export type WorkplaceOccupancy = {
  resourceId: string;
  bookingId: string;
  status: WorkplaceBookingStatus;
  startsAt: string;
  endsAt: string;
  bookedByDisplayName: string | null;
  currentUser: boolean;
};

export type WorkplacePolicy = {
  bookingWindowDays: number;
  maximumActiveBookings: number;
  minimumBookingMinutes: number;
  maximumBookingMinutes: number;
  maximumConsecutiveDays: number;
  workingDayStart: string;
  workingDayEnd: string;
  allowRecurring: boolean;
  requireCheckIn: boolean;
  checkInLeadMinutes: number;
  autoReleaseMinutes: number;
  allowAssignedDeskLending: boolean;
  showColleagueNames: boolean;
  bookingRetentionDays: number;
  version: number;
};

export type WorkplaceExploreResponse = {
  sites: WorkplaceSite[];
  floors: WorkplaceFloor[];
  selectedFloor: WorkplaceFloor | null;
  resources: WorkplaceResource[];
  occupancy: WorkplaceOccupancy[];
  policy: WorkplacePolicy;
  generatedAt: string;
};

export type WorkplaceBooking = {
  bookingId: string;
  resourceId: string;
  resourceName: string;
  resourceType: WorkplaceResourceType;
  siteName: string;
  floorName: string;
  purpose: string | null;
  startsAt: string;
  endsAt: string;
  status: WorkplaceBookingStatus;
  visibleToColleagues: boolean;
  checkedInAt: string | null;
  releasedAt: string | null;
  canCheckIn: boolean;
  canCancel: boolean;
  canRelease: boolean;
  checkInOpensAt: string;
  checkInClosesAt: string;
  version: number;
};

export type WorkplaceAdminOverview = {
  activeSites: number;
  configuredFloors: number;
  reservableResources: number;
  assignedResources: number;
  bookingsThisWeek: number;
  checkedInToday: number;
  utilizationPercent: number;
  policy: WorkplacePolicy;
  generatedAt: string;
};

export type WorkplaceBookingInput = {
  resourceId: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  visibleToColleagues: boolean;
};

export type WorkplaceRelocateBookingInput = Pick<
  WorkplaceBookingInput,
  'resourceId' | 'startsAt' | 'endsAt'
> & {
  reason: string;
  version: number;
};

export type WorkplaceReleaseWindowStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED';

export type WorkplaceReleaseWindow = {
  releaseWindowId: string;
  resourceId: string;
  resourceName: string;
  siteName: string;
  floorName: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  status: WorkplaceReleaseWindowStatus;
  canCancel: boolean;
  version: number;
};

export type WorkplaceReleaseWindowInput = {
  resourceId: string;
  startsAt: string;
  endsAt: string;
  note: string;
};

export type WorkplaceAssignedResource = {
  resourceId: string;
  resourceName: string;
  resourceType: WorkplaceResourceType;
  siteName: string;
  floorName: string;
  timeZone: string;
};

export type WorkplaceAdminBooking = {
  bookingId: string;
  resourceId: string;
  resourceName: string;
  resourceType: WorkplaceResourceType;
  siteName: string;
  floorName: string;
  userId: number;
  personPublicId: string | null;
  bookedForDisplayName: string;
  purpose: string | null;
  startsAt: string;
  endsAt: string;
  status: WorkplaceBookingStatus;
  visibleToColleagues: boolean;
  checkedInAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  legalHold: boolean;
  personalDataExpiresAt: string;
  anonymizedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkplaceAdminBookingPage = {
  content: WorkplaceAdminBooking[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type WorkplaceAuditEvent = {
  auditEventId: string;
  action: string;
  aggregateType: string;
  aggregateId: string | null;
  actorUserId: number;
  correlationId: string | null;
  snapshot: Record<string, unknown>;
  occurredAt: string;
};

export type WorkplaceAuditEventPage = {
  content: WorkplaceAuditEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type WorkplaceSiteInput = Omit<
  WorkplaceSite,
  'siteId' | 'name' | 'configuredFloorCount' | 'resourceCount' | 'version'
> & { version: number | null };
export type WorkplaceFloorInput = Omit<
  WorkplaceFloor,
  'floorId' | 'siteId' | 'siteName' | 'name' | 'resourceCount' | 'backgroundAssetPath' | 'version'
> & { version: number | null };
export type WorkplaceResourceInput = Omit<
  WorkplaceResource,
  | 'resourceId'
  | 'floorId'
  | 'siteId'
  | 'calendarResourceId'
  | 'name'
  | 'assignedToCurrentUser'
  | 'version'
> & { version: number | null };
export type WorkplacePlacementInput = Pick<
  WorkplaceResource,
  | 'resourceId'
  | 'positionX'
  | 'positionY'
  | 'widthPercent'
  | 'heightPercent'
  | 'rotationDegrees'
  | 'version'
>;

function rangeQuery(from: string, to: string) {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function getWorkplaceExplore(
  from: string,
  to: string,
  floorId?: string | null
): Promise<WorkplaceExploreResponse> {
  const floor = floorId ? `&floorId=${encodeURIComponent(floorId)}` : '';
  const response = await axiosInstance.get<ApiResponse<WorkplaceExploreResponse>>(
    `/api/platform/v1/workplace/explore?${rangeQuery(from, to)}${floor}`
  );
  return response.data.data;
}

export async function getWorkplaceBookings(from: string, to: string): Promise<WorkplaceBooking[]> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceBooking[]>>(
    `/api/platform/v1/workplace/bookings?${rangeQuery(from, to)}`
  );
  return response.data.data;
}

export function createWorkplaceIdempotencyKey(scope = 'booking'): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `workplace:${scope}:${randomId}`;
  return `workplace:${scope}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

export async function createWorkplaceBooking(
  input: WorkplaceBookingInput,
  idempotencyKey: string
): Promise<WorkplaceBooking> {
  const response = await axiosInstance.post<ApiResponse<WorkplaceBooking>, WorkplaceBookingInput>(
    '/api/platform/v1/workplace/bookings',
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data.data;
}

export async function relocateWorkplaceBooking(
  bookingId: string,
  input: WorkplaceRelocateBookingInput
): Promise<WorkplaceBooking> {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBooking>,
    WorkplaceRelocateBookingInput
  >(`/api/platform/v1/workplace/bookings/${encodeURIComponent(bookingId)}/relocate`, input);
  return response.data.data;
}

async function changeBooking(
  bookingId: string,
  action: 'check-in' | 'cancel' | 'release',
  version: number
) {
  const response = await axiosInstance.post<ApiResponse<WorkplaceBooking>, { version: number }>(
    `/api/platform/v1/workplace/bookings/${encodeURIComponent(bookingId)}/${action}`,
    { version }
  );
  return response.data.data;
}

export const checkInWorkplaceBooking = (bookingId: string, version: number) =>
  changeBooking(bookingId, 'check-in', version);
export const cancelWorkplaceBooking = (bookingId: string, version: number) =>
  changeBooking(bookingId, 'cancel', version);
export const releaseWorkplaceBooking = (bookingId: string, version: number) =>
  changeBooking(bookingId, 'release', version);

export async function getWorkplaceReleaseWindows(
  from: string,
  to: string
): Promise<WorkplaceReleaseWindow[]> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceReleaseWindow[]>>(
    `/api/platform/v1/workplace/release-windows?${rangeQuery(from, to)}`
  );
  return response.data.data;
}

export async function getWorkplaceAssignedResources(): Promise<WorkplaceAssignedResource[]> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceAssignedResource[]>>(
    '/api/platform/v1/workplace/release-windows/eligible-resources'
  );
  return response.data.data;
}

export async function createWorkplaceReleaseWindow(
  input: WorkplaceReleaseWindowInput,
  idempotencyKey: string
): Promise<WorkplaceReleaseWindow> {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceReleaseWindow>,
    WorkplaceReleaseWindowInput
  >('/api/platform/v1/workplace/release-windows', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data.data;
}

export async function cancelWorkplaceReleaseWindow(
  releaseWindowId: string,
  version: number
): Promise<WorkplaceReleaseWindow> {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceReleaseWindow>,
    { version: number }
  >(`/api/platform/v1/workplace/release-windows/${encodeURIComponent(releaseWindowId)}/cancel`, {
    version,
  });
  return response.data.data;
}

function operationQuery(
  from: string,
  to: string,
  filters: Record<string, string | number | null | undefined>
) {
  const search = new URLSearchParams({ from, to });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  });
  return search.toString();
}

export async function getWorkplaceAdminBookings(
  from: string,
  to: string,
  filters: {
    status?: WorkplaceBookingStatus | null;
    resourceId?: string | null;
    userId?: number | null;
    page?: number;
    size?: number;
  } = {}
): Promise<WorkplaceAdminBookingPage> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceAdminBookingPage>>(
    `/api/platform/v1/admin/workplace/bookings?${operationQuery(from, to, filters)}`
  );
  return response.data.data;
}

export async function forceCancelWorkplaceBooking(
  bookingId: string,
  version: number,
  reason: string
): Promise<WorkplaceAdminBooking> {
  const response = await axiosInstance.put<
    ApiResponse<WorkplaceAdminBooking>,
    { version: number; reason: string }
  >(`/api/platform/v1/admin/workplace/bookings/${encodeURIComponent(bookingId)}/force-cancel`, {
    version,
    reason,
  });
  return response.data.data;
}

export async function updateWorkplaceBookingLegalHold(
  bookingId: string,
  version: number,
  legalHold: boolean,
  reason: string
): Promise<WorkplaceAdminBooking> {
  const response = await axiosInstance.put<
    ApiResponse<WorkplaceAdminBooking>,
    { version: number; legalHold: boolean; reason: string }
  >(`/api/platform/v1/admin/workplace/bookings/${encodeURIComponent(bookingId)}/legal-hold`, {
    version,
    legalHold,
    reason,
  });
  return response.data.data;
}

export async function getWorkplaceAuditEvents(
  from: string,
  to: string,
  filters: {
    action?: string | null;
    aggregateType?: string | null;
    aggregateId?: string | null;
    actorUserId?: number | null;
    page?: number;
    size?: number;
  } = {}
): Promise<WorkplaceAuditEventPage> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceAuditEventPage>>(
    `/api/platform/v1/admin/workplace/audit-events?${operationQuery(from, to, filters)}`
  );
  return response.data.data;
}

export async function getWorkplaceAdminOverview(): Promise<WorkplaceAdminOverview> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceAdminOverview>>(
    '/api/platform/v1/admin/workplace/overview'
  );
  return response.data.data;
}

export async function getWorkplaceAdminSites(): Promise<WorkplaceSite[]> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceSite[]>>(
    '/api/platform/v1/admin/workplace/sites'
  );
  return response.data.data;
}

export async function saveWorkplaceSite(
  siteId: string | null,
  input: WorkplaceSiteInput
): Promise<WorkplaceSite> {
  const url = siteId
    ? `/api/platform/v1/admin/workplace/sites/${encodeURIComponent(siteId)}`
    : '/api/platform/v1/admin/workplace/sites';
  const response = siteId
    ? await axiosInstance.put<ApiResponse<WorkplaceSite>, WorkplaceSiteInput>(url, input)
    : await axiosInstance.post<ApiResponse<WorkplaceSite>, WorkplaceSiteInput>(url, input);
  return response.data.data;
}

export async function getWorkplaceAdminFloors(siteId: string): Promise<WorkplaceFloor[]> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceFloor[]>>(
    `/api/platform/v1/admin/workplace/floors?siteId=${encodeURIComponent(siteId)}`
  );
  return response.data.data;
}

export async function saveWorkplaceFloor(
  siteId: string,
  floorId: string | null,
  input: WorkplaceFloorInput
): Promise<WorkplaceFloor> {
  const base = `/api/platform/v1/admin/workplace/sites/${encodeURIComponent(siteId)}/floors`;
  const url = floorId ? `${base}/${encodeURIComponent(floorId)}` : base;
  const response = floorId
    ? await axiosInstance.put<ApiResponse<WorkplaceFloor>, WorkplaceFloorInput>(url, input)
    : await axiosInstance.post<ApiResponse<WorkplaceFloor>, WorkplaceFloorInput>(url, input);
  return response.data.data;
}

export async function uploadWorkplaceFloorBackground(
  floorId: string,
  version: number,
  file: File
): Promise<WorkplaceFloor> {
  const form = new FormData();
  form.append('file', file);
  const response = await axiosInstance.post<ApiResponse<WorkplaceFloor>, FormData>(
    `/api/platform/v1/admin/workplace/floors/${encodeURIComponent(floorId)}/background?version=${version}`,
    form
  );
  return response.data.data;
}

export async function getWorkplaceAdminResources(floorId: string): Promise<WorkplaceResource[]> {
  const response = await axiosInstance.get<ApiResponse<WorkplaceResource[]>>(
    `/api/platform/v1/admin/workplace/floors/${encodeURIComponent(floorId)}/resources`
  );
  return response.data.data;
}

export async function saveWorkplaceResource(
  floorId: string,
  resourceId: string | null,
  input: WorkplaceResourceInput
): Promise<WorkplaceResource> {
  const base = `/api/platform/v1/admin/workplace/floors/${encodeURIComponent(floorId)}/resources`;
  const url = resourceId ? `${base}/${encodeURIComponent(resourceId)}` : base;
  const response = resourceId
    ? await axiosInstance.put<ApiResponse<WorkplaceResource>, WorkplaceResourceInput>(url, input)
    : await axiosInstance.post<ApiResponse<WorkplaceResource>, WorkplaceResourceInput>(url, input);
  return response.data.data;
}

export async function saveWorkplaceLayout(
  floorId: string,
  resources: WorkplacePlacementInput[]
): Promise<WorkplaceResource[]> {
  const response = await axiosInstance.put<
    ApiResponse<WorkplaceResource[]>,
    { resources: WorkplacePlacementInput[] }
  >(`/api/platform/v1/admin/workplace/floors/${encodeURIComponent(floorId)}/layout`, {
    resources,
  });
  return response.data.data;
}

export async function getWorkplacePolicy(): Promise<WorkplacePolicy> {
  const response = await axiosInstance.get<ApiResponse<WorkplacePolicy>>(
    '/api/platform/v1/admin/workplace/policy'
  );
  return response.data.data;
}

export async function updateWorkplacePolicy(input: WorkplacePolicy): Promise<WorkplacePolicy> {
  const response = await axiosInstance.put<ApiResponse<WorkplacePolicy>, WorkplacePolicy>(
    '/api/platform/v1/admin/workplace/policy',
    input
  );
  return response.data.data;
}
