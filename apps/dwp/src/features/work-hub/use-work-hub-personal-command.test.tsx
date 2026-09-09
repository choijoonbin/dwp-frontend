// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  executePersonalWorkDetailCommand,
  personalWorkStatusActionKind,
  useWorkHubPersonalCommand,
  type PersonalWorkDetailCommand,
  type PersonalWorkDetailCommandClients,
  type PersonalWorkDetailCommandResult,
} from './use-work-hub-personal-command';
import { verifiedWorkHubSnapshotFromRefetch } from './work-hub-page-helpers';
import { hubItem, snapshot } from './work-hub.test-support';
import type { WorkHubSnapshot } from './work-hub-contracts';
import { createWorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

import type {
  PersonalWorkDeleteResult,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

const checklist = [{ itemId: 'step-1', title: 'Review evidence', completed: true }];
const taskId = '1d48ca30-9f34-4f6d-8e73-9f75d4483eba';
const otherTaskId = 'a4444444-4444-4444-8444-444444444444';
const reviewedTask: PersonalWorkTask = {
  taskId,
  title: 'Prepare review',
  description: 'Review the evidence',
  status: 'OPEN',
  priority: 'HIGH',
  dueAt: null,
  source: null,
  checklist: [{ ...checklist[0]!, completed: false }],
  version: 4,
  createdAt: '2026-09-07T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
  completedAt: null,
};
const savedTask: PersonalWorkTask = {
  ...reviewedTask,
  checklist,
  version: 5,
  updatedAt: '2026-09-07T00:01:00Z',
};
const statusTask: PersonalWorkTask = {
  ...reviewedTask,
  status: 'IN_PROGRESS',
  version: 5,
  updatedAt: '2026-09-07T00:01:00Z',
};
const changedSource = {
  availability: 'REFERENCE_ONLY' as const,
  reference: { sourceSystem: 'APPROVAL', sourceReference: 'approval-1' },
  title: null,
  sourceRoute: null,
  status: null,
  dueAt: null,
};
const deleteReceipt: PersonalWorkDeleteResult = {
  taskId,
  version: 5,
  deletedAt: '2026-09-07T00:01:00Z',
};
const key = '1d48ca30-9f34-4f6d-8e73-9f75d4483eba';
const reviewedItem = hubItem({
  title: reviewedTask.title,
  summary: reviewedTask.description,
  lifecycle: reviewedTask.status,
  sourceStatus: reviewedTask.status,
  priority: reviewedTask.priority,
  version: reviewedTask.version,
  updatedAt: reviewedTask.updatedAt,
});
const partialReadySnapshot = {
  ...snapshot([reviewedItem]),
  completeness: 'PARTIAL' as const,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function commandClients(overrides: Partial<PersonalWorkDetailCommandClients> = {}) {
  return {
    getPersonalWorkTask: vi.fn().mockResolvedValue(reviewedTask),
    updatePersonalWorkTask: vi.fn().mockResolvedValue(savedTask),
    deletePersonalWorkTask: vi.fn().mockResolvedValue(deleteReceipt),
    transitionPersonalWorkTask: vi.fn().mockResolvedValue({
      ...statusTask,
    }),
    ...overrides,
  } as unknown as PersonalWorkDetailCommandClients;
}

function commandGuard(controller = new AbortController()) {
  return {
    signal: controller.signal,
    canContinue: () => true,
    reviewedItem,
    preflight: vi.fn().mockResolvedValue(partialReadySnapshot),
  };
}

describe('Personal Work detail receipt validation', () => {
  it.each([
    ['IN_PROGRESS', 'PERSONAL_START'],
    ['WAITING', 'PERSONAL_WAIT'],
    ['COMPLETED', 'PERSONAL_COMPLETE'],
    ['OPEN', 'PERSONAL_REOPEN'],
    ['ARCHIVED', null],
  ] as const)('maps the %s target to its aggregate action authority', (status, action) => {
    expect(personalWorkStatusActionKind(status)).toBe(action);
  });

  it('accepts only an advanced checklist receipt for the reviewed task and submitted list', async () => {
    const controller = new AbortController();
    const clients = commandClients();

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'CHECKLIST', version: 4, checklist },
        key,
        commandGuard(controller),
        clients
      )
    ).resolves.toEqual(savedTask);
    expect(clients.updatePersonalWorkTask).toHaveBeenCalledWith(
      taskId,
      expect.objectContaining({ version: 4, checklist }),
      key,
      controller.signal
    );
  });

  it.each([
    ['another task', { ...savedTask, taskId: otherTaskId }],
    ['a stale version', { ...savedTask, version: 4 }],
    ['a skipped version', { ...savedTask, version: 6 }],
    ['a different checklist', { ...savedTask, checklist: [] }],
    ['a different title', { ...savedTask, title: 'Other task' }],
    ['a different description', { ...savedTask, description: null }],
    ['a different priority', { ...savedTask, priority: 'LOW' as const }],
    ['a different due date', { ...savedTask, dueAt: '2026-09-09T00:00:00Z' }],
    ['a different source', { ...savedTask, source: changedSource }],
    ['a different creation time', { ...savedTask, createdAt: '2026-09-07T00:00:01Z' }],
    ['an older update time', { ...savedTask, updatedAt: '2026-09-06T23:59:59Z' }],
    ['a different lifecycle', { ...savedTask, status: 'WAITING' as const }],
    ['a changed completion time', { ...savedTask, completedAt: '2026-09-07T00:01:00Z' }],
  ])('rejects checklist success for %s', async (_label, response) => {
    const clients = commandClients({
      updatePersonalWorkTask: vi.fn().mockResolvedValue(response),
    });

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'CHECKLIST', version: 4, checklist },
        key,
        commandGuard(),
        clients
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('accepts a status receipt that changes only the requested lifecycle fields', async () => {
    const controller = new AbortController();
    const clients = commandClients();

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'STATUS', version: 4, status: 'IN_PROGRESS' },
        key,
        commandGuard(controller),
        clients
      )
    ).resolves.toEqual(statusTask);
  });

  it('accepts a canonical completion timestamp bound to the update timestamp', async () => {
    const completed = {
      ...statusTask,
      status: 'COMPLETED' as const,
      completedAt: statusTask.updatedAt,
    };
    const clients = commandClients({
      transitionPersonalWorkTask: vi.fn().mockResolvedValue(completed),
    });

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'STATUS', version: 4, status: 'COMPLETED' },
        key,
        commandGuard(),
        clients
      )
    ).resolves.toEqual(completed);
  });

  it.each([
    ['another task', { ...statusTask, taskId: otherTaskId }],
    ['a skipped version', { ...statusTask, version: 6 }],
    ['a different title', { ...statusTask, title: 'Other task' }],
    ['a different checklist', { ...statusTask, checklist }],
    ['a different source', { ...statusTask, source: changedSource }],
    ['a different creation time', { ...statusTask, createdAt: '2026-09-07T00:00:01Z' }],
    ['an older update time', { ...statusTask, updatedAt: '2026-09-06T23:59:59Z' }],
    ['an unexpected status', { ...statusTask, status: 'WAITING' as const }],
    ['an unexpected completion time', { ...statusTask, completedAt: statusTask.updatedAt }],
  ])('rejects status success for %s', async (_label, response) => {
    const clients = commandClients({
      transitionPersonalWorkTask: vi.fn().mockResolvedValue(response),
    });

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'STATUS', version: 4, status: 'IN_PROGRESS' },
        key,
        commandGuard(),
        clients
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    ['another task', { ...deleteReceipt, taskId: otherTaskId }],
    ['a stale version', { ...deleteReceipt, version: 4 }],
    ['a skipped version', { ...deleteReceipt, version: 6 }],
    ['an invalid deletion time', { ...deleteReceipt, deletedAt: 'not-a-date' }],
    ['a non-canonical deletion time', { ...deleteReceipt, deletedAt: ' 2026-09-07T00:01:00Z' }],
    [
      'a deletion before the reviewed update',
      { ...deleteReceipt, deletedAt: '2026-09-06T23:59:59Z' },
    ],
  ])('rejects deletion success for %s', async (_label, response) => {
    const clients = commandClients({
      deletePersonalWorkTask: vi.fn().mockResolvedValue(response),
    });

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'DELETE', version: 4 },
        key,
        commandGuard(),
        clients
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    ['a malformed task id', { ...reviewedTask, taskId: 'task-1' }],
    ['a malformed creation time', { ...reviewedTask, createdAt: 'invalid' }],
    ['a malformed source', { ...reviewedTask, source: { availability: 'UNAVAILABLE' } }],
    ['a changed status', { ...reviewedTask, status: 'WAITING' as const }],
  ])('does not issue a mutation from %s preflight receipt', async (_label, preflight) => {
    const update = vi.fn();
    const remove = vi.fn();
    const transition = vi.fn();
    const clients = commandClients({
      getPersonalWorkTask: vi.fn().mockResolvedValue(preflight),
      updatePersonalWorkTask: update,
      deletePersonalWorkTask: remove,
      transitionPersonalWorkTask: transition,
    });

    await expect(
      executePersonalWorkDetailCommand(
        taskId,
        { kind: 'DELETE', version: 4 },
        key,
        commandGuard(),
        clients
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it.each<[string, PersonalWorkDetailCommand, () => WorkHubSnapshot | null]>([
    ['null snapshot', { kind: 'DELETE', version: 4 }, (): WorkHubSnapshot | null => null],
    [
      'cached READY snapshot with a refetch error',
      { kind: 'CHECKLIST', version: 4, checklist },
      () =>
        verifiedWorkHubSnapshotFromRefetch({
          data: { snapshot: partialReadySnapshot },
          isSuccess: true,
          isRefetchError: true,
        }),
    ],
    [
      'aggregate UNAVAILABLE',
      { kind: 'STATUS', version: 4, status: 'IN_PROGRESS' },
      () => ({ ...partialReadySnapshot, completeness: 'UNAVAILABLE' as const }),
    ],
    [
      'personal source not READY',
      { kind: 'DELETE', version: 4 },
      () => ({
        ...partialReadySnapshot,
        sources: partialReadySnapshot.sources.map((source) => ({
          ...source,
          state: 'UNAVAILABLE' as const,
          items: [],
          receivedAt: null,
        })),
      }),
    ],
    [
      'aggregate version drift',
      { kind: 'CHECKLIST', version: 4, checklist },
      () => snapshot([{ ...reviewedItem, version: reviewedItem.version + 1 }]),
    ],
    [
      'aggregate lifecycle drift',
      { kind: 'STATUS', version: 4, status: 'IN_PROGRESS' },
      () => snapshot([{ ...reviewedItem, lifecycle: 'WAITING' as const }]),
    ],
    [
      'aggregate source status drift',
      { kind: 'DELETE', version: 4 },
      () => snapshot([{ ...reviewedItem, sourceStatus: 'WAITING' }]),
    ],
    [
      'unavailable status action',
      { kind: 'STATUS', version: 4, status: 'IN_PROGRESS' },
      () => snapshot([{ ...reviewedItem, actions: [] }]),
    ],
  ])('does not issue any mutation for %s', async (_label, command, freshSnapshot) => {
    const clients = commandClients({
      getPersonalWorkTask: vi.fn(),
      updatePersonalWorkTask: vi.fn(),
      deletePersonalWorkTask: vi.fn(),
      transitionPersonalWorkTask: vi.fn(),
    });
    const guard = {
      ...commandGuard(),
      preflight: vi.fn().mockResolvedValue(freshSnapshot()),
    };

    await expect(
      executePersonalWorkDetailCommand(taskId, command, key, guard, clients)
    ).rejects.toBeDefined();
    expect(guard.preflight).toHaveBeenCalledOnce();
    expect(clients.getPersonalWorkTask).not.toHaveBeenCalled();
    expect(clients.updatePersonalWorkTask).not.toHaveBeenCalled();
    expect(clients.deletePersonalWorkTask).not.toHaveBeenCalled();
    expect(clients.transitionPersonalWorkTask).not.toHaveBeenCalled();
  });

  it.each([
    ['CHECKLIST', { kind: 'CHECKLIST', version: 4, checklist }],
    ['DELETE', { kind: 'DELETE', version: 4 }],
    ['STATUS', { kind: 'STATUS', version: 4, status: 'IN_PROGRESS' }],
  ] as const)(
    'executes %s from an exact personal READY source in PARTIAL',
    async (kind, command) => {
      const clients = commandClients();
      const guard = commandGuard();

      await expect(
        executePersonalWorkDetailCommand(taskId, command, key, guard, clients)
      ).resolves.toBeDefined();
      const mutation =
        kind === 'CHECKLIST'
          ? clients.updatePersonalWorkTask
          : kind === 'DELETE'
            ? clients.deletePersonalWorkTask
            : clients.transitionPersonalWorkTask;
      expect(mutation).toHaveBeenCalledOnce();
      expect(guard.preflight.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(clients.getPersonalWorkTask).mock.invocationCallOrder[0]!
      );
      expect(vi.mocked(clients.getPersonalWorkTask).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(mutation).mock.invocationCallOrder[0]!
      );
    }
  );
});

describe('mounted Personal Work detail command ownership', () => {
  let host: HTMLDivElement;
  let root: Root;
  let mounted = false;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mounted = true;
  });

  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    host.remove();
  });

  it.each([
    ['owner', 'tenant-b:user-a:access-a', true],
    ['permission', 'tenant-a:user-a:access-a', false],
  ] as const)(
    'stops before detail GET and mutation when %s changes during aggregate preflight',
    async (_axis, nextOwner, nextCanEdit) => {
      const fresh = deferred<typeof partialReadySnapshot | null>();
      const preflight = vi.fn(() => fresh.promise);
      const clients = commandClients({
        getPersonalWorkTask: vi.fn(),
        updatePersonalWorkTask: vi.fn(),
        deletePersonalWorkTask: vi.fn(),
        transitionPersonalWorkTask: vi.fn(),
      });
      const onConfirmed = vi.fn();
      const onError = vi.fn();
      let current: ReturnType<typeof useWorkHubPersonalCommand> | undefined;

      function Harness({ owner, canEdit }: { owner: string; canEdit: boolean }) {
        current = useWorkHubPersonalCommand(
          {
            ownerFingerprint: owner,
            taskId,
            reviewedItem,
            preflight,
            canEdit,
            onConfirmed,
            onError,
          },
          clients
        );
        return null;
      }

      await act(async () => root.render(<Harness owner="tenant-a:user-a:access-a" canEdit />));
      const outcome = current!.run({ kind: 'DELETE', version: 4 }).catch((error) => error);
      await vi.waitFor(() => expect(preflight).toHaveBeenCalledOnce());
      await act(async () => root.render(<Harness owner={nextOwner} canEdit={nextCanEdit} />));
      fresh.resolve(partialReadySnapshot);
      await act(async () => void (await outcome));

      expect(clients.getPersonalWorkTask).not.toHaveBeenCalled();
      expect(clients.updatePersonalWorkTask).not.toHaveBeenCalled();
      expect(clients.deletePersonalWorkTask).not.toHaveBeenCalled();
      expect(clients.transitionPersonalWorkTask).not.toHaveBeenCalled();
      expect(onConfirmed).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(current?.isPending).toBe(false);
    }
  );

  it.each([
    ['CHECKLIST', 'user', 'tenant-a:user-b:access-a', true],
    ['CHECKLIST', 'tenant', 'tenant-b:user-a:access-a', true],
    ['CHECKLIST', 'access', 'tenant-a:user-a:access-b', false],
    ['DELETE', 'user', 'tenant-a:user-b:access-a', true],
    ['DELETE', 'tenant', 'tenant-b:user-a:access-a', true],
    ['DELETE', 'access', 'tenant-a:user-a:access-b', false],
    ['STATUS', 'user', 'tenant-a:user-b:access-a', true],
    ['STATUS', 'tenant', 'tenant-b:user-a:access-a', true],
    ['STATUS', 'access', 'tenant-a:user-a:access-b', false],
  ] as const)(
    'aborts %s and suppresses late success after a %s change',
    async (kind, _axis, nextOwner, nextCanEdit) => {
      const pending = deferred<PersonalWorkDetailCommandResult>();
      let commandSignal: AbortSignal | undefined;
      const update = vi.fn(async (_taskId, _input, _idempotencyKey, signal?: AbortSignal) => {
        commandSignal = signal;
        return pending.promise as Promise<PersonalWorkTask>;
      });
      const remove = vi.fn(async (_taskId, _input, _idempotencyKey, signal?: AbortSignal) => {
        commandSignal = signal;
        return pending.promise as Promise<PersonalWorkDeleteResult>;
      });
      const transition = vi.fn(
        async (_taskId, _transition, _input, _idempotencyKey, signal?: AbortSignal) => {
          commandSignal = signal;
          return pending.promise as Promise<PersonalWorkTask>;
        }
      );
      const clients = commandClients({
        updatePersonalWorkTask: update,
        deletePersonalWorkTask: remove,
        transitionPersonalWorkTask: transition,
      });
      const onConfirmed = vi.fn();
      const onError = vi.fn();
      let current: ReturnType<typeof useWorkHubPersonalCommand> | undefined;

      function Harness({ owner, canEdit }: { owner: string; canEdit: boolean }) {
        current = useWorkHubPersonalCommand(
          {
            ownerFingerprint: owner,
            taskId,
            reviewedItem,
            preflight: async () => partialReadySnapshot,
            canEdit,
            onConfirmed,
            onError,
          },
          clients
        );
        return null;
      }

      await act(async () => root.render(<Harness owner="tenant-a:user-a:access-a" canEdit />));
      const input: PersonalWorkDetailCommand =
        kind === 'CHECKLIST'
          ? { kind, version: 4, checklist }
          : kind === 'DELETE'
            ? { kind, version: 4 }
            : { kind, version: 4, status: 'IN_PROGRESS' };
      let outcome!: Promise<unknown>;
      await act(async () => {
        outcome = current!.run(input).catch((error: unknown) => error);
        await vi.waitFor(() =>
          expect(
            kind === 'CHECKLIST' ? update : kind === 'DELETE' ? remove : transition
          ).toHaveBeenCalled()
        );
      });

      await act(async () => root.render(<Harness owner={nextOwner} canEdit={nextCanEdit} />));
      expect(commandSignal?.aborted).toBe(true);
      pending.resolve(kind === 'DELETE' ? deleteReceipt : { ...savedTask, status: 'IN_PROGRESS' });
      await act(async () => void (await outcome));

      expect(onConfirmed).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(current?.isPending).toBe(false);
    }
  );

  it.each(['CHECKLIST', 'DELETE', 'STATUS'] as const)(
    'aborts %s and suppresses callbacks when its detail route unmounts',
    async (kind) => {
      const pending = deferred<PersonalWorkDetailCommandResult>();
      let commandSignal: AbortSignal | undefined;
      const clients = commandClients({
        updatePersonalWorkTask: vi.fn(
          async (_taskId, _input, _idempotencyKey, signal?: AbortSignal) => {
            commandSignal = signal;
            return pending.promise as Promise<PersonalWorkTask>;
          }
        ),
        deletePersonalWorkTask: vi.fn(
          async (_taskId, _input, _idempotencyKey, signal?: AbortSignal) => {
            commandSignal = signal;
            return pending.promise as Promise<PersonalWorkDeleteResult>;
          }
        ),
        transitionPersonalWorkTask: vi.fn(
          async (_taskId, _transition, _input, _idempotencyKey, signal?: AbortSignal) => {
            commandSignal = signal;
            return pending.promise as Promise<PersonalWorkTask>;
          }
        ),
      });
      const onConfirmed = vi.fn();
      const onError = vi.fn();
      let current: ReturnType<typeof useWorkHubPersonalCommand> | undefined;

      function Harness() {
        current = useWorkHubPersonalCommand(
          {
            ownerFingerprint: 'tenant-a:user-a:access-a',
            taskId,
            reviewedItem,
            preflight: async () => partialReadySnapshot,
            canEdit: true,
            onConfirmed,
            onError,
          },
          clients
        );
        return null;
      }

      await act(async () => root.render(<Harness />));
      const input: PersonalWorkDetailCommand =
        kind === 'CHECKLIST'
          ? { kind, version: 4, checklist }
          : kind === 'DELETE'
            ? { kind, version: 4 }
            : { kind, version: 4, status: 'IN_PROGRESS' };
      let outcome!: Promise<unknown>;
      await act(async () => {
        outcome = current!.run(input).catch((error: unknown) => error);
        await vi.waitFor(() =>
          expect(
            kind === 'CHECKLIST'
              ? clients.updatePersonalWorkTask
              : kind === 'DELETE'
                ? clients.deletePersonalWorkTask
                : clients.transitionPersonalWorkTask
          ).toHaveBeenCalled()
        );
      });

      await act(async () => root.unmount());
      mounted = false;
      expect(commandSignal?.aborted).toBe(true);
      pending.resolve(kind === 'DELETE' ? deleteReceipt : { ...savedTask, status: 'IN_PROGRESS' });
      await act(async () => void (await outcome));

      expect(onConfirmed).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    }
  );

  it.each(['CHECKLIST', 'DELETE', 'STATUS'] as const)(
    'retains an uncertain %s key across a same-owner pathname remount',
    async (kind) => {
      const pending = deferred<PersonalWorkDetailCommandResult>();
      const update = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(savedTask);
      const remove = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(deleteReceipt);
      const transition = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(statusTask);
      const clients = commandClients({
        updatePersonalWorkTask: update,
        deletePersonalWorkTask: remove,
        transitionPersonalWorkTask: transition,
      });
      const mutationCoordinator = createWorkTaskSaveCoordinator('tenant-a:user-a:access-a');
      let current!: ReturnType<typeof useWorkHubPersonalCommand>;
      function Harness() {
        current = useWorkHubPersonalCommand(
          {
            ownerFingerprint: 'tenant-a:user-a:access-a',
            taskId,
            reviewedItem,
            preflight: async () => partialReadySnapshot,
            canEdit: true,
            mutationCoordinator,
            onConfirmed: vi.fn(),
            onError: vi.fn(),
          },
          clients
        );
        return null;
      }
      const command: PersonalWorkDetailCommand =
        kind === 'CHECKLIST'
          ? { kind, version: 4, checklist }
          : kind === 'DELETE'
            ? { kind, version: 4 }
            : { kind, version: 4, status: 'IN_PROGRESS' };
      const operation = kind === 'CHECKLIST' ? update : kind === 'DELETE' ? remove : transition;
      const keyIndex = kind === 'STATUS' ? 3 : 2;

      await act(async () => root.render(<Harness />));
      const first = current.run(command).catch((error: unknown) => error);
      await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
      const retainedKey = operation.mock.calls[0]?.[keyIndex];
      await act(async () => root.unmount());
      mounted = false;
      pending.resolve(
        kind === 'DELETE' ? deleteReceipt : kind === 'CHECKLIST' ? savedTask : statusTask
      );
      await first;

      root = createRoot(host);
      mounted = true;
      await act(async () => root.render(<Harness />));
      await act(async () => void (await current.run(command)));
      expect(operation.mock.calls[1]?.[keyIndex]).toBe(retainedKey);

      await act(async () => void (await current.run(command)));
      expect(operation.mock.calls[2]?.[keyIndex]).not.toBe(retainedKey);
    }
  );
});
