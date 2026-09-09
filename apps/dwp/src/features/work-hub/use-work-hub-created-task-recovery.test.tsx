// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PersonalDayPlan,
  PersonalWorkTaskInput,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { useWorkHubCreatedTaskRecovery } from './use-work-hub-created-task-recovery';
import { createWorkHubController, workHubControllerClients } from './work-hub-controller';
import type { WorkHubSnapshot } from './work-hub-contracts';
import { verifiedWorkHubSnapshotFromRefetch } from './work-hub-page-helpers';
import { personal, snapshot } from './work-hub.test-support';
import { personalWorkToHub } from './work-hub-source-adapters';
import { createWorkTaskSaveCoordinator } from './work-hub-task-save-coordinator';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const owner = 'tenant:user:access';
const planDate = '2026-09-08';
const firstInput: PersonalWorkTaskInput = {
  title: 'Recover first task',
  description: null,
  priority: 'NORMAL',
  dueAt: null,
};
const secondInput: PersonalWorkTaskInput = {
  ...firstInput,
  title: 'Recover second task',
};
const firstReceipt = personal({
  taskId: 'a1111111-1111-4111-8111-111111111111',
  title: firstInput.title,
  description: firstInput.description ?? null,
  priority: firstInput.priority,
  dueAt: firstInput.dueAt ?? null,
  source: null,
  sources: [],
  checklist: [],
  version: 0,
});
const secondReceipt = personal({
  ...firstReceipt,
  taskId: 'a2222222-2222-4222-8222-222222222222',
  title: secondInput.title,
});
const firstPlanKey = 'a3333333-3333-4333-8333-333333333333';
const secondPlanKey = 'a4444444-4444-4444-8444-444444444444';

function clonePlan(plan: PersonalDayPlan): PersonalDayPlan {
  return structuredClone(plan);
}

describe('Work created task recovery', () => {
  let root: Root;
  let host: HTMLDivElement;
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  it.each([null, '2026-09-08T00:00:00Z'])(
    'saves both reversed create receipts with initial plan timestamp %s',
    async (initialUpdatedAt) => {
      const coordinator = createWorkTaskSaveCoordinator(owner);
      const finish = new Map<string, (task: ReturnType<typeof personal>) => void>();
      const execute = vi.fn(
        (submitted: PersonalWorkTaskInput) =>
          new Promise<ReturnType<typeof personal>>((resolve) => {
            finish.set(submitted.title, resolve);
          })
      );
      const firstPending = coordinator.runCreate(
        owner,
        firstInput,
        'a5555555-5555-4555-8555-555555555555',
        execute,
        { date: planDate, idempotencyKey: firstPlanKey }
      );
      const secondPending = coordinator.runCreate(
        owner,
        secondInput,
        'a6666666-6666-4666-8666-666666666666',
        execute,
        { date: planDate, idempotencyKey: secondPlanKey }
      );
      await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
      finish.get(secondInput.title)?.(secondReceipt);
      const secondConfirmation = await secondPending;
      finish.get(firstInput.title)?.(firstReceipt);
      const firstConfirmation = await firstPending;

      let storedPlan: PersonalDayPlan = {
        date: planDate,
        version: 0,
        updatedAt: initialUpdatedAt,
        items: [],
      };
      const getPlan = vi.fn(async () => clonePlan(storedPlan));
      const replacePlan = vi.fn(
        async (
          date: string,
          input: { version: number; items: WorkSourceReference[] },
          _idempotencyKey: string
        ) => {
          expect(date).toBe(planDate);
          expect(input.version).toBe(storedPlan.version);
          const previous = storedPlan;
          storedPlan = {
            date,
            version: previous.version + 1,
            updatedAt: `2026-09-08T00:0${previous.version + 1}:00Z`,
            items: input.items.map((reference, position) => {
              if (reference.sourceSystem === 'DAY_PLAN_SELECTION') {
                const existing = previous.items.find(
                  (item) =>
                    item.selectionReference.sourceSystem === reference.sourceSystem &&
                    item.selectionReference.sourceReference === reference.sourceReference
                );
                if (!existing) throw new Error('Unknown existing plan selection');
                return { ...existing, position };
              }
              const task =
                reference.sourceReference === firstReceipt.taskId ? firstReceipt : secondReceipt;
              return {
                position,
                selectionReference: {
                  sourceSystem: 'DAY_PLAN_SELECTION',
                  sourceReference: `selection-${reference.sourceReference}`,
                },
                source: {
                  availability: 'AVAILABLE' as const,
                  reference: { ...reference },
                  title: task.title,
                  sourceRoute: '/work/queue',
                  status: task.status,
                  dueAt: task.dueAt,
                },
              };
            }),
          };
          return clonePlan(storedPlan);
        }
      );
      const controller = createWorkHubController(['personal'], {
        ...workHubControllerClients,
        getPersonalDayPlan: getPlan,
        replacePersonalDayPlan: replacePlan,
      });
      const onCreated = vi.fn();
      function Harness() {
        useWorkHubCreatedTaskRecovery({
          coordinator,
          owner,
          controller,
          snapshot: snapshot([
            personalWorkToHub(firstReceipt, true),
            personalWorkToHub(secondReceipt, true),
          ]),
          preflight: async () =>
            snapshot([
              personalWorkToHub(firstReceipt, true),
              personalWorkToHub(secondReceipt, true),
            ]),
          onCreated,
          onPlanDraftChange: vi.fn(),
          onPlanError: vi.fn(),
          onFeedback: vi.fn(),
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

      await vi.waitFor(() => expect(replacePlan).toHaveBeenCalledTimes(2));
      expect(replacePlan.mock.calls.map(([, , idempotencyKey]) => idempotencyKey)).toEqual([
        firstPlanKey,
        secondPlanKey,
      ]);
      expect(getPlan).toHaveBeenCalledTimes(2);
      expect(storedPlan.items.map((item) => item.source.reference?.sourceReference)).toEqual([
        firstReceipt.taskId,
        secondReceipt.taskId,
      ]);
      expect(onCreated.mock.calls.map(([reference]) => reference.sourceReference)).toEqual([
        firstReceipt.taskId,
        secondReceipt.taskId,
      ]);
      expect(firstConfirmation.confirmationId).toBeLessThan(secondConfirmation.confirmationId);
      expect(coordinator.confirmedCreates(owner)).toEqual([]);
    }
  );

  it.each([
    [
      'cached data from a failed refetch',
      () =>
        verifiedWorkHubSnapshotFromRefetch({
          data: { snapshot: snapshot([personalWorkToHub(firstReceipt, true)]) },
          isSuccess: true,
          isRefetchError: true,
        }),
    ],
    [
      'an unavailable personal source',
      () => {
        const cached = snapshot([personalWorkToHub(firstReceipt, true)]);
        return {
          ...cached,
          completeness: 'UNAVAILABLE' as const,
          sources: cached.sources.map((source) => ({
            ...source,
            state: 'UNAVAILABLE' as const,
            receivedAt: null,
          })),
        };
      },
    ],
    [
      'a READY aggregate containing a different task',
      () => snapshot([personalWorkToHub(secondReceipt, true)]),
    ],
  ])('keeps the plan intent recoverable without a PUT for %s', async (_label, freshSnapshot) => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const confirmation = await coordinator.runCreate(
      owner,
      firstInput,
      'a5555555-5555-4555-8555-555555555555',
      vi.fn().mockResolvedValue(firstReceipt),
      { date: planDate, idempotencyKey: firstPlanKey }
    );
    const acknowledge = vi.spyOn(coordinator, 'acknowledgeCreate');
    const release = vi.spyOn(coordinator, 'releaseCreate');
    const getPlan = vi.fn();
    const replacePlan = vi.fn();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: getPlan,
      replacePersonalDayPlan: replacePlan,
    });
    const onCreated = vi.fn();
    const commandSnapshot = freshSnapshot();
    const currentSnapshot =
      _label === 'cached data from a failed refetch'
        ? snapshot([personalWorkToHub(firstReceipt, true)])
        : (commandSnapshot ?? snapshot([personalWorkToHub(firstReceipt, true)]));
    const preflight = vi.fn(async () => commandSnapshot);
    function Harness() {
      useWorkHubCreatedTaskRecovery({
        coordinator,
        owner,
        controller,
        snapshot: currentSnapshot,
        preflight,
        onCreated,
        onPlanDraftChange: vi.fn(),
        onPlanError: vi.fn(),
        onFeedback: vi.fn(),
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

    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
    await act(async () => Promise.resolve());
    expect(preflight).toHaveBeenCalledOnce();
    expect(acknowledge).not.toHaveBeenCalled();
    expect(getPlan).not.toHaveBeenCalled();
    expect(replacePlan).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(coordinator.confirmedCreates(owner)).toEqual([
      expect.objectContaining({ confirmationId: confirmation.confirmationId }),
    ]);
  });

  it('retries once when the personal aggregate becomes READY in the same mount', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const confirmation = await coordinator.runCreate(
      owner,
      firstInput,
      'a5555555-5555-4555-8555-555555555555',
      vi.fn().mockResolvedValue(firstReceipt),
      { date: planDate, idempotencyKey: firstPlanKey }
    );
    const acknowledge = vi.spyOn(coordinator, 'acknowledgeCreate');
    const release = vi.spyOn(coordinator, 'releaseCreate');
    const readySnapshot = snapshot([personalWorkToHub(firstReceipt, true)]);
    const unavailableSnapshot = {
      ...readySnapshot,
      completeness: 'UNAVAILABLE' as const,
      sources: readySnapshot.sources.map((source) => ({
        ...source,
        state: 'UNAVAILABLE' as const,
        receivedAt: null,
      })),
    };
    let commandSnapshot: WorkHubSnapshot = unavailableSnapshot;
    const preflight = vi.fn(async () => commandSnapshot);
    const getPlan = vi.fn().mockResolvedValue({
      date: planDate,
      version: 0,
      updatedAt: '2026-09-08T00:00:00Z',
      items: [],
    });
    const replacePlan = vi.fn(
      async (
        date: string,
        input: { version: number; items: WorkSourceReference[] },
        idempotencyKey: string
      ) => {
        expect(idempotencyKey).toBe(firstPlanKey);
        return {
          date,
          version: input.version + 1,
          updatedAt: '2026-09-08T00:01:00Z',
          items: input.items.map((reference, position) => ({
            position,
            selectionReference: {
              sourceSystem: 'DAY_PLAN_SELECTION' as const,
              sourceReference: `selection-${reference.sourceReference}`,
            },
            source: {
              availability: 'AVAILABLE' as const,
              reference: { ...reference },
              title: firstReceipt.title,
              sourceRoute: '/work/queue',
              status: firstReceipt.status,
              dueAt: firstReceipt.dueAt,
            },
          })),
        };
      }
    );
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: getPlan,
      replacePersonalDayPlan: replacePlan,
    });
    const onCreated = vi.fn();
    function Harness({ aggregate }: { aggregate: typeof readySnapshot }) {
      useWorkHubCreatedTaskRecovery({
        coordinator,
        owner,
        controller,
        snapshot: aggregate,
        preflight,
        onCreated,
        onPlanDraftChange: vi.fn(),
        onPlanError: vi.fn(),
        onFeedback: vi.fn(),
      });
      return null;
    }

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness aggregate={unavailableSnapshot} />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
    await act(async () => Promise.resolve());
    expect(preflight).toHaveBeenCalledOnce();
    expect(getPlan).not.toHaveBeenCalled();
    expect(replacePlan).not.toHaveBeenCalled();
    expect(acknowledge).not.toHaveBeenCalled();

    commandSnapshot = readySnapshot;
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness aggregate={readySnapshot} />
        </QueryClientProvider>
      )
    );

    await vi.waitFor(() => expect(coordinator.confirmedCreates(owner)).toEqual([]));
    expect(preflight).toHaveBeenCalledTimes(3);
    expect(getPlan).toHaveBeenCalledOnce();
    expect(replacePlan).toHaveBeenCalledOnce();
    expect(acknowledge.mock.calls.map(([, claim]) => claim.confirmationId)).toEqual([
      confirmation.confirmationId,
    ]);
    expect(release).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
  });

  it.each(['outage', 'identity drift', 'version drift'] as const)(
    'rechecks authority after loading the plan and retains the receipt after %s',
    async (failure) => {
      const coordinator = createWorkTaskSaveCoordinator(owner);
      await coordinator.runCreate(
        owner,
        firstInput,
        'a5555555-5555-4555-8555-555555555555',
        vi.fn().mockResolvedValue(firstReceipt),
        { date: planDate, idempotencyKey: firstPlanKey }
      );
      const acknowledge = vi.spyOn(coordinator, 'acknowledgeCreate');
      const release = vi.spyOn(coordinator, 'releaseCreate');
      const ready = snapshot([personalWorkToHub(firstReceipt, true)]);
      const changed =
        failure === 'outage'
          ? { ...ready, completeness: 'UNAVAILABLE' as const }
          : snapshot([
              personalWorkToHub(
                failure === 'identity drift'
                  ? secondReceipt
                  : { ...firstReceipt, version: firstReceipt.version + 1 },
                true
              ),
            ]);
      const preflight = vi.fn().mockResolvedValueOnce(ready).mockResolvedValue(changed);
      const getPlan = vi.fn().mockResolvedValue({
        date: planDate,
        version: 0,
        updatedAt: '2026-09-08T00:00:00Z',
        items: [],
      });
      const replacePlan = vi.fn();
      const controller = createWorkHubController(['personal'], {
        ...workHubControllerClients,
        getPersonalDayPlan: getPlan,
        replacePersonalDayPlan: replacePlan,
      });
      const onCreated = vi.fn();
      function Harness() {
        useWorkHubCreatedTaskRecovery({
          coordinator,
          owner,
          controller,
          snapshot: ready,
          preflight,
          onCreated,
          onPlanDraftChange: vi.fn(),
          onPlanError: vi.fn(),
          onFeedback: vi.fn(),
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
      await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
      await act(async () => Promise.resolve());
      expect(preflight).toHaveBeenCalledTimes(2);
      expect(getPlan).toHaveBeenCalledOnce();
      expect(replacePlan).not.toHaveBeenCalled();
      expect(acknowledge).not.toHaveBeenCalled();
      expect(onCreated).not.toHaveBeenCalled();
      expect(coordinator.confirmedCreates(owner)).toHaveLength(1);
    }
  );

  it('does not retry a persistent aggregate outage when retained personal timestamps change', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    await coordinator.runCreate(
      owner,
      firstInput,
      'a5555555-5555-4555-8555-555555555555',
      vi.fn().mockResolvedValue(firstReceipt),
      { date: planDate, idempotencyKey: firstPlanKey }
    );
    const release = vi.spyOn(coordinator, 'releaseCreate');
    let unavailable = {
      ...snapshot([personalWorkToHub(firstReceipt, true)]),
      completeness: 'UNAVAILABLE' as const,
    };
    const preflight = vi.fn(async () => unavailable);
    const getPlan = vi.fn();
    const replacePlan = vi.fn();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: getPlan,
      replacePersonalDayPlan: replacePlan,
    });
    function Harness() {
      useWorkHubCreatedTaskRecovery({
        coordinator,
        owner,
        controller,
        snapshot: unavailable,
        preflight,
        onCreated: vi.fn(),
        onPlanDraftChange: vi.fn(),
        onPlanError: vi.fn(),
        onFeedback: vi.fn(),
      });
      return null;
    }
    const render = () =>
      act(async () =>
        root.render(
          <QueryClientProvider client={queryClient}>
            <Harness />
          </QueryClientProvider>
        )
      );
    await render();
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
    for (let minute = 1; minute <= 3; minute += 1) {
      unavailable = {
        ...unavailable,
        sources: unavailable.sources.map((source) => ({
          ...source,
          receivedAt: `2026-09-08T00:0${minute}:00Z`,
        })),
      };
      await render();
    }
    expect(preflight).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(getPlan).not.toHaveBeenCalled();
    expect(replacePlan).not.toHaveBeenCalled();
    expect(coordinator.confirmedCreates(owner)).toHaveLength(1);
  });
});
