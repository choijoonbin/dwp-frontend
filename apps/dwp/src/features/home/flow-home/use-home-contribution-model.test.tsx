// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';

import { useHomeContributionModel } from './use-home-contribution-model';

import type {
  AppEntitlementPermission,
  HomeOverview,
  WorkspaceWorkItem,
} from '@dwp-frontend/shared-utils';
import type {
  PersonalDayPlan,
  PersonalWorkPage,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

const personalApi = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getPlan: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', () => ({
  getPersonalWorkTasks: personalApi.getTasks,
  getPersonalDayPlan: personalApi.getPlan,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === 'flow.contributions.personalPlan.title'
        ? 'Today plan'
        : key === 'flow.contributions.personalPlan.description'
          ? `Plan count ${String(values?.count ?? 0)}`
          : key,
  }),
}));

const NOW = '2026-09-07T03:00:00.000Z';
const WORK_VIEW: AppEntitlementPermission = {
  resourceType: 'APP',
  resourceKey: 'APP.WORK',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};
const WORK_DENY: AppEntitlementPermission = { ...WORK_VIEW, effect: 'DENY' };

function task(taskId: string, title: string): PersonalWorkTask {
  return {
    taskId,
    title,
    description: null,
    status: 'OPEN',
    priority: 'NORMAL',
    dueAt: null,
    source: null,
    version: 0,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
  };
}

function taskPage(...items: PersonalWorkTask[]): PersonalWorkPage<PersonalWorkTask> {
  return { items, page: 0, size: 100, totalElements: items.length, hasMore: false };
}

function emptyPlan(): PersonalDayPlan {
  return { date: '2026-09-07', version: 0, items: [], updatedAt: NOW };
}

function overview(workItems: WorkspaceWorkItem[] = []): HomeOverview {
  const unavailable = (source: string) => ({
    status: 'FORBIDDEN' as const,
    source,
    generatedAt: NOW,
    reason: null,
  });
  return {
    audience: {
      profile: 'MEMBER',
      ruleVersion: 'home-test',
      reasons: ['AUTHENTICATED_WORKFORCE_MEMBER'],
    },
    work: {
      status: 'AVAILABLE',
      source: 'DWP_WORKSPACE',
      generatedAt: NOW,
      data: {
        summary: {
          total: workItems.length,
          dueSoon: 0,
          inProgress: workItems.filter((item) => item.status === 'in-progress').length,
          waiting: 0,
          completed: workItems.filter((item) => item.status === 'completed').length,
        },
        items: workItems,
        generatedAt: NOW,
      },
      reason: null,
    },
    calendar: unavailable('DWP_CALENDAR'),
    communications: unavailable('DWP_COMMUNICATIONS'),
    activity: unavailable('DWP_ACTIVITY'),
    recommendations: unavailable('DWP_HOME_RECOMMENDATIONS'),
    generatedAt: NOW,
  };
}

function workspaceItem(title: string): WorkspaceWorkItem {
  return {
    workItemId: 'workspace-1',
    id: 'workspace-1',
    title,
    summary: 'Verified workspace source remains available.',
    dataClassification: 'INTERNAL',
    type: 'Task',
    priority: 'medium',
    status: 'in-progress',
    owner: 'Current member',
    dueAt: null,
    sourceSystem: 'WORKSPACE',
    sourceReference: 'workspace-1',
    sourceRoute: '/work/queue?item=workspace-1',
    version: 1,
    updatedAt: NOW,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

type HookInput = Parameters<typeof useHomeContributionModel>[0];

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
let input: HookInput;
let result: ReturnType<typeof useHomeContributionModel>;
let mounted: boolean;

function Probe() {
  result = useHomeContributionModel(input);
  return null;
}

async function render() {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, mounted ? createElement(Probe) : null)
    );
  });
}

async function waitFor(assertion: () => void) {
  await act(async () => {
    await vi.waitFor(assertion, { timeout: 3_000 });
  });
}

function personalTitles() {
  return result.model.buckets.action
    .filter((item) => item.providerKey === 'personal-work')
    .map((item) => item.title);
}

function personalPlanCounts() {
  return result.model.buckets.pulse
    .filter((item) => item.providerKey === 'personal-day-plan')
    .map((item) => item.count);
}

describe('Flow Home personal Work query isolation', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    personalApi.getTasks.mockReset().mockResolvedValue(taskPage());
    personalApi.getPlan.mockReset().mockResolvedValue(emptyPlan());
    client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    mounted = true;
    input = {
      tenantId: 1,
      userId: 7,
      audience: 'MEMBER',
      now: new Date(NOW),
      locale: 'en',
      timeZone: 'Asia/Seoul',
      permissions: [WORK_VIEW],
      roles: ['WORKSPACE_MEMBER'],
      accessFingerprint: 'scope-a',
      overview: overview(),
      overviewLoading: false,
      overviewFailed: false,
      notification: { loading: false, fetching: false, failed: false },
    };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('publishes a complete Flow list and count beyond the first 100 personal tasks', async () => {
    personalApi.getTasks.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(
        page === 0
          ? {
              items: Array.from({ length: 100 }, (_, index) =>
                task(`task-${index}`, `Task ${index}`)
              ),
              page: 0,
              size: 100,
              totalElements: 101,
              hasMore: true,
            }
          : {
              items: [task('task-100', 'Task 100')],
              page: 1,
              size: 100,
              totalElements: 101,
              hasMore: false,
            }
      )
    );

    await render();
    await waitFor(() => expect(personalTitles()).toHaveLength(101));
    expect(personalApi.getTasks).toHaveBeenCalledTimes(2);
    expect(
      result.model.providers.find((provider) => provider.providerKey === 'personal-work')
    ).toMatchObject({ state: 'AVAILABLE', visibleCount: 101 });
  });

  it.each([
    ['tenant', { tenantId: 2, accessFingerprint: 'scope-b' }],
    ['user', { userId: 8, accessFingerprint: 'scope-b' }],
    ['access scope', { accessFingerprint: 'scope-b' }],
  ] as const)('ignores a late personal-work response after %s changes', async (_label, change) => {
    const oldRead = deferred<PersonalWorkPage<PersonalWorkTask>>();
    const currentRead = deferred<PersonalWorkPage<PersonalWorkTask>>();
    personalApi.getTasks.mockReset();
    personalApi.getTasks
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(currentRead.promise);

    await render();
    await waitFor(() => expect(personalApi.getTasks).toHaveBeenCalledTimes(1));
    const oldSignal = personalApi.getTasks.mock.calls[0]?.[0]?.signal as AbortSignal;
    expect(oldSignal).toBeInstanceOf(AbortSignal);
    expect(personalApi.getPlan.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);

    input = { ...input, ...change };
    await render();
    await waitFor(() => expect(personalApi.getTasks).toHaveBeenCalledTimes(2));
    expect(oldSignal.aborted).toBe(true);

    currentRead.resolve(taskPage(task('current-task', 'Current owner task')));
    await waitFor(() => expect(personalTitles()).toEqual(['Current owner task']));

    oldRead.resolve(taskPage(task('old-task', 'Previous owner private task')));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(personalTitles()).toEqual(['Current owner task']);
    expect(JSON.stringify(result.model)).not.toContain('Previous owner private task');
  });

  it('drops inactive task and plan caches before Home is entered again', async () => {
    personalApi.getTasks.mockResolvedValueOnce(taskPage(task('private', 'Old private task')));
    personalApi.getPlan.mockResolvedValueOnce({
      date: '2026-09-07',
      version: 1,
      updatedAt: NOW,
      items: [
        {
          position: 0,
          selectionReference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'private' },
          source: {
            availability: 'AVAILABLE',
            reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'private' },
            title: 'Private source',
            status: 'OPEN',
            sourceRoute: '/work/queue',
            dueAt: null,
          },
        },
      ],
    } satisfies PersonalDayPlan);
    await render();
    await waitFor(() => {
      expect(personalTitles()).toEqual(['Old private task']);
      expect(personalPlanCounts()).toEqual([1]);
    });

    mounted = false;
    await render();
    await waitFor(() => {
      expect(
        client.getQueryData(['workspace', 'work-hub', 'home-personal', 1, 7, 'scope-a'])
      ).toBeUndefined();
      expect(
        client.getQueryData(['workspace', 'work-hub', 'home-plan', 1, 7, 'scope-a', '2026-09-07'])
      ).toBeUndefined();
    });
    await client.invalidateQueries({ queryKey: ['workspace', 'work-hub'] });

    personalApi.getTasks.mockImplementationOnce(() => new Promise(() => undefined));
    personalApi.getPlan.mockImplementationOnce(() => new Promise(() => undefined));
    mounted = true;
    await render();
    await waitFor(() => expect(personalApi.getTasks).toHaveBeenCalledTimes(2));
    expect(personalTitles()).toEqual([]);
    expect(personalPlanCounts()).toEqual([]);
    expect(JSON.stringify(result.model)).not.toContain('Old private task');
  });

  it('keeps verified personal work visible during an in-place refresh', async () => {
    personalApi.getTasks.mockResolvedValueOnce(taskPage(task('current', 'Current task')));
    await render();
    await waitFor(() => expect(personalTitles()).toEqual(['Current task']));

    const refreshRead = deferred<PersonalWorkPage<PersonalWorkTask>>();
    personalApi.getTasks.mockReturnValueOnce(refreshRead.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.retry();
    });
    await waitFor(() => expect(personalApi.getTasks).toHaveBeenCalledTimes(2));
    expect(personalTitles()).toEqual(['Current task']);

    refreshRead.resolve(taskPage(task('refreshed', 'Refreshed task')));
    await act(async () => refresh);
    await waitFor(() => expect(personalTitles()).toEqual(['Refreshed task']));
  });

  it('hides cached titles immediately on APP.WORK denial and reloads only after a new grant', async () => {
    personalApi.getTasks
      .mockResolvedValueOnce(taskPage(task('allowed-task', 'Allowed private task')))
      .mockResolvedValueOnce(taskPage(task('regranted-task', 'Newly authorized task')));
    await render();
    await waitFor(() => expect(personalTitles()).toEqual(['Allowed private task']));

    input = { ...input, permissions: [WORK_VIEW, WORK_DENY], accessFingerprint: 'scope-denied' };
    await render();
    expect(personalTitles()).toEqual([]);
    expect(JSON.stringify(result.model)).not.toContain('Allowed private task');
    expect(
      result.model.providers.find((provider) => provider.providerKey === 'personal-work')
    ).toMatchObject({ state: 'FORBIDDEN', visibleCount: 0 });
    expect(personalApi.getTasks).toHaveBeenCalledTimes(1);

    input = { ...input, permissions: [WORK_VIEW], accessFingerprint: 'scope-regranted' };
    await render();
    await waitFor(() => expect(personalTitles()).toEqual(['Newly authorized task']));
    expect(personalApi.getTasks).toHaveBeenCalledTimes(2);
  });

  it('keeps verified workspace work visible and marks Action partial when only personal Work fails', async () => {
    personalApi.getTasks.mockRejectedValue(new HttpError('Personal Work unavailable', 503));
    input = { ...input, overview: overview([workspaceItem('Verified workspace task')]) };

    await render();
    await waitFor(() => {
      expect(
        result.model.providers.find((provider) => provider.providerKey === 'personal-work')?.state
      ).toBe('UNAVAILABLE');
    });

    expect(personalApi.getTasks).toHaveBeenCalledTimes(2);
    expect(result.model.buckets.action.map((item) => item.title)).toContain(
      'Verified workspace task'
    );
    expect(result.model.bucketStates.action).toBe('PARTIAL');
    expect(result.partial).toBe(true);
  });
});
