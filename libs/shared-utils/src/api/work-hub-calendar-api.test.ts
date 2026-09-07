import { afterEach, expect, it, vi } from 'vitest';
import {
  getWorkCalendarLinks,
  putWorkCalendarLink,
  removeWorkCalendarLink,
} from './work-hub-calendar-api';
import { resetCsrfToken } from '../axios-instance';

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

it('keeps stable link identity across PUT retries and scopes reads through the authenticated session', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } }),
    } as Response)
    .mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: { state: 'LINKED' } }),
    } as Response);
  vi.stubGlobal('fetch', fetchMock);
  const linkId = '36e6e854-ec64-456c-8bcc-46a7d5ba97f2';
  const body = {
    work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task' },
    eventId: '95fdccda-1ba0-4c7d-9829-189db4da0b4d',
  };
  await putWorkCalendarLink(linkId, body);
  await putWorkCalendarLink(linkId, body);
  await getWorkCalendarLinks(1, 50);
  await removeWorkCalendarLink(linkId, 0);
  expect(fetchMock.mock.calls[1]?.[0]).toBe(
    `/api/platform/v1/workspace/work-hub/calendar-links/${linkId}`
  );
  expect(fetchMock.mock.calls[2]?.[0]).toBe(fetchMock.mock.calls[1]?.[0]);
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
    method: 'PUT',
    credentials: 'include',
    body: JSON.stringify(body),
    headers: { 'X-XSRF-TOKEN': 'csrf-token' },
  });
  expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify(body));
  expect(fetchMock.mock.calls[3]?.[0]).toContain('?page=1&size=50');
  expect(fetchMock.mock.calls[4]?.[0]).toContain(`${linkId}?version=0`);
  expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ method: 'DELETE' });
});
