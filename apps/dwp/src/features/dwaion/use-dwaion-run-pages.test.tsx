// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ page: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getDwaionUserRunPage: runtime.page,
}));

import { DWAION_ACTIVITY_REFRESH_INTERVAL_MS, useDwaionRunPages } from './use-dwaion-run-pages';

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
    runtime.page.mockReset().mockImplementation(({ cursor }: { cursor?: string }) => {
      const key = cursor ?? 'first';
      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);
      const page: DwaionUserRunPage = cursor
        ? {
            runs: [run('20000000-0000-4000-8000-000000000002', `older-${attempt}`)],
            snapshotAt: '2026-09-16T00:00:00Z',
            nextCursor: null,
            hasMore: false,
          }
        : {
            runs: [run('10000000-0000-4000-8000-000000000001', `latest-${attempt}`)],
            snapshotAt: '2026-09-16T00:00:00Z',
            nextCursor: 'older-cursor',
            hasMore: true,
          };
      return Promise.resolve(page);
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('refreshes every explicitly loaded page without discarding older pages', async () => {
    expect(DWAION_ACTIVITY_REFRESH_INTERVAL_MS).toBe(60_000);
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
      await result.refetch();
    });

    await act(async () => {
      await vi.waitFor(() =>
        expect(
          result.data?.pages.flatMap((page) => page.runs.map((item) => item.activityTitle))
        ).toEqual(['latest-2', 'older-2'])
      );
    });
    expect(result.data?.pages).toHaveLength(2);
    expect(runtime.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'older-cursor', signal: expect.any(AbortSignal) })
    );
  });
});
