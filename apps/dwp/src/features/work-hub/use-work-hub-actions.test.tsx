// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkHubActions } from './use-work-hub-actions';
import type { WorkHubActionGuard, WorkHubActionResult } from './work-hub-actions';
import type { createWorkHubController } from './work-hub-controller';
import { hubItem, snapshot } from './work-hub.test-support';
import { createWorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('direct Work action ownership', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  it('aborts an in-flight command and discards its late result when the owner changes', async () => {
    let owner: string | null = 'tenant-a:user-a:allow';
    let finish!: (result: WorkHubActionResult) => void;
    let guard: WorkHubActionGuard | undefined;
    const execute = vi.fn((_command, nextGuard: WorkHubActionGuard) => {
      guard = nextGuard;
      return new Promise<WorkHubActionResult>((resolve) => {
        finish = resolve;
      });
    });
    const controller = {
      adopt: vi.fn(),
      select: vi.fn(),
      execute,
    } as unknown as ReturnType<typeof createWorkHubController>;
    const onFeedback = vi.fn();
    const onHandoff = vi.fn();
    let actions!: ReturnType<typeof useWorkHubActions>;
    const item = hubItem({
      actions: [{ kind: 'WORKSPACE_COMPLETE', availability: 'AVAILABLE' }],
    });
    const currentSnapshot = snapshot([item]);
    const refresh = vi.fn().mockResolvedValue(currentSnapshot);

    function Harness() {
      actions = useWorkHubActions({
        owner,
        snapshot: currentSnapshot,
        controller,
        onFeedback,
        onHandoff,
        refresh,
      });
      return null;
    }
    const render = async () =>
      act(async () =>
        root.render(
          <QueryClientProvider client={queryClient}>
            <Harness />
          </QueryClientProvider>
        )
      );

    await render();
    await act(async () => {
      expect(actions.run(item, 'WORKSPACE_COMPLETE')).toBe(true);
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(guard?.canContinue?.()).toBe(true);

    owner = 'tenant-b:user-b:allow';
    await render();
    expect(guard?.signal?.aborted).toBe(true);
    expect(guard?.canContinue?.()).toBe(false);

    await act(async () =>
      finish({
        state: 'CONFIRMED',
        outcome: 'STATUS_CHANGED',
        sourceReference: item.reference.sourceReference,
        version: item.version + 1,
        sourceStatus: 'COMPLETED',
      })
    );
    expect(onFeedback).not.toHaveBeenCalled();
    expect(onHandoff).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('preserves uncertain retry identity, refreshes rejected snapshots, and clears rejected identity', async () => {
    const owner = 'tenant-a:user-a:allow';
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ state: 'UNAVAILABLE', retryable: true })
      .mockResolvedValueOnce({ state: 'CONFLICT', retryable: true })
      .mockResolvedValueOnce({ state: 'FORBIDDEN', retryable: false });
    const controller = {
      adopt: vi.fn(),
      select: vi.fn(),
      execute,
    } as unknown as ReturnType<typeof createWorkHubController>;
    const onFeedback = vi.fn();
    const currentSnapshot = snapshot([hubItem()]);
    const refresh = vi.fn().mockResolvedValue(currentSnapshot);
    let actions!: ReturnType<typeof useWorkHubActions>;
    const item = hubItem();

    function Harness() {
      actions = useWorkHubActions({
        owner,
        snapshot: currentSnapshot,
        controller,
        onFeedback,
        onHandoff: vi.fn(),
        refresh,
      });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );
    const runAndSettle = async () => {
      await act(async () => {
        expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true);
      });
      await vi.waitFor(() => expect(actions.pending).toBe(false));
    };

    await runAndSettle();
    expect(refresh).toHaveBeenCalledOnce();
    const uncertainKey = execute.mock.calls[0][0].idempotencyKey;

    await runAndSettle();
    expect(execute.mock.calls[1][0].idempotencyKey).toBe(uncertainKey);
    expect(refresh).toHaveBeenCalledTimes(3);

    await runAndSettle();
    expect(execute.mock.calls[2][0].idempotencyKey).not.toBe(uncertainKey);
    expect(refresh).toHaveBeenCalledTimes(5);
    expect(onFeedback).toHaveBeenCalledTimes(3);
  });

  it('retains a personal action key across a same-owner pathname remount', async () => {
    const owner = 'tenant-a:user-a:allow';
    let finish!: (result: WorkHubActionResult) => void;
    const confirmed: WorkHubActionResult = {
      state: 'CONFIRMED',
      outcome: 'STATUS_CHANGED',
      sourceReference: hubItem().reference.sourceReference,
      version: hubItem().version + 1,
      sourceStatus: 'COMPLETED',
    };
    const execute = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WorkHubActionResult>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValue(confirmed);
    const controller = {
      adopt: vi.fn(),
      select: vi.fn(),
      execute,
    } as unknown as ReturnType<typeof createWorkHubController>;
    const mutationCoordinator = createWorkTaskSaveCoordinator(owner);
    const item = hubItem();
    let actions!: ReturnType<typeof useWorkHubActions>;
    function Harness() {
      actions = useWorkHubActions({
        owner,
        snapshot: snapshot([item]),
        controller,
        onFeedback: vi.fn(),
        onHandoff: vi.fn(),
        refresh: vi.fn().mockResolvedValue(snapshot([item])),
        mutationCoordinator,
      });
      return null;
    }
    const render = async () =>
      act(async () =>
        root.render(
          <QueryClientProvider client={queryClient}>
            <Harness />
          </QueryClientProvider>
        )
      );

    await render();
    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    const retainedKey = execute.mock.calls[0]?.[0].idempotencyKey;
    await act(async () => root.unmount());
    root = createRoot(host);
    finish(confirmed);
    await render();
    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    await vi.waitFor(() => expect(actions.pending).toBe(false));

    expect(execute.mock.calls[1]?.[0].idempotencyKey).toBe(retainedKey);
    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    await vi.waitFor(() => expect(actions.pending).toBe(false));
    expect(execute.mock.calls[2]?.[0].idempotencyKey).not.toBe(retainedKey);
  });

  it('does not dispatch a retained row while the aggregate snapshot is unavailable', async () => {
    const owner = 'tenant-a:user-a:allow';
    const item = hubItem();
    const unavailable = snapshot([item]);
    unavailable.completeness = 'UNAVAILABLE';
    unavailable.sources = [
      { ...unavailable.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
    ];
    const execute = vi.fn();
    const refresh = vi.fn();
    let actions!: ReturnType<typeof useWorkHubActions>;
    function Harness() {
      actions = useWorkHubActions({
        owner,
        snapshot: unavailable,
        controller: {
          adopt: vi.fn(),
          select: vi.fn(),
          execute,
        } as unknown as ReturnType<typeof createWorkHubController>,
        onFeedback: vi.fn(),
        onHandoff: vi.fn(),
        refresh,
      });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );

    expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('requires a successful fresh READY snapshot and current action before dispatch', async () => {
    const owner = 'tenant-a:user-a:allow';
    const item = hubItem();
    const reviewed = snapshot([item]);
    const changed = hubItem({ version: item.version + 1 });
    const execute = vi.fn();
    const feedback = vi.fn();
    let fresh: ReturnType<typeof snapshot> | null = null;
    const refresh = vi.fn(async () => fresh);
    let actions!: ReturnType<typeof useWorkHubActions>;
    function Harness() {
      actions = useWorkHubActions({
        owner,
        snapshot: reviewed,
        controller: {
          adopt: vi.fn(),
          select: vi.fn(),
          execute,
        } as unknown as ReturnType<typeof createWorkHubController>,
        onFeedback: feedback,
        onHandoff: vi.fn(),
        refresh,
      });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );

    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    await vi.waitFor(() => expect(actions.pending).toBe(false));
    expect(execute).not.toHaveBeenCalled();
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', title: 'workHub.results.UNAVAILABLE.title' })
    );

    fresh = snapshot([{ ...item, actions: [] }]);
    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    await vi.waitFor(() => expect(actions.pending).toBe(false));
    expect(execute).not.toHaveBeenCalled();
    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warning', title: 'workHub.results.CONFLICT.title' })
    );

    fresh = snapshot([changed]);
    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    await vi.waitFor(() => expect(actions.pending).toBe(false));
    expect(execute).not.toHaveBeenCalled();

    fresh = snapshot([item]);
    fresh.completeness = 'PARTIAL';
    fresh.sources[0]!.hasMore = true;
    execute.mockResolvedValue({ state: 'UNAVAILABLE', retryable: true });
    await act(async () => expect(actions.run(item, 'PERSONAL_COMPLETE')).toBe(true));
    await vi.waitFor(() => expect(actions.pending).toBe(false));
    expect(execute).toHaveBeenCalledOnce();
  });
});
