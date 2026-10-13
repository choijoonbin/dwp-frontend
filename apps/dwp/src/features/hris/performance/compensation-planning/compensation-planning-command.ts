import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import type { CompensationCommandEnvelope } from './compensation-planning-api';
import type { CompensationCommandResult } from './compensation-planning-contract';

export type CompensationCommandName =
  | 'CREATE_CYCLE'
  | 'REVISE_CYCLE'
  | 'ALLOCATE_BUDGET'
  | 'UPSERT_PROPOSAL'
  | 'SUBMIT_PROPOSAL'
  | 'APPROVE_PLAN'
  | 'PUBLISH_SNAPSHOT'
  | 'CANCEL_CYCLE';

export type PendingCompensationCommand<T = unknown> = Readonly<{
  command: CompensationCommandName;
  targetId: string;
  envelope: CompensationCommandEnvelope<T>;
}>;

export function newCompensationCommandId(): string {
  return globalThis.crypto.randomUUID();
}

export function isAmbiguousCompensationCommandFailure(error: unknown): boolean {
  if (error instanceof HttpTransportError) {
    return error.reason === 'NETWORK' || error.reason === 'TIMEOUT';
  }
  return error instanceof HttpError && (error.status === 408 || error.status === 429 || error.status >= 500);
}

export function commandResultCorrelationId(result: CompensationCommandResult): string {
  return result.correlationId;
}

export function commandResultAggregateId(result: CompensationCommandResult): string | undefined {
  if ('aggregateId' in result) return result.aggregateId;
  if ('aggregatePublicId' in result) return result.aggregatePublicId;
  if ('snapshotId' in result) return result.cycleId;
  return undefined;
}

export function isResultUnknown(result: CompensationCommandResult): boolean {
  return 'status' in result && result.status === 'RESULT_UNKNOWN';
}

export function verifyCompensationCommandResult(
  pending: PendingCompensationCommand,
  result: CompensationCommandResult
): CompensationCommandResult {
  if (commandResultCorrelationId(result) !== pending.envelope.correlationId) {
    throw new Error('Compensation command correlation does not match the sealed request.');
  }
  if (isResultUnknown(result)) {
    const unknownAggregateId = commandResultAggregateId(result);
    if (
      pending.command !== 'CREATE_CYCLE' &&
      unknownAggregateId !== undefined &&
      unknownAggregateId !== pending.targetId
    ) {
      throw new Error('Compensation command result does not match its governed target.');
    }
    return result;
  }
  const aggregateId = commandResultAggregateId(result);
  const targetMustMatch = pending.command !== 'CREATE_CYCLE';
  if (targetMustMatch && aggregateId !== pending.targetId) {
    throw new Error('Compensation command result does not match its governed target.');
  }
  return result;
}

/** Keeps the exact object identity needed for safe ambiguous-result replay. */
export function retainPendingCompensationCommand<T>(
  pending: PendingCompensationCommand<T>
): PendingCompensationCommand<T> {
  return pending;
}
