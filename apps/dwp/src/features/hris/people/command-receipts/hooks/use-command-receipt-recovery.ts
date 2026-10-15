import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { readHrisCommandReceipt } from '../api/command-receipt-api';
import {
  assertSameHrisCommandReceipt,
  hrisCommandReceiptIsTerminal,
} from '../model/command-receipt';

import type {
  AuthorizedEmployeeChangeResultLocation,
  HrisCommandReceiptReader,
} from '../api/command-receipt-api';
import type { HrisCommandReceipt } from '../model/command-receipt';

export type CommandReceiptRecoveryPhase =
  'IDLE' | 'LOADING' | 'POLLING' | 'SETTLED' | 'DENIED' | 'ERROR' | 'RECOVERY_REQUIRED';

export type CommandReceiptRecoveryPolicy = Readonly<{
  maximumAttempts: number;
  backoffMs: readonly number[];
}>;

export const DEFAULT_COMMAND_RECEIPT_RECOVERY_POLICY: CommandReceiptRecoveryPolicy = Object.freeze({
  maximumAttempts: 5,
  backoffMs: Object.freeze([0, 750, 1_500, 3_000, 5_000]),
});

type RecoverySnapshot = Readonly<{
  scopeIdentity: string;
  receipt: HrisCommandReceipt | null;
  resultLocation: AuthorizedEmployeeChangeResultLocation | null;
  phase: CommandReceiptRecoveryPhase;
  attempt: number;
  error: Error | null;
}>;

function idleSnapshot(scopeIdentity: string): RecoverySnapshot {
  return {
    scopeIdentity,
    receipt: null,
    resultLocation: null,
    phase: 'IDLE',
    attempt: 0,
    error: null,
  };
}

function denied(error: unknown): boolean {
  return error instanceof HttpError && [401, 403, 404].includes(error.status);
}

function aborted(error: unknown): boolean {
  return (
    (error instanceof HttpTransportError && error.reason === 'ABORT') ||
    (error instanceof DOMException && error.name === 'AbortError')
  );
}

function errorValue(error: unknown): Error {
  return error instanceof Error ? error : new Error('Command receipt recovery failed.');
}

export function useCommandReceiptRecovery({
  enabled,
  seedReceipt,
  scopeIdentity,
  contextScopeKey,
  reader = readHrisCommandReceipt,
  policy = DEFAULT_COMMAND_RECEIPT_RECOVERY_POLICY,
}: Readonly<{
  enabled: boolean;
  seedReceipt: HrisCommandReceipt | null;
  scopeIdentity: string;
  contextScopeKey?: string;
  reader?: HrisCommandReceiptReader;
  policy?: CommandReceiptRecoveryPolicy;
}>) {
  const [cycle, setCycle] = useState(0);
  const [snapshot, setSnapshot] = useState<RecoverySnapshot>(() => idleSnapshot(scopeIdentity));
  const generation = useRef(0);
  const seedKey = seedReceipt
    ? `${seedReceipt.receiptId}:${seedReceipt.status}:${seedReceipt.authorizationRevision}`
    : 'none';
  const backoffKey = policy.backoffMs.join(',');
  const backoffMs = useMemo(
    () => backoffKey.split(',').map((value) => Number(value)),
    [backoffKey]
  );

  useEffect(() => {
    const currentGeneration = ++generation.current;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const active = () => currentGeneration === generation.current && !controller.signal.aborted;

    if (!enabled || !seedReceipt) {
      setSnapshot(idleSnapshot(scopeIdentity));
      return () => controller.abort();
    }
    const schedule = (delay: number, operation: () => void) => {
      timer = setTimeout(operation, Math.max(0, delay));
    };
    const poll = async () => {
      attempt += 1;
      setSnapshot({
        scopeIdentity,
        receipt: attempt === 1 ? seedReceipt : null,
        resultLocation: null,
        phase: attempt === 1 ? 'LOADING' : 'POLLING',
        attempt,
        error: null,
      });
      try {
        const result = await reader(seedReceipt.receiptId, contextScopeKey, controller.signal);
        if (!active()) return;
        assertSameHrisCommandReceipt(seedReceipt, result.receipt);
        if (hrisCommandReceiptIsTerminal(result.receipt)) {
          setSnapshot({
            scopeIdentity,
            receipt: result.receipt,
            resultLocation: result.resultLocation,
            phase: 'SETTLED',
            attempt,
            error: null,
          });
          return;
        }
        if (attempt >= policy.maximumAttempts) {
          setSnapshot({
            scopeIdentity,
            receipt: result.receipt,
            resultLocation: null,
            phase: 'RECOVERY_REQUIRED',
            attempt,
            error: null,
          });
          return;
        }
        setSnapshot({
          scopeIdentity,
          receipt: result.receipt,
          resultLocation: null,
          phase: 'POLLING',
          attempt,
          error: null,
        });
        schedule(backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 0, () => {
          void poll();
        });
      } catch (error) {
        if (!active() || aborted(error)) return;
        if (denied(error)) {
          setSnapshot({
            scopeIdentity,
            receipt: null,
            resultLocation: null,
            phase: 'DENIED',
            attempt,
            error: null,
          });
          return;
        }
        if (attempt >= policy.maximumAttempts) {
          setSnapshot({
            scopeIdentity,
            receipt: null,
            resultLocation: null,
            phase: 'ERROR',
            attempt,
            error: errorValue(error),
          });
          return;
        }
        setSnapshot({
          scopeIdentity,
          receipt: null,
          resultLocation: null,
          phase: 'POLLING',
          attempt,
          error: null,
        });
        schedule(backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 0, () => {
          void poll();
        });
      }
    };

    schedule(backoffMs[0] ?? 0, () => void poll());
    return () => {
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [
    backoffMs,
    contextScopeKey,
    cycle,
    enabled,
    policy.maximumAttempts,
    reader,
    scopeIdentity,
    seedKey,
    seedReceipt,
  ]);

  const current = useMemo(() => {
    const scopedSnapshot =
      snapshot.scopeIdentity === scopeIdentity ? snapshot : idleSnapshot(scopeIdentity);
    return enabled && seedReceipt && scopedSnapshot.phase === 'IDLE'
      ? {
          scopeIdentity,
          receipt: seedReceipt,
          resultLocation: null,
          phase: 'LOADING' as const,
          attempt: 0,
          error: null,
        }
      : scopedSnapshot;
  }, [enabled, scopeIdentity, seedReceipt, snapshot]);
  const active = current.phase === 'LOADING' || current.phase === 'POLLING';
  const canRecover = current.phase === 'ERROR' || current.phase === 'RECOVERY_REQUIRED';
  const recover = useCallback(() => {
    if (canRecover) setCycle((value) => value + 1);
  }, [canRecover]);

  return useMemo(
    () => ({
      ...current,
      active,
      canRecover,
      maximumAttempts: policy.maximumAttempts,
      recover,
    }),
    [active, canRecover, current, policy.maximumAttempts, recover]
  );
}
