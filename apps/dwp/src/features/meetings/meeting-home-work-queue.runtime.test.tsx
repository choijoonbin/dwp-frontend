// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Api from '@dwp-frontend/shared-utils/api/work-assignment-api';
import type { WorkAssignmentTask } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import { HttpError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/work-assignment-api', async (original) => ({
  ...(await original<typeof Api>()),
  getWorkAssignments: runtime.list,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string; title?: string }) =>
      options?.date ?? options?.title ?? key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

import { MeetingHomeWorkQueue } from './meeting-home-work-queue';

const task = (index: number, overrides: Partial<WorkAssignmentTask> = {}): WorkAssignmentTask => ({
  assignmentId: `99000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  createdByUserId: 9,
  assignedByUserId: 9,
  assigneeUserId: 7,
  title: `Follow-up ${index}`,
  description: null,
  priority: 'NORMAL',
  dueAt: `2026-09-${String(Math.min(index, 30)).padStart(2, '0')}T00:00:00Z`,
  assignmentState: 'ACCEPTED',
  workState: 'OPEN',
  assignmentRevision: 1,
  version: 2,
  source: {
    availability: 'NOT_REQUESTED',
    reference: null,
    sourceVersion: null,
    sourceRoute: null,
  },
  capabilities: {
    canAccept: false,
    canDecline: false,
    canStart: true,
    canWait: true,
    canComplete: true,
    canReassign: false,
    canCancel: false,
  },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  acceptedAt: '2026-09-01T00:00:00Z',
  completedAt: null,
  ...overrides,
});

const page = (items: WorkAssignmentTask[]) => ({
  items,
  page: 0,
  size: 20,
  totalElements: items.length,
  hasMore: false,
});

let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;

async function render() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount = document.createElement('div');
  document.body.appendChild(mount);
  root = createRoot(mount);
  router = createMemoryRouter(
    [
      {
        path: '/',
        element: createElement(MeetingHomeWorkQueue, {
          scope: 'tenant-1:user-7',
          actorId: 7,
          timeZone: 'UTC',
        }),
      },
      {
        path: '/meetings/follow-ups',
        element: createElement('div', null, 'Follow-up destination'),
      },
    ],
    { initialEntries: ['/'] }
  );
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    );
  });
}

async function settle() {
  await act(async () => {
    await vi.waitFor(() => expect(runtime.list).toHaveBeenCalled());
  });
}

describe('Meeting home Work queue runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    runtime.list.mockReset();
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    router?.dispose();
    client?.clear();
    mount?.remove();
  });

  it('renders an explicit loading state while current Work access is unresolved', async () => {
    runtime.list.mockReturnValue(new Promise(() => undefined));
    await render();
    expect(mount.textContent).toContain('home.workQueue.loading');
  });

  it('shows at most six overdue unfinished items and excludes terminal work', async () => {
    runtime.list.mockResolvedValue(
      page([
        ...Array.from({ length: 8 }, (_, index) => task(index + 1)),
        task(20, { workState: 'COMPLETED' }),
        task(21, { assignmentState: 'DECLINED' }),
      ])
    );
    await render();
    await settle();
    await act(async () => {
      await vi.waitFor(() => expect(mount.textContent).toContain('Follow-up 1'));
    });
    expect(mount.querySelectorAll('article')).toHaveLength(6);
    expect(mount.textContent).toContain('home.workQueue.overdue');
    expect(mount.textContent).not.toContain('Follow-up 20');
    expect(mount.textContent).not.toContain('Follow-up 21');
    expect(
      JSON.stringify(client.getQueryData(['meetings', 'home', 'work-queue', 'tenant-1:user-7']))
    ).not.toContain('source');
  });

  it('clears previously authorized content when refresh is denied', async () => {
    runtime.list.mockResolvedValue(page([task(1)]));
    await render();
    await settle();
    await act(async () => {
      await vi.waitFor(() => expect(mount.textContent).toContain('Follow-up 1'));
    });
    runtime.list.mockRejectedValue(new HttpError('Forbidden', 403));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['meetings', 'home', 'work-queue'] });
      await vi.waitFor(() => expect(mount.textContent).toContain('home.workQueue.errorTitle'));
    });
    expect(mount.textContent).not.toContain('Follow-up 1');
    expect(mount.textContent).toContain('home.workQueue.errorTitle');
  });

  it('opens the canonical Meeting follow-up destination', async () => {
    runtime.list.mockResolvedValue(page([task(1)]));
    await render();
    await settle();
    await act(async () => {
      await vi.waitFor(() => expect(mount.textContent).toContain('Follow-up 1'));
    });
    const open = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent === 'home.workQueue.openAll'
    );
    await act(async () => open?.click());
    expect(mount.textContent).toContain('Follow-up destination');
  });
});
