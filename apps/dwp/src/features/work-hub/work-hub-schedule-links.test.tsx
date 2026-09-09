// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubScheduleLinks } from './work-hub-schedule-links';
import { verifiedWorkHubSnapshotFromRefetch } from './work-hub-page-helpers';
import { hubItem, snapshot } from './work-hub.test-support';

import type { CalendarEvent } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkCalendarLink } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const item = hubItem();
const link = {
  linkId: '36e6e854-ec64-456c-8bcc-46a7d5ba97f2',
  work: item.reference,
  eventId: 'b4cbdbdf-ff5a-4a95-8937-8360e6f2194e',
  state: 'LINKED',
  version: 3,
  calendarAvailability: 'REFERENCE_ONLY',
} as WorkCalendarLink;
const event = {
  eventId: link.eventId,
  title: 'Focus on brief',
  startsAt: '2026-09-04T09:00:00Z',
  endsAt: '2026-09-04T10:00:00Z',
  status: 'CONFIRMED',
} as CalendarEvent;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
const theme = createTheme({ shape: { borderRadius: 11 } });

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

async function render(props: Partial<ComponentProps<typeof WorkHubScheduleLinks>> = {}) {
  const defaults: ComponentProps<typeof WorkHubScheduleLinks> = {
    item,
    ownerFingerprint: 'tenant-1:user-900018',
    from: '2026-01-01T00:00:00Z',
    to: '2027-01-01T00:00:00Z',
    canUnlink: true,
    preflight: vi.fn().mockResolvedValue(snapshot([item])),
    loadSchedules: vi.fn().mockResolvedValue({
      state: 'LOADED',
      items: [{ link, event, state: 'AVAILABLE' }],
    }),
    unlinkSchedule: vi.fn().mockResolvedValue({
      link: { ...link, state: 'REMOVED', version: 4 },
      calendarChanged: false,
      sourceChanged: false,
    }),
    onOpenCalendar: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <ThemeProvider theme={theme}>
          <WorkHubScheduleLinks {...merged} />
        </ThemeProvider>
      </QueryClientProvider>
    )
  );
  await settle();
  return merged;
}

function exactButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

describe('WorkHubScheduleLinks', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

  it('shows a generic state for inaccessible Calendar data without exposing opaque ids', async () => {
    await render({
      loadSchedules: vi.fn().mockResolvedValue({
        state: 'PARTIAL',
        items: [{ link, event: null, state: 'UNAVAILABLE' }],
      }),
    });

    expect(document.body.textContent).toContain('workHub.scheduleLinks.partial');
    expect(document.body.textContent).toContain('workHub.scheduleLinks.detailsUnavailable');
    expect(document.body.textContent).not.toContain(link.linkId);
    expect(document.body.textContent).not.toContain(link.eventId);
  });

  it('resolves the linked Calendar card radius from the active theme to CSS pixels', async () => {
    await render();

    const card = document.querySelector<HTMLElement>('[data-testid="work-hub-schedule-link-card"]');

    expect(card).not.toBeNull();
    expect(getComputedStyle(card!).borderRadius).toBe('11px');
  });

  it('removes only the personal link after confirmation and keeps the confirmed result visible', async () => {
    const preflight = vi.fn().mockResolvedValue(snapshot([item]));
    const current = {
      state: 'LOADED',
      items: [{ link, event, state: 'AVAILABLE' }],
    } as const;
    const loadSchedules = vi
      .fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValue({ ...current, state: 'PARTIAL' as const });
    const unlinkSchedule = vi.fn().mockResolvedValue({
      link: { ...link, state: 'REMOVED', version: 4 },
      calendarChanged: false,
      sourceChanged: false,
    });
    await render({ preflight, loadSchedules, unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
    await settle();

    expect(unlinkSchedule).toHaveBeenCalledWith(
      link,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        canContinue: expect.any(Function),
      })
    );
    expect(preflight).toHaveBeenCalledOnce();
    expect(preflight.mock.invocationCallOrder[0]).toBeLessThan(
      loadSchedules.mock.invocationCallOrder[1]!
    );
    expect(loadSchedules.mock.invocationCallOrder[1]).toBeLessThan(
      unlinkSchedule.mock.invocationCallOrder[0]!
    );
    expect(document.body.textContent).toContain('workHub.scheduleLinks.unlinked');
    expect(document.body.textContent).not.toContain(event.title);
  });

  it('closes an open unlink preview and performs no mutation after command access is revoked', async () => {
    const unlinkSchedule = vi.fn();
    await render({ unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    expect(exactButton('workHub.scheduleLinks.confirm')).toBeDefined();

    await render({ canUnlink: false, unlinkSchedule });

    await act(async () => exactButton('workHub.scheduleLinks.confirm')?.click());
    expect(unlinkSchedule).not.toHaveBeenCalled();
  });

  it('performs no unlink when the fresh aggregate snapshot is unavailable', async () => {
    const preflight = vi.fn().mockResolvedValue(null);
    const unlinkSchedule = vi.fn();
    await render({ preflight, unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
    await settle();

    expect(preflight).toHaveBeenCalledOnce();
    expect(unlinkSchedule).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('workHub.scheduleLinks.unlinkFailed');
  });

  it('rejects cached READY data when its React Query refetch failed', async () => {
    const cachedSnapshot = snapshot([item]);
    const preflight = vi.fn().mockResolvedValue(
      verifiedWorkHubSnapshotFromRefetch({
        data: { snapshot: cachedSnapshot },
        isSuccess: true,
        isRefetchError: true,
      })
    );
    const unlinkSchedule = vi.fn();
    await render({ preflight, unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
    await settle();

    expect(preflight).toHaveBeenCalledOnce();
    expect(unlinkSchedule).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('workHub.scheduleLinks.unlinkFailed');
  });

  it.each([
    ['missing', 'LOADED', []],
    ['removed', 'LOADED', [{ ...link, state: 'REMOVED' as const }]],
    ['version drift', 'LOADED', [{ ...link, version: link.version + 1 }]],
    ['event drift', 'LOADED', [{ ...link, eventId: '85fdccda-1ba0-4c7d-9829-189db4da0b4d' }]],
    [
      'work drift',
      'LOADED',
      [
        {
          ...link,
          work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'another-task' },
        },
      ],
    ],
    ['duplicate', 'LOADED', [link, { ...link }]],
    ['retained through an unavailable read', 'UNAVAILABLE', [link]],
  ] as const)(
    'performs no unlink when the current relationship is %s',
    async (_label, state, links) => {
      const current = {
        state: 'LOADED' as const,
        items: [{ link, event, state: 'AVAILABLE' as const }],
      };
      const loadSchedules = vi
        .fn()
        .mockResolvedValueOnce(current)
        .mockResolvedValueOnce({
          state,
          items: links.map((candidate) => ({ link: candidate, event, state: 'AVAILABLE' })),
        })
        .mockResolvedValue(current);
      const unlinkSchedule = vi.fn();
      await render({ loadSchedules, unlinkSchedule });
      await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
      await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
      await settle();

      expect(loadSchedules.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(unlinkSchedule).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain('workHub.scheduleLinks.unlinkFailed');
    }
  );

  it('aborts unlink on owner change and suppresses a late success callback', async () => {
    let finish!: (
      value: Awaited<ReturnType<ComponentProps<typeof WorkHubScheduleLinks>['unlinkSchedule']>>
    ) => void;
    let observedSignal: AbortSignal | undefined;
    const unlinkSchedule = vi.fn((_link, guard) => {
      observedSignal = guard?.signal;
      return new Promise<
        Awaited<ReturnType<ComponentProps<typeof WorkHubScheduleLinks>['unlinkSchedule']>>
      >((resolve) => {
        finish = resolve;
      });
    });
    await render({ unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
    expect(unlinkSchedule).toHaveBeenCalledOnce();

    await render({ ownerFingerprint: 'tenant-b:user-b:calendar-view', unlinkSchedule });
    expect(observedSignal?.aborted).toBe(true);
    await act(async () =>
      finish({
        link: { ...link, state: 'REMOVED', version: 4 },
        calendarChanged: false,
        sourceChanged: false,
      })
    );
    await settle();

    expect(document.body.textContent).not.toContain('workHub.scheduleLinks.unlinked');
  });

  it('reconciles authoritative links after a terminal unlink conflict', async () => {
    const loadSchedules = vi.fn().mockResolvedValue({
      state: 'LOADED',
      items: [{ link, event, state: 'AVAILABLE' }],
    });
    const unlinkSchedule = vi.fn().mockRejectedValue(new HttpError('conflict', 409));
    await render({ loadSchedules, unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
    await settle();

    expect(document.body.textContent).toContain('workHub.scheduleLinks.unlinkFailed');
    expect(loadSchedules.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('refreshes a same-owner remount after a late unlink receipt', async () => {
    let finish!: (
      value: Awaited<ReturnType<ComponentProps<typeof WorkHubScheduleLinks>['unlinkSchedule']>>
    ) => void;
    const unlinkSchedule = vi.fn(
      () =>
        new Promise<
          Awaited<ReturnType<ComponentProps<typeof WorkHubScheduleLinks>['unlinkSchedule']>>
        >((resolve) => {
          finish = resolve;
        })
    );
    const current = {
      state: 'LOADED' as const,
      items: [{ link, event, state: 'AVAILABLE' as const }],
    };
    const loadSchedules = vi
      .fn()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockResolvedValue({ state: 'LOADED', items: [] });
    await render({ loadSchedules, unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());

    await act(async () => root.render(<QueryClientProvider client={client} />));
    await render({ loadSchedules, unlinkSchedule });
    expect(document.body.textContent).toContain(event.title);

    await act(async () =>
      finish({
        link: { ...link, state: 'REMOVED', version: 4 },
        calendarChanged: false,
        sourceChanged: false,
      })
    );
    await settle();

    expect(loadSchedules.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toContain(event.title);
  });
});
