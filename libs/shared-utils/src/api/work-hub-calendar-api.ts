import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import type { PersonalWorkPage, WorkSourceReference } from './personal-work-contracts';

export type WorkCalendarLink = {
  linkId: string;
  work: WorkSourceReference;
  eventId: string;
  state: 'LINKED' | 'REMOVED';
  version: number;
  createdAt: string;
  updatedAt: string;
  calendarAvailability: 'REFERENCE_ONLY';
};
const base = '/api/platform/v1/workspace/work-hub/calendar-links';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function linkPath(linkId: string) {
  if (!uuid.test(linkId)) throw new Error('A stable UUID link identifier is required.');
  return `${base}/${linkId}`;
}

export async function getWorkCalendarLinks(
  page = 0,
  size = 100
): Promise<PersonalWorkPage<WorkCalendarLink>> {
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    page > 10_000 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw new Error('Invalid link page.');
  return (
    await axiosInstance.get<ApiResponse<PersonalWorkPage<WorkCalendarLink>>>(
      `${base}?page=${page}&size=${size}`
    )
  ).data.data;
}

/** PUT uses the stable link ID as command identity, including after an uncertain response. */
export async function putWorkCalendarLink(
  linkId: string,
  input: { work: WorkSourceReference; eventId: string }
): Promise<WorkCalendarLink> {
  if (!uuid.test(input.eventId)) throw new Error('A Calendar event reference is required.');
  return (
    await axiosInstance.put<ApiResponse<WorkCalendarLink>, typeof input>(linkPath(linkId), input)
  ).data.data;
}

/** Only removes the personal relationship; the Calendar event is unchanged. */
export async function removeWorkCalendarLink(
  linkId: string,
  version: number
): Promise<WorkCalendarLink> {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new Error('A non-negative link version is required.');
  return (
    await axiosInstance.delete<ApiResponse<WorkCalendarLink>>(
      `${linkPath(linkId)}?version=${version}`
    )
  ).data.data;
}
