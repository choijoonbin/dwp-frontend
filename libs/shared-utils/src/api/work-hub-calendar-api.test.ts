import { afterEach, expect, it, vi } from 'vitest';
import {
  createWorkCalendarEventHandoff,
  getWorkCalendarLinks,
  isExactWorkCalendarLinkReceipt,
  parseWorkCalendarEventHandoffDescription,
  parseWorkCalendarEventHandoff,
  putWorkCalendarLink,
  removeWorkCalendarLink,
  workCalendarEventHandoffDescription,
  workCalendarInternalPath,
} from './work-hub-calendar-api';
import { resetCsrfToken } from '../axios-instance';

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

it('round-trips a fresh bounded Work composer handoff and derives portable event metadata', () => {
  const now = new Date('2026-09-16T00:00:00.000Z');
  const handoff = createWorkCalendarEventHandoff(
    {
      ownerFingerprint: `sha256:${'a'.repeat(64)}`,
      work: {
        sourceSystem: 'PERSONAL_TASK',
        sourceReference: 'task/42',
        obligationKey: 'follow up',
      },
      sourceUrl: '/work/queue?work=PERSONAL_TASK%3Atask%252F42%3Afollow%2520up',
      returnTo: '/work/queue?view=mine#task-42',
      title: '집중: 분기 보고서 마무리',
      startsAt: '2026-09-16T09:00:00+09:00',
      endsAt: '2026-09-16T09:30:00+09:00',
      timeZone: 'Asia/Seoul',
    },
    now
  );

  expect(
    parseWorkCalendarEventHandoff(
      { workCalendarEventHandoff: handoff },
      now.getTime() + 14 * 60_000
    )
  ).toEqual(handoff);
  const description =
    'DWP Work\n' +
    'Reference: PERSONAL_TASK:task%2F42:follow%20up\n' +
    'Source: /work/queue?work=PERSONAL_TASK%3Atask%252F42%3Afollow%2520up';
  expect(workCalendarEventHandoffDescription(handoff)).toBe(description);
  expect(parseWorkCalendarEventHandoffDescription(description)).toEqual({
    work: handoff.work,
    sourceUrl: handoff.sourceUrl,
  });
  expect(
    parseWorkCalendarEventHandoffDescription(
      `${description.replace('task%252F42', 'different')}\nhttps://evil.example`
    )
  ).toBeNull();
});

it('accepts only an exact linked Work receipt for the reviewed event identity', () => {
  const expected = {
    linkId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
    work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
    eventId: '95fdccda-1ba0-4c7d-9829-189db4da0b4d',
  };
  const receipt = {
    ...expected,
    state: 'LINKED' as const,
    version: 0,
    createdAt: '2026-09-16T00:00:00Z',
    updatedAt: '2026-09-16T00:00:00Z',
    calendarAvailability: 'REFERENCE_ONLY' as const,
  };

  expect(isExactWorkCalendarLinkReceipt(receipt, expected)).toBe(true);
  expect(
    isExactWorkCalendarLinkReceipt({ ...receipt, eventId: crypto.randomUUID() }, expected)
  ).toBe(false);
  expect(isExactWorkCalendarLinkReceipt({ ...receipt, state: 'REMOVED' }, expected)).toBe(false);
});

it('rejects expired, cross-origin, encoded-alias, noncanonical source and excessive-range handoffs', () => {
  const now = new Date('2026-09-16T00:00:00.000Z');
  const valid = createWorkCalendarEventHandoff(
    {
      ownerFingerprint: `sha256:${'a'.repeat(64)}`,
      work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
      sourceUrl: '/work/queue?work=PERSONAL_TASK%3Atask-42%3A',
      returnTo: '/work/queue?view=mine',
      title: '집중: 검토',
      startsAt: '2026-09-16T09:00:00+09:00',
      endsAt: '2026-09-16T09:30:00+09:00',
      timeZone: 'Asia/Seoul',
    },
    now
  );
  const state = (value: unknown) => ({ workCalendarEventHandoff: value });

  expect(parseWorkCalendarEventHandoff(state(valid), Date.parse(valid.expiresAt))).toBeNull();
  expect(
    parseWorkCalendarEventHandoff(
      state({ ...valid, sourceUrl: 'https://evil.example/work' }),
      now.getTime()
    )
  ).toBeNull();
  expect(
    parseWorkCalendarEventHandoff(state({ ...valid, returnTo: '/work/%5cadmin' }), now.getTime())
  ).toBeNull();
  expect(
    parseWorkCalendarEventHandoff(
      state({ ...valid, sourceUrl: `${valid.sourceUrl}&view=mine` }),
      now.getTime()
    )
  ).toBeNull();
  expect(
    parseWorkCalendarEventHandoff(
      state({
        ...valid,
        work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'different-task' },
      }),
      now.getTime()
    )
  ).toBeNull();
  expect(
    parseWorkCalendarEventHandoff(
      state({
        ...valid,
        work: { sourceSystem: 'personal-task', sourceReference: 'task-42' },
      }),
      now.getTime()
    )
  ).toBeNull();
  expect(
    parseWorkCalendarEventHandoff(
      state({ ...valid, endsAt: '2026-09-18T09:30:00+09:00' }),
      now.getTime()
    )
  ).toBeNull();
  expect(workCalendarInternalPath('//evil.example/work')).toBeNull();
  expect(workCalendarInternalPath('/work/queue?filter=%0A')).toBeNull();
  expect(workCalendarInternalPath('/calendar/schedule', true)).toBeNull();
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
  const signal = new AbortController().signal;
  await putWorkCalendarLink(linkId, body, signal);
  await putWorkCalendarLink(linkId, body);
  await getWorkCalendarLinks(1, 50, signal);
  await removeWorkCalendarLink(linkId, 0, signal);
  expect(fetchMock.mock.calls[1]?.[0]).toBe(
    `/api/platform/v1/workspace/work-hub/calendar-links/${linkId}`
  );
  expect(fetchMock.mock.calls[2]?.[0]).toBe(fetchMock.mock.calls[1]?.[0]);
  expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
    method: 'PUT',
    credentials: 'include',
    body: JSON.stringify(body),
    headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    signal,
  });
  expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify(body));
  expect(fetchMock.mock.calls[3]?.[0]).toContain('?page=1&size=50');
  expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ signal });
  expect(fetchMock.mock.calls[4]?.[0]).toContain(`${linkId}?version=0`);
  expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ method: 'DELETE', signal });
});
