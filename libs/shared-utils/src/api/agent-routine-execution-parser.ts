import { HttpError } from '../http-error';
import { isAgentDate, isAgentRecord } from './agent-governed-api';

import type {
  DwaionRoutineExecutionReceipt,
  DwaionRoutineExecutionRun,
  DwaionRoutineNotificationState,
  DwaionRoutineRunState,
  DwaionRoutineRuntimeCapabilities,
  DwaionRoutineSource,
} from './agent-routine-execution-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_.-]{1,127}$/u;
const SOURCES = new Set<DwaionRoutineSource>(['WORK_ITEM', 'MAIL', 'CALENDAR']);
const STATES = new Set<DwaionRoutineRunState>([
  'QUEUED',
  'CLAIMED',
  'RUNNING',
  'RETRY_SCHEDULED',
  'COMPENSATING',
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'COMPENSATED',
]);
const TERMINAL = new Set<DwaionRoutineRunState>([
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'COMPENSATED',
]);
const NOTIFICATIONS = new Set<DwaionRoutineNotificationState>([
  'NOT_REQUIRED',
  'DELIVERED',
  'NOT_CONFIGURED',
  'FAILED',
]);

export function parseDwaionRoutineCapabilities(value: unknown): DwaionRoutineRuntimeCapabilities {
  if (
    !isAgentRecord(value) ||
    typeof value.lifecycleMode !== 'string' ||
    !capabilityBooleans.every((key) => typeof value[key] === 'boolean') ||
    typeof value.executionProviderState !== 'string' ||
    !(value.recoveryHint === null || typeof value.recoveryHint === 'string') ||
    !enumArray(value.supportedCadences, new Set(['DAILY', 'WEEKDAYS', 'WEEKLY'])) ||
    !enumArray(value.consentScopes, new Set(['SOURCE_ACCESS', 'ANALYSIS', 'PROPOSAL_DELIVERY']))
  ) {
    throw invalid('Routine runtime capabilities response is invalid.', value);
  }
  return value as DwaionRoutineRuntimeCapabilities;
}

export function parseDwaionRoutineRun(value: unknown): DwaionRoutineExecutionRun {
  if (
    !isAgentRecord(value) ||
    !uuid(value.routineRunId) ||
    !uuid(value.routineId) ||
    !integer(value.routineRevision, 1) ||
    !['SCHEDULED', 'MANUAL'].includes(String(value.trigger)) ||
    !STATES.has(value.state as DwaionRoutineRunState) ||
    !integer(value.version, 1) ||
    !integer(value.attemptCount, 0) ||
    !integer(value.maximumAttempts, 1, 10) ||
    !isAgentDate(value.scheduledFor) ||
    !nullableDate(value.nextAttemptAt) ||
    !nullableDate(value.startedAt) ||
    !nullableDate(value.completedAt) ||
    !integer(value.evidenceCount, 0) ||
    !integer(value.proposalsCreated, 0) ||
    !integer(value.approvalGatedActionsCreated, 0) ||
    !integer(value.tokensUsed, 0) ||
    !integer(value.elapsedMs, 0) ||
    !NOTIFICATIONS.has(value.notificationState as DwaionRoutineNotificationState) ||
    !(
      value.safeErrorCode === null ||
      (typeof value.safeErrorCode === 'string' && SAFE_CODE.test(value.safeErrorCode))
    ) ||
    !(value.recoveryHint === null || typeof value.recoveryHint === 'string') ||
    typeof value.compensationRequired !== 'boolean' ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt)
  ) {
    throw invalid('Routine execution response is invalid.', value);
  }
  const state = value.state as DwaionRoutineRunState;
  if (TERMINAL.has(state) !== (value.completedAt !== null))
    throw invalid('Routine execution completion time contradicts its state.', value);
  if (value.receipt !== null && value.receipt !== undefined) {
    const receipt = parseDwaionRoutineReceipt(value.receipt);
    if (
      !['COMPLETED', 'COMPENSATED'].includes(state) ||
      receipt.routineRunId !== value.routineRunId ||
      receipt.routineId !== value.routineId ||
      receipt.routineRevision !== value.routineRevision ||
      receipt.terminalState !== state
    ) {
      throw invalid('Routine execution receipt is not bound to the returned run.', value);
    }
  } else if (['COMPLETED', 'COMPENSATED'].includes(state)) {
    throw invalid('Successful routine execution lacks a receipt.', value);
  }
  return value as DwaionRoutineExecutionRun;
}

export function parseDwaionRoutineReceipt(value: unknown): DwaionRoutineExecutionReceipt {
  if (
    !isAgentRecord(value) ||
    !uuid(value.receiptId) ||
    !uuid(value.routineRunId) ||
    !uuid(value.routineId) ||
    !integer(value.routineRevision, 1) ||
    !['COMPLETED', 'COMPENSATED'].includes(String(value.terminalState)) ||
    typeof value.providerReceiptId !== 'string' ||
    !value.providerReceiptId.trim() ||
    typeof value.resultSha256 !== 'string' ||
    !SHA256.test(value.resultSha256) ||
    !integer(value.evidenceCount, 0) ||
    !integer(value.proposalsCreated, 0) ||
    !integer(value.approvalGatedActionsCreated, 0) ||
    value.externalWritesPerformed !== 0 ||
    !NOTIFICATIONS.has(value.notificationState as DwaionRoutineNotificationState) ||
    !integer(value.authorizationDecisionRevision, 1) ||
    !enumArray(value.authorizedSources, SOURCES) ||
    value.authorizedSources.length < 1 ||
    !isAgentDate(value.completedAt)
  ) {
    throw invalid('Routine execution receipt is invalid.', value);
  }
  return value as DwaionRoutineExecutionReceipt;
}

const capabilityBooleans = [
  'activationAvailable',
  'schedulingAvailable',
  'backgroundExecutionAvailable',
  'dryRunAvailable',
  'pauseResumeAvailable',
  'oneTimeScheduleAvailable',
  'activeWindowPreviewAvailable',
  'quietHoursPreviewAvailable',
  'quietHoursDeliveryEnforcementAvailable',
  'holidayPolicyAvailable',
  'costBudgetAvailable',
  'runtimeBudgetAvailable',
  'notificationDeliveryAvailable',
  'proposalDeliveryAvailable',
  'externalWriteAvailable',
] as const;

function enumArray<T extends string>(value: unknown, allowed: ReadonlySet<T>): value is T[] {
  return (
    Array.isArray(value) &&
    value.length === new Set(value).size &&
    value.every((item) => typeof item === 'string' && allowed.has(item as T))
  );
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function nullableDate(value: unknown) {
  return value === null || isAgentDate(value);
}

function invalid(message: string, value: unknown) {
  return new HttpError(message, 502, value);
}
