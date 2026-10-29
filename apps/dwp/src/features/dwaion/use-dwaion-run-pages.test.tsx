// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ detail: vi.fn(), page: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getDwaionUserRun: runtime.detail,
  getDwaionUserRunPage: runtime.page,
}));

import {
  DWAION_ACTIVITY_REFRESH_INTERVAL_MS,
  DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS,
  dwaionHeadRunPageRefetchInterval,
  dwaionKnownRunDetailRefetchInterval,
  dwaionKnownRunDetailRefetchOnWindowFocus,
  dwaionRunDetailRefetchOnWindowFocus,
  dwaionRunDetailRefetchInterval,
  dwaionRunDetailStaleTime,
  dwaionRunPagesRefetchInterval,
  nextDwaionRunPageParam,
  overlayDwaionRunPages,
  shouldRefetchDwaionRunPagesOnLifecycle,
  useDwaionRunPages,
} from './use-dwaion-run-pages';
import { resolveDwaionSelectedRun, summarizeDwaionActivityWindow } from './dwaion-activity-model';
import { HttpError } from '@dwp-frontend/shared-utils';

import type { DwaionUserRun, DwaionUserRunPage } from '@dwp-frontend/shared-utils';

let root: Root;
let host: HTMLDivElement;
let client: QueryClient;
let result: ReturnType<typeof useDwaionRunPages>;

function run(id: string, title: string): DwaionUserRun {
  return {
    runId: id,
    agentKey: 'DWP_ASSISTANT',
    agentRevision: 1,
    runState: 'COMPLETED',
    answerState: 'COMPLETED',
    riskTier: 'L0',
    policyOutcome: 'ALLOW',
    statusCode: null,
    sourceCount: 0,
    latencyMs: 10,
    conversationId: null,
    createdAt: '2026-09-15T00:00:00Z',
    completedAt: '2026-09-15T00:00:01Z',
    activityTitle: title,
  };
}

function runningRun(id: string, title: string): DwaionUserRun {
  return {
    ...run(id, title),
    runState: 'RUNNING',
    answerState: null,
    completedAt: null,
  };
}

const HEAD_RUN_ID = '10000000-0000-4000-8000-000000000001';
const HISTORY_RUN_ID = '20000000-0000-4000-8000-000000000002';

function Harness() {
  result = useDwaionRunPages({
    identity: '1:user-7',
    period: 'MONTH',
    periodFrom: '2026-08-17T00:00:00Z',
    enabled: true,
  });
  return null;
}

async function settle() {
  await act(async () => {
    await vi.waitFor(() => expect(result.isSuccess).toBe(true));
  });
}

describe('DWAI activity run page freshness', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const attempts = new Map<string, number>();
    runtime.detail
      .mockReset()
      .mockImplementation((runId: string) => Promise.resolve(run(runId, 'exact-detail')));
    runtime.page.mockReset().mockImplementation(({ cursor }: { cursor?: string }) => {
      const key = cursor ?? 'first';
      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);
      const page: DwaionUserRunPage = cursor
        ? {
            runs: [run(HISTORY_RUN_ID, `older-${attempt}`)],
            snapshotAt: '2026-09-16T00:00:00Z',
            nextCursor: null,
            hasMore: false,
          }
        : {
            runs: [run(HEAD_RUN_ID, `latest-${attempt}`)],
            snapshotAt: '2026-09-16T00:00:00Z',
            nextCursor: 'older-cursor',
            hasMore: true,
          };
      return Promise.resolve(page);
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
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

  it('refetches every explicitly loaded page without discarding older pages', async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    await settle();
    expect(result.hasNextPage).toBe(true);
    let loaded!: Awaited<ReturnType<typeof result.fetchNextPage>>;
    await act(async () => {
      loaded = await result.fetchNextPage();
    });
    expect(loaded.data?.pages).toHaveLength(2);
    await act(async () => {
      await vi.waitFor(() => expect(result.data?.pages).toHaveLength(2));
    });
    await act(async () => {
      await result.refetchHead();
    });
    await vi.waitFor(() => expect(result.headPage?.runs[0]?.activityTitle).toBe('latest-2'));
    expect(
      runtime.page.mock.calls.filter(([input]) => !(input as { cursor?: string }).cursor)
    ).toHaveLength(2);
    expect(
      runtime.page.mock.calls.filter(
        ([input]) => (input as { cursor?: string }).cursor === 'older-cursor'
      )
    ).toHaveLength(1);

    await act(async () => {
      await result.refetch();
    });

    await act(async () => {
      await vi.waitFor(() =>
        expect(
          result.data?.pages.flatMap((page) => page.runs.map((item) => item.activityTitle))
        ).toEqual(['latest-3', 'older-2'])
      );
    });
    expect(result.data?.pages).toHaveLength(2);
    expect(runtime.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'older-cursor', signal: expect.any(AbortSignal) })
    );

    await act(async () => {
      await result.refetchHead();
    });
    await vi.waitFor(() => expect(result.headPage?.runs[0]?.activityTitle).toBe('latest-4'));
    expect(
      overlayDwaionRunPages(result.headPage, result.data?.pages).map((item) => item.activityTitle)
    ).toEqual(['latest-4', 'older-2']);
  });

  it('overlays a fresh head without dropping rows displaced beyond its page boundary', () => {
    const a = '10000000-0000-4000-8000-000000000001';
    const b = '10000000-0000-4000-8000-000000000002';
    const c = '10000000-0000-4000-8000-000000000003';
    const inserted = '10000000-0000-4000-8000-000000000004';
    const oldFirst: DwaionUserRunPage = {
      runs: [run(a, 'old-a'), run(b, 'boundary-b')],
      snapshotAt: '2026-09-16T00:00:00Z',
      nextCursor: 'older-cursor',
      hasMore: true,
    };
    const oldSecond: DwaionUserRunPage = {
      runs: [run(c, 'older-c')],
      snapshotAt: '2026-09-16T00:00:00Z',
      nextCursor: null,
      hasMore: false,
    };
    const head: DwaionUserRunPage = {
      runs: [run(inserted, 'new-head'), run(a, 'fresh-a')],
      snapshotAt: '2026-09-16T00:01:00Z',
      nextCursor: 'new-older-cursor',
      hasMore: true,
    };
    const detached = run('10000000-0000-4000-8000-000000000005', 'detached-detail');

    expect(
      overlayDwaionRunPages(
        head,
        [oldFirst, oldSecond],
        [run(b, 'fresh-boundary-b'), detached]
      ).map((item) => item.activityTitle)
    ).toEqual(['new-head', 'fresh-a', 'fresh-boundary-b', 'older-c']);
  });

  it('preserves older cursors while bounding automatic infinite-query refetches', () => {
    const page: DwaionUserRunPage = {
      runs: [],
      snapshotAt: '2026-09-16T00:00:00Z',
      nextCursor: 'next-page',
      hasMore: true,
    };
    expect(nextDwaionRunPageParam(page)).toBe('next-page');
    const runningPage = {
      ...page,
      runs: [{ ...run('30000000-0000-4000-8000-000000000003', 'running'), runState: 'RUNNING' }],
    } satisfies DwaionUserRunPage;
    expect(dwaionRunPagesRefetchInterval(undefined)).toBe(DWAION_ACTIVITY_REFRESH_INTERVAL_MS);
    expect(dwaionRunPagesRefetchInterval([page])).toBe(false);
    expect(dwaionRunPagesRefetchInterval([runningPage])).toBe(false);
    expect(dwaionRunPagesRefetchInterval([runningPage, page])).toBe(false);
    expect(shouldRefetchDwaionRunPagesOnLifecycle(undefined)).toBe(true);
    expect(shouldRefetchDwaionRunPagesOnLifecycle([runningPage])).toBe(false);
    expect(shouldRefetchDwaionRunPagesOnLifecycle([runningPage, page])).toBe(false);
    expect(dwaionHeadRunPageRefetchInterval(page)).toBe(DWAION_ACTIVITY_REFRESH_INTERVAL_MS);
    expect(dwaionHeadRunPageRefetchInterval(runningPage)).toBe(
      DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    );
    expect(dwaionRunDetailRefetchInterval(runningPage.runs[0])).toBe(
      DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    );
    expect(dwaionRunDetailStaleTime(runningPage.runs[0])).toBe(15_000);
    expect(dwaionRunDetailRefetchOnWindowFocus(runningPage.runs[0])).toBe(true);
    expect(
      dwaionKnownRunDetailRefetchInterval(
        undefined,
        runningPage.runs[0],
        new HttpError('Temporary upstream failure.', 503)
      )
    ).toBe(DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS);
    expect(
      dwaionKnownRunDetailRefetchOnWindowFocus(
        undefined,
        runningPage.runs[0],
        new HttpError('Temporary upstream failure.', 503)
      )
    ).toBe(true);
    expect(
      dwaionKnownRunDetailRefetchInterval(
        undefined,
        runningPage.runs[0],
        new HttpError('Run is unavailable.', 404)
      )
    ).toBe(false);
    const completed = run('40000000-0000-4000-8000-000000000004', 'completed');
    expect(dwaionRunDetailRefetchInterval(completed)).toBe(false);
    expect(dwaionRunDetailStaleTime(completed)).toBe(Infinity);
    expect(dwaionRunDetailRefetchOnWindowFocus(completed)).toBe(false);
  });

  it('stops selected-run polling when exact detail advances a loaded RUNNING row to terminal', () => {
    const listed = {
      ...run('50000000-0000-4000-8000-000000000005', 'listed-running'),
      runState: 'RUNNING' as const,
    };
    const terminalDetail = {
      ...listed,
      activityTitle: 'exact-terminal-detail',
      runState: 'COMPLETED' as const,
    };
    expect(dwaionRunDetailRefetchInterval(listed)).toBe(
      DWAION_ACTIVITY_RUNNING_REFRESH_INTERVAL_MS
    );

    const selected = resolveDwaionSelectedRun({
      listRun: listed,
      detailRun: terminalDetail,
      detailDenied: false,
    });
    expect(selected).toBe(terminalDetail);
    expect(dwaionRunDetailRefetchInterval(selected)).toBe(false);
    expect(dwaionRunDetailRefetchOnWindowFocus(selected)).toBe(false);
  });

  it('overlays a terminal exact detail for a RUNNING row outside the head page and metrics', async () => {
    const historicalRunning = runningRun(HISTORY_RUN_ID, 'historical-running');
    const terminalDetail = {
      ...historicalRunning,
      activityTitle: 'historical-completed',
      runState: 'COMPLETED' as const,
      answerState: 'COMPLETED' as const,
      completedAt: '2026-09-16T00:05:00Z',
    };
    runtime.page.mockImplementation(({ cursor }: { cursor?: string }) =>
      Promise.resolve(
        cursor
          ? {
              runs: [historicalRunning],
              snapshotAt: '2026-09-16T00:00:00Z',
              nextCursor: null,
              hasMore: false,
            }
          : {
              runs: [run(HEAD_RUN_ID, 'head-completed')],
              snapshotAt: '2026-09-16T00:00:00Z',
              nextCursor: 'older-cursor',
              hasMore: true,
            }
      )
    );
    runtime.detail.mockResolvedValue(terminalDetail);

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    await settle();
    await act(async () => {
      await result.fetchNextPage();
    });
    await act(async () => {
      await vi.waitFor(() => expect(result.runningRunDetails).toEqual([terminalDetail]));
    });

    const overlaid = overlayDwaionRunPages(
      result.headPage,
      result.data?.pages,
      result.runningRunDetails,
      result.deniedRunningRunIds
    );
    expect(overlaid.map((item) => item.runId)).toEqual([HEAD_RUN_ID, HISTORY_RUN_ID]);
    expect(overlaid.find((item) => item.runId === HISTORY_RUN_ID)?.runState).toBe('COMPLETED');
    expect(summarizeDwaionActivityWindow(overlaid)).toMatchObject({
      total: 2,
      running: 0,
      completed: 2,
    });
    expect(dwaionRunDetailRefetchInterval(result.runningRunDetails[0])).toBe(false);
  });

  it('removes only a RUNNING row whose exact detail returns 404', async () => {
    const historicalRunning = runningRun(HISTORY_RUN_ID, 'historical-running');
    runtime.page.mockImplementation(({ cursor }: { cursor?: string }) =>
      Promise.resolve(
        cursor
          ? {
              runs: [historicalRunning],
              snapshotAt: '2026-09-16T00:00:00Z',
              nextCursor: null,
              hasMore: false,
            }
          : {
              runs: [run(HEAD_RUN_ID, 'head-completed')],
              snapshotAt: '2026-09-16T00:00:00Z',
              nextCursor: 'older-cursor',
              hasMore: true,
            }
      )
    );
    runtime.detail.mockRejectedValue(new HttpError('Run is unavailable.', 404));

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    await settle();
    await act(async () => {
      await result.fetchNextPage();
    });
    await act(async () => {
      await vi.waitFor(() => expect(result.deniedRunningRunIds).toEqual([HISTORY_RUN_ID]));
    });

    expect(result.rootDenied).toBe(false);
    expect(result.error).toMatchObject({ status: 404 });
    expect(
      overlayDwaionRunPages(
        result.headPage,
        result.data?.pages,
        result.runningRunDetails,
        result.deniedRunningRunIds
      ).map((item) => item.runId)
    ).toEqual([HEAD_RUN_ID]);
  });

  it.each([401, 403])(
    'fails the complete cached run surface closed when exact detail returns %s',
    async (status) => {
      const historicalRunning = runningRun(HISTORY_RUN_ID, 'historical-running');
      runtime.page.mockImplementation(({ cursor }: { cursor?: string }) =>
        Promise.resolve(
          cursor
            ? {
                runs: [historicalRunning],
                snapshotAt: '2026-09-16T00:00:00Z',
                nextCursor: null,
                hasMore: false,
              }
            : {
                runs: [run(HEAD_RUN_ID, 'head-completed')],
                snapshotAt: '2026-09-16T00:00:00Z',
                nextCursor: 'older-cursor',
                hasMore: true,
              }
        )
      );
      runtime.detail.mockRejectedValue(new HttpError('Run access was denied.', status));

      await act(async () => {
        root.render(
          <QueryClientProvider client={client}>
            <Harness />
          </QueryClientProvider>
        );
      });
      await settle();
      await act(async () => {
        await result.fetchNextPage();
      });
      await act(async () => {
        await vi.waitFor(() => expect(result.rootDenied).toBe(true));
      });

      expect(result.deniedRunningRunIds).toEqual([]);
      expect(result.error).toMatchObject({ status });
    }
  );

  it('keeps a RUNNING row after a transient failure and overlays terminal state on the next poll', async () => {
    const historicalRunning = runningRun(HISTORY_RUN_ID, 'historical-running');
    const terminalDetail = {
      ...historicalRunning,
      activityTitle: 'historical-completed-after-retry',
      runState: 'COMPLETED' as const,
      answerState: 'COMPLETED' as const,
      completedAt: '2026-09-16T00:05:00Z',
    };
    runtime.page.mockImplementation(({ cursor }: { cursor?: string }) =>
      Promise.resolve(
        cursor
          ? {
              runs: [historicalRunning],
              snapshotAt: '2026-09-16T00:00:00Z',
              nextCursor: null,
              hasMore: false,
            }
          : {
              runs: [run(HEAD_RUN_ID, 'head-completed')],
              snapshotAt: '2026-09-16T00:00:00Z',
              nextCursor: 'older-cursor',
              hasMore: true,
            }
      )
    );
    runtime.detail
      .mockRejectedValueOnce(new HttpError('Temporary upstream failure.', 503))
      .mockRejectedValueOnce(new HttpError('Temporary upstream failure.', 503))
      .mockResolvedValue(terminalDetail);

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Harness />
        </QueryClientProvider>
      );
    });
    await settle();
    await act(async () => {
      await result.fetchNextPage();
    });
    await act(async () => {
      await vi.waitFor(() => expect(result.error).toMatchObject({ status: 503 }));
    });

    expect(result.rootDenied).toBe(false);
    expect(result.deniedRunningRunIds).toEqual([]);
    expect(
      overlayDwaionRunPages(
        result.headPage,
        result.data?.pages,
        result.runningRunDetails,
        result.deniedRunningRunIds
      ).find((item) => item.runId === HISTORY_RUN_ID)?.runState
    ).toBe('RUNNING');

    await act(async () => {
      await client.refetchQueries({
        queryKey: ['dwaion', 'user-run', 'detail', '1:user-7', HISTORY_RUN_ID],
        exact: true,
      });
    });
    await act(async () => {
      await vi.waitFor(() => expect(result.runningRunDetails).toEqual([terminalDetail]));
    });
    const overlaid = overlayDwaionRunPages(
      result.headPage,
      result.data?.pages,
      result.runningRunDetails,
      result.deniedRunningRunIds
    );
    expect(overlaid.map((item) => item.runId)).toEqual([HEAD_RUN_ID, HISTORY_RUN_ID]);
    expect(overlaid.find((item) => item.runId === HISTORY_RUN_ID)?.runState).toBe('COMPLETED');
    expect(summarizeDwaionActivityWindow(overlaid)).toMatchObject({ running: 0, completed: 2 });
  });
});
