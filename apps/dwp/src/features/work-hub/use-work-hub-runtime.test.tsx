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
  permissions: [] as Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW' | 'DENY';
  }>,
  load: vi.fn(),
  sourceLoad: vi.fn(),
  create: vi.fn(),
  adopt: vi.fn(),
  select: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: true }),
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ permissions: state.permissions }),
}));
vi.mock('./work-hub-controller', () => ({
  createWorkHubController: (...args: unknown[]) => {
    state.create(...args);
    return {
      refresh: state.load,
      adopt: state.adopt,
      select: state.select,
      execute: state.execute,
    };
  },
}));
vi.mock('./work-hub-loader', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  loadWorkHub: state.sourceLoad,
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
    state.sourceLoad.mockReset();
    state.create.mockReset();
    state.adopt.mockReset();
    state.select.mockReset();
    state.execute.mockReset();
    state.permissions = [];
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
  it('enables assignments only for a numeric user and passes that actor to every source read', async () => {
    state.user = { ...state.user, userId: '11' };
    const assigned = snapshot([], 'work-assignments');
    state.load.mockResolvedValue(assigned);
    state.sourceLoad.mockResolvedValue(assigned);

    await render();
    await settle();

    expect(runtime.enabledSources).toContain('work-assignments');
    expect(state.create).toHaveBeenCalledWith(
      expect.arrayContaining(['workspace', 'work-assignments', 'personal']),
      undefined,
      { canUpdatePersonal: false, actorId: 11 }
    );

    await act(async () => runtime.refreshSource('work-assignments'));
    await settle();

    expect(state.sourceLoad).toHaveBeenCalledWith({
      enabledSources: ['work-assignments'],
      canUpdatePersonal: false,
      actorId: 11,
    });
  });
  it('separates Calendar read access from the exact event-create command grant', async () => {
    state.load.mockResolvedValue(snapshot([]));
    state.permissions = [
      {
        resourceType: 'APP',
        resourceKey: 'APP.WORK',
        permissionCode: 'UPDATE',
        effect: 'ALLOW',
      },
      {
        resourceType: 'APP',
        resourceKey: 'APP.CALENDAR',
        permissionCode: 'VIEW',
        effect: 'ALLOW',
      },
    ];
    await render();
    await settle();
    expect(runtime.canUseCalendar).toBe(true);
    expect(runtime.canCreateCalendarEvent).toBe(false);

    state.permissions = [
      ...state.permissions,
      {
        resourceType: 'APP',
        resourceKey: 'APP.CALENDAR',
        permissionCode: 'CREATE',
        effect: 'ALLOW',
      },
    ];
    await render();
    await settle();
    expect(runtime.canCreateCalendarEvent).toBe(true);

    state.permissions = [
      ...state.permissions,
      {
        resourceType: 'APP',
        resourceKey: 'APP.CALENDAR',
        permissionCode: 'CREATE',
        effect: 'DENY',
      },
    ];
    await render();
    await settle();
    expect(runtime.canCreateCalendarEvent).toBe(false);
  });
  it('publishes a scoped source refresh without discarding independently verified neighbours', async () => {
    const workspaceItem = hubItem({
      key: 'workspace:item',
      sourceId: 'workspace',
      title: 'Workspace neighbour',
    });
    const personalItem = hubItem({ key: 'personal:item', title: 'Old personal title' });
    const initial: WorkHubSnapshot = {
      ...snapshot([workspaceItem, personalItem]),
      sources: [
        { ...snapshot([workspaceItem], 'workspace').sources[0]!, items: [workspaceItem] },
        { ...snapshot([personalItem], 'personal').sources[0]!, items: [personalItem] },
      ],
    };
    const refreshedPersonal = {
      ...personalItem,
      title: 'Current personal title',
      version: personalItem.version + 1,
    };
    const scoped: WorkHubSnapshot = {
      ...snapshot([refreshedPersonal]),
      sources: [
        {
          ...snapshot([], 'workspace').sources[0]!,
          state: 'NOT_REQUESTED',
          items: [],
          receivedAt: null,
        },
        {
          ...snapshot([refreshedPersonal], 'personal').sources[0]!,
          items: [refreshedPersonal],
        },
      ],
    };
    state.load.mockResolvedValue(initial);
    state.sourceLoad.mockResolvedValue(scoped);
    await render();
    await settle();

    await act(async () => runtime.refreshSource('personal'));
    await settle();

    expect(state.sourceLoad).toHaveBeenCalledWith({
      enabledSources: ['personal'],
      canUpdatePersonal: false,
      actorId: null,
    });
    expect(runtime.query.data?.snapshot.items.map((item) => item.title)).toEqual([
      'Workspace neighbour',
      'Current personal title',
    ]);
    expect(state.adopt).toHaveBeenCalledWith(
      expect.objectContaining({ items: [workspaceItem, refreshedPersonal] })
    );
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

  it.each([
    ['an aggregate outage', () => unavailable(), 503],
    [
      'a source outage',
      () => {
        const retained = snapshot([hubItem()]);
        retained.completeness = 'PARTIAL';
        retained.sources = [
          { ...retained.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
        ];
        return retained;
      },
      409,
    ],
    ['fresh action availability drift', () => snapshot([{ ...hubItem(), actions: [] }]), 409],
  ] as const)('does not dispatch after %s', async (_label, refreshed, status) => {
    const ready = snapshot([hubItem()]);
    state.load.mockResolvedValueOnce(ready).mockResolvedValueOnce(refreshed());
    await render();
    await settle();

    await expect(runtime.changeStatus(runtime.query.data!.items[0]!, 'COMPLETED')).rejects.toEqual(
      expect.objectContaining({ status })
    );
    expect(state.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['version', { version: 1 }],
    ['source identity', { sourceReference: 'another-task' }],
  ])(
    'rejects a public status command with a stale reviewed %s before source dispatch',
    async (_label, changes) => {
      state.load.mockResolvedValue(snapshot([hubItem()]));
      await render();
      await settle();
      const stale = { ...runtime.query.data!.items[0]!, ...changes };
      expect(runtime.canStatus(stale, 'COMPLETED')).toBe(false);
      await expect(runtime.changeStatus(stale, 'COMPLETED')).rejects.toMatchObject({ status: 404 });
      expect(state.execute).not.toHaveBeenCalled();
    }
  );

  it('does not dispatch when a failed refetch returns cached READY data', async () => {
    const ready = snapshot([hubItem()]);
    state.load.mockResolvedValueOnce(ready).mockRejectedValue(new Error('offline'));
    await render();
    await settle();

    await expect(runtime.changeStatus(runtime.query.data!.items[0]!, 'COMPLETED')).rejects.toEqual(
      expect.objectContaining({ status: 503 })
    );
    expect(state.execute).not.toHaveBeenCalled();
  });

  it('dispatches from an exact fresh READY receipt and publishes its confirmed version', async () => {
    const reviewed = hubItem();
    const updated = {
      ...reviewed,
      lifecycle: 'COMPLETED' as const,
      sourceStatus: 'COMPLETED',
      version: reviewed.version + 1,
      actions: [],
    };
    state.load
      .mockResolvedValueOnce(snapshot([reviewed]))
      .mockResolvedValueOnce(snapshot([reviewed]))
      .mockResolvedValueOnce(snapshot([updated]));
    state.execute.mockResolvedValue({
      state: 'CONFIRMED',
      outcome: 'STATUS_CHANGED',
      sourceReference: reviewed.reference.sourceReference,
      version: updated.version,
      sourceStatus: updated.sourceStatus,
    });
    await render();
    await settle();

    await expect(
      runtime.changeStatus(runtime.query.data!.items[0]!, 'COMPLETED')
    ).resolves.toMatchObject({ version: updated.version, status: 'completed' });
    expect(state.adopt).toHaveBeenCalledOnce();
    expect(state.select).toHaveBeenCalledWith(reviewed.reference);
    expect(state.execute).toHaveBeenCalledOnce();
  });
});
