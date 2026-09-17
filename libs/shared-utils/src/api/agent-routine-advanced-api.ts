import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import {
  assertAgentRevision,
  assertAgentUuid,
  isAgentDate,
  isAgentRecord,
} from './agent-governed-api';
import { isDwaionRoutineDefinition, type DwaionRoutineDefinition } from './agent-routine-api';
import {
  productSurfaceHighRiskMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

export type DwaionRoutineAdvancedCommandKind =
  | 'CHANGE_APPROVAL'
  | 'AGENT_ENGINE_SWITCH'
  | 'WORM_EVIDENCE_DELIVERY'
  | 'OAUTH_REAUTHORIZATION'
  | 'TEMPORARY_BUDGET_INCREASE'
  | 'OPERATOR_ESCALATION'
  | 'PROVIDER_ROLLBACK';

export type DwaionRoutineAdvancedPayload =
  | { kind: 'CHANGE_APPROVAL'; definition: DwaionRoutineDefinition }
  | {
      kind: 'AGENT_ENGINE_SWITCH';
      action: 'APPLY';
      agentId: string;
      engineId: string;
      expiresAt: string;
    }
  | { kind: 'AGENT_ENGINE_SWITCH'; action: 'ROLLBACK' }
  | {
      kind: 'WORM_EVIDENCE_DELIVERY';
      evidenceScope: 'ROUTINE_HISTORY' | 'LATEST_RUN' | 'FULL_AUDIT';
      retentionDays: number;
      legalHold: boolean;
    }
  | {
      kind: 'OAUTH_REAUTHORIZATION';
      source: 'WORK_ITEM' | 'MAIL' | 'CALENDAR';
      connectionReference: string;
    }
  | {
      kind: 'TEMPORARY_BUDGET_INCREASE';
      additionalRuns: number;
      additionalTokensPerRun: number;
      additionalMinutesPerRun: number;
      expiresAt: string;
    }
  | {
      kind: 'OPERATOR_ESCALATION';
      severity: 'P1' | 'P2' | 'P3';
      summary: string;
      routineRunId: string | null;
    }
  | { kind: 'PROVIDER_ROLLBACK'; routineRunId: string; providerReceiptId: string };

export type DwaionRoutineAdvancedCommand = {
  commandId: string;
  routineId: string;
  ownerUserId: string;
  kind: DwaionRoutineAdvancedCommandKind;
  state: 'AWAITING_APPROVAL' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'REJECTED';
  expectedRevision: number;
  version: number;
  makerUserId: string;
  checkerUserId: string | null;
  canApprove: boolean;
  proposedDefinition: DwaionRoutineDefinition | null;
  problem: { code: string; detail: string; recoveryHint: string } | null;
  receipt: {
    receiptId: string;
    commandId: string;
    routineId: string;
    kind: DwaionRoutineAdvancedCommandKind;
    state: 'SUCCEEDED' | 'PARTIAL';
    providerReceiptId: string;
    resultSha256: string;
    providerOutcome: {
      routineId: string;
      expectedRevision: number;
      kind: DwaionRoutineAdvancedCommandKind;
      outcome: 'APPLIED' | 'PARTIALLY_APPLIED';
      appliedPayload: DwaionRoutineAdvancedPayload;
      evidenceRef: string;
    };
    appliedRevision: number | null;
    completedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type DwaionRoutineAdvancedDecisionInput = {
  decision: 'APPROVE' | 'REJECT';
  changeReason: string;
  evidenceRefs: string[];
};

const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9_.-]{1,127}$/u;

export async function createDwaionRoutineAdvancedCommand(
  routineId: string,
  expectedRevision: number,
  commandId: string,
  payload: DwaionRoutineAdvancedPayload,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionRoutineAdvancedCommand> {
  assertAgentUuid(routineId, 'Advanced routine');
  assertAgentUuid(commandId, 'Advanced routine command');
  assertAgentRevision(expectedRevision, 'Advanced routine revision', 1);
  validatePayload(payload);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `/api/agent/v1/routines/${encodeURIComponent(routineId)}/advanced-commands`,
    {
      commandId,
      expectedRevision,
      reasonCode: `USER_${payload.kind}`,
      changeReason: commandReason(payload.kind),
      payload,
    },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  return parseDwaionRoutineAdvancedCommand(response.data.data, routineId, commandId);
}

export async function getDwaionRoutineAdvancedCommands(
  routineId: string,
  signal?: AbortSignal
): Promise<DwaionRoutineAdvancedCommand[]> {
  assertAgentUuid(routineId, 'Advanced routine');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/routines/${encodeURIComponent(routineId)}/advanced-commands`,
    { signal }
  );
  if (!Array.isArray(response.data.data)) {
    throw new HttpError('Advanced routine command list is invalid.', 502, response.data);
  }
  return response.data.data.map((item) => parseDwaionRoutineAdvancedCommand(item, routineId));
}

export async function getDwaionRoutinePendingApprovals(
  signal?: AbortSignal
): Promise<DwaionRoutineAdvancedCommand[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    '/api/agent/v1/routines/advanced-commands/pending-approvals?limit=50',
    { signal }
  );
  if (!Array.isArray(response.data.data)) {
    throw new HttpError('Routine approval queue is invalid.', 502, response.data);
  }
  return response.data.data.map((item) => {
    const command = parseDwaionRoutineAdvancedCommand(item);
    if (
      command.kind !== 'CHANGE_APPROVAL' ||
      command.state !== 'AWAITING_APPROVAL' ||
      !command.canApprove
    ) {
      throw new HttpError('Routine approval queue item is invalid.', 502, item);
    }
    return command;
  });
}

export async function decideDwaionRoutineAdvancedCommand(
  command: DwaionRoutineAdvancedCommand,
  commandId: string,
  input: DwaionRoutineAdvancedDecisionInput,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionRoutineAdvancedCommand> {
  assertAgentUuid(command.commandId, 'Routine approval');
  assertAgentUuid(commandId, 'Routine approval decision command');
  assertAgentRevision(command.version, 'Routine approval version', 1);
  if (
    command.kind !== 'CHANGE_APPROVAL' ||
    command.state !== 'AWAITING_APPROVAL' ||
    !command.canApprove
  ) {
    throw new TypeError('Routine approval is not eligible for this checker.');
  }
  const changeReason = input.changeReason.trim().replaceAll(/\s+/gu, ' ');
  if (changeReason.length < 5 || changeReason.length > 1_000) {
    throw new TypeError('Routine approval decision reason is invalid.');
  }
  const evidenceRefs = input.evidenceRefs.map((value) => value.trim()).filter(Boolean);
  if (
    evidenceRefs.length < 1 ||
    evidenceRefs.length > 20 ||
    evidenceRefs.some((value) => value.length > 240) ||
    new Set(evidenceRefs).size !== evidenceRefs.length
  ) {
    throw new TypeError('Routine approval evidence is invalid.');
  }
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `/api/agent/v1/routines/advanced-commands/${encodeURIComponent(command.commandId)}/decision`,
    {
      commandId,
      expectedRevision: command.version,
      reasonCode:
        input.decision === 'APPROVE'
          ? 'ROUTINE_CHANGE_CHECKER_APPROVED'
          : 'ROUTINE_CHANGE_CHECKER_REJECTED',
      changeReason,
      decision: input.decision,
      evidenceRefs,
    },
    productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
  );
  const decided = parseDwaionRoutineAdvancedCommand(
    response.data.data,
    undefined,
    command.commandId
  );
  if (input.decision === 'APPROVE' && decided.state === 'FAILED' && decided.problem) {
    throw new HttpError(decided.problem.detail, 409, response.data);
  }
  if (
    decided.state !== (input.decision === 'APPROVE' ? 'SUCCEEDED' : 'REJECTED') ||
    decided.canApprove ||
    !decided.checkerUserId
  ) {
    throw new HttpError('Routine approval decision response is invalid.', 502, response.data);
  }
  return decided;
}

export function parseDwaionRoutineAdvancedCommand(
  value: unknown,
  routineId?: string,
  commandId?: string
): DwaionRoutineAdvancedCommand {
  if (
    !isAgentRecord(value) ||
    !uuid(value.commandId) ||
    !uuid(value.routineId) ||
    typeof value.ownerUserId !== 'string' ||
    !KINDS.has(value.kind as DwaionRoutineAdvancedCommandKind) ||
    !STATES.has(String(value.state)) ||
    !revision(value.expectedRevision) ||
    !revision(value.version) ||
    typeof value.makerUserId !== 'string' ||
    !(value.checkerUserId === null || typeof value.checkerUserId === 'string') ||
    typeof value.canApprove !== 'boolean' ||
    !proposedDefinition(value.proposedDefinition, value.kind) ||
    !problem(value.problem) ||
    !receipt(value.receipt, value.commandId, value.routineId, value.kind, value.expectedRevision) ||
    !isAgentDate(value.createdAt) ||
    !isAgentDate(value.updatedAt) ||
    (routineId !== undefined && value.routineId !== routineId) ||
    (commandId !== undefined && value.commandId !== commandId)
  ) {
    throw new HttpError('Advanced routine command response is invalid.', 502, value);
  }
  return value as DwaionRoutineAdvancedCommand;
}

function proposedDefinition(value: unknown, kind: unknown): boolean {
  return kind === 'CHANGE_APPROVAL' ? isDwaionRoutineDefinition(value) : value === null;
}

function validatePayload(payload: DwaionRoutineAdvancedPayload): void {
  if (payload.kind === 'PROVIDER_ROLLBACK') {
    assertAgentUuid(payload.routineRunId, 'Routine rollback run');
    if (!normalizedText(payload.providerReceiptId, 1, 240)) {
      throw new TypeError('Provider receipt is required.');
    }
  } else if (payload.kind === 'OPERATOR_ESCALATION') {
    if (!normalizedText(payload.summary.replaceAll(/\s+/gu, ' '), 10, 1_000)) {
      throw new TypeError('Routine escalation summary is invalid.');
    }
    if (payload.routineRunId) assertAgentUuid(payload.routineRunId, 'Routine escalation run');
  } else if (payload.kind === 'TEMPORARY_BUDGET_INCREASE') {
    if (
      !integerBetween(payload.additionalRuns, 0, 744) ||
      !integerBetween(payload.additionalTokensPerRun, 0, 2_000_000) ||
      !integerBetween(payload.additionalMinutesPerRun, 0, 240) ||
      payload.additionalRuns + payload.additionalTokensPerRun + payload.additionalMinutesPerRun <=
        0 ||
      !isFutureWithinDays(payload.expiresAt, 30)
    ) {
      throw new TypeError('Temporary routine budget expiry is invalid.');
    }
  } else if (payload.kind === 'AGENT_ENGINE_SWITCH' && payload.action === 'APPLY') {
    if (
      !payload.agentId.trim() ||
      !payload.engineId.trim() ||
      !isFutureWithinDays(payload.expiresAt, 30)
    ) {
      throw new TypeError('Routine engine override is invalid.');
    }
  } else if (payload.kind === 'WORM_EVIDENCE_DELIVERY') {
    if (!integerBetween(payload.retentionDays, 1, 3_650)) {
      throw new TypeError('Routine WORM retention is invalid.');
    }
  } else if (payload.kind === 'OAUTH_REAUTHORIZATION') {
    if (!safeReference(payload.connectionReference, 240)) {
      throw new TypeError('Routine OAuth connection reference is invalid.');
    }
  }
}

function commandReason(kind: DwaionRoutineAdvancedCommandKind): string {
  return `The user reviewed the routine evidence and requested ${kind.toLowerCase().replaceAll('_', ' ')}.`;
}

function problem(value: unknown): boolean {
  return (
    value === null ||
    (isAgentRecord(value) &&
      safeCode(value.code) &&
      text(value.detail, 500) &&
      text(value.recoveryHint, 1_000))
  );
}

function receipt(
  value: unknown,
  commandId: unknown,
  routineId: unknown,
  kind: unknown,
  expectedRevision: unknown
): boolean {
  return (
    value === null ||
    (isAgentRecord(value) &&
      uuid(value.receiptId) &&
      value.commandId === commandId &&
      value.routineId === routineId &&
      value.kind === kind &&
      ['SUCCEEDED', 'PARTIAL'].includes(String(value.state)) &&
      text(value.providerReceiptId, 240) &&
      typeof value.resultSha256 === 'string' &&
      SHA256.test(value.resultSha256) &&
      providerOutcome(value.providerOutcome, routineId, kind, value.state, expectedRevision) &&
      (value.appliedRevision === null || revision(value.appliedRevision)) &&
      isAgentDate(value.completedAt))
  );
}

function providerOutcome(
  value: unknown,
  routineId: unknown,
  kind: unknown,
  state: unknown,
  expectedRevision: unknown
): boolean {
  if (
    !isAgentRecord(value) ||
    value.routineId !== routineId ||
    value.expectedRevision !== expectedRevision ||
    value.kind !== kind ||
    value.outcome !== (state === 'SUCCEEDED' ? 'APPLIED' : 'PARTIALLY_APPLIED') ||
    !text(value.evidenceRef, 240) ||
    !advancedPayload(value.appliedPayload, kind)
  ) {
    return false;
  }
  return true;
}

function advancedPayload(value: unknown, kind: unknown): boolean {
  if (!isAgentRecord(value) || value.kind !== kind) return false;
  if (kind === 'CHANGE_APPROVAL') return isDwaionRoutineDefinition(value.definition);
  if (kind === 'AGENT_ENGINE_SWITCH') {
    if (value.action === 'ROLLBACK') {
      return (
        value.agentId === undefined && value.engineId === undefined && value.expiresAt === undefined
      );
    }
    return (
      value.action === 'APPLY' &&
      safeReference(value.agentId, 160) &&
      safeReference(value.engineId, 160) &&
      isAgentDate(value.expiresAt)
    );
  }
  if (kind === 'WORM_EVIDENCE_DELIVERY') {
    return (
      ['ROUTINE_HISTORY', 'LATEST_RUN', 'FULL_AUDIT'].includes(String(value.evidenceScope)) &&
      integerBetween(value.retentionDays, 1, 3_650) &&
      typeof value.legalHold === 'boolean'
    );
  }
  if (kind === 'OAUTH_REAUTHORIZATION') {
    return (
      ['WORK_ITEM', 'MAIL', 'CALENDAR'].includes(String(value.source)) &&
      safeReference(value.connectionReference, 240)
    );
  }
  if (kind === 'TEMPORARY_BUDGET_INCREASE') {
    return (
      integerBetween(value.additionalRuns, 0, 744) &&
      integerBetween(value.additionalTokensPerRun, 0, 2_000_000) &&
      integerBetween(value.additionalMinutesPerRun, 0, 240) &&
      Number(value.additionalRuns) +
        Number(value.additionalTokensPerRun) +
        Number(value.additionalMinutesPerRun) >
        0 &&
      isAgentDate(value.expiresAt)
    );
  }
  if (kind === 'OPERATOR_ESCALATION') {
    return (
      ['P1', 'P2', 'P3'].includes(String(value.severity)) &&
      normalizedText(value.summary, 10, 1_000) &&
      (value.routineRunId === null || uuid(value.routineRunId))
    );
  }
  return (
    kind === 'PROVIDER_ROLLBACK' &&
    uuid(value.routineRunId) &&
    normalizedText(value.providerReceiptId, 1, 240)
  );
}

function isFutureWithinDays(value: string, days: number): boolean {
  if (!isAgentDate(value)) return false;
  const timestamp = Date.parse(value);
  const now = Date.now();
  return timestamp > now && timestamp <= now + days * 24 * 60 * 60 * 1000;
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function revision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function integerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function safeReference(value: unknown, maximum: number): value is string {
  return normalizedText(value, 1, maximum) && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(value);
}

function safeCode(value: unknown): value is string {
  return typeof value === 'string' && SAFE_CODE.test(value);
}

function text(value: unknown, maximum: number): value is string {
  return normalizedText(value, 1, maximum);
}

function normalizedText(value: unknown, minimum: number, maximum: number): value is string {
  return (
    typeof value === 'string' && value.trim().length >= minimum && value.trim().length <= maximum
  );
}

const KINDS = new Set<DwaionRoutineAdvancedCommandKind>([
  'CHANGE_APPROVAL',
  'AGENT_ENGINE_SWITCH',
  'WORM_EVIDENCE_DELIVERY',
  'OAUTH_REAUTHORIZATION',
  'TEMPORARY_BUDGET_INCREASE',
  'OPERATOR_ESCALATION',
  'PROVIDER_ROLLBACK',
]);
const STATES = new Set([
  'AWAITING_APPROVAL',
  'RUNNING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'REJECTED',
]);
