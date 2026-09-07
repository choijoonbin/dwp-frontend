// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canRetryScheduleResult,
  resolveScheduleCalendarId,
  WorkHubScheduleDialog,
} from './work-hub-schedule-dialog';
import { hubItem } from './work-hub.test-support';

import type { CalendarEvent, CalendarSummary } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkCalendarLink } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import type { WorkScheduleCommand, WorkScheduleResult } from './work-hub-scheduling';
import type { WorkHubItem } from './work-hub-contracts';
import type { Root } from 'react-dom/client';

const { getCalendars } = vi.hoisted(() => ({ getCalendars: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/calendar-api', () => ({
  getCalendars: (...args: unknown[]) => getCalendars(...args),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const calendar = {
  calendarId: 'calendar-one',
  name: 'My calendar',
  type: 'PERSONAL',
  capabilities: { canCreateEvents: true },
} as CalendarSummary;
const command = {
  linkId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
  work: hubItem().reference,
  eventInput: {
    calendarId: calendar.calendarId,
    title: 'Review the task',
    startsAt: '2026-09-04T09:00:00.000Z',
    endsAt: '2026-09-04T10:00:00.000Z',
    timeZone: 'Asia/Seoul',
  },
} as WorkScheduleCommand;
const event = {
  eventId: 'event-one',
  calendarId: calendar.calendarId,
  type: 'FOCUS',
} as CalendarEvent;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

function exactButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

async function render(
  execute: (command: WorkScheduleCommand, event?: CalendarEvent) => Promise<WorkScheduleResult>,
  prepare = vi.fn(() => command)
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkHubScheduleDialog
          open
          item={hubItem()}
          onClose={vi.fn()}
          onOpenCalendar={vi.fn()}
          prepare={prepare}
          execute={execute}
        />
      </QueryClientProvider>
    )
  );
  await settle();
  return prepare;
}

describe('WorkHubScheduleDialog', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    getCalendars.mockReset().mockResolvedValue([calendar]);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    document.body.replaceChildren();
  });

  it('falls back from a stale calendar selection and only retries retryable results', () => {
    expect(resolveScheduleCalendarId('removed-calendar', [calendar])).toBe(calendar.calendarId);
    expect(resolveScheduleCalendarId(calendar.calendarId, [calendar])).toBe(calendar.calendarId);
    expect(
      canRetryScheduleResult({
        state: 'CALENDAR_REJECTED',
        command,
        sourceChanged: false,
        reason: 'FORBIDDEN',
        retryable: false,
      })
    ).toBe(false);
  });

  it('leaves only Calendar navigation and close after a non-retryable rejection', async () => {
    await render(async () => ({
      state: 'CALENDAR_REJECTED',
      command,
      sourceChanged: false,
      reason: 'FORBIDDEN',
      retryable: false,
    }));
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    expect(exactButton('work:workHub.schedule.create')).toBeUndefined();
    expect(exactButton('work:workHub.schedule.openCalendar')).toBeDefined();
    expect(document.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
  });

  it('replays the exact command and confirmed event when only link persistence is pending', async () => {
    const link = { state: 'LINKED' } as WorkCalendarLink;
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'LINK_PENDING',
        command,
        event,
        sourceChanged: false,
        reason: 'UNAVAILABLE',
        retryable: true,
      })
      .mockResolvedValueOnce({
        state: 'SCHEDULED',
        command,
        event,
        link,
        sourceChanged: false,
      });
    const prepare = await render(execute);
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();
    await act(async () => exactButton('work:workHub.schedule.retryLink')!.click());
    await settle();

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls).toEqual([
      [command, undefined],
      [command, event],
    ]);
  });

  it('keeps a confirmed Calendar receipt when the dialog closes before link recovery', async () => {
    const link = { state: 'LINKED' } as WorkCalendarLink;
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        state: 'LINK_PENDING',
        command,
        event,
        sourceChanged: false,
        reason: 'UNAVAILABLE',
        retryable: true,
      })
      .mockResolvedValueOnce({
        state: 'SCHEDULED',
        command,
        event,
        link,
        sourceChanged: false,
      });
    const prepare = vi.fn(() => command);
    const selected = hubItem();
    const renderState = async (open: boolean, item: WorkHubItem | null) => {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <WorkHubScheduleDialog
              open={open}
              item={item}
              onClose={vi.fn()}
              onOpenCalendar={vi.fn()}
              prepare={prepare}
              execute={execute}
            />
          </QueryClientProvider>
        )
      );
      await settle();
    };

    await renderState(true, selected);
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();
    await renderState(false, null);
    await renderState(true, selected);

    expect(exactButton('work:workHub.schedule.retryLink')).toBeDefined();
    await act(async () => exactButton('work:workHub.schedule.retryLink')!.click());
    await settle();

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls).toEqual([
      [command, undefined],
      [command, event],
    ]);
  });
});
