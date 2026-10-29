import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  cancelAuthenticatedCalendarBooking,
  cancelAuthenticatedCalendarBookingHold,
  changeCalendarBookingPageState,
  confirmAuthenticatedCalendarBooking,
  createAuthenticatedCalendarBookingHold,
  createCalendarBookingPage,
  getAuthenticatedCalendarBookablePage,
  getAuthenticatedCalendarBookingAvailability,
  getCalendarBookingCapabilities,
  getCalendarBookingPage,
  getMyCalendarBookingAppointment,
  listCalendarBookingPages,
  listMyCalendarBookingAppointments,
  rescheduleAuthenticatedCalendarBooking,
  revokeCalendarBookingManagementToken,
  revokeCalendarBookingPagePublicToken,
  rotateCalendarBookingManagementToken,
  rotateCalendarBookingPagePublicToken,
  updateCalendarBookingPage,
  type CalendarBookingAppointment,
  type CalendarBookingPage,
  type SaveCalendarBookingPageInput,
} from './calendar-booking-api';

const PAGE_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';
const HOLD_ID = '10ba0853-02a8-7499-b6d8-009251e6a465';
const APPOINTMENT_ID = '20ba0853-02a8-7499-b6d8-009251e6a466';
const IDEMPOTENCY_KEY = '30ba0853-02a8-7499-b6d8-009251e6a467';
const BASE = '/api/platform/v1/calendar/booking';

const pageInput: SaveCalendarBookingPageInput = {
  ownerType: 'PERSONAL',
  ownerGroupRef: null,
  calendarId: '40ba0853-02a8-7499-b6d8-009251e6a468',
  title: 'Design review',
  description: null,
  timeZone: 'Asia/Seoul',
  durationMinutes: 30,
  bufferBeforeMinutes: 5,
  bufferAfterMinutes: 5,
  dailyLimit: 8,
  minimumNoticeMinutes: 120,
  maximumAdvanceDays: 45,
  meetingMode: 'VIDEO',
  location: null,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
  dialInInstructions: null,
  availabilityRules: [{ dayOfWeek: 'MONDAY', startsAt: '09:00:00', endsAt: '17:00:00' }],
  questions: [],
  version: 7,
};

const page: CalendarBookingPage = {
  ...pageInput,
  pageId: PAGE_ID,
  ownerPersonPublicId: '50ba0853-02a8-7499-b6d8-009251e6a469',
  state: 'PUBLISHED',
  publicLinkConfigured: true,
  publicTokenVersion: 2,
  updatedAt: '2026-10-28T01:00:00Z',
};

const appointment: CalendarBookingAppointment = {
  appointmentId: APPOINTMENT_ID,
  pageId: PAGE_ID,
  eventId: '60ba0853-02a8-7499-b6d8-009251e6a46a',
  bookerPersonPublicId: '70ba0853-02a8-7499-b6d8-009251e6a46b',
  state: 'CONFIRMED',
  startsAt: '2026-11-02T01:00:00Z',
  endsAt: '2026-11-02T01:30:00Z',
  supersedesAppointmentId: null,
  version: 3,
  updatedAt: '2026-10-28T01:00:00Z',
};

describe('calendar booking API contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the authenticated capability, page and appointment read paths with abort signals', async () => {
    const signal = new AbortController().signal;
    const get = vi.spyOn(axiosInstance, 'get').mockImplementation(async (path: string) => {
      if (path.endsWith('/capabilities')) return { data: { data: { holdTtlSeconds: 300 } } };
      if (path.endsWith('/pages')) return { data: { data: [page] } };
      if (path.endsWith('/appointments')) return { data: { data: [appointment] } };
      if (path.includes('/bookable')) return { data: { data: { pageId: PAGE_ID } } };
      if (path.includes('/appointments/')) return { data: { data: appointment } };
      return { data: { data: page } };
    });

    await getCalendarBookingCapabilities(signal);
    await listCalendarBookingPages(signal);
    await getCalendarBookingPage(PAGE_ID, signal);
    await getAuthenticatedCalendarBookablePage(PAGE_ID, signal);
    await listMyCalendarBookingAppointments(signal);
    await getMyCalendarBookingAppointment(APPOINTMENT_ID, signal);

    expect(get.mock.calls).toEqual([
      [`${BASE}/capabilities`, { signal }],
      [`${BASE}/pages`, { signal }],
      [`${BASE}/pages/${PAGE_ID}`, { signal }],
      [`${BASE}/pages/${PAGE_ID}/bookable`, { signal }],
      [`${BASE}/appointments`, { signal }],
      [`${BASE}/appointments/${APPOINTMENT_ID}`, { signal }],
    ]);
  });

  it('encodes the availability range as query values and forwards cancellation', async () => {
    const signal = new AbortController().signal;
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: { data: { pageId: PAGE_ID, slots: [] } },
    });

    await getAuthenticatedCalendarBookingAvailability(
      PAGE_ID,
      { from: '2026-11-01T00:00:00+09:00', to: '2026-11-08T00:00:00+09:00' },
      signal
    );

    expect(get).toHaveBeenCalledWith(
      `${BASE}/pages/${PAGE_ID}/availability?from=2026-11-01T00%3A00%3A00%2B09%3A00&to=2026-11-08T00%3A00%3A00%2B09%3A00`,
      { signal }
    );
  });

  it('uses exact create/update and page token lifecycle paths with optimistic versions', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: page } });
    const put = vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { data: page } });

    await createCalendarBookingPage(pageInput);
    await updateCalendarBookingPage(PAGE_ID, pageInput);
    await revokeCalendarBookingPagePublicToken(PAGE_ID, { version: 7 });

    expect(post).toHaveBeenCalledWith(
      `${BASE}/pages/${PAGE_ID}/public-token:revoke`,
      { version: 7 },
      undefined
    );
    expect(put).toHaveBeenCalledWith(`${BASE}/pages/${PAGE_ID}`, pageInput, undefined);
    expect(post).toHaveBeenCalledWith(`${BASE}/pages`, pageInput, undefined);
  });

  it('consumes a publish token once without returning it to a caller cache', async () => {
    const consume = vi.fn();
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: { data: { page, publicToken: 'raw-public-once' } },
    });

    const result = await changeCalendarBookingPageState(
      PAGE_ID,
      { state: 'PUBLISHED', version: 7 },
      consume
    );

    expect(post).toHaveBeenCalledWith(
      `${BASE}/pages/${PAGE_ID}/state`,
      { state: 'PUBLISHED', version: 7 },
      undefined
    );
    expect(consume).toHaveBeenCalledOnce();
    expect(consume).toHaveBeenCalledWith({ kind: 'PUBLIC_LINK', value: 'raw-public-once' });
    expect(result).toBe(page);
    expect(result).not.toHaveProperty('publicToken');
  });

  it('uses the colon-delimited public token rotation path and ignores an absent token', async () => {
    const consume = vi.fn();
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: { data: { page, publicToken: null } },
    });

    await rotateCalendarBookingPagePublicToken(PAGE_ID, { version: 7 }, consume);

    expect(post).toHaveBeenCalledWith(
      `${BASE}/pages/${PAGE_ID}/public-token:rotate`,
      { version: 7 },
      undefined
    );
    expect(consume).not.toHaveBeenCalled();
  });

  it('carries page version, fencing token and idempotency in hold-confirm bodies', async () => {
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValueOnce({
        data: {
          data: {
            holdId: HOLD_ID,
            pageId: PAGE_ID,
            state: 'HELD',
            fencingToken: 9,
          },
        },
      })
      .mockResolvedValueOnce({
        data: { data: { appointment, managementToken: 'raw-manage-once' } },
      });
    const consume = vi.fn();
    const holdInput = {
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      idempotencyKey: IDEMPOTENCY_KEY,
      pageVersion: 7,
    };

    await createAuthenticatedCalendarBookingHold(PAGE_ID, holdInput);
    const result = await confirmAuthenticatedCalendarBooking(
      PAGE_ID,
      {
        holdId: HOLD_ID,
        fencingToken: 9,
        idempotencyKey: IDEMPOTENCY_KEY,
        answers: [{ key: 'agenda', value: 'Review' }],
      },
      consume
    );

    expect(post).toHaveBeenNthCalledWith(1, `${BASE}/pages/${PAGE_ID}/holds`, holdInput, undefined);
    expect(post).toHaveBeenNthCalledWith(
      2,
      `${BASE}/pages/${PAGE_ID}/appointments`,
      {
        holdId: HOLD_ID,
        fencingToken: 9,
        idempotencyKey: IDEMPOTENCY_KEY,
        answers: [{ key: 'agenda', value: 'Review' }],
      },
      undefined
    );
    expect(consume).toHaveBeenCalledWith({
      kind: 'APPOINTMENT_MANAGEMENT',
      value: 'raw-manage-once',
    });
    expect(result).toBe(appointment);
    expect(result).not.toHaveProperty('managementToken');
  });

  it('uses exact hold cancel, reschedule and appointment cancel paths', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: appointment } });

    await cancelAuthenticatedCalendarBookingHold(PAGE_ID, HOLD_ID, { fencingToken: 9 });
    await rescheduleAuthenticatedCalendarBooking(APPOINTMENT_ID, {
      replacementHoldId: HOLD_ID,
      fencingToken: 10,
      idempotencyKey: IDEMPOTENCY_KEY,
      version: 3,
    });
    await cancelAuthenticatedCalendarBooking(APPOINTMENT_ID, {
      version: 3,
      reason: 'Schedule changed',
    });

    expect(post.mock.calls).toEqual([
      [`${BASE}/pages/${PAGE_ID}/holds/${HOLD_ID}/cancel`, { fencingToken: 9 }, undefined],
      [
        `${BASE}/appointments/${APPOINTMENT_ID}/reschedule`,
        {
          replacementHoldId: HOLD_ID,
          fencingToken: 10,
          idempotencyKey: IDEMPOTENCY_KEY,
          version: 3,
        },
        undefined,
      ],
      [
        `${BASE}/appointments/${APPOINTMENT_ID}/cancel`,
        { version: 3, reason: 'Schedule changed' },
        undefined,
      ],
    ]);
  });

  it('keeps management token rotation one-time and revoke token-free', async () => {
    const consume = vi.fn();
    const post = vi
      .spyOn(axiosInstance, 'post')
      .mockResolvedValueOnce({ data: { data: { appointment, managementToken: 'rotated-once' } } })
      .mockResolvedValueOnce({ data: { data: appointment } });

    const rotated = await rotateCalendarBookingManagementToken(
      APPOINTMENT_ID,
      { version: 3 },
      consume
    );
    const revoked = await revokeCalendarBookingManagementToken(APPOINTMENT_ID, { version: 4 });

    expect(post.mock.calls).toEqual([
      [`${BASE}/appointments/${APPOINTMENT_ID}/management-token:rotate`, { version: 3 }, undefined],
      [`${BASE}/appointments/${APPOINTMENT_ID}/management-token:revoke`, { version: 4 }, undefined],
    ]);
    expect(consume).toHaveBeenCalledOnce();
    expect(rotated).toBe(appointment);
    expect(revoked).toBe(appointment);
  });

  it.each([
    ['page/1', () => getCalendarBookingPage('page/1')],
    [PAGE_ID.toUpperCase(), () => getCalendarBookingPage(PAGE_ID.toUpperCase())],
    [
      'hold/1',
      () => cancelAuthenticatedCalendarBookingHold(PAGE_ID, 'hold/1', { fencingToken: 1 }),
    ],
    [
      'bad idempotency key',
      () =>
        createAuthenticatedCalendarBookingHold(PAGE_ID, {
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          pageVersion: 7,
          idempotencyKey: 'retry-1',
        }),
    ],
  ])('rejects non-canonical transport identity before dispatch: %s', async (_label, request) => {
    const get = vi.spyOn(axiosInstance, 'get');
    const post = vi.spyOn(axiosInstance, 'post');

    await expect(request()).rejects.toThrow('canonical lowercase UUID');
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
