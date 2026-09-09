import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  WorkTaskCreateClaim,
  WorkTaskCreateConfirmation,
  WorkTaskSaveCoordinator,
} from './work-hub-task-save-coordinator';

const noConfirmations = [] as const;

export type WorkTaskCreateRecoveryGuard = {
  signal: AbortSignal;
  canContinue: () => boolean;
};

type RecoveryRun = {
  confirmationId: number;
  claim: WorkTaskCreateClaim;
  consumer: symbol;
  coordinator: WorkTaskSaveCoordinator;
  generation: number;
  owner: string;
  retryRevision: string | undefined;
  abort: AbortController;
};

type RecoveryLane = {
  active: RecoveryRun | null;
  attempted: Map<number, Set<string | undefined>>;
  consumers: Set<symbol>;
};

const recoveryLanes = new WeakMap<WorkTaskSaveCoordinator, RecoveryLane>();

function recoveryLane(coordinator: WorkTaskSaveCoordinator) {
  const existing = recoveryLanes.get(coordinator);
  if (existing) return existing;
  const lane: RecoveryLane = {
    active: null,
    attempted: new Map(),
    consumers: new Set(),
  };
  recoveryLanes.set(coordinator, lane);
  return lane;
}

export class WorkTaskCreateRecoveryDeferredError extends Error {
  constructor(readonly retryRevision: string | undefined) {
    super('Work create recovery is waiting for a newer aggregate');
    this.name = 'WorkTaskCreateRecoveryDeferredError';
  }
}

export function useWorkHubCreateRecovery({
  coordinator,
  owner,
  onRecovered,
  retryRevision,
}: {
  coordinator?: WorkTaskSaveCoordinator;
  owner: string | null;
  onRecovered: (
    confirmation: WorkTaskCreateConfirmation,
    guard: WorkTaskCreateRecoveryGuard
  ) => void | Promise<void>;
  retryRevision?: string;
}) {
  const queryClient = useQueryClient();
  const current = useRef({ coordinator, owner, onRecovered, retryRevision });
  current.current = { coordinator, owner, onRecovered, retryRevision };
  const lifecycle = useRef({
    coordinator,
    generation: 0,
    mounted: false,
    owner,
  });
  const consumer = useRef(Symbol('work-create-recovery')).current;
  const processing = useRef<RecoveryRun | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => coordinator?.subscribe(listener) ?? (() => undefined),
    [coordinator]
  );
  const getSnapshot = useCallback(
    () => (coordinator && owner ? coordinator.confirmedCreates(owner) : noConfirmations),
    [coordinator, owner]
  );
  const confirmations = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const generation = lifecycle.current.generation + 1;
    lifecycle.current = { coordinator, generation, mounted: true, owner };
    const lane = coordinator ? recoveryLane(coordinator) : null;
    lane?.consumers.add(consumer);
    return () => {
      if (lifecycle.current.generation === generation) {
        lifecycle.current = { coordinator, generation, mounted: false, owner };
      }
      const run = processing.current;
      if (run?.consumer === consumer && run.generation === generation) {
        run.abort.abort();
        run.coordinator.releaseCreate(run.owner, run.claim);
        if (processing.current === run) processing.current = null;
        if (lane?.active === run) lane.active = null;
      }
      lane?.consumers.delete(consumer);
      if (lane?.consumers.size === 0) lane.attempted.clear();
    };
  }, [consumer, coordinator, owner]);

  useEffect(() => {
    const mounted = lifecycle.current;
    if (
      !owner ||
      !coordinator ||
      !mounted.mounted ||
      mounted.coordinator !== coordinator ||
      mounted.owner !== owner ||
      processing.current
    ) {
      return;
    }
    const lane = recoveryLane(coordinator);
    if (lane.active) return;
    const availableIds = new Set(confirmations.map(({ confirmationId }) => confirmationId));
    for (const attempted of lane.attempted.keys()) {
      if (!availableIds.has(attempted)) lane.attempted.delete(attempted);
    }
    const confirmation = confirmations.find(
      ({ confirmationId }) => !lane.attempted.get(confirmationId)?.has(retryRevision)
    );
    if (!confirmation) return;
    const claim = coordinator.claimCreate(owner, confirmation.confirmationId);
    if (!claim) return;
    const run: RecoveryRun = {
      claim,
      confirmationId: confirmation.confirmationId,
      consumer,
      coordinator,
      generation: mounted.generation,
      owner,
      retryRevision,
      abort: new AbortController(),
    };
    processing.current = run;
    lane.active = run;
    const canContinue = () => {
      const latest = lifecycle.current;
      return (
        latest.mounted &&
        latest.generation === run.generation &&
        latest.coordinator === run.coordinator &&
        latest.owner === run.owner &&
        current.current.coordinator === run.coordinator &&
        current.current.owner === run.owner &&
        processing.current === run &&
        lane.active === run &&
        !run.abort.signal.aborted
      );
    };
    void (async () => {
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
          queryClient.invalidateQueries({ queryKey: ['workspace', 'activity'] }),
        ]);
        if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
        await current.current.onRecovered(confirmation, {
          signal: run.abort.signal,
          canContinue,
        });
        if (!canContinue()) throw new DOMException('Work owner changed', 'AbortError');
        run.coordinator.acknowledgeCreate(run.owner, run.claim);
      } catch (error) {
        if (canContinue()) {
          const blockedRevisions = lane.attempted.get(run.confirmationId) ?? new Set();
          blockedRevisions.add(run.retryRevision);
          if (error instanceof WorkTaskCreateRecoveryDeferredError) {
            blockedRevisions.add(error.retryRevision);
          }
          lane.attempted.set(run.confirmationId, blockedRevisions);
        }
        run.coordinator.releaseCreate(run.owner, run.claim);
      } finally {
        if (processing.current === run) processing.current = null;
        if (lane.active === run) lane.active = null;
      }
    })();
  }, [confirmations, consumer, coordinator, owner, queryClient, retryRevision]);
}
