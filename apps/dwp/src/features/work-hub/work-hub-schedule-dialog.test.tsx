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
import { createWorkScheduleCoordinator } from './work-hub-schedule-coordinator';
import {
  persistWorkScheduleIntent,
  restoreWorkScheduleIntent,
} from './work-hub-schedule-intent-storage';

import type * as CalendarApi from '@dwp-frontend/shared-utils/api/calendar-api';
import type * as DesignSystem from '@dwp-frontend/design-system';
import type { CalendarEvent, CalendarSummary } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkCalendarLink } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import {
  type WorkScheduleCommand,
  type WorkScheduleExecutionGuard,
  type WorkScheduleResult,
} from './work-hub-scheduling';
import type { WorkHubItem } from './work-hub-contracts';
import type { Root } from 'react-dom/client';

const { getCalendars } = vi.hoisted(() => ({ getCalendars: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/calendar-api', async (importOriginal) => ({
  ...(await importOriginal<typeof CalendarApi>()),
  getCalendars: (...args: unknown[]) => getCalendars(...args),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'work:workHub.schedule.defaultTitle'
        ? `집중: ${String(options?.title ?? '')}`
        : ((
            {
              'work:workHub.schedule.serviceCode': 'WRK-C01',
              'work:workHub.schedule.serviceName': 'DWP Calendar Handoff Service',
            } as Record<string, string>
          )[key] ?? key),
  }),
}));
vi.mock('@dwp-frontend/design-system', async (importOriginal) => ({
  ...(await importOriginal<typeof DesignSystem>()),
  DateTimePickerField: ({
    label,
    value,
    onValueChange,
    disabled,
  }: DesignSystem.DateTimePickerFieldProps) => (
    <input
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
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
  reviewedItemSourceId: hubItem().sourceId,
  reviewedItemSourceStatus: hubItem().sourceStatus,
  reviewedItemVersion: hubItem().version,
  reviewedItemLifecycle: hubItem().lifecycle,
  eventInput: {
    idempotencyKey: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
    calendarId: calendar.calendarId,
    title: 'Review the task',
    type: 'FOCUS',
    startsAt: '2026-09-04T09:00:00.000Z',
    endsAt: '2026-09-04T10:00:00.000Z',
    timeZone: 'Asia/Seoul',
    allDay: false,
    visibility: 'PRIVATE',
    recurrence: 'NONE',
    recurrenceInterval: 1,
    responseRequired: false,
    attendees: [],
  },
} as WorkScheduleCommand;
const event = {
  eventId: 'b4cbdbdf-ff5a-4a95-8937-8360e6f2194e',
  calendarId: calendar.calendarId,
  calendarName: calendar.name,
  calendarColor: '#2563EB',
  organizerName: 'Current user',
  title: command.eventInput.title,
  type: 'FOCUS',
  startsAt: command.eventInput.startsAt,
  endsAt: command.eventInput.endsAt,
  timeZone: command.eventInput.timeZone,
  allDay: false,
  visibility: 'PRIVATE',
  recurrence: 'NONE',
  recurrenceInterval: 1,
  responseRequired: false,
  attendees: [],
  status: 'CONFIRMED',
  conflict: false,
  version: 0,
} as CalendarEvent;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
const ownerFingerprint = 'tenant-1:user-900018';

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

function exactButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

async function render(
  execute: (
    command: WorkScheduleCommand,
    event?: CalendarEvent,
    guard?: WorkScheduleExecutionGuard
  ) => Promise<WorkScheduleResult>,
  prepare: () => WorkScheduleCommand = vi.fn(() => command)
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkHubScheduleDialog
          open
          item={hubItem()}
          ownerFingerprint={ownerFingerprint}
          canSchedule
          onClose={vi.fn()}
          onOpenCalendar={vi.fn()}
          reviewHandoff={async () => true}
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
    window.sessionStorage.clear();
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
    expect(
      canRetryScheduleResult({
        state: 'CALENDAR_UNCONFIRMED',
        command,
        sourceChanged: false,
        reason: 'INVALID_RECEIPT',
        retryable: true,
      })
    ).toBe(false);
  });

  it('does not load calendars or enable submit with VIEW but without exact CREATE access', async () => {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <WorkHubScheduleDialog
            open
            item={hubItem()}
            ownerFingerprint={ownerFingerprint}
            canSchedule={false}
            onClose={vi.fn()}
            onOpenCalendar={vi.fn()}
            reviewHandoff={async () => true}
            prepare={vi.fn(() => command)}
            execute={vi.fn()}
          />
        </QueryClientProvider>
      )
    );
    await settle();

    expect(getCalendars).not.toHaveBeenCalled();
    expect(exactButton('work:workHub.schedule.create')?.disabled).toBe(true);
  });

  it('preserves edited calendar fields for metadata refreshes and resets only for a new reviewed scope or opening', async () => {
    const execute = vi.fn<() => Promise<WorkScheduleResult>>();
    const first = hubItem();
    const view = (item: WorkHubItem, open = true) => (
      <QueryClientProvider client={client}>
        <WorkHubScheduleDialog
          open={open}
          item={item}
          ownerFingerprint={ownerFingerprint}
          canSchedule
          onClose={vi.fn()}
          onOpenCalendar={vi.fn()}
          reviewHandoff={async () => true}
          prepare={vi.fn(() => command)}
          execute={execute}
        />
      </QueryClientProvider>
    );
    const input = (label: string) => {
      const direct = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
      const associated = [...document.querySelectorAll('label')].find(
        (candidate) => candidate.textContent === label
      );
      return direct ?? (document.getElementById(associated!.htmlFor) as HTMLInputElement);
    };
    const titleLabel = 'work:workHub.schedule.eventTitle';
    const startLabel = 'work:workHub.schedule.startsAt';
    const endLabel = 'work:workHub.schedule.endsAt';
    const edit = async (label: string, value: string) => {
      await act(async () => {
        const target = input(label);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          target,
          value
        );
        target.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    await act(async () => root.render(view(first)));
    await settle();
    const editedTitle = 'My reviewed focus time';
    const editedStart = '2026-09-15T08:00:00.000Z';
    const editedEnd = '2026-09-15T10:00:00.000Z';
    await edit(titleLabel, editedTitle);
    await edit(startLabel, editedStart);
    await edit(endLabel, editedEnd);

    await act(async () =>
      root.render(
        view({
          ...first,
          title: 'Updated work display metadata',
          summary: 'A refreshed source label',
        })
      )
    );
    await settle();
    expect(input(titleLabel).value).toBe(editedTitle);
    expect(input(startLabel).value).toBe(editedStart);
    expect(input(endLabel).value).toBe(editedEnd);
    expect(execute).not.toHaveBeenCalled();

    const changed = { ...first, title: 'A new reviewed work version', version: first.version + 1 };
    await act(async () => root.render(view(changed)));
    await settle();
    expect(input(titleLabel).value).toBe(`집중: ${changed.title}`);
    expect(input(startLabel).value).not.toBe(editedStart);
    expect(input(endLabel).value).not.toBe(editedEnd);
    await edit(titleLabel, editedTitle);
    await act(async () => root.render(view(changed, false)));
    await act(async () => root.render(view(changed)));
    await settle();
    expect(input(titleLabel).value).toBe(`집중: ${changed.title}`);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['calendar removed', []],
    ['calendar duplicated', [calendar, { ...calendar }]],
    ['calendar changed to team', [{ ...calendar, type: 'TEAM' }]],
    ['create permission revoked', [{ ...calendar, capabilities: { canCreateEvents: false } }]],
  ])('does not execute after a fresh %s response', async (_label, refreshedCalendars) => {
    getCalendars.mockResolvedValueOnce([calendar]).mockResolvedValueOnce(refreshedCalendars);
    const execute = vi.fn<() => Promise<WorkScheduleResult>>();
    await render(execute);

    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    expect(getCalendars).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not execute when the fresh calendar capability read fails', async () => {
    getCalendars
      .mockResolvedValueOnce([calendar])
      .mockRejectedValueOnce(new Error('calendar unavailable'));
    const execute = vi.fn<() => Promise<WorkScheduleResult>>();
    await render(execute);

    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    expect(getCalendars).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['close', 'item switch', 'unmount'] as const)(
    'does not begin, persist, or execute after async intent matching finishes following a %s',
    async (transition) => {
      const coordinator = createWorkScheduleCoordinator(ownerFingerprint);
      const begin = vi.spyOn(coordinator, 'begin');
      const execute = vi.fn<() => Promise<WorkScheduleResult>>();
      const prepare = vi.fn(() => command);
      const first = hubItem();
      const second = hubItem({
        key: 'PERSONAL_TASK:second-task:',
        reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'second-task' },
        title: 'Second task',
      });
      const view = (open: boolean, item: WorkHubItem | null) => (
        <QueryClientProvider client={client}>
          <WorkHubScheduleDialog
            open={open}
            item={item}
            ownerFingerprint={ownerFingerprint}
            canSchedule
            coordinator={coordinator}
            onClose={vi.fn()}
            onOpenCalendar={vi.fn()}
            reviewHandoff={async () => true}
            prepare={prepare}
            execute={execute}
          />
        </QueryClientProvider>
      );
      await act(async () => root.render(view(true, first)));
      await settle();

      const pendingDigests: Array<(value: ArrayBuffer) => void> = [];
      const digest = vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(
        () =>
          new Promise<ArrayBuffer>((resolve) => {
            pendingDigests.push(resolve);
          })
      );
      await act(async () => exactButton('work:workHub.schedule.create')!.click());
      await act(async () => Promise.resolve());
      expect(pendingDigests).toHaveLength(3);

      await act(async () => {
        if (transition === 'unmount') {
          root.unmount();
          root = createRoot(host);
          return;
        }
        root.render(transition === 'close' ? view(false, null) : view(true, second));
      });
      await act(async () => {
        pendingDigests.forEach((resolve) => resolve(new Uint8Array(32).buffer));
        await Promise.resolve();
      });
      await settle();

      expect(begin).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem('dwp.work.schedule-intents.v1')).toBeNull();
      digest.mockRestore();
      coordinator.dispose();
    }
  );

  it.each(['close', 'unmount'] as const)(
    'does not persist or execute when a %s happens during async intent persistence',
    async (transition) => {
      const coordinator = createWorkScheduleCoordinator(ownerFingerprint);
      const begin = vi.spyOn(coordinator, 'begin');
      const execute = vi.fn<() => Promise<WorkScheduleResult>>();
      const view = (open: boolean, item: WorkHubItem | null) => (
        <QueryClientProvider client={client}>
          <WorkHubScheduleDialog
            open={open}
            item={item}
            ownerFingerprint={ownerFingerprint}
            canSchedule
            coordinator={coordinator}
            onClose={vi.fn()}
            onOpenCalendar={vi.fn()}
            reviewHandoff={async () => true}
            prepare={vi.fn(() => command)}
            execute={execute}
          />
        </QueryClientProvider>
      );
      await act(async () => root.render(view(true, hubItem())));
      await settle();

      let digestCount = 0;
      const pendingPersistence: Array<(value: ArrayBuffer) => void> = [];
      const digest = vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(() => {
        digestCount += 1;
        if (digestCount <= 3) return Promise.resolve(new Uint8Array(32).buffer);
        return new Promise<ArrayBuffer>((resolve) => pendingPersistence.push(resolve));
      });
      await act(async () => exactButton('work:workHub.schedule.create')!.click());
      await settle();

      expect(begin).toHaveBeenCalledOnce();
      expect(pendingPersistence).toHaveLength(3);
      expect(execute).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem('dwp.work.schedule-intents.v1')).toBeNull();

      await act(async () => {
        if (transition === 'unmount') {
          root.unmount();
          root = createRoot(host);
          return;
        }
        root.render(view(false, null));
      });
      await act(async () => {
        pendingPersistence.forEach((resolve) => resolve(new Uint8Array(32).buffer));
        await Promise.resolve();
      });
      await settle();

      expect(execute).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem('dwp.work.schedule-intents.v1')).toBeNull();
      digest.mockRestore();
      coordinator.dispose();
    }
  );

  it('blocks a mismatched reload marker until the user explicitly discards it', async () => {
    await persistWorkScheduleIntent(ownerFingerprint, hubItem().key, command);
    const newLinkId = '46e6e854-ec64-456c-8bcc-46a7d5ba97f2';
    const nextCommand = {
      ...command,
      linkId: newLinkId,
      eventInput: {
        ...command.eventInput,
        idempotencyKey: newLinkId,
        title: 'A different reviewed title',
      },
    };
    const execute = vi.fn(async (submitted: WorkScheduleCommand) => ({
      state: 'CALENDAR_UNCONFIRMED' as const,
      command: submitted,
      sourceChanged: false as const,
      reason: 'UNAVAILABLE',
      retryable: true,
    }));
    await render(execute, () => nextCommand);

    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    expect(execute).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('work:workHub.schedule.previousIntentNeedsReview');

    await act(async () => exactButton('work:workHub.schedule.discardPreviousIntent')!.click());
    await settle();
    await expect(restoreWorkScheduleIntent(ownerFingerprint, hubItem().key)).resolves.toBeNull();

    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        linkId: newLinkId,
        eventInput: expect.objectContaining({ idempotencyKey: newLinkId }),
      }),
      undefined,
      expect.any(Object)
    );
  });

  it('reuses the opaque preflight id after reload when the reviewed input is exact', async () => {
    await persistWorkScheduleIntent(ownerFingerprint, hubItem().key, command);
    const newLinkId = '46e6e854-ec64-456c-8bcc-46a7d5ba97f2';
    const execute = vi.fn(async (submitted: WorkScheduleCommand) => ({
      state: 'CALENDAR_UNCONFIRMED' as const,
      command: submitted,
      sourceChanged: false as const,
      reason: 'UNAVAILABLE',
      retryable: true,
    }));
    await render(execute, () => ({
      ...command,
      linkId: newLinkId,
      eventInput: { ...command.eventInput, idempotencyKey: newLinkId },
    }));

    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        linkId: command.linkId,
        eventInput: expect.objectContaining({ idempotencyKey: command.linkId }),
      }),
      undefined,
      expect.any(Object)
    );
  });

  it('requires explicit reconciliation and discard after an invalid receipt', async () => {
    await render(async () => ({
      state: 'CALENDAR_UNCONFIRMED',
      command,
      sourceChanged: false,
      reason: 'INVALID_RECEIPT',
      retryable: true,
    }));

    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    expect(document.body.textContent).toContain('work:workHub.schedule.invalidReceiptNeedsReview');
    expect(exactButton('work:workHub.schedule.recheck')).toBeUndefined();
    expect(exactButton('work:workHub.schedule.discardPreviousIntent')).toBeDefined();
    await expect(restoreWorkScheduleIntent(ownerFingerprint, hubItem().key)).resolves.toEqual({
      linkId: command.linkId,
    });

    await act(async () => exactButton('work:workHub.schedule.discardPreviousIntent')!.click());
    await settle();

    await expect(restoreWorkScheduleIntent(ownerFingerprint, hubItem().key)).resolves.toBeNull();
    expect(exactButton('work:workHub.schedule.create')?.disabled).toBe(false);
  });

  it('retains a rejected invalid receipt across a route remount until explicit discard', async () => {
    const coordinator = createWorkScheduleCoordinator(ownerFingerprint);
    const execute = vi.fn(async () => ({
      state: 'CALENDAR_REJECTED' as const,
      command,
      sourceChanged: false as const,
      reason: 'INVALID_RECEIPT',
      retryable: true,
    }));
    const dialog = (
      <WorkHubScheduleDialog
        open
        item={hubItem()}
        ownerFingerprint={ownerFingerprint}
        canSchedule
        coordinator={coordinator}
        onClose={vi.fn()}
        onOpenCalendar={vi.fn()}
        reviewHandoff={async () => true}
        prepare={vi.fn(() => command)}
        execute={execute}
      />
    );
    const renderDialog = async (mounted: boolean) => {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>{mounted ? dialog : null}</QueryClientProvider>
        )
      );
      await settle();
    };
    await renderDialog(true);
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();

    await expect(restoreWorkScheduleIntent(ownerFingerprint, hubItem().key)).resolves.toEqual({
      linkId: command.linkId,
    });
    await renderDialog(false);
    await renderDialog(true);

    expect(document.body.textContent).toContain('work:workHub.schedule.invalidReceiptNeedsReview');
    expect(exactButton('work:workHub.schedule.recheck')).toBeUndefined();
    expect(execute).toHaveBeenCalledOnce();
    await act(async () => exactButton('work:workHub.schedule.discardPreviousIntent')!.click());
    await settle();

    await expect(restoreWorkScheduleIntent(ownerFingerprint, hubItem().key)).resolves.toBeNull();
    expect(coordinator.recover(ownerFingerprint, hubItem().key)).toBeNull();
    expect(exactButton('work:workHub.schedule.create')?.disabled).toBe(false);
    coordinator.dispose();
  });

  it('leaves only Calendar navigation and close after a non-retryable rejection', async () => {
    await render(async () => ({
      state: 'CALENDAR_REJECTED',
      command,
      sourceChanged: false,
      reason: 'FORBIDDEN',
      retryable: false,
    }));
    expect(getCalendars).toHaveBeenCalledWith(expect.any(AbortSignal));
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
      [
        command,
        undefined,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          canContinue: expect.any(Function),
        }),
      ],
      [
        command,
        event,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          canContinue: expect.any(Function),
        }),
      ],
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
              ownerFingerprint={ownerFingerprint}
              canSchedule
              onClose={vi.fn()}
              onOpenCalendar={vi.fn()}
              reviewHandoff={async () => true}
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
      [
        command,
        undefined,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          canContinue: expect.any(Function),
        }),
      ],
      [
        command,
        event,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          canContinue: expect.any(Function),
        }),
      ],
    ]);
  });

  it('keeps a late receipt with its original work while a different selection is open', async () => {
    let resolve!: (result: WorkScheduleResult) => void;
    const execute = vi.fn().mockImplementation(
      () =>
        new Promise<WorkScheduleResult>((done) => {
          resolve = done;
        })
    );
    const first = hubItem();
    const second = hubItem({ key: 'second-work', title: 'A different work item' });
    const prepare = vi.fn(() => command);
    const renderSelection = async (item: WorkHubItem) => {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <WorkHubScheduleDialog
              open
              item={item}
              ownerFingerprint={ownerFingerprint}
              canSchedule
              onClose={vi.fn()}
              onOpenCalendar={vi.fn()}
              reviewHandoff={async () => true}
              prepare={prepare}
              execute={execute}
            />
          </QueryClientProvider>
        )
      );
      await settle();
    };
    await renderSelection(first);
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await renderSelection(second);
    await act(async () =>
      resolve({
        state: 'LINK_PENDING',
        command,
        event,
        sourceChanged: false,
        reason: 'UNAVAILABLE',
        retryable: true,
      })
    );
    await settle();

    expect(document.body.textContent).toContain(second.title);
    expect(document.body.textContent).not.toContain('work:workHub.schedule.results.linkPending');
    expect(exactButton('work:workHub.schedule.create')?.disabled).toBe(false);
    await renderSelection(first);
    expect(document.body.textContent).toContain('work:workHub.schedule.results.linkPending');
    expect(exactButton('work:workHub.schedule.retryLink')).toBeDefined();
    expect(prepare).toHaveBeenCalledOnce();
  });

  it('joins an in-flight same-owner route remount before retrying the exact command', async () => {
    const coordinator = createWorkScheduleCoordinator(ownerFingerprint);
    let finishFirst!: (result: WorkScheduleResult) => void;
    const execute = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WorkScheduleResult>((resolve) => {
            finishFirst = resolve;
          })
      )
      .mockResolvedValue({
        state: 'CALENDAR_UNCONFIRMED',
        command,
        sourceChanged: false,
        reason: 'UNAVAILABLE',
        retryable: true,
      });
    const prepare = vi.fn(() => command);
    const dialog = (
      <WorkHubScheduleDialog
        open
        item={hubItem()}
        ownerFingerprint={ownerFingerprint}
        canSchedule
        coordinator={coordinator}
        onClose={vi.fn()}
        onOpenCalendar={vi.fn()}
        reviewHandoff={async () => true}
        prepare={prepare}
        execute={execute}
      />
    );
    await act(async () =>
      root.render(<QueryClientProvider client={client}>{dialog}</QueryClientProvider>)
    );
    await settle();
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();
    expect(execute).toHaveBeenCalledTimes(1);

    await act(async () => root.render(<QueryClientProvider client={client} />));
    await act(async () =>
      root.render(<QueryClientProvider client={client}>{dialog}</QueryClientProvider>)
    );
    await settle();

    expect(exactButton('work:workHub.schedule.recheck')?.disabled).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    await act(async () =>
      finishFirst({
        state: 'CALENDAR_UNCONFIRMED',
        command,
        sourceChanged: false,
        reason: 'CANCELLED',
        retryable: true,
      })
    );
    await settle();
    expect(exactButton('work:workHub.schedule.recheck')?.disabled).toBe(false);
    await act(async () => exactButton('work:workHub.schedule.recheck')!.click());
    await settle();

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.map(([submitted]) => submitted.linkId)).toEqual([
      command.linkId,
      command.linkId,
    ]);
    coordinator.dispose();
  });

  it('aborts an in-flight command and exposes no late receipt after owner access changes', async () => {
    let finish!: (result: WorkScheduleResult) => void;
    let observedSignal: AbortSignal | undefined;
    const execute = vi.fn((_command, _event, guard: WorkScheduleExecutionGuard | undefined) => {
      observedSignal = guard?.signal;
      return new Promise<WorkScheduleResult>((resolve) => {
        finish = resolve;
      });
    });
    const renderScope = async (scopeOwner: string, canSchedule: boolean) => {
      await act(async () =>
        root.render(
          <QueryClientProvider client={client}>
            <WorkHubScheduleDialog
              open
              item={hubItem()}
              ownerFingerprint={scopeOwner}
              canSchedule={canSchedule}
              onClose={vi.fn()}
              onOpenCalendar={vi.fn()}
              reviewHandoff={async () => true}
              prepare={vi.fn(() => command)}
              execute={execute}
            />
          </QueryClientProvider>
        )
      );
      await settle();
    };
    await renderScope(ownerFingerprint, true);
    await act(async () => exactButton('work:workHub.schedule.create')!.click());
    await settle();
    expect(execute).toHaveBeenCalledOnce();

    await renderScope('tenant-2:user-900019', false);
    expect(observedSignal?.aborted).toBe(true);
    await act(async () =>
      finish({
        state: 'LINK_PENDING',
        command,
        event,
        sourceChanged: false,
        reason: 'CANCELLED',
        retryable: true,
      })
    );
    await settle();

    expect(document.body.textContent).not.toContain('work:workHub.schedule.results.linkPending');
  });
});
