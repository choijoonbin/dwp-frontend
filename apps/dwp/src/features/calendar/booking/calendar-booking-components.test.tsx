// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CalendarBookingAppointments,
  CalendarBookingBookablePanel,
  CalendarBookingCapabilityNotice,
  CalendarBookingOneTimeTokenNotice,
  CalendarBookingOwnedPageDetail,
  CalendarBookingPageBrowser,
  type CalendarBookingCopy,
} from './calendar-booking-components';

import type { Root } from 'react-dom/client';
import type {
  AuthenticatedCalendarBookablePage,
  CalendarBookingAppointment,
  CalendarBookingAvailability,
  CalendarBookingHold,
  CalendarBookingPage,
} from '@dwp-frontend/shared-utils';

const PAGE_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';
const APPOINTMENT_ID = '20ba0853-02a8-7499-b6d8-009251e6a466';

const copy: CalendarBookingCopy = {
  loading: 'Loading bookings',
  empty: 'Nothing here',
  unavailable: 'Bookings unavailable',
  denied: 'Booking access revoked',
  disabled: 'Authenticated booking disabled',
  stale: 'Information may be stale',
  partial: 'Only a bounded subset is shown',
  retry: 'Retry',
  searchLabel: 'Search booking pages',
  searchPlaceholder: 'Search',
  pagesLabel: 'Booking pages',
  noSearchResults: 'No matching pages',
  showMore: 'Show more',
  externalDisabled: 'Public and external booking is disabled',
  externalEnabled: 'External booking is enabled',
  selectPage: (title) => `Select ${title}`,
  pageState: (state) => `State ${state}`,
  minutes: (minutes) => `${minutes} minutes`,
  pageDetailHeading: 'Booking page detail',
  timeZone: (value) => `Time zone ${value}`,
  dailyLimit: (count) => `Daily limit ${count}`,
  notice: (minutes) => `Notice ${minutes}`,
  advanceWindow: (days) => `Advance ${days}`,
  buffers: (before, after) => `Buffers ${before}/${after}`,
  availabilityRuleCount: (count) => `Rules ${count}`,
  questionCount: (count) => `Questions ${count}`,
  bookableHeading: 'Book an appointment',
  slotsLabel: 'Available times',
  noSlots: 'No available times',
  showMoreSlots: 'Show more times',
  selectSlot: (value) => `Choose ${value}`,
  createHold: 'Hold this time',
  releaseHold: 'Release time',
  holdExpired: 'This hold expired',
  versionChanged: 'The booking page changed',
  accessInfoMissing: 'Access details are unavailable',
  meetingMode: (mode) => `Mode ${mode}`,
  accessInformation: 'How to join',
  openVideo: 'Open secure video link',
  questionsHeading: 'Booking questions',
  required: 'Required',
  answerRequired: 'Answer required',
  invalidAnswer: 'Invalid answer',
  confirmBooking: 'Confirm booking',
  confirmReschedule: 'Confirm new time',
  appointmentsHeading: 'My appointments',
  appointmentsLabel: 'Appointment list',
  selectAppointment: (value) => `Open ${value}`,
  appointmentState: (state) => `State ${state}`,
  appointmentDetail: 'Appointment detail',
  appointmentPage: 'Booking page',
  appointmentTime: 'Time',
  requestReschedule: 'Reschedule',
  cancelReason: 'Cancellation reason',
  cancelAppointment: 'Cancel appointment',
  actionsUnavailable: 'Appointment actions unavailable',
  oneTimeTokenHeading: 'Save this token now',
  publicTokenDescription: 'The public token is shown once.',
  managementTokenDescription: 'The management token is shown once.',
  dismissToken: 'Dismiss token',
};

function bookingPage(index = 0): CalendarBookingPage {
  return {
    pageId:
      index === 0 ? PAGE_ID : `${index.toString(16).padStart(8, '0')}-02a8-7499-b6d8-009251e6a464`,
    ownerType: 'PERSONAL',
    ownerPersonPublicId: null,
    ownerGroupRef: null,
    calendarId: '40ba0853-02a8-7499-b6d8-009251e6a468',
    state: 'PUBLISHED',
    title: index === 0 ? 'Design review' : `Page ${index}`,
    description: index === 0 ? 'Discuss the product' : null,
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
}

const bookable: AuthenticatedCalendarBookablePage = {
  pageId: PAGE_ID,
  pageVersion: 4,
  title: 'Design review',
  description: 'Discuss the product',
  timeZone: 'Asia/Seoul',
  durationMinutes: 30,
  meetingMode: 'VIDEO',
  location: null,
  conferenceUrl: 'https://meet.google.com/abc-defg-hij',
  dialInInstructions: null,
  questions: [{ key: 'agenda', label: 'Agenda', type: 'LONG_TEXT', required: true, options: null }],
};

const availability: CalendarBookingAvailability = {
  pageId: PAGE_ID,
  pageVersion: 4,
  from: '2026-11-01T00:00:00Z',
  to: '2026-11-08T00:00:00Z',
  slots: [{ startsAt: '2026-11-02T01:00:00Z', endsAt: '2026-11-02T01:30:00Z' }],
  generatedAt: '2026-10-28T00:00:00Z',
};

const hold: CalendarBookingHold = {
  holdId: '10ba0853-02a8-7499-b6d8-009251e6a465',
  pageId: PAGE_ID,
  bookerPersonPublicId: '70ba0853-02a8-7499-b6d8-009251e6a46b',
  state: 'HELD',
  startsAt: '2026-11-02T01:00:00Z',
  endsAt: '2026-11-02T01:30:00Z',
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
  startsAt: '2026-11-02T01:00:00Z',
  endsAt: '2026-11-02T01:30:00Z',
  supersedesAppointmentId: null,
  version: 3,
  updatedAt: '2026-10-28T00:00:00Z',
};

let container: HTMLDivElement;
let root: Root;

async function render(node: React.ReactNode) {
  await act(async () => root.render(node));
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
    const setter = Object.getOwnPropertyDescriptor(
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value'
    )?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('calendar booking components', () => {
  it('debounces page search, keeps native keyboard controls and bounds show-more paging', async () => {
    const select = vi.fn();
    await render(
      createElement(CalendarBookingPageBrowser, {
        pages: Array.from({ length: 45 }, (_, index) => bookingPage(index)),
        state: 'READY',
        selectedPageId: null,
        copy,
        onSelect: select,
      })
    );

    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(20);
    click(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Show more'
      ) ?? null
    );
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(40);

    input(container.querySelector('input[type="search"]'), 'Design');
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(40);
    await act(async () => vi.advanceTimersByTimeAsync(275));
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(1);
    const choose = container.querySelector('button[aria-label="Select Design review"]');
    expect(choose).not.toBeNull();
    click(choose);
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ pageId: PAGE_ID, version: 4 }));
  });

  it('announces external booking disablement explicitly', async () => {
    await render(createElement(CalendarBookingCapabilityNotice, { externalEnabled: false, copy }));
    expect(container.textContent).toContain('Public and external booking is disabled');
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('renders the complete managed booking-page detail without enabling a mutation', async () => {
    await render(
      createElement(CalendarBookingOwnedPageDetail, {
        page: { ...bookingPage(), state: 'PAUSED' },
        state: 'READY',
        copy,
      })
    );
    expect(container.textContent).toContain('Booking page detail');
    expect(container.textContent).toContain('State PAUSED');
    expect(container.textContent).toContain('Time zone Asia/Seoul');
    expect(container.textContent).toContain('Daily limit 8');
    expect(container.textContent).toContain('Buffers 0/0');
    expect(container.querySelector('button')).toBeNull();
  });

  it('requires a valid current-version hold and required answers before confirm', async () => {
    const confirm = vi.fn();
    const release = vi.fn();
    const answer = vi.fn();
    await render(
      createElement(CalendarBookingBookablePanel, {
        page: bookable,
        availability,
        state: 'READY',
        selectedSlot: availability.slots[0],
        hold,
        heldPageVersion: 4,
        answers: {},
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelectSlot: vi.fn(),
        onCreateHold: vi.fn(),
        onReleaseHold: release,
        onAnswer: answer,
        onConfirm: confirm,
      })
    );

    expect(
      container.querySelector('a[href="https://meet.google.com/abc-defg-hij"]')
    ).not.toBeNull();
    const confirmButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm booking'
    );
    expect(confirmButton?.disabled).toBe(true);

    await render(
      createElement(CalendarBookingBookablePanel, {
        page: bookable,
        availability,
        state: 'READY',
        selectedSlot: availability.slots[0],
        hold,
        heldPageVersion: 4,
        answers: { agenda: 'Review the launch' },
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelectSlot: vi.fn(),
        onCreateHold: vi.fn(),
        onReleaseHold: release,
        onAnswer: answer,
        onConfirm: confirm,
      })
    );
    const enabledConfirm = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Confirm booking'
    );
    expect(enabledConfirm?.disabled).toBe(false);
    click(enabledConfirm ?? null);
    expect(confirm).toHaveBeenCalledWith([{ key: 'agenda', value: 'Review the launch' }], hold);
  });

  it('fails booking closed for page version change, stale data and missing access info', async () => {
    const createHold = vi.fn();
    await render(
      createElement(CalendarBookingBookablePanel, {
        page: { ...bookable, pageVersion: 5, conferenceUrl: null },
        availability,
        state: 'STALE',
        selectedSlot: availability.slots[0],
        hold,
        heldPageVersion: 4,
        answers: { agenda: 'Review' },
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelectSlot: vi.fn(),
        onCreateHold: createHold,
        onReleaseHold: vi.fn(),
        onAnswer: vi.fn(),
        onConfirm: vi.fn(),
      })
    );

    expect(container.textContent).toContain('Information may be stale');
    expect(container.textContent).toContain('Access details are unavailable');
    expect(container.textContent).toContain('The booking page changed');
    expect(createHold).not.toHaveBeenCalled();
  });

  it('does not submit a slot that disappeared during an availability refresh', async () => {
    const createHold = vi.fn();
    await render(
      createElement(CalendarBookingBookablePanel, {
        page: bookable,
        availability,
        state: 'READY',
        selectedSlot: {
          startsAt: '2026-11-03T01:00:00Z',
          endsAt: '2026-11-03T01:30:00Z',
        },
        hold: null,
        heldPageVersion: null,
        answers: {},
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelectSlot: vi.fn(),
        onCreateHold: createHold,
        onReleaseHold: vi.fn(),
        onAnswer: vi.fn(),
        onConfirm: vi.fn(),
      })
    );
    const holdButton = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === 'Hold this time'
    );
    expect(holdButton?.disabled).toBe(true);
    click(holdButton ?? null);
    expect(createHold).not.toHaveBeenCalled();
  });

  it('renders availability in bounded keyboard-accessible pages', async () => {
    const manySlots = Array.from({ length: 30 }, (_, index) => {
      const startsAt = new Date(Date.parse('2026-11-02T00:00:00Z') + index * 30 * 60_000);
      return {
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
      };
    });
    await render(
      createElement(CalendarBookingBookablePanel, {
        page: bookable,
        availability: { ...availability, slots: manySlots },
        state: 'READY',
        selectedSlot: null,
        hold: null,
        heldPageVersion: null,
        answers: {},
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelectSlot: vi.fn(),
        onCreateHold: vi.fn(),
        onReleaseHold: vi.fn(),
        onAnswer: vi.fn(),
        onConfirm: vi.fn(),
      })
    );
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(20);
    click(
      [...container.querySelectorAll('button')].find(
        (item) => item.textContent === 'Show more times'
      ) ?? null
    );
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(30);
  });

  it('shows appointment list/detail and sends cancellation with exact optimistic version', async () => {
    const cancel = vi.fn();
    const reschedule = vi.fn();
    await render(
      createElement(CalendarBookingAppointments, {
        appointments: [appointment],
        state: 'READY',
        selectedAppointmentId: APPOINTMENT_ID,
        locale: 'en-US',
        timeZone: 'UTC',
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelect: vi.fn(),
        onRequestReschedule: reschedule,
        onCancel: cancel,
      })
    );

    expect(container.textContent).toContain('Appointment detail');
    input(container.querySelector('textarea'), '  Plans changed  ');
    click(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Cancel appointment'
      ) ?? null
    );
    expect(cancel).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      version: 3,
      reason: 'Plans changed',
    });
    click(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Reschedule'
      ) ?? null
    );
    expect(reschedule).toHaveBeenCalledWith(appointment);
  });

  it('disables appointment writes when the source is stale', async () => {
    await render(
      createElement(CalendarBookingAppointments, {
        appointments: [appointment],
        state: 'STALE',
        selectedAppointmentId: APPOINTMENT_ID,
        locale: 'en-US',
        timeZone: 'UTC',
        now: Date.parse('2026-11-01T00:00:00Z'),
        copy,
        onSelect: vi.fn(),
        onRequestReschedule: vi.fn(),
        onCancel: vi.fn(),
      })
    );
    expect(container.textContent).toContain('Appointment actions unavailable');
    expect(
      [...container.querySelectorAll('button')]
        .filter((button) => ['Reschedule', 'Cancel appointment'].includes(button.textContent ?? ''))
        .every((button) => button.disabled)
    ).toBe(true);
  });

  it('renders the raw token only as dismissible one-time text, never as a URL or form value', async () => {
    const dismiss = vi.fn();
    await render(
      createElement(CalendarBookingOneTimeTokenNotice, {
        token: { kind: 'APPOINTMENT_MANAGEMENT', value: 'raw-token-once' },
        copy,
        onDismiss: dismiss,
      })
    );
    expect(container.querySelector('code')?.textContent).toBe('raw-token-once');
    expect(container.querySelector('[href*="raw-token-once"]')).toBeNull();
    expect(container.querySelector('[value*="raw-token-once"]')).toBeNull();
    click(
      [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Dismiss token'
      ) ?? null
    );
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
