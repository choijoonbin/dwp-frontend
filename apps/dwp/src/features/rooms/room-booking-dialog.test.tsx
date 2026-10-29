// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoomBookingDialog } from './room-booking-dialog';

import type { CalendarEvent, CalendarPolicy, CalendarResource } from '@dwp-frontend/shared-utils';

const api = vi.hoisted(() => ({
  availability: vi.fn(),
  people: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  close: vi.fn(),
  saved: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const telemetry = vi.hoisted(() => {
  let active = false;
  const events = {
    binding: vi.fn(),
    begin: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    abandon: vi.fn(),
  };
  const hook = {
    begin: () => {
      if (active) return;
      active = true;
      events.begin();
    },
    complete: () => {
      if (!active) return;
      active = false;
      events.complete();
    },
    fail: (error: unknown) => {
      if (!active) return;
      active = false;
      events.fail(error);
    },
    failAuthority: () => undefined,
    abandon: () => {
      if (!active) return;
      active = false;
      events.abandon();
    },
  };
  return {
    events,
    hook,
    reset: () => {
      active = false;
      Object.values(events).forEach((mock) => mock.mockReset());
    },
  };
});

vi.mock('@dwp-frontend/shared-utils', () => ({
  createRoomBooking: api.create,
  updateRoomBooking: api.update,
  getRoomAvailability: api.availability,
  listPeople: api.people,
  resolveIdempotentMutationIntent: (current: { key: string } | null, _input: unknown) =>
    current ?? { key: 'room-recurrence-intent' },
  useAuth: () => ({ user: { tenantId: 1, userId: 7 } }),
  useToast: () => ({ success: api.toastSuccess, error: api.toastError }),
}));

vi.mock('../../components/use-product-action-mutation', () => ({
  useProductActionMutation:
    () => (action: (authority: { expectedDecisionRevision: string }) => Promise<unknown>) =>
      action({ expectedDecisionRevision: 'verified-room-action' }),
}));

vi.mock('../../components/use-single-product-surface-task-telemetry', () => ({
  useSingleProductSurfaceTaskTelemetry: (binding: unknown) => {
    telemetry.events.binding(binding);
    return telemetry.hook;
  },
}));

vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    canCreateRoomBooking: true,
    canUpdateRoomBooking: true,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'booking.recurrencePreviewSummary'
        ? `${values?.count}:${values?.first}:${values?.last}:${values?.timeZone}`
        : key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  AutocompleteMultiField: () => null,
  DwpDateTimeProvider: ({ children }: { children: ReactNode }) => children,
  FormDialog: ({
    children,
    onClose,
    onSubmit,
    submitDisabled,
  }: {
    children: ReactNode;
    onClose: () => void;
    onSubmit: () => void;
    submitDisabled: boolean;
  }) =>
    createElement(
      'div',
      null,
      children,
      createElement('button', { 'data-testid': 'close', onClick: onClose }, 'close'),
      createElement(
        'button',
        { 'data-testid': 'submit', disabled: submitDisabled, onClick: onSubmit },
        'submit'
      )
    ),
  FormField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (event: { target: { value: string } }) => void;
  }) => createElement('input', { 'aria-label': label, value, onChange }),
  DateTimePickerField: ({
    label,
    value,
    onValueChange,
    disabled,
  }: {
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
  }) =>
    createElement('input', {
      'aria-label': label,
      value,
      disabled,
      onChange: (event: { target: { value: string } }) => onValueChange(event.target.value),
    }),
  DatePickerField: ({
    label,
    value,
    onValueChange,
    errorMessage,
    disabled,
  }: {
    label: string;
    value: string;
    onValueChange: (value: string | null) => void;
    errorMessage?: string;
    disabled?: boolean;
  }) =>
    createElement(
      'label',
      null,
      createElement('input', {
        'aria-label': label,
        type: 'date',
        value,
        disabled,
        onChange: (event: { target: { value: string } }) => onValueChange(event.target.value),
      }),
      errorMessage
    ),
  SelectField: ({
    label,
    value,
    options,
    onValueChange,
    disabled,
  }: {
    label: string;
    value: string | number;
    options: readonly { value: string | number; label: string }[];
    onValueChange: (value: string | number) => void;
    disabled?: boolean;
  }) =>
    createElement(
      'select',
      {
        'aria-label': label,
        value: String(value),
        disabled,
        onChange: (event: { target: { value: string } }) => {
          const selected = options.find((option) => String(option.value) === event.target.value);
          if (selected) onValueChange(selected.value);
        },
      },
      options.map((option) =>
        createElement(
          'option',
          { key: String(option.value), value: String(option.value) },
          option.label
        )
      )
    ),
}));

const generatedAt = '2026-10-28T00:00:00Z';
const startsAt = '2026-11-10T01:00:00Z';
const endsAt = '2026-11-10T02:00:00Z';
const room: CalendarResource = {
  resourceId: '19000000-0000-4000-8000-000000000001',
  code: 'ROOM-1',
  name: 'Atlas',
  nameKo: '아틀라스',
  nameEn: 'Atlas',
  type: 'ROOM',
  site: 'Seoul',
  floor: '19F',
  capacity: 8,
  features: [],
  timeZone: 'Asia/Seoul',
  approvalRequired: false,
  state: 'AVAILABLE',
  available: true,
  version: 4,
};
const policy: CalendarPolicy = {
  weekStart: 1,
  workingDayStart: '08:00:00',
  workingDayEnd: '20:00:00',
  defaultEventMinutes: 30,
  minimumEventMinutes: 15,
  maximumEventMinutes: 480,
  maximumAdvanceDays: 90,
  defaultBufferMinutes: 0,
  weeklyFocusTargetMinutes: 240,
  dailyMeetingLimitMinutes: 480,
  enforceMeetingAgenda: false,
  allowExternalAttendees: false,
  version: 3,
};
const recurringEvent: CalendarEvent = {
  eventId: '18000000-0000-4000-8000-000000000001',
  calendarId: '18000000-0000-4000-8000-000000000002',
  calendarName: 'Work',
  calendarColor: '#0057B8',
  organizerUserId: 7,
  organizerName: 'Owner',
  title: 'Existing weekly review',
  description: 'Agenda',
  type: 'MEETING',
  startsAt,
  endsAt,
  timeZone: room.timeZone,
  allDay: false,
  location: room.name,
  status: 'CONFIRMED',
  visibility: 'DEFAULT',
  recurrence: 'WEEKLY',
  recurrenceInterval: 1,
  recurrenceUntil: '2026-12-08',
  responseRequired: false,
  attendees: [],
  resource: room,
  conflict: false,
  capabilities: {
    canViewDetails: true,
    canEdit: true,
    canDelete: true,
    canRestore: false,
    canRespond: false,
    canStar: false,
  },
  version: 5,
};

describe('Room booking recurrence and task telemetry', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    telemetry.reset();
    vi.clearAllMocks();
    api.people.mockResolvedValue({ items: [] });
    api.availability.mockImplementation(async (_from: string, _to: string, excluded?: string) => ({
      rooms: [room],
      occupancy: [],
      bookingEligibility: [
        {
          resourceId: room.resourceId,
          eligible: true,
          reasonCode: 'ELIGIBLE',
          evaluatedFrom: startsAt,
          evaluatedTo: endsAt,
          excludedEventId: excluded ?? null,
          evaluatedAt: generatedAt,
          resourceVersion: room.version,
          policyVersion: policy.version,
        },
      ],
      generatedAt,
    }));
    api.create.mockResolvedValue({ eventId: 'saved-event' });
    api.update.mockResolvedValue(recurringEvent);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  async function render(options: {
    allowRecurring: boolean;
    recurrencePolicyEnabled?: boolean;
    event?: CalendarEvent;
    target?: CalendarResource;
    open?: boolean;
  }) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <RoomBookingDialog
            open={options.open ?? true}
            room={options.target ?? room}
            initialStart={startsAt}
            initialEnd={endsAt}
            policy={policy}
            allowRecurring={options.allowRecurring}
            recurrencePolicyEnabled={options.recurrencePolicyEnabled}
            event={options.event}
            onClose={api.close}
            onSaved={api.saved}
          />
        </QueryClientProvider>
      );
    });
    await settle();
  }

  async function settle() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  async function change(selector: string, value: string) {
    const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
    expect(input).not.toBeNull();
    await act(async () => {
      const prototype =
        input instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
      input?.dispatchEvent(new Event('change', { bubbles: true }));
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle();
  }

  async function fillSubject() {
    await change('input[aria-label="booking.subject"]', 'Recurring room review');
  }

  async function submit() {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="submit"]');
    expect(button?.disabled).toBe(false);
    await act(async () => button?.click());
    await settle();
  }

  it('previews and submits a finite recurrence when Workplace policy allows it', async () => {
    await render({ allowRecurring: true });
    await fillSubject();
    await change('select[aria-label="booking.recurrence"]', 'WEEKLY');
    await change('select[aria-label="booking.recurrenceInterval"]', '2');
    await change('input[aria-label="booking.recurrenceUntil"]', '2026-12-08');

    const preview = document.querySelector('[data-testid="room-booking-recurrence-preview"]');
    expect(preview?.textContent).toContain('3:2026-11-10:2026-12-08:Asia/Seoul');
    expect(preview?.textContent).toContain('2026-11-10');
    expect(preview?.textContent).toContain('2026-11-24');
    expect(preview?.textContent).toContain('2026-12-08');

    await submit();

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: 'WEEKLY',
        recurrenceInterval: 2,
        recurrenceUntil: '2026-12-08',
        recurrenceDays: ['TUESDAY'],
        recurrenceCount: null,
        idempotencyKey: 'room-recurrence-intent',
      }),
      expect.objectContaining({ expectedDecisionRevision: 'verified-room-action' })
    );
    expect(telemetry.events.binding).toHaveBeenCalledWith({
      productKey: 'workplace',
      surfaceKey: 'workplace.work',
      taskKind: 'WORK',
    });
    expect(telemetry.events.begin).toHaveBeenCalledTimes(1);
    expect(telemetry.events.complete).toHaveBeenCalledTimes(1);
    expect(telemetry.events.fail).not.toHaveBeenCalled();
    expect(telemetry.events.abandon).not.toHaveBeenCalled();
  });

  it('forces a stale recurrence back to NONE when policy turns off', async () => {
    await render({ allowRecurring: true });
    await fillSubject();
    await change('select[aria-label="booking.recurrence"]', 'DAILY');
    await change('input[aria-label="booking.recurrenceUntil"]', '2026-11-12');

    await render({ allowRecurring: false });
    expect(document.querySelector('select[aria-label="booking.recurrence"]')).toBeNull();
    await submit();

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: 'NONE',
        recurrenceInterval: 1,
        recurrenceUntil: null,
        recurrenceDays: [],
        recurrenceCount: null,
      }),
      expect.anything()
    );
  });

  it('explains and locks a grandfathered series when recurring policy is disabled', async () => {
    await render({
      allowRecurring: true,
      recurrencePolicyEnabled: false,
      event: recurringEvent,
    });

    expect(
      document.querySelector('[data-testid="room-booking-recurrence-policy-locked"]')?.textContent
    ).toContain('booking.recurrencePolicyLocked');
    for (const label of [
      'booking.start',
      'booking.end',
      'booking.recurrence',
      'booking.recurrenceInterval',
      'booking.recurrenceUntil',
    ]) {
      expect(
        document.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)
          ?.disabled
      ).toBe(true);
    }

    await submit();
    expect(api.update).toHaveBeenCalledWith(
      recurringEvent.eventId,
      expect.objectContaining({
        startsAt,
        endsAt,
        recurrence: 'WEEKLY',
        recurrenceInterval: 1,
        recurrenceUntil: '2026-12-08',
        version: recurringEvent.version,
      }),
      expect.objectContaining({ expectedDecisionRevision: 'verified-room-action' })
    );
  });

  it('starts a new attempt after failure and abandons on target change or close without identifiers', async () => {
    api.create.mockRejectedValueOnce(new Error('definitive failure'));
    await render({ allowRecurring: false });
    await fillSubject();
    await submit();
    expect(telemetry.events.fail).toHaveBeenCalledTimes(1);

    api.create.mockResolvedValueOnce({ eventId: 'retry-saved-event' });
    await change('input[aria-label="booking.subject"]', 'Corrected room review');
    await submit();
    expect(telemetry.events.begin).toHaveBeenCalledTimes(2);
    expect(telemetry.events.complete).toHaveBeenCalledTimes(1);

    const nextRoom = { ...room, resourceId: '19000000-0000-4000-8000-000000000002' };
    const thirdRoom = { ...room, resourceId: '19000000-0000-4000-8000-000000000003' };
    api.availability.mockImplementation(async (from: string, to: string) => ({
      rooms: [nextRoom, thirdRoom],
      occupancy: [],
      bookingEligibility: [nextRoom, thirdRoom].map((candidate) => ({
        resourceId: candidate.resourceId,
        eligible: true,
        reasonCode: 'ELIGIBLE',
        evaluatedFrom: from,
        evaluatedTo: to,
        excludedEventId: null,
        evaluatedAt: generatedAt,
        resourceVersion: candidate.version,
        policyVersion: policy.version,
      })),
      generatedAt,
    }));
    await render({ allowRecurring: false, target: nextRoom });
    expect(telemetry.events.begin).toHaveBeenCalledTimes(3);
    await render({ allowRecurring: false, target: thirdRoom });
    expect(telemetry.events.begin).toHaveBeenCalledTimes(4);
    expect(telemetry.events.abandon).toHaveBeenCalledTimes(1);
    document.querySelector<HTMLButtonElement>('[data-testid="close"]')?.click();
    expect(telemetry.events.abandon).toHaveBeenCalledTimes(2);
    expect(telemetry.events.binding.mock.calls.flat().join(':')).not.toContain(room.resourceId);
    expect(telemetry.events.binding.mock.calls.flat().join(':')).not.toContain(nextRoom.resourceId);
    expect(telemetry.events.binding.mock.calls.flat().join(':')).not.toContain(
      thirdRoom.resourceId
    );
  });
});
