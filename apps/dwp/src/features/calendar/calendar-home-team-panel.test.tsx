// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { CalendarHomeTeamPanel } from './calendar-home-team-panel';

import type { Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import type { CalendarTeamAvailabilitySnapshot } from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  permission: vi.fn((_resource: string, _action: string) => true),
  auth: { isAuthenticated: true, user: { tenantId: 1, userId: 2 } },
}));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getCalendarTeamAvailabilitySnapshot: mocks.request,
  useAuth: () => mocks.auth,
  usePermissions: () => ({ hasPermission: mocks.permission }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));

function snapshot(
  overrides: Partial<CalendarTeamAvailabilitySnapshot> = {}
): CalendarTeamAvailabilitySnapshot {
  return {
    date: '2026-09-04',
    timeZone: 'Asia/Seoul',
    generatedAt: new Date(Date.now()).toISOString(),
    validUntil: new Date(Date.now() + 30_000).toISOString(),
    source: 'DWP_NATIVE_CALENDAR',
    scope: 'SHARED_WITH_ME',
    hasMore: false,
    members: [
      {
        personPublicId: 'person/a+b',
        displayName: 'Kim Shared',
        status: 'AVAILABLE',
        busyUntil: null,
        nextAvailableAt: new Date(Date.now()).toISOString(),
        busyMinutes: 0,
        busyWindows: [],
      },
    ],
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
async function flush() {
  for (let index = 0; index < 3; index += 1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
}
async function render(props: Partial<ComponentProps<typeof CalendarHomeTeamPanel>> = {}) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          null,
          createElement(CalendarHomeTeamPanel, {
            state: 'READY',
            timeZone: 'Asia/Seoul',
            language: 'en',
            currentSearch: '?scope=team&tz=Asia%2FSeoul',
            ...props,
          })
        )
      )
    );
  });
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-04T00:40:00Z'));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.auth = { isAuthenticated: true, user: { tenantId: 1, userId: 2 } };
  mocks.permission.mockReset().mockReturnValue(true);
  mocks.request.mockReset().mockImplementation(async () => snapshot());
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

describe('CalendarHomeTeamPanel privacy and navigation', () => {
  it('requests with AbortSignal and actor/tenant/time-zone isolated cache identity', async () => {
    await render();
    expect(mocks.request).toHaveBeenCalledWith('Asia/Seoul', expect.any(AbortSignal));
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'calendar',
      'team-availability',
      '1',
      '2',
      'Asia/Seoul',
      0,
    ]);
    expect(container.textContent).toContain('Kim Shared');
    expect(container.textContent).toContain('workspace.team.scope');
    const link = container.querySelector('a[aria-label*="Kim Shared"]');
    expect(link?.getAttribute('href')).toContain('person=person%2Fa%2Bb');
    expect(link?.getAttribute('href')).toContain('scope=team');
  });

  it.each(['LOADING', 'STALE', 'DENIED', 'UNAVAILABLE'] as const)(
    'never requests while the rail is %s',
    async (state) => {
      await render({ state });
      expect(mocks.request).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('Kim Shared');
    }
  );

  it('requires both calendar and directory permission', async () => {
    mocks.permission.mockImplementation((...args: unknown[]) => args[0] !== 'APP.PEOPLE_DIRECTORY');
    await render();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(container.textContent).toContain('workspace.team.denied');
  });

  it('clears displayed and cached members synchronously when rail authority changes', async () => {
    await render();
    await render({ state: 'STALE' });
    expect(container.textContent).not.toContain('Kim Shared');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('aborts in-flight reads when directory permission is revoked', async () => {
    let signal: AbortSignal | undefined;
    mocks.request.mockImplementation((_zone: string, requestSignal: AbortSignal) => {
      signal = requestSignal;
      return new Promise(() => {});
    });
    await render();
    mocks.permission.mockReturnValue(false);
    await render();
    expect(signal?.aborted).toBe(true);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('discards data on refresh failure and requires an explicit retry', async () => {
    await render();
    mocks.request.mockRejectedValue(new HttpError('Denied', 403));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['calendar', 'team-availability'] });
    });
    await flush();
    expect(container.textContent).not.toContain('Kim Shared');
    expect(container.textContent).toContain('workspace.team.denied');
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => query.state.data === undefined)
    ).toBe(true);
    const count = mocks.request.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(mocks.request).toHaveBeenCalledTimes(count);
    mocks.request.mockImplementation(async () => snapshot());
    await act(async () => {
      container.querySelector('button')?.click();
    });
    await flush();
    expect(container.textContent).toContain('Kim Shared');
  });

  it('expires a short-lived sharing grant immediately and fetches a fresh snapshot', async () => {
    mocks.request
      .mockResolvedValueOnce(snapshot({ validUntil: new Date(Date.now() + 1000).toISOString() }))
      .mockImplementation(() => new Promise(() => {}));
    await render();
    expect(container.textContent).toContain('Kim Shared');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flush();
    expect(container.textContent).not.toContain('Kim Shared');
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => query.state.data === undefined)
    ).toBe(true);
  });

  it('refreshes an accepted snapshot after a clock jump without retaining expired identities', async () => {
    await render();
    expect(container.textContent).toContain('Kim Shared');
    let finish: ((data: CalendarTeamAvailabilitySnapshot) => void) | undefined;
    mocks.request.mockImplementation(
      () =>
        new Promise<CalendarTeamAvailabilitySnapshot>((resolve) => {
          finish = resolve;
        })
    );
    // Render after expiry but before the old timeout fires, matching a suspended tab.
    vi.setSystemTime(new Date(Date.now() + 31_000));
    await render();
    expect(container.textContent).not.toContain('Kim Shared');
    expect(container.textContent).not.toContain('workspace.team.expired');
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => !query.state.data)
    ).toBe(true);
    await act(async () => {
      finish?.(snapshot({ members: [] }));
    });
    await flush();
    expect(container.textContent).toContain('workspace.team.empty');
  });

  it('rechecks authority after normal expiry and stops polling on the resulting 403', async () => {
    await render();
    expect(container.textContent).toContain('Kim Shared');
    mocks.request.mockRejectedValue(new HttpError('Denied', 403));
    vi.setSystemTime(new Date(Date.now() + 31_000));
    await render();
    await flush();
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('Kim Shared');
    expect(container.textContent).toContain('workspace.team.denied');
    expect(container.textContent).not.toContain('workspace.team.expired');
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => !query.state.data)
    ).toBe(true);
    const count = mocks.request.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(91_000);
    });
    await flush();
    expect(mocks.request).toHaveBeenCalledTimes(count);
    expect(container.textContent).not.toContain('Kim Shared');
  });

  it.each([
    { validUntil: '2026-09-04T00:39:59Z' },
    { validUntil: '2026-09-04T00:42:00Z' },
    { generatedAt: '2026-09-04T00:41:00Z' },
    { date: '2026-09-03' },
    { timeZone: 'UTC' },
  ])('rejects invalid, expired or mismatched response %j', async (overrides) => {
    mocks.request.mockResolvedValue(snapshot(overrides));
    await render();
    expect(container.textContent).not.toContain('Kim Shared');
    expect(container.textContent).toContain('workspace.team.expired');
    const count = mocks.request.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    await flush();
    expect(mocks.request).toHaveBeenCalledTimes(count);
  });

  it('drops old identity results during a tenant switch', async () => {
    let finish: ((data: CalendarTeamAvailabilitySnapshot) => void) | undefined;
    let oldSignal: AbortSignal | undefined;
    mocks.request.mockImplementationOnce((_zone: string, signal: AbortSignal) => {
      oldSignal = signal;
      return new Promise<CalendarTeamAvailabilitySnapshot>((resolve) => {
        finish = resolve;
      });
    });
    await render();
    mocks.auth = { isAuthenticated: true, user: { tenantId: 9, userId: 10 } };
    mocks.request.mockResolvedValue(snapshot({ members: [] }));
    await render();
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      finish?.(snapshot());
    });
    await flush();
    expect(container.textContent).not.toContain('Kim Shared');
    expect(
      client
        .getQueryCache()
        .getAll()
        .every((query) => query.queryKey[2] === '9')
    ).toBe(true);
  });

  it('routes empty sharing state and more-members navigation to schedule', async () => {
    mocks.request.mockResolvedValue(snapshot({ members: [], hasMore: true }));
    await render();
    expect(container.textContent).toContain('workspace.team.empty');
    expect(container.textContent).toContain('workspace.team.more');
    for (const link of container.querySelectorAll('a'))
      expect(link.getAttribute('href')).toContain('/calendar/schedule');
  });
});
