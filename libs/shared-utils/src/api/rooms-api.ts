import { axiosInstance } from '../axios-instance';

import type {
  CalendarAdminOverview,
  CalendarBooking,
  CalendarEvent,
  CalendarPolicy,
  CalendarResource,
  CalendarResourceInput,
  CalendarResponseStatus,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from './calendar-api';
import type { ApiResponse } from '../types';

export type RoomOccupancy = {
  resourceId: string;
  startsAt: string;
  endsAt: string;
  bookingStatus: 'PENDING' | 'CONFIRMED';
};

export type RoomAvailability = {
  rooms: CalendarResource[];
  occupancy: RoomOccupancy[];
  generatedAt: string;
};

function rangeQuery(from: string, to: string) {
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

export async function getRoomAvailability(from: string, to: string): Promise<RoomAvailability> {
  const response = await axiosInstance.get<ApiResponse<RoomAvailability>>(
    `/api/platform/v1/rooms/availability?${rangeQuery(from, to)}`
  );
  return response.data.data;
}

export async function getRoomsPolicy(): Promise<CalendarPolicy> {
  const response = await axiosInstance.get<ApiResponse<CalendarPolicy>>(
    '/api/platform/v1/rooms/policy'
  );
  return response.data.data;
}

export async function getRoomBookings(from: string, to: string): Promise<CalendarEvent[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarEvent[]>>(
    `/api/platform/v1/rooms/bookings?${rangeQuery(from, to)}`
  );
  return response.data.data;
}

export async function createRoomBooking(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  const response = await axiosInstance.post<ApiResponse<CalendarEvent>, CreateCalendarEventInput>(
    '/api/platform/v1/rooms/bookings',
    input
  );
  return response.data.data;
}

export async function updateRoomBooking(
  eventId: string,
  input: UpdateCalendarEventInput
): Promise<CalendarEvent> {
  const response = await axiosInstance.put<ApiResponse<CalendarEvent>, UpdateCalendarEventInput>(
    `/api/platform/v1/rooms/bookings/${encodeURIComponent(eventId)}`,
    input
  );
  return response.data.data;
}

export async function respondToRoomBooking(
  eventId: string,
  responseStatus: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'>
): Promise<CalendarEvent> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarEvent>,
    { response: Exclude<CalendarResponseStatus, 'NEEDS_ACTION'> }
  >(`/api/platform/v1/rooms/bookings/${encodeURIComponent(eventId)}/response`, {
    response: responseStatus,
  });
  return response.data.data;
}

export async function cancelRoomBooking(eventId: string, version: number): Promise<void> {
  await axiosInstance.post<ApiResponse<void>, { version: number }>(
    `/api/platform/v1/rooms/bookings/${encodeURIComponent(eventId)}/cancel`,
    { version }
  );
}

export async function getRoomsAdminOverview(): Promise<CalendarAdminOverview> {
  const response = await axiosInstance.get<ApiResponse<CalendarAdminOverview>>(
    '/api/platform/v1/admin/rooms/overview'
  );
  return response.data.data;
}

export async function getPendingRoomBookings(): Promise<CalendarBooking[]> {
  const response = await axiosInstance.get<ApiResponse<CalendarBooking[]>>(
    '/api/platform/v1/admin/rooms/bookings/pending'
  );
  return response.data.data;
}

export async function decideRoomBooking(
  bookingId: string,
  decision: 'APPROVE' | 'DECLINE',
  note: string,
  version: number
): Promise<CalendarBooking> {
  const response = await axiosInstance.post<
    ApiResponse<CalendarBooking>,
    { decision: 'APPROVE' | 'DECLINE'; note: string; version: number }
  >(`/api/platform/v1/admin/rooms/bookings/${encodeURIComponent(bookingId)}/decision`, {
    decision,
    note,
    version,
  });
  return response.data.data;
}

export async function updateRoomsPolicy(input: CalendarPolicy): Promise<CalendarPolicy> {
  const response = await axiosInstance.put<ApiResponse<CalendarPolicy>, CalendarPolicy>(
    '/api/platform/v1/admin/rooms/policy',
    input
  );
  return response.data.data;
}

export async function saveRoomResource(
  resourceId: string | null,
  input: CalendarResourceInput
): Promise<CalendarResource> {
  if (!resourceId) {
    const response = await axiosInstance.post<ApiResponse<CalendarResource>, CalendarResourceInput>(
      '/api/platform/v1/admin/rooms/resources',
      input
    );
    return response.data.data;
  }
  const response = await axiosInstance.put<ApiResponse<CalendarResource>, CalendarResourceInput>(
    `/api/platform/v1/admin/rooms/resources/${encodeURIComponent(resourceId)}`,
    input
  );
  return response.data.data;
}
