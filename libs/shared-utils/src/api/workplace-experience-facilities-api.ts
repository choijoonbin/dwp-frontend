import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';

const ADMIN = '/api/platform/v1/admin/workplace/experience/facilities';
const MEMBER = '/api/platform/v1/workplace/experience/facilities';
export type WorkplaceFacilityCategory = 'REPAIR' | 'CLEANING' | 'ACCESS' | 'OTHER';
export type WorkplaceFacilityRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type WorkplaceFacilityRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type WorkplaceResourceClosure = {
  closureId: string;
  resourceId: string;
  siteId: string;
  floorId: string;
  resourceName: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'CANCELLED';
  reason: string;
  cancellationReason: string | null;
  resourceVersionAtCreate: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  affectedBookingsPath: string;
};
export type WorkplacePublicClosure = {
  resourceId: string;
  startsAt: string;
  endsAt: string;
  availability: string;
};
export type WorkplaceFacilityRequest = {
  requestId: string;
  resourceId: string;
  siteId: string;
  floorId: string;
  resourceName: string;
  category: WorkplaceFacilityCategory;
  description: string;
  status: WorkplaceFacilityRequestStatus;
  statusReason: string | null;
  priority: WorkplaceFacilityRequestPriority;
  assignedTo: string | null;
  serviceProvider: string | null;
  externalWorkOrderReference: string | null;
  slaDueAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  owner: string;
};
export type WorkplaceFacilityPage<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  generatedAt: string;
  countsScope?: 'SITE' | 'FLOORS';
  allowedFloorIds?: string[] | null;
};
export type WorkplaceCreateClosure = {
  startsAt: string;
  endsAt: string;
  version: number;
  reason: string;
  confirmed: boolean;
};
export type WorkplaceBookingAvailability = {
  resourceId: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  reason: string | null;
  closures: WorkplacePublicClosure[];
  generatedAt: string;
  owner: string;
  guaranteesBooking: boolean;
};
export type WorkplaceRoomBookingImpact = {
  resourceId: string;
  calendarResourceId: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  content: {
    bookingId: string;
    eventId: string;
    calendarResourceId: string;
    startsAt: string;
    endsAt: string;
    status: string;
    version: number;
    owner: string;
  }[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  generatedAt: string;
  source: string;
  availability: string;
  owner: string;
  existingBookingsMutated: boolean;
};
const id = encodeURIComponent;
function query(input: Record<string, string | number | boolean | undefined>) {
  return new URLSearchParams(
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}
export async function getWorkplaceResourceClosures(input: {
  siteId: string;
  floorId?: string;
  resourceId?: string;
  from: string;
  to: string;
  includeCancelled?: boolean;
  page?: number;
  size?: number;
}) {
  const response = await axiosInstance.get<
    ApiResponse<WorkplaceFacilityPage<WorkplaceResourceClosure>>
  >(`${ADMIN}/closures?${query(input)}`);
  return response.data.data;
}
export async function getWorkplaceResourceClosure(siteId: string, closureId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceResourceClosure>>(
    `${ADMIN}/closures/${id(closureId)}?${query({ siteId })}`
  );
  return response.data.data;
}
export async function createWorkplaceResourceClosure(
  siteId: string,
  resourceId: string,
  input: WorkplaceCreateClosure,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceResourceClosure>,
    WorkplaceCreateClosure
  >(`${ADMIN}/resources/${id(resourceId)}/closures?${query({ siteId })}`, input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data.data;
}
export async function cancelWorkplaceResourceClosure(
  siteId: string,
  closureId: string,
  input: { version: number; reason: string; confirmed: boolean }
) {
  const response = await axiosInstance.put<ApiResponse<WorkplaceResourceClosure>, typeof input>(
    `${ADMIN}/closures/${id(closureId)}/cancel?${query({ siteId })}`,
    input
  );
  return response.data.data;
}
export async function getWorkplaceFacilityRequests(
  input: {
    siteId?: string;
    floorId?: string;
    status?: WorkplaceFacilityRequestStatus;
    page?: number;
    size?: number;
  },
  admin = false
) {
  const response = await axiosInstance.get<
    ApiResponse<WorkplaceFacilityPage<WorkplaceFacilityRequest>>
  >(`${admin ? ADMIN : MEMBER}/requests?${query(input)}`);
  return response.data.data;
}
export async function getWorkplaceFacilityRequest(requestId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceFacilityRequest>>(
    `${MEMBER}/requests/${id(requestId)}`
  );
  return response.data.data;
}
export async function createWorkplaceFacilityRequest(
  resourceId: string,
  input: { category: WorkplaceFacilityCategory; description: string },
  idempotencyKey: string
) {
  const response = await axiosInstance.post<ApiResponse<WorkplaceFacilityRequest>, typeof input>(
    `${MEMBER}/resources/${id(resourceId)}/requests`,
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data.data;
}
export async function changeWorkplaceFacilityRequestStatus(
  siteId: string,
  requestId: string,
  input: {
    status: WorkplaceFacilityRequestStatus;
    version: number;
    reason: string;
    confirmed: boolean;
    priority?: WorkplaceFacilityRequestPriority;
    assignedTo?: string;
    serviceProvider?: string;
    externalWorkOrderReference?: string;
    slaDueAt?: string;
    clearSla?: boolean;
  }
) {
  const response = await axiosInstance.put<ApiResponse<WorkplaceFacilityRequest>, typeof input>(
    `${ADMIN}/requests/${id(requestId)}/status?${query({ siteId })}`,
    input
  );
  return response.data.data;
}
export async function getWorkplaceBookingAvailability(
  resourceId: string,
  from: string,
  to: string
) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceBookingAvailability>>(
    `${MEMBER}/resources/${id(resourceId)}/booking-availability?${query({ from, to })}`
  );
  return response.data.data;
}
export async function getWorkplaceRoomBookingImpact(
  siteId: string,
  resourceId: string,
  from: string,
  to: string,
  page = 0,
  size = 20
) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceRoomBookingImpact>>(
    `${ADMIN}/resources/${id(resourceId)}/room-booking-impact?${query({ siteId, from, to, page, size })}`
  );
  return response.data.data;
}
