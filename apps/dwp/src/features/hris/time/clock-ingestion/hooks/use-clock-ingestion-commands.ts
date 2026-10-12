import { useCallback, useEffect, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  ClockCommandOutcomeUnknownError,
  assertRecordClockEventRequest,
} from '../api/clock-ingestion-api';
import { assertClockReceiptReplayInvariant } from '../model/clock-ingestion-model';

import type { ClockIngestionDataSource } from '../api/clock-ingestion-api';
import type {
  ClockCommandReceipt,
  ClockEvent,
  ClockIngestionScope,
  RecordClockEventRequest,
} from '../model/clock-ingestion-model';
import type {
  ProductSurfaceGovernedMutationAuthority,
  ProductSurfaceSecureMutationAuthority,
} from '@dwp-frontend/shared-utils';

export type ClockRecordAuthorityExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
) => Promise<T>;

export type ClockVoidCommandBinding = Readonly<{
  eventId: string;
  expectedObjectVersion: number;
  idempotencyKey: string;
  request: Readonly<{ reasonCode: string }>;
}>;

export type ClockVoidAuthorityExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>,
  binding: ClockVoidCommandBinding
) => Promise<T>;

export type ClockRecordCommandOwnerBinding = Readonly<{
  routeContractKey: 'route.hcm.personal.time-clock-event-record.action';
  execute: ClockRecordAuthorityExecutor;
}>;

export type ClockVoidCommandOwnerBinding = Readonly<{
  routeContractKey: 'route.hcm.operations.time-clock-event-void.action';
  execute: ClockVoidAuthorityExecutor;
}>;

export type ClockCommandOwnerBinding = Readonly<{
  record?: ClockRecordCommandOwnerBinding;
  voidEvent?: ClockVoidCommandOwnerBinding;
}>;

export type ClockCommandFeedback =
  | Readonly<{ kind: 'SUCCESS'; receipt: ClockCommandReceipt }>
  | Readonly<{ kind: 'REJECTED'; retryExact: false }>
  | Readonly<{ kind: 'RESULT_UNKNOWN'; retryExact: true }>;

type PendingRecord = Readonly<{
  kind: 'RECORD';
  scopeIdentity: string;
  scopeEpoch: number;
  idempotencyKey: string;
  request: RecordClockEventRequest;
  observedReceipt?: ClockCommandReceipt;
}>;

type PendingVoid = Readonly<{
  kind: 'VOID';
  scopeIdentity: string;
  scopeEpoch: number;
  idempotencyKey: string;
  event: ClockEvent;
  request: Readonly<{ reasonCode: string }>;
  observedReceipt?: ClockCommandReceipt;
}>;

type PendingCommand = PendingRecord | PendingVoid;

type ScopeBinding = Readonly<{
  identity: string;
  epoch: number;
}>;

function sameScopeBinding(left: ScopeBinding, right: ScopeBinding): boolean {
  return left.identity === right.identity && left.epoch === right.epoch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function newCommandId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Secure TIM command identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

function authorityWithCommandId(
  authority: ProductSurfaceGovernedMutationAuthority,
  idempotencyKey: string
): ProductSurfaceSecureMutationAuthority {
  if (authority.mode !== 'SECURE') {
    throw new Error('Secure TIM command authority is required.');
  }
  if (authority.idempotencyKey !== undefined && authority.idempotencyKey !== idempotencyKey) {
    throw new Error('TIM authority changed the pending command identity.');
  }
  return { ...authority, idempotencyKey };
}

function isAmbiguous(error: unknown): boolean {
  if (error instanceof ClockCommandOutcomeUnknownError) return true;
  if (error instanceof HttpTransportError) return true;
  return (
    error instanceof HttpError &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

function assertReceiptMatchesPending(
  command: PendingCommand,
  receipt: ClockCommandReceipt,
  scope: ClockIngestionScope
): void {
  const record = command.kind === 'RECORD';
  if (
    receipt.commandType !== (record ? 'CLOCK_RECORD' : 'CLOCK_VOID') ||
    receipt.originatingAction !== (record ? 'TIME_CLOCK_RECORD' : 'TIME_CLOCK_CORRECT') ||
    receipt.purposeCode !== 'TIME_CAPTURE' ||
    receipt.correlationId !== scope.correlationId ||
    (!record && receipt.resultRef !== null && receipt.resultRef !== command.event.clockEventId)
  ) {
    throw new Error('TIM command receipt does not match the pending command.');
  }
  if (command.observedReceipt) {
    assertClockReceiptReplayInvariant(command.observedReceipt, receipt);
  }
}

export function useClockIngestionCommands({
  dataSource,
  owner,
  scope,
  reload,
  idFactory = newCommandId,
}: Readonly<{
  dataSource: ClockIngestionDataSource;
  owner?: ClockCommandOwnerBinding;
  scope: ClockIngestionScope;
  reload: () => void;
  idFactory?: () => string;
}>) {
  const [recordOpen, setRecordOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ClockEvent | null>(null);
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ClockCommandFeedback | null>(null);
  const scopeIdentity = JSON.stringify([
    scope.ready,
    scope.contextScopeKey,
    scope.decisionRevision,
    scope.locale,
    scope.timeZone,
    scope.correlationId,
  ]);
  const renderedScopeIdentityRef = useRef(scopeIdentity);
  const scopeEpochRef = useRef(0);
  if (renderedScopeIdentityRef.current !== scopeIdentity) {
    renderedScopeIdentityRef.current = scopeIdentity;
    scopeEpochRef.current += 1;
  }
  const scopeEpoch = scopeEpochRef.current;
  const currentScopeBinding: ScopeBinding = { identity: scopeIdentity, epoch: scopeEpoch };
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingCommand | null>(null);
  const commandAbortRef = useRef<AbortController | null>(null);
  const currentScopeBindingRef = useRef(currentScopeBinding);
  const commandStateBindingRef = useRef(currentScopeBinding);
  const [commandStateBinding, setCommandStateBinding] = useState(currentScopeBinding);
  currentScopeBindingRef.current = currentScopeBinding;
  const scopeBindingCurrent = sameScopeBinding(commandStateBinding, currentScopeBinding);
  const isCurrentBinding = useCallback((identity: string, epoch: number) => {
    const binding = { identity, epoch };
    return (
      sameScopeBinding(binding, currentScopeBindingRef.current) &&
      sameScopeBinding(binding, commandStateBindingRef.current)
    );
  }, []);
  const storePending = useCallback((next: PendingCommand | null) => {
    pendingRef.current = next;
    setPending(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      commandAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const nextScopeBinding = { identity: scopeIdentity, epoch: scopeEpoch };
    if (sameScopeBinding(commandStateBindingRef.current, nextScopeBinding)) return;
    commandStateBindingRef.current = nextScopeBinding;
    setCommandStateBinding(nextScopeBinding);
    commandAbortRef.current?.abort();
    commandAbortRef.current = null;
    busyRef.current = false;
    setBusy(false);
    storePending(null);
    setRecordOpen(false);
    setVoidTarget(null);
    setFeedback(null);
  }, [scopeEpoch, scopeIdentity, storePending]);

  const execute = useCallback(
    async (command: PendingCommand): Promise<void> => {
      if (
        busyRef.current ||
        !scope.ready ||
        !isCurrentBinding(command.scopeIdentity, command.scopeEpoch)
      )
        return;
      const recordExecutor =
        owner?.record?.routeContractKey === 'route.hcm.personal.time-clock-event-record.action'
          ? owner.record.execute
          : undefined;
      const voidExecutor =
        owner?.voidEvent?.routeContractKey === 'route.hcm.operations.time-clock-event-void.action'
          ? owner.voidEvent.execute
          : undefined;
      const executor = command.kind === 'RECORD' ? recordExecutor : voidExecutor;
      if (!executor || !isCurrentBinding(command.scopeIdentity, command.scopeEpoch)) {
        storePending(null);
        setFeedback({ kind: 'REJECTED', retryExact: false });
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setFeedback(null);
      const abort = new AbortController();
      commandAbortRef.current = abort;
      const signal = abort.signal;
      let receipt: ClockCommandReceipt | undefined;
      try {
        if (command.kind === 'RECORD') {
          receipt = await (executor as ClockRecordAuthorityExecutor)(async (authority) => {
            if (signal.aborted || !isCurrentBinding(command.scopeIdentity, command.scopeEpoch)) {
              throw new HttpTransportError('ABORT');
            }
            return dataSource.record(
              command.request,
              scope,
              authorityWithCommandId(authority, command.idempotencyKey),
              signal
            );
          });
        } else {
          const version = command.event.eventOrder;
          if (
            version === null ||
            !command.event.availableActions.some(
              (action) => action.actionKey === 'hris.action.tim.clock.void'
            )
          ) {
            throw new HttpError('The corrective action is unavailable.', 403);
          }
          receipt = await (executor as ClockVoidAuthorityExecutor)(
            async (authority) => {
              if (signal.aborted || !isCurrentBinding(command.scopeIdentity, command.scopeEpoch)) {
                throw new HttpTransportError('ABORT');
              }
              return dataSource.voidEvent(
                command.event.clockEventId,
                command.request.reasonCode,
                version,
                scope,
                authorityWithCommandId(authority, command.idempotencyKey),
                signal
              );
            },
            {
              eventId: command.event.clockEventId,
              expectedObjectVersion: version,
              idempotencyKey: command.idempotencyKey,
              request: command.request,
            }
          );
        }
        assertReceiptMatchesPending(command, receipt, scope);
        if (!mountedRef.current) return;
        if (!isCurrentBinding(command.scopeIdentity, command.scopeEpoch)) return;
        storePending(null);
        setRecordOpen(false);
        setVoidTarget(null);
        setFeedback({ kind: 'SUCCESS', receipt });
        reload();
      } catch (error) {
        if (!mountedRef.current) return;
        if (!isCurrentBinding(command.scopeIdentity, command.scopeEpoch)) return;
        const ambiguous = receipt !== undefined || isAmbiguous(error);
        storePending(
          ambiguous ? { ...command, ...(receipt ? { observedReceipt: receipt } : {}) } : null
        );
        setFeedback(
          ambiguous
            ? { kind: 'RESULT_UNKNOWN', retryExact: true }
            : { kind: 'REJECTED', retryExact: false }
        );
      } finally {
        if (commandAbortRef.current === abort) {
          commandAbortRef.current = null;
          busyRef.current = false;
          if (mountedRef.current && isCurrentBinding(command.scopeIdentity, command.scopeEpoch))
            setBusy(false);
        }
      }
    },
    [dataSource, isCurrentBinding, owner?.record, owner?.voidEvent, reload, scope, storePending]
  );

  const submitRecord = useCallback(
    (request: RecordClockEventRequest) => {
      if (!scope.ready || !isCurrentBinding(scopeIdentity, scopeEpoch)) return Promise.resolve();
      if (busyRef.current || pendingRef.current) {
        if (pendingRef.current) setFeedback({ kind: 'RESULT_UNKNOWN', retryExact: true });
        return Promise.resolve();
      }
      let idempotencyKey: string;
      try {
        assertRecordClockEventRequest(request);
        idempotencyKey = idFactory();
        if (!UUID.test(idempotencyKey)) throw new Error('Invalid command identity.');
      } catch {
        storePending(null);
        setFeedback({ kind: 'REJECTED', retryExact: false });
        return Promise.resolve();
      }
      const command: PendingRecord = {
        kind: 'RECORD',
        scopeIdentity,
        scopeEpoch,
        idempotencyKey,
        request: Object.freeze({ ...request }),
      };
      storePending(command);
      return execute(command);
    },
    [execute, idFactory, isCurrentBinding, scope.ready, scopeEpoch, scopeIdentity, storePending]
  );

  const submitVoid = useCallback(
    (reasonCode: string) => {
      if (!scope.ready || !isCurrentBinding(scopeIdentity, scopeEpoch) || !voidTarget) {
        return Promise.resolve();
      }
      if (busyRef.current || pendingRef.current) {
        if (pendingRef.current) setFeedback({ kind: 'RESULT_UNKNOWN', retryExact: true });
        return Promise.resolve();
      }
      let idempotencyKey: string;
      try {
        idempotencyKey = idFactory();
      } catch {
        storePending(null);
        setFeedback({ kind: 'REJECTED', retryExact: false });
        return Promise.resolve();
      }
      if (
        !UUID.test(idempotencyKey) ||
        !/^[A-Z][A-Z0-9_]{1,79}$/u.test(reasonCode) ||
        voidTarget.eventOrder === null ||
        !voidTarget.availableActions.some(
          (action) => action.actionKey === 'hris.action.tim.clock.void'
        )
      ) {
        storePending(null);
        setFeedback({ kind: 'REJECTED', retryExact: false });
        return Promise.resolve();
      }
      const command: PendingVoid = {
        kind: 'VOID',
        scopeIdentity,
        scopeEpoch,
        idempotencyKey,
        event: voidTarget,
        request: Object.freeze({ reasonCode }),
      };
      storePending(command);
      return execute(command);
    },
    [
      execute,
      idFactory,
      isCurrentBinding,
      scope.ready,
      scopeEpoch,
      scopeIdentity,
      storePending,
      voidTarget,
    ]
  );

  const retryExact = useCallback(() => {
    const command = pendingRef.current;
    return command &&
      isCurrentBinding(scopeIdentity, scopeEpoch) &&
      command.scopeIdentity === scopeIdentity &&
      command.scopeEpoch === scopeEpoch
      ? execute(command)
      : Promise.resolve();
  }, [execute, isCurrentBinding, scopeEpoch, scopeIdentity]);

  const openRecord = useCallback(() => {
    if (!scope.ready || !isCurrentBinding(scopeIdentity, scopeEpoch)) return;
    if (pendingRef.current) {
      setFeedback({ kind: 'RESULT_UNKNOWN', retryExact: true });
      return;
    }
    setFeedback(null);
    setRecordOpen(true);
  }, [isCurrentBinding, scope.ready, scopeEpoch, scopeIdentity]);

  const closeRecord = useCallback(() => {
    if (isCurrentBinding(scopeIdentity, scopeEpoch) && !busyRef.current) setRecordOpen(false);
  }, [isCurrentBinding, scopeEpoch, scopeIdentity]);

  const openVoid = useCallback(
    (event: ClockEvent) => {
      if (!scope.ready || !isCurrentBinding(scopeIdentity, scopeEpoch)) return;
      if (pendingRef.current) {
        setFeedback({ kind: 'RESULT_UNKNOWN', retryExact: true });
        return;
      }
      if (
        !event.availableActions.some((action) => action.actionKey === 'hris.action.tim.clock.void')
      ) {
        setFeedback({ kind: 'REJECTED', retryExact: false });
        return;
      }
      setFeedback(null);
      setVoidTarget(event);
    },
    [isCurrentBinding, scope.ready, scopeEpoch, scopeIdentity]
  );

  const closeVoid = useCallback(() => {
    if (isCurrentBinding(scopeIdentity, scopeEpoch) && !busyRef.current) setVoidTarget(null);
  }, [isCurrentBinding, scopeEpoch, scopeIdentity]);

  const dismissFeedback = useCallback(() => {
    if (isCurrentBinding(scopeIdentity, scopeEpoch)) setFeedback(null);
  }, [isCurrentBinding, scopeEpoch, scopeIdentity]);

  return {
    scopeIdentity,
    scopeEpoch,
    scopeBindingCurrent,
    recordOpen: scopeBindingCurrent && recordOpen,
    voidTarget: scopeBindingCurrent ? voidTarget : null,
    pendingKind: scopeBindingCurrent ? (pending?.kind ?? null) : null,
    busy: scopeBindingCurrent && busy,
    feedback: scopeBindingCurrent ? feedback : null,
    openRecord,
    closeRecord,
    openVoid,
    closeVoid,
    submitRecord,
    submitVoid,
    retryExact,
    dismissFeedback,
  } as const;
}
