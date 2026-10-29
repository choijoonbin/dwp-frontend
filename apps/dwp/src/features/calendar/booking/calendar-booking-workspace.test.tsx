// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { CalendarBookingWorkspace } from './calendar-booking-workspace';

import type { Root } from 'react-dom/client';
import type {
  CalendarBookingAppointment,
  CalendarBookingAvailability,
  CalendarBookingHold,
  CalendarBookingPage,
} from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    isLoading: false,
    user: { tenantId: 1, userId: 2, personPublicId: 'person-3' },
  },
  capabilities: vi.fn(),
  pages: vi.fn(),
  page: vi.fn(),
  appointments: vi.fn(),
  appointment: vi.fn(),
  bookable: vi.fn(),
  availability: vi.fn(),
  createHold: vi.fn(),
  releaseHold: vi.fn(),
  confirm: vi.fn(),
  reschedule: vi.fn(),
  cancel: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  useAuth: () => mocks.auth,
  useToast: () => mocks.toast,
  getCalendarBookingCapabilities: mocks.capabilities,
  listCalendarBookingPages: mocks.pages,
  getCalendarBookingPage: mocks.page,
  listMyCalendarBookingAppointments: mocks.appointments,
  getMyCalendarBookingAppointment: mocks.appointment,
  getAuthenticatedCalendarBookablePage: mocks.bookable,
  getAuthenticatedCalendarBookingAvailability: mocks.availability,
  createAuthenticatedCalendarBookingHold: mocks.createHold,
  cancelAuthenticatedCalendarBookingHold: mocks.releaseHold,
  confirmAuthenticatedCalendarBooking: mocks.confirm,
  rescheduleAuthenticatedCalendarBooking: mocks.reschedule,
  cancelAuthenticatedCalendarBooking: mocks.cancel,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${Object.values(values).join(' ')}` : key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

const PAGE_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';
const HOLD_ID = '10ba0853-02a8-7499-b6d8-009251e6a465';
const APPOINTMENT_ID = '20ba0853-02a8-7499-b6d8-009251e6a466';

const page: CalendarBookingPage = {
  pageId: PAGE_ID,
  ownerType: 'PERSONAL',
  ownerPersonPublicId: null,
  ownerGroupRef: null,
  calendarId: '40ba0853-02a8-7499-b6d8-009251e6a468',
  state: 'PUBLISHED',
  title: 'Design review',
  description: 'Discuss the product',
  timeZone: 'Asia/Seoul',
  durationMinutes: 30,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  dailyLimit: 8,
  minimumNoticeMinutes: 60,
  maximumAdvanceDays: 30,
  meetingMode: 'VIDEO',
  location: null,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
  dialInInstructions: null,
  availabilityRules: [],
  questions: [],
  publicLinkConfigured: false,
  publicTokenVersion: 0,
  version: 4,
  updatedAt: '2026-10-28T00:00:00Z',
};

const availability: CalendarBookingAvailability = {
  pageId: PAGE_ID,
  pageVersion: 4,
  from: '2026-11-01T00:00:00.000Z',
  to: '2026-11-15T00:00:00.000Z',
  slots: [{ startsAt: '2026-11-02T01:00:00Z', endsAt: '2026-11-02T01:30:00Z' }],
  generatedAt: '2026-11-01T00:00:00Z',
};

const hold: CalendarBookingHold = {
  holdId: HOLD_ID,
  pageId: PAGE_ID,
  bookerPersonPublicId: '70ba0853-02a8-7499-b6d8-009251e6a46b',
  state: 'HELD',
  startsAt: availability.slots[0]!.startsAt,
  endsAt: availability.slots[0]!.endsAt,
  expiresAt: '2026-11-01T00:05:00Z',
  fencingToken: 8,
  version: 1,
};

const appointment: CalendarBookingAppointment = {
  appointmentId: APPOINTMENT_ID,
  pageId: PAGE_ID,
  eventId: '60ba0853-02a8-7499-b6d8-009251e6a46a',
  bookerPersonPublicId: '70ba0853-02a8-7499-b6d8-009251e6a46b',
  state: 'CONFIRMED',
  startsAt: availability.slots[0]!.startsAt,
  endsAt: availability.slots[0]!.endsAt,
  supersedesAppointmentId: null,
  version: 3,
  updatedAt: '2026-11-01T00:00:00Z',
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function flush() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  }
}

function button(text: string) {
  return (
    [...container.querySelectorAll('button')].find((item) => item.textContent === text) ?? null
  );
}

function click(element: Element | null) {
  if (!(element instanceof HTMLElement)) throw new Error('Expected a clickable element');
  act(() => element.click());
}

function input(element: Element | null, value: string) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    throw new Error('Expected a text input');
  }
  act(() => {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function render(strict = false) {
  const workspace = createElement(
    QueryClientProvider,
    { client },
    createElement(CalendarBookingWorkspace)
  );
  await act(async () => {
    root.render(strict ? createElement(StrictMode, null, workspace) : workspace);
  });
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.capabilities.mockReset().mockResolvedValue({
    authenticatedBookingEnabled: true,
    externalPublicBookingEnabled: false,
    externalPublicBookingReason: 'disabled',
    holdTtlSeconds: 300,
  });
  mocks.pages.mockReset().mockResolvedValue([page]);
  mocks.page.mockReset().mockResolvedValue(page);
  mocks.appointments.mockReset().mockResolvedValue([]);
  mocks.appointment.mockReset().mockResolvedValue(appointment);
  mocks.bookable.mockReset().mockResolvedValue({
    pageId: PAGE_ID,
    pageVersion: 4,
    title: page.title,
    description: page.description,
    timeZone: page.timeZone,
    durationMinutes: page.durationMinutes,
    meetingMode: page.meetingMode,
    location: page.location,
    conferenceUrl: page.conferenceUrl,
    dialInInstructions: page.dialInInstructions,
    questions: [
      { key: 'agenda', label: 'Agenda', type: 'LONG_TEXT', required: true, options: null },
    ],
  });
  mocks.availability.mockReset().mockResolvedValue(availability);
  mocks.createHold.mockReset().mockResolvedValue(hold);
  mocks.releaseHold.mockReset().mockResolvedValue({ ...hold, state: 'CANCELLED' });
  mocks.confirm
    .mockReset()
    .mockImplementation(
      async (
        _pageId: string,
        _input: unknown,
        consume: (token: { kind: 'APPOINTMENT_MANAGEMENT'; value: string }) => void
      ) => {
        consume({ kind: 'APPOINTMENT_MANAGEMENT', value: 'raw-management-token-once' });
        return appointment;
      }
    );
  mocks.reschedule.mockReset().mockResolvedValue({ ...appointment, state: 'RESCHEDULED' });
  mocks.cancel.mockReset().mockResolvedValue({ ...appointment, state: 'CANCELLED', version: 4 });
  Object.values(mocks.toast).forEach((mock) => mock.mockReset());
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.useRealTimers();
});

describe('CalendarBookingWorkspace', () => {
  it('restarts an aborted StrictMode probe and completes its initial private reads', async () => {
    mocks.capabilities.mockImplementation(
      (signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          const timer = window.setTimeout(
            () =>
              resolve({
                authenticatedBookingEnabled: true,
                externalPublicBookingEnabled: false,
                externalPublicBookingReason: 'disabled',
                holdTtlSeconds: 300,
              }),
            2
          );
          signal?.addEventListener(
            'abort',
            () => {
              window.clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true }
          );
        })
    );

    await render(true);

    expect(mocks.capabilities).toHaveBeenCalled();
    expect(mocks.pages).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(container.textContent).toContain('Design review');
    expect(container.textContent).not.toContain('booking.states.loading');
  });

  it('uses abortable private reads and completes hold-to-confirm without caching the raw token', async () => {
    await render();

    expect(mocks.capabilities).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.pages).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(mocks.appointments).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(container.textContent).toContain('booking.capabilities.externalDisabled');

    click(container.querySelector('button[aria-label="booking.pages.select Design review"]'));
    await flush();
    expect(mocks.page).toHaveBeenCalledWith(PAGE_ID, expect.any(AbortSignal));
    expect(mocks.bookable).toHaveBeenCalledWith(PAGE_ID, expect.any(AbortSignal));
    expect(mocks.availability).toHaveBeenCalledWith(
      PAGE_ID,
      { from: '2026-11-01T00:00:00.000Z', to: '2026-11-15T00:00:00.000Z' },
      expect.any(AbortSignal)
    );

    click(container.querySelector('input[type="radio"]'));
    click(button('booking.bookable.createHold'));
    await flush();
    expect(mocks.createHold).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({
        pageVersion: 4,
        startsAt: availability.slots[0]!.startsAt,
        endsAt: availability.slots[0]!.endsAt,
        idempotencyKey: expect.any(String),
      })
    );

    input(container.querySelector('textarea'), 'Review launch');
    click(button('booking.bookable.confirm'));
    await flush();
    expect(mocks.confirm).toHaveBeenCalledWith(
      PAGE_ID,
      expect.objectContaining({
        holdId: HOLD_ID,
        fencingToken: 8,
        idempotencyKey: expect.any(String),
        answers: [{ key: 'agenda', value: 'Review launch' }],
      }),
      expect.any(Function)
    );
    expect(container.querySelector('code')?.textContent).toBe('raw-management-token-once');
    expect(mocks.appointment).toHaveBeenCalledWith(APPOINTMENT_ID, expect.any(AbortSignal));
    expect(window.location.href).not.toContain('raw-management-token-once');
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data)
      )
    ).not.toContain('raw-management-token-once');
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state.data)
      )
    ).not.toContain('raw-management-token-once');
  });

  it('purges previously displayed private data when refreshed authority is denied', async () => {
    await render();
    expect(container.textContent).toContain('Design review');

    mocks.pages.mockRejectedValue(new HttpError('Denied', 403));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ['calendar', 'booking', '1:2:person-3', 'pages'],
      });
    });
    await flush();

    expect(container.textContent).not.toContain('Design review');
    expect(container.textContent).toContain('booking.states.denied');
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: ['calendar', 'booking'] })
        .every((query) => query.state.data === undefined)
    ).toBe(true);
  });

  it('aborts an in-flight private page read when the workspace unmounts', async () => {
    let signal: AbortSignal | undefined;
    mocks.pages.mockImplementation((requestSignal: AbortSignal) => {
      signal = requestSignal;
      return new Promise(() => undefined);
    });
    await render();
    expect(signal?.aborted).toBe(false);

    await act(async () => root.unmount());
    expect(signal?.aborted).toBe(true);
    root = createRoot(container);
  });
});
