// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { CalendarEventRemindersEditor } from './calendar-event-reminders-editor';

import type { Root } from 'react-dom/client';
import type { CalendarReminderSet } from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  getReminders: vi.fn(),
  updateReminders: vi.fn(),
  getCapabilities: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getCalendarEventReminders: mocks.getReminders,
  updateCalendarEventReminders: mocks.updateReminders,
  getNotificationCapabilities: mocks.getCapabilities,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const EVENT_ID = '00ba0853-02a8-7499-b6d8-009251e6a464';

function reminderSet(overrides: Partial<CalendarReminderSet> = {}): CalendarReminderSet {
  return {
    eventId: EVENT_ID,
    eventVersion: 8,
    version: 2,
    state: 'ACTIVE',
    reminders: [
      {
        reminderId: 'reminder-1',
        offsetMinutes: 10,
        channel: 'IN_APP',
        nextOccurrenceStartsAt: null,
        nextDueAt: null,
      },
    ],
    updatedAt: null,
    ...overrides,
  };
}

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

async function flush() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.getReminders.mockReset();
  mocks.updateReminders.mockReset();
  mocks.getCapabilities.mockReset().mockResolvedValue({
    enabledChannels: ['IN_APP'],
    unavailableChannels: ['EMAIL'],
    canonicalStore: 'POSTGRESQL',
    realtimeTransport: 'SSE_HINT_WITH_DURABLE_SYNC',
    externalDeliveryState: 'DISABLED',
    generatedAt: '2026-10-28T00:00:00Z',
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

async function render(event: { eventId: string; version: number } | null) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(CalendarEventRemindersEditor, { event })
      )
    );
  });
  await flush();
}

describe('CalendarEventRemindersEditor recovery', () => {
  it('keeps an invalidated set locked until review, then permits explicit unchanged reapply', async () => {
    const invalidated = reminderSet({ state: 'INVALIDATED' });
    mocks.getReminders.mockResolvedValue(invalidated);
    mocks.updateReminders.mockResolvedValue({
      ...invalidated,
      state: 'ACTIVE',
      version: 3,
    });

    await render({ eventId: EVENT_ID, version: 8 });

    expect(button(container, 'event.reminders.save')?.disabled).toBe(true);
    expect(mocks.updateReminders).not.toHaveBeenCalled();

    await act(async () => {
      button(container, 'event.reminders.reviewAndReapply')?.click();
    });
    await flush();

    expect(mocks.getReminders).toHaveBeenCalledTimes(2);
    expect(mocks.updateReminders).not.toHaveBeenCalled();
    const reapply = button(container, 'event.reminders.reapply');
    expect(reapply?.disabled).toBe(false);

    await act(async () => reapply?.click());
    await flush();

    expect(mocks.updateReminders).toHaveBeenCalledWith(EVENT_ID, {
      version: 2,
      reminders: [{ offsetMinutes: 10, channel: 'IN_APP' }],
    });
  });

  it('preserves an existing email reminder but blocks reactivation when capability is unavailable', async () => {
    mocks.getReminders.mockResolvedValue(
      reminderSet({
        state: 'INVALIDATED',
        reminders: [
          {
            reminderId: 'reminder-email',
            offsetMinutes: 10,
            channel: 'EMAIL',
            nextOccurrenceStartsAt: null,
            nextDueAt: null,
          },
        ],
      })
    );

    await render({ eventId: EVENT_ID, version: 8 });
    expect(container.textContent).toContain('event.reminders.emailUnavailable');
    expect(container.textContent).toContain('event.reminders.channels.EMAIL');

    await act(async () => {
      button(container, 'event.reminders.reviewAndReapply')?.click();
    });
    await flush();

    expect(button(container, 'event.reminders.reapply')?.disabled).toBe(true);
    expect(mocks.updateReminders).not.toHaveBeenCalled();
  });

  it('refetches after a version conflict and lets the user choose whether to keep the draft', async () => {
    const initial = reminderSet();
    mocks.getReminders.mockResolvedValueOnce(initial).mockResolvedValueOnce(
      reminderSet({
        version: 3,
        reminders: [
          {
            reminderId: 'reminder-latest',
            offsetMinutes: 60,
            channel: 'IN_APP',
            nextOccurrenceStartsAt: null,
            nextDueAt: null,
          },
        ],
      })
    );
    mocks.updateReminders.mockRejectedValue(new HttpError('Reminder version changed.', 409));

    await render({ eventId: EVENT_ID, version: 8 });
    await act(async () => {
      button(container, 'event.reminders.add')?.click();
    });
    await flush();
    expect(button(container, 'event.reminders.save')?.disabled).toBe(false);

    await act(async () => {
      button(container, 'event.reminders.save')?.click();
    });
    await flush();

    expect(mocks.getReminders).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('event.reminders.versionConflict');
    expect(button(container, 'event.reminders.keepEdits')).toBeDefined();

    await act(async () => {
      button(container, 'event.reminders.keepEdits')?.click();
    });
    await flush();

    expect(container.textContent).not.toContain('event.reminders.versionConflict');
    expect(button(container, 'event.reminders.save')?.disabled).toBe(false);
  });
});
