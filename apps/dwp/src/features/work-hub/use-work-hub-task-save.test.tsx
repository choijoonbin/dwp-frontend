// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { useWorkHubTaskSave } from './use-work-hub-task-save';
import { useWorkHubCreatedTaskRecovery } from './use-work-hub-created-task-recovery';
import { personal, snapshot } from './work-hub.test-support';
import { createWorkHubController, workHubControllerClients } from './work-hub-controller';
import { personalWorkToHub } from './work-hub-source-adapters';
import {
  createWorkTaskSaveCoordinator,
  type WorkTaskSaveCoordinator,
} from './work-hub-task-save-coordinator';

const state = vi.hoisted(() => ({
  owner: 'A' as string | null,
  params: new URLSearchParams('scope=all'),
  setParams: vi.fn(),
  latest: vi.fn(),
}));
vi.mock('./use-work-hub-operation-owner', () => ({ useWorkHubOperationOwner: () => state.owner }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [state.params, state.setParams] }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/design-system', () => ({
  mergeFilterSearchParams: (params: URLSearchParams, patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    return next;
  },
}));
vi.mock('@dwp-frontend/shared-utils/api/personal-work-api', () => ({
  createPersonalWorkTask: vi.fn(),
  getPersonalDayPlan: vi.fn(),
  getPersonalWorkTask: state.latest,
  getPersonalWorkTimeline: vi.fn(),
  replacePersonalDayPlan: vi.fn(),
  transitionPersonalWorkTask: vi.fn(),
  updatePersonalWorkTask: vi.fn(),
}));
let root: Root | undefined;
let host: HTMLDivElement;
let client: QueryClient;
let save: ReturnType<typeof useWorkHubTaskSave>;
let editing: ReturnType<typeof personal> | null;
let activeController: ReturnType<typeof createWorkHubController>;
let taskSaveCoordinator: WorkTaskSaveCoordinator | undefined;
let enabled: boolean;
let renderedSnapshot: ReturnType<typeof snapshot>;
let preflight: ReturnType<typeof vi.fn<() => Promise<ReturnType<typeof snapshot> | null>>>;
const callbacks = {
  onTaskClosed: vi.fn(),
  onEditingTaskChange: vi.fn(),
  onPlanDraftChange: vi.fn(),
  onPlanError: vi.fn(),
  onFeedback: vi.fn(),
  onCreated: vi.fn(),
};
const controller = {
  capture: vi.fn(),
  savePersonalTask: vi.fn(),
  adopt: vi.fn(),
  select: vi.fn(),
  addToPlan: vi.fn(),
  loadPlan: vi.fn(),
  savePlan: vi.fn(),
  state: () => ({ planDraft: [] }),
};
const input = { title: 'My work', description: null, priority: 'NORMAL' as const, dueAt: null };
function Harness() {
  save = useWorkHubTaskSave({
    controller: activeController,
    snapshot: renderedSnapshot,
    editingTask: editing,
    today: '2026-09-07',
    taskSaveCoordinator,
    enabled,
    preflight,
    ...callbacks,
  });
  return null;
}
async function render() {
  await act(async () =>
    root!.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
  );
}
describe('Work task save lifecycle', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.owner = 'A';
    state.params = new URLSearchParams('scope=all');
    editing = null;
    enabled = true;
    renderedSnapshot = snapshot();
    preflight = vi.fn(async () => renderedSnapshot);
    state.latest.mockReset();
    state.latest.mockImplementation(async () => editing ?? personal());
    activeController = controller as unknown as ReturnType<typeof createWorkHubController>;
    taskSaveCoordinator = undefined;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    client.clear();
    host.remove();
  });
  it('does not navigate, close a dialog, or send a follow-up plan after identity changes', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    controller.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(input, { idempotencyKey: 'capture-1', addToTodayPlan: true }).catch(
      (error: Error) => error
    );
    await vi.waitFor(() => expect(controller.capture).toHaveBeenCalledOnce());
    state.owner = 'B';
    await render();
    await act(async () => finish(personal()));
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(controller.savePlan).not.toHaveBeenCalled();
    expect(state.setParams).not.toHaveBeenCalled();
    for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
  });
  it('does not publish a late create response after unmount', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    controller.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(input, { idempotencyKey: 'capture-1', addToTodayPlan: false }).catch(
      (error: Error) => error
    );
    await vi.waitFor(() => expect(controller.capture).toHaveBeenCalledOnce());
    await act(async () => root!.unmount());
    root = undefined;
    finish(personal());
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(callbacks.onCreated).not.toHaveBeenCalled();
    expect(state.setParams).not.toHaveBeenCalled();
  });
  it("drops a late 409 recovery read rather than repopulating another owner's cache", async () => {
    editing = personal();
    controller.savePersonalTask.mockRejectedValueOnce(new HttpError('Conflict', 409));
    let finish!: (value: ReturnType<typeof personal>) => void;
    state.latest.mockResolvedValueOnce(editing).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(
      { ...input, version: 2 },
      { idempotencyKey: 'edit-1', addToTodayPlan: false }
    ).catch((error: Error) => error);
    await act(async () => {
      await Promise.resolve();
    });
    expect(state.latest).toHaveBeenCalledTimes(2);
    state.owner = 'B';
    await render();
    finish(personal({ version: 3 }));
    await result;
    expect(callbacks.onEditingTaskChange).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it.each([
    ['foreign task', personal({ taskId: 'a4444444-4444-4444-8444-444444444444', version: 3 })],
    ['stale version', personal({ version: 2 })],
    ['non-finite version', personal({ version: Number.NaN })],
    ['malformed timestamp', personal({ version: 3, updatedAt: 'invalid' })],
  ])('does not adopt a %s returned by 409 reconciliation', async (_label, latest) => {
    editing = personal();
    controller.savePersonalTask.mockRejectedValueOnce(new HttpError('Conflict', 409));
    state.latest.mockResolvedValueOnce(editing).mockResolvedValueOnce(latest);
    await render();

    await expect(
      save(
        { ...input, version: 2 },
        { idempotencyKey: '1d48ca30-9f34-4f6d-8e73-9f75d4483eba', addToTodayPlan: false }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(state.latest).toHaveBeenCalledWith(editing.taskId, expect.any(AbortSignal));
    expect(callbacks.onEditingTaskChange).not.toHaveBeenCalled();
    expect(callbacks.onTaskClosed).not.toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(callbacks.onFeedback).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    );
  });

  it('does not dispatch create or edit without a verified fresh personal source', async () => {
    preflight.mockResolvedValue(null);
    await render();
    await expect(
      save(input, { idempotencyKey: 'create-refetch-error', addToTodayPlan: false })
    ).rejects.toMatchObject({ status: 503 });
    expect(controller.capture).not.toHaveBeenCalled();

    const unavailable = snapshot();
    unavailable.completeness = 'UNAVAILABLE';
    unavailable.sources = [
      { ...unavailable.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
    ];
    preflight.mockResolvedValue(unavailable);
    await render();

    await expect(
      save(input, { idempotencyKey: 'create-unavailable', addToTodayPlan: false })
    ).rejects.toMatchObject({ status: 503 });
    expect(controller.capture).not.toHaveBeenCalled();

    editing = personal();
    await render();
    await expect(
      save(
        { ...input, version: editing.version },
        { idempotencyKey: 'edit-unavailable', addToTodayPlan: false }
      )
    ).rejects.toMatchObject({ status: 503 });
    expect(controller.savePersonalTask).not.toHaveBeenCalled();
    expect(state.latest).not.toHaveBeenCalled();
  });

  it('aborts before dispatch when permission is removed during the fresh preflight', async () => {
    let finish!: (value: ReturnType<typeof snapshot>) => void;
    preflight.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const result = save(input, {
      idempotencyKey: 'permission-transition',
      addToTodayPlan: false,
    }).catch((error: Error) => error);

    enabled = false;
    await render();
    finish(snapshot());

    await expect(result).resolves.toMatchObject({ name: 'AbortError' });
    expect(controller.capture).not.toHaveBeenCalled();
  });

  it('rechecks the exact reviewed edit version before dispatch', async () => {
    editing = personal();
    state.latest.mockReset();
    state.latest.mockResolvedValue(personal({ version: editing.version + 1 }));
    await render();

    await expect(
      save(
        { ...input, version: editing.version },
        { idempotencyKey: 'changed-edit', addToTodayPlan: false }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(controller.savePersonalTask).not.toHaveBeenCalled();
  });
  it('locks duplicate submissions synchronously and preserves current URL refinements', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    controller.capture.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    const first = save(input, { idempotencyKey: 'capture-1', addToTodayPlan: false });
    await expect(
      save(input, { idempotencyKey: 'capture-1', addToTodayPlan: false })
    ).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(controller.capture).toHaveBeenCalledOnce());
    state.params = new URLSearchParams('query=new-filter');
    await render();
    await act(async () => {
      finish(personal());
      await first;
    });
    expect(controller.capture).toHaveBeenCalledOnce();
    expect(state.setParams.mock.calls[0][0].get('query')).toBe('new-filter');
    expect(callbacks.onTaskClosed).toHaveBeenCalledOnce();
  });

  it.each([
    ['creation', false],
    ['edit', true],
  ])('keeps the mounted dialog open after an unbound %s 2xx receipt', async (_label, edit) => {
    editing = edit ? personal() : null;
    const malformed = personal({
      taskId: edit ? 'a4444444-4444-4444-8444-444444444444' : '',
      title: input.title,
      version: edit ? 3 : 0,
    });
    activeController = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: vi.fn().mockResolvedValue(malformed),
      updatePersonalWorkTask: vi.fn().mockResolvedValue(malformed),
    });
    await render();

    await expect(
      save(edit ? { ...input, version: 2 } : input, {
        idempotencyKey: '1d48ca30-9f34-4f6d-8e73-9f75d4483eba',
        addToTodayPlan: false,
      })
    ).rejects.toThrow('Unverified personal task');
    expect(callbacks.onTaskClosed).not.toHaveBeenCalled();
    expect(callbacks.onCreated).not.toHaveBeenCalled();
    expect(state.setParams).not.toHaveBeenCalled();
    expect(callbacks.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    );
    expect(callbacks.onFeedback).not.toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    );
  });

  it('binds an edit receipt to the status reviewed in detail instead of a stale aggregate row', async () => {
    editing = personal({ status: 'WAITING', version: 7 });
    controller.savePersonalTask.mockResolvedValueOnce(
      personal({ ...input, status: 'WAITING', version: 8 })
    );
    await render();

    await act(async () => {
      await save(
        { ...input, version: 7 },
        { idempotencyKey: '1d48ca30-9f34-4f6d-8e73-9f75d4483eba', addToTodayPlan: false }
      );
    });

    expect(controller.savePersonalTask).toHaveBeenCalledWith(
      { ...input, version: 7 },
      '1d48ca30-9f34-4f6d-8e73-9f75d4483eba',
      expect.objectContaining({
        expectedStatus: 'WAITING',
        signal: expect.any(AbortSignal),
        canContinue: expect.any(Function),
      })
    );
  });

  it('reuses one create POST and its identity across a same-owner Work route remount', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    const firstCreate = vi.fn(
      () =>
        new Promise<ReturnType<typeof personal>>((resolve) => {
          finish = resolve;
        })
    );
    const secondCreate = vi.fn();
    taskSaveCoordinator = createWorkTaskSaveCoordinator('A');
    activeController = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: firstCreate,
    });
    await render();
    const first = save(input, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      addToTodayPlan: false,
    }).catch((error: Error) => error);
    await vi.waitFor(() => expect(firstCreate).toHaveBeenCalledOnce());

    await act(async () => root!.unmount());
    root = createRoot(host);
    activeController = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: secondCreate,
    });
    await render();
    const resumed = save(input, {
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      addToTodayPlan: false,
    });
    await act(async () => {
      finish(
        personal({
          title: input.title,
          priority: input.priority,
          description: input.description,
          dueAt: input.dueAt,
          source: null,
          sources: [],
          checklist: [],
          version: 0,
        })
      );
      await resumed;
    });

    expect(await first).toMatchObject({ name: 'AbortError' });
    expect(firstCreate).toHaveBeenCalledOnce();
    expect(secondCreate).not.toHaveBeenCalled();
    expect(callbacks.onCreated).toHaveBeenCalledOnce();
    expect(callbacks.onTaskClosed).toHaveBeenCalledOnce();
    expect(callbacks.onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    );
  });

  it('retains an edit key across a same-owner Work route remount', async () => {
    editing = personal();
    let finish!: (value: ReturnType<typeof personal>) => void;
    const firstSave = vi.fn<ReturnType<typeof createWorkHubController>['savePersonalTask']>(
      (_input, _idempotencyKey) =>
        new Promise<ReturnType<typeof personal>>((resolve) => {
          finish = resolve;
        })
    );
    const secondSave = vi.fn().mockResolvedValue(personal({ ...input, version: 3 }));
    taskSaveCoordinator = createWorkTaskSaveCoordinator('A');
    activeController = {
      ...controller,
      savePersonalTask: firstSave,
    } as unknown as ReturnType<typeof createWorkHubController>;
    await render();
    const first = save(
      { ...input, version: 2 },
      { idempotencyKey: 'first-edit-key', addToTodayPlan: false }
    ).catch((error: Error) => error);
    await vi.waitFor(() => expect(firstSave).toHaveBeenCalledOnce());

    await act(async () => root!.unmount());
    root = createRoot(host);
    finish(personal({ ...input, version: 3 }));
    await expect(first).resolves.toMatchObject({ name: 'AbortError' });
    activeController = {
      ...controller,
      savePersonalTask: secondSave,
    } as unknown as ReturnType<typeof createWorkHubController>;
    await render();
    await act(async () => {
      await save(
        { ...input, version: 2 },
        { idempotencyKey: 'second-edit-key', addToTodayPlan: false }
      );
    });

    expect(firstSave.mock.calls[0]?.[1]).toBe('first-edit-key');
    expect(secondSave.mock.calls[0]?.[1]).toBe('first-edit-key');
  });

  it.each(['failed refetch', 'aggregate outage', 'created task drift'] as const)(
    'keeps create-to-plan recovery available without a plan PUT after %s',
    async (failure) => {
      const created = personal({
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueAt: input.dueAt,
        source: null,
        sources: [],
        checklist: [],
        version: 0,
      });
      const readyCreated = snapshot([personalWorkToHub(created, true)]);
      const planPreflight =
        failure === 'failed refetch'
          ? null
          : failure === 'aggregate outage'
            ? {
                ...readyCreated,
                completeness: 'UNAVAILABLE' as const,
                sources: readyCreated.sources.map((source) => ({
                  ...source,
                  state: 'UNAVAILABLE' as const,
                  items: [],
                  receivedAt: null,
                })),
              }
            : snapshot([personalWorkToHub({ ...created, version: created.version + 1 }, true)]);
      taskSaveCoordinator = createWorkTaskSaveCoordinator('A');
      const acknowledge = vi.spyOn(taskSaveCoordinator, 'acknowledgeCreate');
      const release = vi.spyOn(taskSaveCoordinator, 'releaseCreate');
      controller.capture.mockResolvedValue(created);
      controller.addToPlan.mockReturnValue([
        { sourceSystem: 'PERSONAL_TASK', sourceReference: created.taskId },
      ]);
      preflight
        .mockResolvedValueOnce(snapshot())
        .mockResolvedValueOnce(planPreflight as ReturnType<typeof snapshot> | null);
      await render();

      await expect(
        save(input, { idempotencyKey: `create-${failure}`, addToTodayPlan: true })
      ).rejects.toMatchObject({ status: 503 });
      expect(controller.capture).toHaveBeenCalledOnce();
      expect(controller.addToPlan).not.toHaveBeenCalled();
      expect(controller.savePlan).not.toHaveBeenCalled();
      expect(acknowledge).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
      expect(taskSaveCoordinator.confirmedCreates('A')).toHaveLength(1);
    }
  );

  it.each(['authority lost after plan load', 'unverified plan receipt'] as const)(
    'releases the create confirmation after %s',
    async (failure) => {
      const created = personal({ ...input, source: null, sources: [], checklist: [], version: 0 });
      const ready = snapshot([personalWorkToHub(created, true)]);
      taskSaveCoordinator = createWorkTaskSaveCoordinator('A');
      const acknowledge = vi.spyOn(taskSaveCoordinator, 'acknowledgeCreate');
      const release = vi.spyOn(taskSaveCoordinator, 'releaseCreate');
      controller.capture.mockResolvedValue(created);
      controller.loadPlan.mockResolvedValue(undefined);
      controller.addToPlan.mockReturnValue([
        { sourceSystem: 'PERSONAL_TASK', sourceReference: created.taskId },
      ]);
      controller.savePlan.mockResolvedValue({ state: 'UNAVAILABLE', draft: [] });
      preflight
        .mockResolvedValueOnce(snapshot())
        .mockResolvedValueOnce(ready)
        .mockResolvedValueOnce(failure === 'authority lost after plan load' ? null : ready);
      await render();
      const result = save(input, { idempotencyKey: 'create-plan-follow-up', addToTodayPlan: true });
      if (failure === 'authority lost after plan load') {
        await expect(result).rejects.toMatchObject({ status: 503 });
        expect(controller.savePlan).not.toHaveBeenCalled();
        expect(controller.addToPlan).not.toHaveBeenCalled();
      } else {
        await expect(result).resolves.toBeUndefined();
        expect(controller.savePlan).toHaveBeenCalledOnce();
        expect(callbacks.onFeedback).toHaveBeenCalledWith(
          expect.objectContaining({ severity: 'warning' })
        );
      }
      expect(controller.loadPlan).toHaveBeenCalledOnce();
      expect(preflight).toHaveBeenCalledTimes(3);
      expect(acknowledge).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledOnce();
      expect(taskSaveCoordinator.confirmedCreates('A')).toHaveLength(1);
    }
  );

  it.each([null, '2026-09-07T00:00:00Z'])(
    'serializes direct create-to-plan behind recovery with initial plan timestamp %s',
    async (initialUpdatedAt) => {
      const created = personal({ ...input, source: null, sources: [], checklist: [], version: 0 });
      const recovered = {
        ...created,
        taskId: 'a2222222-2222-4222-8222-222222222222',
        title: 'Recovered first',
      };
      const ready = snapshot([
        personalWorkToHub(created, true),
        personalWorkToHub(recovered, true),
      ]);
      taskSaveCoordinator = createWorkTaskSaveCoordinator('A');
      await taskSaveCoordinator.runCreate(
        'A',
        { ...input, title: recovered.title },
        'a5555555-5555-4555-8555-555555555555',
        vi.fn().mockResolvedValue(recovered),
        { date: '2026-09-07', idempotencyKey: 'a6666666-6666-4666-8666-666666666666' }
      );
      let stored: PersonalDayPlan = {
        date: '2026-09-07',
        version: 0,
        updatedAt: initialUpdatedAt,
        items: [],
      };
      let finishLoad!: (value: PersonalDayPlan) => void;
      const getPlan = vi
        .fn<() => Promise<PersonalDayPlan>>()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishLoad = resolve;
            })
        )
        .mockImplementation(async () => structuredClone(stored));
      const replacePlan = vi.fn(
        async (date: string, submitted: { version: number; items: WorkSourceReference[] }) => {
          expect(submitted.version).toBe(stored.version);
          const previous = stored;
          stored = {
            date,
            version: previous.version + 1,
            updatedAt: '2026-09-07T00:01:00Z',
            items: submitted.items.map((reference, position) => {
              const existing = previous.items.find(
                (item) => item.selectionReference.sourceReference === reference.sourceReference
              );
              return existing
                ? { ...existing, position }
                : {
                    position,
                    selectionReference: {
                      sourceSystem: 'DAY_PLAN_SELECTION',
                      sourceReference: `selection-${reference.sourceReference}`,
                    },
                    source: {
                      availability: 'AVAILABLE' as const,
                      reference,
                      title: 'Created work',
                      sourceRoute: '/work/queue',
                      status: 'OPEN',
                      dueAt: null,
                    },
                  };
            }),
          };
          return structuredClone(stored);
        }
      );
      const createTask = vi.fn().mockResolvedValue(created);
      activeController = createWorkHubController(['personal'], {
        ...workHubControllerClients,
        createPersonalWorkTask: createTask,
        getPersonalDayPlan: getPlan,
        replacePersonalDayPlan: replacePlan,
      });
      preflight.mockResolvedValue(ready);
      function CombinedHarness() {
        useWorkHubCreatedTaskRecovery({
          coordinator: taskSaveCoordinator,
          owner: 'A',
          controller: activeController,
          snapshot: ready,
          preflight,
          ...callbacks,
        });
        return <Harness />;
      }
      await act(async () =>
        root!.render(
          <QueryClientProvider client={client}>
            <CombinedHarness />
          </QueryClientProvider>
        )
      );
      await vi.waitFor(() => expect(getPlan).toHaveBeenCalledOnce());
      const direct = save(input, {
        idempotencyKey: 'a7777777-7777-4777-8777-777777777777',
        addToTodayPlan: true,
      });
      await vi.waitFor(() => expect(createTask).toHaveBeenCalledOnce());
      expect(replacePlan).not.toHaveBeenCalled();
      expect(getPlan).toHaveBeenCalledOnce();
      await act(async () => {
        finishLoad(structuredClone(stored));
        await direct;
      });
      await vi.waitFor(() => expect(taskSaveCoordinator!.confirmedCreates('A')).toEqual([]));
      expect(getPlan).toHaveBeenCalledTimes(2);
      expect(replacePlan).toHaveBeenCalledTimes(2);
      expect(stored.items.map((item) => item.source.reference?.sourceReference)).toEqual([
        recovered.taskId,
        created.taskId,
      ]);
      expect(callbacks.onCreated).toHaveBeenCalledTimes(2);
    }
  );

  it('recovers create plus add-to-plan exactly once after a same-owner route remount', async () => {
    let finish!: (value: ReturnType<typeof personal>) => void;
    const firstCreate = vi.fn(
      () =>
        new Promise<ReturnType<typeof personal>>((resolve) => {
          finish = resolve;
        })
    );
    const secondCreate = vi.fn();
    const planDate = '2026-09-07';
    const created = personal({
      title: input.title,
      priority: input.priority,
      description: input.description,
      dueAt: input.dueAt,
      source: null,
      sources: [],
      checklist: [],
      version: 0,
    });
    const createdReference = {
      sourceSystem: 'PERSONAL_TASK',
      sourceReference: created.taskId,
    };
    const planKey = vi.fn();
    const replacePlan = vi.fn(async (_date, _input, idempotencyKey) => {
      planKey(idempotencyKey);
      return {
        date: planDate,
        version: 1,
        updatedAt: '2026-09-07T00:01:00Z',
        items: [
          {
            position: 0,
            selectionReference: {
              sourceSystem: 'DAY_PLAN_SELECTION',
              sourceReference: 'opaque-created-task',
            },
            source: {
              availability: 'AVAILABLE' as const,
              reference: createdReference,
              title: created.title,
              sourceRoute: '/work/queue',
              status: created.status,
              dueAt: created.dueAt,
            },
          },
        ],
      };
    });
    taskSaveCoordinator = createWorkTaskSaveCoordinator('A');
    activeController = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: firstCreate,
    });
    await render();
    const first = save(input, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      addToTodayPlan: true,
    }).catch((error: Error) => error);
    await vi.waitFor(() => expect(firstCreate).toHaveBeenCalledOnce());

    await act(async () => root!.unmount());
    root = createRoot(host);
    activeController = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: secondCreate,
      getPersonalDayPlan: vi.fn().mockResolvedValue({
        date: planDate,
        version: 0,
        updatedAt: '2026-09-07T00:00:00Z',
        items: [],
      }),
      replacePersonalDayPlan: replacePlan,
    });
    function RecoveryHarness() {
      useWorkHubCreatedTaskRecovery({
        coordinator: taskSaveCoordinator,
        owner: state.owner,
        controller: activeController,
        snapshot: snapshot([personalWorkToHub(created, true)]),
        preflight: async () => snapshot([personalWorkToHub(created, true)]),
        onCreated: callbacks.onCreated,
        onPlanDraftChange: callbacks.onPlanDraftChange,
        onPlanError: callbacks.onPlanError,
        onFeedback: callbacks.onFeedback,
      });
      return null;
    }
    await act(async () =>
      root!.render(
        <QueryClientProvider client={client}>
          <RecoveryHarness />
        </QueryClientProvider>
      )
    );
    finish(created);

    await vi.waitFor(() => expect(replacePlan).toHaveBeenCalledOnce());
    await expect(first).resolves.toMatchObject({ name: 'AbortError' });
    expect(firstCreate).toHaveBeenCalledOnce();
    expect(secondCreate).not.toHaveBeenCalled();
    expect(planKey).toHaveBeenCalledOnce();
    expect(planKey.mock.calls[0]?.[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
    );
    expect(callbacks.onCreated).toHaveBeenCalledWith(createdReference);
    expect(taskSaveCoordinator.confirmedCreates('A')).toEqual([]);
  });
});
