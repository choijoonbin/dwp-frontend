// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkHubPlanSave } from './use-work-hub-plan-save';
import type { createWorkHubController, WorkHubPlanSaveResult } from './work-hub-controller';
import {
  createWorkTaskSaveCoordinator,
  type WorkTaskSaveCoordinator,
} from './work-hub-task-save-coordinator';
import { hubItem, snapshot } from './work-hub.test-support';
import type { WorkHubSnapshot } from './work-hub-contracts';

const draft = [hubItem().reference];
const saved: WorkHubPlanSaveResult = {
  state: 'SAVED',
  plan: {
    date: '2026-09-08',
    version: 3,
    updatedAt: '2026-09-08T10:00:00Z',
    items: [],
  },
};
let host: HTMLDivElement;
let root: Root | undefined;
let owner = 'A';
let enabled = true;
let controller: ReturnType<typeof createWorkHubController>;
let save: ReturnType<typeof useWorkHubPlanSave>;
let mutationCoordinator: WorkTaskSaveCoordinator | undefined;
let preflight: ReturnType<typeof vi.fn<() => Promise<WorkHubSnapshot | null>>>;

function Harness() {
  save = useWorkHubPlanSave({
    owner,
    enabled,
    controller,
    preflight,
    mutationCoordinator,
    snapshot: snapshot(),
  });
  return null;
}

async function render() {
  await act(async () => root!.render(<Harness />));
}

function deferredController() {
  let finish!: (result: WorkHubPlanSaveResult) => void;
  const savePlan = vi.fn<ReturnType<typeof createWorkHubController>['savePlan']>(
    () =>
      new Promise<WorkHubPlanSaveResult>((resolve) => {
        finish = resolve;
      })
  );
  return {
    controller: {
      savePlan,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>,
    finish: (result = saved) => finish(result),
    savePlan,
  };
}

describe('Work plan save lifecycle', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    owner = 'A';
    enabled = true;
    mutationCoordinator = undefined;
    preflight = vi.fn().mockResolvedValue(snapshot());
    controller = deferredController().controller;
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    host.remove();
  });

  it.each(['owner', 'controller', 'permission', 'unmount'] as const)(
    'aborts and discards a late plan receipt after %s changes',
    async (transition) => {
      const pendingController = deferredController();
      controller = pendingController.controller;
      await render();
      const result = save('2026-09-08', draft, 'stable-key').catch((error: Error) => error);
      await vi.waitFor(() => expect(pendingController.savePlan).toHaveBeenCalledOnce());
      const guard = pendingController.savePlan.mock.calls[0]?.[3];
      expect(guard?.signal?.aborted).toBe(false);

      if (transition === 'owner') owner = 'B';
      if (transition === 'controller') controller = deferredController().controller;
      if (transition === 'permission') enabled = false;
      if (transition === 'unmount') {
        await act(async () => root!.unmount());
        root = undefined;
      } else {
        await render();
      }
      expect(guard?.signal?.aborted).toBe(true);
      pendingController.finish();

      await expect(result).resolves.toMatchObject({ name: 'AbortError' });
      expect(guard?.canContinue?.()).toBe(false);
    }
  );

  it('blocks duplicate plan submissions until the first settles', async () => {
    const pendingController = deferredController();
    controller = pendingController.controller;
    await render();
    const first = save('2026-09-08', draft, 'stable-key');
    await expect(save('2026-09-08', draft, 'new-key')).rejects.toMatchObject({
      name: 'AbortError',
    });
    pendingController.finish();
    await expect(first).resolves.toBe(saved);
    expect(pendingController.savePlan).toHaveBeenCalledOnce();
  });

  it('does not call the plan mutation when the fresh personal source is unavailable', async () => {
    const savePlan = vi.fn();
    controller = {
      savePlan,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>;
    const unavailable = snapshot();
    unavailable.completeness = 'UNAVAILABLE';
    unavailable.sources = [
      { ...unavailable.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
    ];
    preflight.mockResolvedValue(unavailable);
    await render();

    await expect(save('2026-09-08', draft, 'stable-key')).resolves.toEqual({
      state: 'UNAVAILABLE',
      draft,
    });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('does not call the plan mutation when a failed refetch yields no verified snapshot', async () => {
    const savePlan = vi.fn();
    controller = {
      savePlan,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>;
    preflight.mockResolvedValue(null);
    await render();

    await expect(save('2026-09-08', draft, 'stable-key')).resolves.toEqual({
      state: 'UNAVAILABLE',
      draft,
    });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it.each([
    ['source status', { ...hubItem(), sourceStatus: 'WAITING' }],
    ['version', { ...hubItem(), version: hubItem().version + 1 }],
    ['source identity', { ...hubItem(), sourceId: 'workspace' as const }],
  ])('does not mutate a plan when reviewed work changes its %s', async (_label, changed) => {
    const savePlan = vi.fn();
    controller = {
      savePlan,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>;
    preflight.mockResolvedValue(snapshot([changed]));
    await render();
    await expect(save('2026-09-08', draft, 'stable-key')).resolves.toEqual({
      state: 'UNAVAILABLE',
      draft,
    });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('checks a removed reviewed item even when it no longer appears in the submitted draft', async () => {
    const savePlan = vi.fn();
    controller = {
      savePlan,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>;
    preflight.mockResolvedValue(snapshot([{ ...hubItem(), version: hubItem().version + 1 }]));
    await render();
    await expect(save('2026-09-08', [], 'stable-key', [hubItem()])).resolves.toEqual({
      state: 'UNAVAILABLE',
      draft: [],
    });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('keeps PARTIAL semantics when the personal source itself is freshly READY', async () => {
    const readyPartial = snapshot();
    readyPartial.completeness = 'PARTIAL';
    readyPartial.sources[0]!.hasMore = true;
    preflight.mockResolvedValue(readyPartial);
    const savePlan = vi.fn().mockResolvedValue(saved);
    controller = {
      savePlan,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>;
    await render();

    await expect(save('2026-09-08', draft, 'stable-key')).resolves.toBe(saved);
    expect(savePlan).toHaveBeenCalledOnce();
  });

  it('reuses an uncertain plan key after a same-owner pathname remount', async () => {
    mutationCoordinator = createWorkTaskSaveCoordinator(owner);
    const firstController = deferredController();
    controller = firstController.controller;
    await render();
    const first = save('2026-09-08', draft, 'first-key').catch((error: Error) => error);
    await vi.waitFor(() => expect(firstController.savePlan).toHaveBeenCalledOnce());
    const retainedKey = firstController.savePlan.mock.calls[0]?.[2];

    await act(async () => root!.unmount());
    root = createRoot(host);
    firstController.finish();
    await expect(first).resolves.toMatchObject({ name: 'AbortError' });
    const secondSave = vi.fn().mockResolvedValue(saved);
    controller = {
      savePlan: secondSave,
      state: () => ({ plan: { date: '2026-09-08', version: 2 } }),
    } as unknown as ReturnType<typeof createWorkHubController>;
    await render();

    await expect(save('2026-09-08', draft, 'second-key')).resolves.toBe(saved);
    expect(secondSave).toHaveBeenCalledWith('2026-09-08', draft, retainedKey, expect.any(Object));
    await expect(save('2026-09-08', draft, 'third-key')).resolves.toBe(saved);
    expect(secondSave.mock.calls[1]?.[2]).toBe('third-key');
  });
});
