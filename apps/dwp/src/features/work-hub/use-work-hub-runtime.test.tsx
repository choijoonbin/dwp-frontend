// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkHubRuntime } from './use-work-hub-runtime';
import { hubItem, snapshot } from './work-hub.test-support';
import type { WorkHubSnapshot } from './work-hub-contracts';

const state = vi.hoisted(() => ({
  user: {
    identityPlane: 'TENANT',
    tenantId: 'a',
    userId: 'a',
    roles: ['MEMBER'],
    groups: [] as { groupRef: string }[],
  },
  load: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: true }),
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ permissions: [] }),
}));
vi.mock('./work-hub-controller', () => ({
  createWorkHubController: () => ({ refresh: state.load }),
}));
let client: QueryClient;
let root: Root;
let host: HTMLDivElement;
let runtime: ReturnType<typeof useWorkHubRuntime>;
function Harness() {
  runtime = useWorkHubRuntime();
  return <p>{runtime.query.data?.items.map((item) => item.title).join(',')}</p>;
}
async function render() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
  );
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
const unavailable = (): WorkHubSnapshot => ({
  ...snapshot([]),
  completeness: 'UNAVAILABLE' as const,
  sources: [{ ...snapshot().sources[0], items: [], state: 'UNAVAILABLE' as const }],
});
describe('Work queue scope ownership', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    state.user = {
      identityPlane: 'TENANT',
      tenantId: 'a',
      userId: 'a',
      roles: ['MEMBER'],
      groups: [],
    };
    state.load.mockReset();
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
  it("does not restore a previous user's rows when the next user has a total outage", async () => {
    state.load
      .mockResolvedValueOnce(snapshot([hubItem({ title: 'Private A' })]))
      .mockResolvedValueOnce(unavailable());
    await render();
    await settle();
    expect(host.textContent).toBe('Private A');
    state.user = { ...state.user, tenantId: 'b', userId: 'b' };
    await render();
    await settle();
    expect(state.load).toHaveBeenCalledTimes(2);
    expect(host.textContent).toBe('');
    expect(runtime.query.data?.snapshot.completeness).toBe('UNAVAILABLE');
  });
  it('resets the retained snapshot on a same-user security scope change', async () => {
    state.load
      .mockResolvedValueOnce(snapshot([hubItem({ title: 'Former group work' })]))
      .mockResolvedValueOnce(unavailable());
    await render();
    await settle();
    state.user = { ...state.user, groups: [{ groupRef: 'new-team' }] };
    await render();
    await settle();
    expect(host.textContent).toBe('');
    expect(state.load).toHaveBeenCalledTimes(2);
  });
  it('discards an old in-flight read after identity changes', async () => {
    let oldRead!: (value: ReturnType<typeof snapshot>) => void;
    state.load
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            oldRead = resolve;
          })
      )
      .mockResolvedValueOnce(snapshot([hubItem({ title: 'Current B' })]));
    await render();
    state.user = { ...state.user, userId: 'b' };
    await render();
    await settle();
    await act(async () => oldRead(snapshot([hubItem({ title: 'Late private A' })])));
    await settle();
    expect(host.textContent).toBe('Current B');
  });
  it('keeps verified rows during a pure outage within the same owner', async () => {
    state.load
      .mockResolvedValueOnce(snapshot([hubItem({ title: 'My verified work' })]))
      .mockResolvedValueOnce(unavailable());
    await render();
    await settle();
    await act(async () => {
      await runtime.query.refetch();
    });
    await settle();
    expect(host.textContent).toBe('My verified work');
    expect(runtime.query.data?.snapshot.completeness).toBe('UNAVAILABLE');
  });
  it.each([403, 404])(
    'does not resurrect rows after HTTP %s followed by a transport outage',
    async (failureStatus) => {
      const denied = unavailable();
      denied.sources = [
        {
          ...denied.sources[0],
          failureStatus,
          state: failureStatus === 403 ? 'FORBIDDEN' : 'UNAVAILABLE',
        },
      ];
      state.load
        .mockResolvedValueOnce(snapshot([hubItem({ title: 'Revoked private work' })]))
        .mockResolvedValueOnce(denied)
        .mockResolvedValueOnce(unavailable());
      await render();
      await settle();
      await act(async () => {
        await runtime.query.refetch();
      });
      await settle();
      expect(host.textContent).toBe('');
      await act(async () => {
        await runtime.query.refetch();
      });
      await settle();
      expect(host.textContent).toBe('');
    }
  );
});
