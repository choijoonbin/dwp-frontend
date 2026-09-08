// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkHubBatch } from './use-work-hub-batch';
import { hubItem, personal, snapshot } from './work-hub.test-support';

const mocks = vi.hoisted(() => ({
  owner: { identityPlane: 'TENANT', tenantId: 'tenant-a', userId: 'user-a' },
  transition: vi.fn(),
  workspace: vi.fn(),
  permissions: [] as { resourceKey: string; permissionCode: string; effect: string }[],
}));
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
const refresh = vi.fn().mockResolvedValue(undefined);
const first = hubItem();
const second = hubItem({
  key: 'second',
  reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'second' },
});
const currentSnapshot = snapshot([first, second]);
const checkedKeys = new Set([first.key, second.key]);

function Harness() {
  batch = useWorkHubBatch({
    snapshot: currentSnapshot,
    checkedKeys,
    clearSelection,
    onFeedback: feedback,
    refresh,
  });
  return null;
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
  await act(async () => batch.confirm());
  expect(mocks.transition).toHaveBeenCalledTimes(1);
}

describe('batch lifecycle ownership', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    mocks.owner = { identityPlane: 'TENANT', tenantId: 'tenant-a', userId: 'user-a' };
    mocks.permissions = [];
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
    expect(refresh).not.toHaveBeenCalled();
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
});
