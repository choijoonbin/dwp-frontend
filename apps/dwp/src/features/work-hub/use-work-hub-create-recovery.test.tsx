// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalWorkTaskInput } from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { personal } from './work-hub.test-support';
import { useWorkHubCreateRecovery } from './use-work-hub-create-recovery';
import {
  createWorkTaskSaveCoordinator,
  type WorkTaskCreatePlanIntent,
  type WorkTaskSaveCoordinator,
} from './work-hub-task-save-coordinator';

const owner = 'tenant:user:access';
const input = { title: 'Recovered task', description: null, priority: 'NORMAL' as const };
const receipt = personal({
  title: input.title,
  description: input.description,
  priority: input.priority,
  source: null,
  sources: [],
  checklist: [],
  version: 0,
});
const otherInput: PersonalWorkTaskInput = {
  ...input,
  title: 'Another recovered task',
};
const otherReceipt = personal({
  ...receipt,
  taskId: 'a4444444-4444-4444-8444-444444444444',
  title: otherInput.title,
});
let root: Root;
let host: HTMLDivElement;
let queryClient: QueryClient;

async function confirmDistinctCreatesInReverse(
  coordinator: WorkTaskSaveCoordinator,
  firstPlanIntent: WorkTaskCreatePlanIntent | null = null,
  secondPlanIntent: WorkTaskCreatePlanIntent | null = null
) {
  const finish = new Map<string, (task: ReturnType<typeof personal>) => void>();
  const execute = vi.fn(
    (submitted: PersonalWorkTaskInput) =>
      new Promise<ReturnType<typeof personal>>((resolve) => {
        finish.set(submitted.title, resolve);
      })
  );
  const firstPending = coordinator.runCreate(
    owner,
    input,
    '11111111-1111-4111-8111-111111111111',
    execute,
    firstPlanIntent
  );
  const secondPending = coordinator.runCreate(
    owner,
    otherInput,
    '22222222-2222-4222-8222-222222222222',
    execute,
    secondPlanIntent
  );
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  finish.get(otherInput.title)?.(otherReceipt);
  const second = await secondPending;
  finish.get(input.title)?.(receipt);
  const first = await firstPending;
  return { first, second };
}

describe('Work create receipt recovery', () => {
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

  it('publishes a late same-owner confirmation to a remounted page', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const recovered = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    function Harness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: recovered });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );

    await act(async () => {
      await coordinator.runCreate(
        owner,
        input,
        '11111111-1111-4111-8111-111111111111',
        vi.fn().mockResolvedValue(receipt)
      );
    });
    await vi.waitFor(() =>
      expect(recovered).toHaveBeenCalledWith(
        expect.objectContaining({ planIntent: null, task: receipt }),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          canContinue: expect.any(Function),
        })
      )
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspace', 'work-hub'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['workspace', 'activity'] });
    expect(coordinator.confirmedCreates(owner)).toEqual([]);
  });

  it('does not expose a confirmation through another owner subscription', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const recovered = vi.fn();
    function Harness() {
      useWorkHubCreateRecovery({ coordinator, owner: 'other-owner', onRecovered: recovered });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );
    await coordinator.runCreate(
      owner,
      input,
      '11111111-1111-4111-8111-111111111111',
      vi.fn().mockResolvedValue(receipt)
    );
    await act(async () => Promise.resolve());
    expect(recovered).not.toHaveBeenCalled();
    expect(coordinator.confirmedCreates('other-owner')).toEqual([]);
  });

  it('lets the original submitter claim the receipt before a subscribed recovery consumer', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const recovered = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    function Harness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: recovered });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );

    let confirmationId = -1;
    let claim: ReturnType<typeof coordinator.claimCreate> = null;
    await act(async () => {
      const confirmation = await coordinator.runCreate(
        owner,
        input,
        '11111111-1111-4111-8111-111111111111',
        vi.fn().mockResolvedValue(receipt)
      );
      confirmationId = confirmation.confirmationId;
      claim = coordinator.claimCreate(owner, confirmationId);
      expect(claim).not.toBeNull();
    });
    await act(async () => Promise.resolve());

    expect(recovered).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    coordinator.acknowledgeCreate(owner, claim!);
    expect(coordinator.confirmedCreates(owner)).toEqual([]);
  });

  it('runs one confirmation at a time and continues after releasing a failed recovery', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const confirmations = await confirmDistinctCreatesInReverse(coordinator);
    const acknowledge = vi.spyOn(coordinator, 'acknowledgeCreate');
    const release = vi.spyOn(coordinator, 'releaseCreate');
    const recovered = vi.fn(async (confirmation: typeof confirmations.first) => {
      if (confirmation.confirmationId === confirmations.first.confirmationId) {
        throw new Error('first follow-up failed');
      }
    });
    function Harness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: recovered });
      return null;
    }

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );

    await vi.waitFor(() => expect(recovered).toHaveBeenCalledTimes(2));
    expect(recovered.mock.calls.map(([confirmation]) => confirmation.confirmationId)).toEqual([
      confirmations.first.confirmationId,
      confirmations.second.confirmationId,
    ]);
    expect(acknowledge.mock.calls.map(([, claim]) => claim.confirmationId)).toEqual([
      confirmations.second.confirmationId,
    ]);
    expect(
      release.mock.calls.some(
        ([, claim]) => claim.confirmationId === confirmations.first.confirmationId
      )
    ).toBe(true);
    expect(coordinator.confirmedCreates(owner)).toEqual([
      expect.objectContaining({ confirmationId: confirmations.first.confirmationId }),
    ]);
  });

  it('does not let a stale owner recovery acknowledge the next owner confirmation', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const nextOwner = 'other-tenant:other-user:access';
    const nextCoordinator = createWorkTaskSaveCoordinator(nextOwner);
    const firstConfirmation = await coordinator.runCreate(
      owner,
      input,
      '11111111-1111-4111-8111-111111111111',
      vi.fn().mockResolvedValue(receipt)
    );
    const nextConfirmation = await nextCoordinator.runCreate(
      nextOwner,
      otherInput,
      '22222222-2222-4222-8222-222222222222',
      vi.fn().mockResolvedValue(otherReceipt)
    );
    const firstAcknowledge = vi.spyOn(coordinator, 'acknowledgeCreate');
    const nextAcknowledge = vi.spyOn(nextCoordinator, 'acknowledgeCreate');
    let finishStale!: () => void;
    const stalePending = new Promise<void>((resolve) => {
      finishStale = resolve;
    });
    const staleRecovered = vi.fn(() => stalePending);
    const nextRecovered = vi.fn();
    function Harness({ switched = false }: { switched?: boolean }) {
      useWorkHubCreateRecovery(
        switched
          ? { coordinator: nextCoordinator, owner: nextOwner, onRecovered: nextRecovered }
          : { coordinator, owner, onRecovered: staleRecovered }
      );
      return null;
    }

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(staleRecovered).toHaveBeenCalledOnce());
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness switched />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(nextRecovered).toHaveBeenCalledOnce());
    finishStale();
    await act(async () => stalePending);

    expect(firstAcknowledge).not.toHaveBeenCalled();
    expect(nextAcknowledge.mock.calls.map(([, claim]) => claim.confirmationId)).toEqual([
      nextConfirmation.confirmationId,
    ]);
    expect(coordinator.confirmedCreates(owner)).toEqual([
      expect.objectContaining({ confirmationId: firstConfirmation.confirmationId }),
    ]);
    expect(nextCoordinator.confirmedCreates(nextOwner)).toEqual([]);
  });

  it('releases an unmounted run without clearing or acknowledging the remounted queue', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const confirmations = await confirmDistinctCreatesInReverse(coordinator);
    const acknowledge = vi.spyOn(coordinator, 'acknowledgeCreate');
    let finishStale!: () => void;
    const stalePending = new Promise<void>((resolve) => {
      finishStale = resolve;
    });
    let staleSignal: AbortSignal | undefined;
    const staleRecovered = vi.fn((_confirmation, guard) => {
      staleSignal = guard.signal;
      return stalePending;
    });
    function StaleHarness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: staleRecovered });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <StaleHarness />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(staleRecovered).toHaveBeenCalledOnce());

    await act(async () => root.unmount());
    expect(staleSignal?.aborted).toBe(true);
    root = createRoot(host);
    let finishCurrent!: () => void;
    const currentPending = new Promise<void>((resolve) => {
      finishCurrent = resolve;
    });
    const currentRecovered = vi
      .fn()
      .mockImplementationOnce(() => currentPending)
      .mockResolvedValue(undefined);
    function CurrentHarness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: currentRecovered });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <CurrentHarness />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(currentRecovered).toHaveBeenCalledOnce());

    finishStale();
    await act(async () => stalePending);
    expect(acknowledge).not.toHaveBeenCalled();

    finishCurrent();
    await act(async () => currentPending);
    await vi.waitFor(() => expect(currentRecovered).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(coordinator.confirmedCreates(owner)).toEqual([]));
    expect(acknowledge.mock.calls.map(([, claim]) => claim.confirmationId)).toEqual([
      confirmations.first.confirmationId,
      confirmations.second.confirmationId,
    ]);
  });

  it('prevents a stale recovery from releasing the next claimant lease', async () => {
    const coordinator = createWorkTaskSaveCoordinator(owner);
    const claimCreate = vi.spyOn(coordinator, 'claimCreate');
    await coordinator.runCreate(
      owner,
      input,
      '11111111-1111-4111-8111-111111111111',
      vi.fn().mockResolvedValue(receipt)
    );
    let finishInvalidation!: () => void;
    const pendingInvalidation = new Promise<void>((resolve) => {
      finishInvalidation = resolve;
    });
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockReturnValueOnce(pendingInvalidation)
      .mockReturnValueOnce(pendingInvalidation);
    const staleRecovered = vi.fn();
    function StaleHarness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: staleRecovered });
      return null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <StaleHarness />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));

    await act(async () => root.unmount());
    root = createRoot(host);
    invalidate.mockResolvedValue(undefined);
    let finishCurrentRecovery!: () => void;
    const currentRecovery = new Promise<void>((resolve) => {
      finishCurrentRecovery = resolve;
    });
    const currentRecovered = vi.fn(() => currentRecovery);
    const competingRecovered = vi.fn();
    function CompetingHarness() {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: competingRecovered });
      return null;
    }
    function CurrentHarness({ competing = false }: { competing?: boolean }) {
      useWorkHubCreateRecovery({ coordinator, owner, onRecovered: currentRecovered });
      return competing ? <CompetingHarness /> : null;
    }
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <CurrentHarness />
        </QueryClientProvider>
      )
    );
    await vi.waitFor(() => expect(currentRecovered).toHaveBeenCalledOnce());
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <CurrentHarness competing />
        </QueryClientProvider>
      )
    );
    finishInvalidation();
    await act(async () => pendingInvalidation);

    expect(staleRecovered).not.toHaveBeenCalled();
    expect(competingRecovered).not.toHaveBeenCalled();
    expect(claimCreate).toHaveBeenCalledTimes(2);
    finishCurrentRecovery();
    await act(async () => currentRecovery);
    expect(currentRecovered).toHaveBeenCalledOnce();
    expect(coordinator.confirmedCreates(owner)).toEqual([]);
  });
});
