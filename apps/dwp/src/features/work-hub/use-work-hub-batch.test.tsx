// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkHubBatch } from './use-work-hub-batch';
import * as batchReceiptStorage from './work-hub-batch-receipt-storage';
import { hubItem, personal, snapshot } from './work-hub.test-support';

const mocks = vi.hoisted(() => ({
  owner: { identityPlane: 'TENANT', tenantId: 'tenant-a', userId: 'user-a' },
  transition: vi.fn(),
  workspace: vi.fn(),
  afterPersist: undefined as undefined | (() => void | Promise<void>),
  restoreReport: undefined as undefined | (() => void),
  permissions: [] as { resourceKey: string; permissionCode: string; effect: string }[],
}));
vi.mock('./work-hub-batch-receipt-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof batchReceiptStorage>();
  return {
    ...actual,
    persistWorkHubBatchReport: async (
      ...args: Parameters<typeof actual.persistWorkHubBatchReport>
    ) => {
      const persisted = await actual.persistWorkHubBatchReport(...args);
      if (persisted) await mocks.afterPersist?.();
      return persisted;
    },
    restoreWorkHubBatchReport: async (
      ...args: Parameters<typeof actual.restoreWorkHubBatchReport>
    ) => {
      const report = await actual.restoreWorkHubBatchReport(...args);
      if (report) mocks.restoreReport?.();
      return report;
    },
  };
});
vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: mocks.owner, isAuthenticated: true }),
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ permissions: mocks.permissions }),
}));
vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', () => ({
  transitionPersonalWorkTask: mocks.transition,
}));
vi.mock('@dwp-frontend/shared-utils', () => ({
  updateWorkspaceWorkStatuses: mocks.workspace,
  canChangeWorkspaceWorkStatus: () => true,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let host: HTMLDivElement;
let root: Root | undefined;
let queryClient: QueryClient;
let batch: ReturnType<typeof useWorkHubBatch>;
const feedback = vi.fn();
const clearSelection = vi.fn();
let refreshOverride: ReturnType<typeof snapshot> | null = null;
const refresh = vi.fn(
  async (): Promise<ReturnType<typeof snapshot> | null> => refreshOverride ?? renderedSnapshot
);
const first = hubItem();
const second = hubItem({
  key: 'second',
  reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'second' },
});
const currentSnapshot = snapshot([first, second]);
let renderedSnapshot = currentSnapshot;
const checkedKeys = new Set([first.key, second.key]);
let renderedCheckedKeys: ReadonlySet<string> = checkedKeys;

function Harness() {
  batch = useWorkHubBatch({
    snapshot: renderedSnapshot,
    checkedKeys: renderedCheckedKeys,
    clearSelection,
    onFeedback: feedback,
    refresh,
  });
  return null;
}

function nextBatchEvent(name: string) {
  return new Promise<void>((resolve) => {
    globalThis.addEventListener(name, () => resolve(), {
      once: true,
    });
  });
}

function nextBatchRestore() {
  return new Promise<void>((resolve) => {
    mocks.restoreReport = resolve;
  });
}

async function actThroughBatchUpdate(action: () => void | Promise<unknown>) {
  const updated = nextBatchEvent(batchReceiptStorage.WORK_HUB_BATCH_REPORT_UPDATED_EVENT);
  const restored = nextBatchRestore();
  await act(async () => {
    await action();
    await updated;
  });
  await act(async () => {
    await restored;
    await Promise.resolve();
    await Promise.resolve();
  });
  mocks.restoreReport = undefined;
}

async function renderAndRestore() {
  const restored = nextBatchRestore();
  await render();
  await act(async () => {
    await restored;
    await Promise.resolve();
    await Promise.resolve();
  });
  mocks.restoreReport = undefined;
}

async function render() {
  await act(async () =>
    root!.render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    )
  );
}

async function start() {
  await render();
  await act(async () => batch.open('COMPLETED'));
  await act(async () => {
    await batch.confirm();
    await vi.waitFor(() => expect(mocks.transition).toHaveBeenCalledTimes(1));
  });
}

describe('batch lifecycle ownership', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.afterPersist = undefined;
    mocks.restoreReport = undefined;
    window.sessionStorage.clear();
    mocks.owner = { identityPlane: 'TENANT', tenantId: 'tenant-a', userId: 'user-a' };
    mocks.permissions = [];
    renderedSnapshot = currentSnapshot;
    refreshOverride = null;
    renderedCheckedKeys = checkedKeys;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    queryClient.clear();
    host.remove();
  });

  it('aborts the old owner and does not publish late receipts after a tenant/user switch', async () => {
    let finish!: (result: ReturnType<typeof personal>) => void;
    mocks.transition.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await start();
    const signal = mocks.transition.mock.calls[0][4] as AbortSignal;
    mocks.owner = { identityPlane: 'TENANT', tenantId: 'tenant-b', userId: 'user-b' };
    await render();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(personal({ status: 'COMPLETED', version: 3 })));
    expect(mocks.transition).toHaveBeenCalledTimes(1);
    expect(feedback).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
    expect(batch.target).toBeNull();
    expect(batch.receipts).toEqual([]);
    expect(batch.pending).toBe(false);
  });

  it('stops after unmount even when the transport reports an ambiguous late failure', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    let fail!: (error: Error) => void;
    mocks.transition.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        })
    );
    await start();
    const signal = mocks.transition.mock.calls[0][4] as AbortSignal;
    await act(async () => root!.unmount());
    root = undefined;
    expect(signal.aborted).toBe(true);
    await act(async () => fail(new Error('Lost response')));
    expect(mocks.transition).toHaveBeenCalledTimes(1);
    expect(feedback).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspace', 'work-hub'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspace', 'activity'] });
    });
  });

  it('keeps the original retry identity and final cancelled receipts across an in-flight route remount', async () => {
    let fail!: (error: Error) => void;
    mocks.transition.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        })
    );
    await start();
    const originalKey = mocks.transition.mock.calls[0][3] as string;

    await act(async () => root!.unmount());
    root = createRoot(host);
    await renderAndRestore();
    expect(batch.receipts.every((row) => row.state === 'UNKNOWN')).toBe(true);

    await actThroughBatchUpdate(() => fail(new Error('Response was lost during route transition')));
    expect(batch.receipts.map(({ state, reason }) => ({ state, reason }))).toEqual([
      { state: 'UNKNOWN', reason: 'CANCELLED' },
      { state: 'EXCLUDED', reason: 'CANCELLED' },
    ]);
    expect(batch.receipts[0].idempotencyKey).toBe(originalKey);
    expect(mocks.transition).toHaveBeenCalledOnce();
  });

  it('records a persisted run cancelled before dispatch as excluded instead of ambiguous', async () => {
    renderedCheckedKeys = new Set([first.key]);
    let reportPersisted!: () => void;
    const persisted = new Promise<void>((resolve) => {
      reportPersisted = resolve;
    });
    let releasePersist!: () => void;
    mocks.afterPersist = () => {
      reportPersisted();
      return new Promise<void>((resolve) => {
        releasePersist = resolve;
      });
    };
    await render();
    await act(async () => batch.open('COMPLETED'));
    let confirming!: Promise<boolean>;
    await act(async () => {
      confirming = batch.confirm();
      await persisted;
    });
    expect(mocks.transition).not.toHaveBeenCalled();

    await act(async () => root!.unmount());
    root = undefined;
    await act(async () => {
      releasePersist();
      await confirming;
    });
    mocks.afterPersist = undefined;
    expect(mocks.transition).not.toHaveBeenCalled();

    root = createRoot(host);
    await renderAndRestore();
    expect(batch.receipts).toHaveLength(1);
    expect(batch.receipts[0]).toMatchObject({ state: 'EXCLUDED', reason: 'CANCELLED' });
  });

  it('retains the terminal unknown receipt when a retry unmounts during preflight hashing', async () => {
    renderedCheckedKeys = new Set([first.key]);
    mocks.transition.mockRejectedValueOnce(new Error('The response was lost after commit'));
    await render();
    await act(async () => batch.open('COMPLETED'));
    await actThroughBatchUpdate(() => batch.confirm());
    expect(mocks.transition).toHaveBeenCalledOnce();
    const stored = window.sessionStorage.getItem('dwp.work.batch-report.v3');
    expect(JSON.parse(stored ?? '{}')).toMatchObject({
      phase: 'FINAL',
      receipts: [{ state: 'UNKNOWN' }],
    });

    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let hashingStarted!: () => void;
    const hashing = new Promise<void>((resolve) => {
      hashingStarted = resolve;
    });
    let releaseHash!: () => void;
    const hashGate = new Promise<void>((resolve) => {
      releaseHash = resolve;
    });
    const digest = vi
      .spyOn(globalThis.crypto.subtle, 'digest')
      .mockImplementationOnce(async (algorithm, data) => {
        hashingStarted();
        await hashGate;
        return originalDigest(algorithm, data);
      });

    let retried!: Promise<boolean>;
    await act(async () => {
      retried = batch.retryUnconfirmed();
      await hashing;
    });
    await act(async () => root!.unmount());
    root = undefined;
    await act(async () => {
      releaseHash();
      expect(await retried).toBe(false);
    });
    digest.mockRestore();

    expect(mocks.transition).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe(stored);
    expect(
      JSON.parse(window.sessionStorage.getItem('dwp.work.batch-report.v3') ?? '{}')
    ).toMatchObject({
      phase: 'FINAL',
      receipts: [{ state: 'UNKNOWN' }],
    });
  });

  it('aborts remaining items when the same actor loses its Work update scope', async () => {
    let finish!: (result: ReturnType<typeof personal>) => void;
    mocks.transition.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await start();
    const signal = mocks.transition.mock.calls[0][4] as AbortSignal;
    mocks.permissions = [{ resourceKey: 'APP.WORK', permissionCode: 'UPDATE', effect: 'DENY' }];
    await render();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(personal({ version: 3 })));
    expect(mocks.transition).toHaveBeenCalledOnce();
    expect(feedback).not.toHaveBeenCalled();
    expect(batch.receipts).toEqual([]);
  });

  it('restores a completed report after a same-owner Work page remount', async () => {
    mocks.transition
      .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 }))
      .mockResolvedValueOnce(personal({ taskId: 'second', status: 'COMPLETED', version: 4 }));
    await render();
    await act(async () => batch.open('COMPLETED'));
    await actThroughBatchUpdate(() => batch.confirm());
    const stored = window.sessionStorage.getItem('dwp.work.batch-report.v3');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(first.title);
    expect(stored).not.toContain(first.key);

    await act(async () => root!.unmount());
    root = createRoot(host);
    await renderAndRestore();
    expect(batch.target).toBeNull();
    expect(batch.outcome).toBe('CONFIRMED');

    await act(async () => batch.reopen());
    expect(batch.target).toBe('COMPLETED');
    expect(batch.reviewItems.map((item) => item.key)).toEqual([first.key, second.key]);
  });

  it('clears a restored report immediately when the operation owner changes', async () => {
    mocks.transition
      .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 }))
      .mockResolvedValueOnce(personal({ taskId: 'second', status: 'COMPLETED', version: 4 }));
    await render();
    await act(async () => batch.open('COMPLETED'));
    await actThroughBatchUpdate(() => batch.confirm());

    mocks.owner = { identityPlane: 'TENANT', tenantId: 'tenant-b', userId: 'user-b' };
    await render();
    expect(batch.receipts).toEqual([]);
    expect(batch.outcome).toBeNull();
    expect(batch.target).toBeNull();
    await vi.waitFor(() =>
      expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull()
    );
  });

  it('keeps a mixed-source report hidden through a PARTIAL/503 snapshot and restores it after recovery', async () => {
    mocks.transition
      .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 }))
      .mockResolvedValueOnce(personal({ taskId: 'second', status: 'COMPLETED', version: 4 }));
    await render();
    await act(async () => batch.open('COMPLETED'));
    await actThroughBatchUpdate(() => batch.confirm());
    const stored = window.sessionStorage.getItem('dwp.work.batch-report.v3');

    await act(async () => root!.unmount());
    root = createRoot(host);
    renderedSnapshot = {
      ...snapshot([]),
      completeness: 'PARTIAL',
      sources: [
        {
          ...snapshot([]).sources[0],
          state: 'UNAVAILABLE',
          failureStatus: 503,
        },
      ],
    };
    await render();
    expect(batch.receipts).toEqual([]);
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe(stored);

    renderedSnapshot = currentSnapshot;
    await renderAndRestore();
    expect(batch.outcome).toBe('CONFIRMED');
  });

  it('revalidates restored receipts for each newer same-owner snapshot', async () => {
    mocks.transition
      .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 }))
      .mockResolvedValueOnce(personal({ taskId: 'second', status: 'COMPLETED', version: 4 }));
    await render();
    await act(async () => batch.open('COMPLETED'));
    await actThroughBatchUpdate(() => batch.confirm());
    await act(async () => batch.close());
    const stored = window.sessionStorage.getItem('dwp.work.batch-report.v3');
    expect(batch.receipts).toHaveLength(2);

    renderedSnapshot = {
      ...snapshot([]),
      completeness: 'PARTIAL',
      sources: [
        {
          ...snapshot([]).sources[0],
          state: 'UNAVAILABLE',
          failureStatus: 503,
        },
      ],
    };
    await render();
    await vi.waitFor(() => expect(batch.receipts).toEqual([]));
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe(stored);
    mocks.transition.mockClear();
    let retried!: boolean;
    await act(async () => {
      retried = await batch.retryUnconfirmed();
    });
    expect(retried).toBe(false);
    expect(mocks.transition).not.toHaveBeenCalled();

    const advancedFirst = {
      ...first,
      lifecycle: 'COMPLETED' as const,
      sourceStatus: 'COMPLETED',
      version: 9,
      actions: [{ kind: 'PERSONAL_REOPEN' as const, availability: 'AVAILABLE' as const }],
    };
    renderedSnapshot = snapshot([advancedFirst, second]);
    await renderAndRestore();
    expect(batch.receipts[0]).toMatchObject({
      item: { lifecycle: 'COMPLETED', version: 9 },
      reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: first.version },
    });

    renderedSnapshot = snapshot([]);
    await render();
    await vi.waitFor(() => expect(batch.receipts).toEqual([]));
    await vi.waitFor(() =>
      expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull()
    );
  });

  it('replays the original personal payload after remounting with an advanced source snapshot', async () => {
    renderedCheckedKeys = new Set([first.key]);
    mocks.transition
      .mockRejectedValueOnce(new Error('The response was lost after commit'))
      .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 }));
    await render();
    await act(async () => batch.open('COMPLETED'));
    await actThroughBatchUpdate(() => batch.confirm());
    expect(batch.receipts[0]).toMatchObject({
      state: 'UNKNOWN',
      reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: first.version },
    });
    const originalCall = mocks.transition.mock.calls[0].slice(0, 4);

    await act(async () => root!.unmount());
    root = createRoot(host);
    renderedSnapshot = snapshot([
      {
        ...first,
        lifecycle: 'COMPLETED',
        sourceStatus: 'COMPLETED',
        version: 9,
        actions: [{ kind: 'PERSONAL_REOPEN', availability: 'AVAILABLE' }],
      },
    ]);
    await renderAndRestore();
    expect(batch.receipts[0]).toMatchObject({
      item: { lifecycle: 'COMPLETED', version: 9 },
      reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: first.version },
    });

    await act(async () => batch.reopen());
    await actThroughBatchUpdate(() => batch.retryUnconfirmed());
    expect(mocks.transition).toHaveBeenCalledTimes(2);
    expect(mocks.transition.mock.calls[1].slice(0, 4)).toEqual(originalCall);
    expect(batch.receipts[0]).toMatchObject({ state: 'CONFIRMED', version: 3 });
  });

  it('does not open or dispatch a retained selection during an aggregate outage', async () => {
    const unavailable = snapshot([first, second]);
    unavailable.completeness = 'UNAVAILABLE';
    unavailable.sources = [
      { ...unavailable.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
    ];
    renderedSnapshot = unavailable;
    await render();

    expect(batch.items).toEqual([]);
    await act(async () => batch.open('COMPLETED'));
    expect(batch.target).toBeNull();
    await expect(batch.confirm()).resolves.toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it('runs a fresh READY preflight and rejects a changed or unavailable review before persistence', async () => {
    renderedCheckedKeys = new Set([first.key]);
    await render();
    await act(async () => batch.open('COMPLETED'));

    refresh.mockResolvedValueOnce(null);
    await expect(batch.confirm()).resolves.toBe(false);
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();

    const unavailable = snapshot([first]);
    unavailable.completeness = 'UNAVAILABLE';
    unavailable.sources = [
      { ...unavailable.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
    ];
    refreshOverride = unavailable;
    await expect(batch.confirm()).resolves.toBe(false);
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();

    refreshOverride = snapshot([{ ...first, version: first.version + 1 }]);
    await expect(batch.confirm()).resolves.toBe(false);
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();
  });
});
