import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  assertAgentRevision,
  assertAgentUuid,
  expectAgentData,
  isAgentDate,
  isAgentRecord,
  newAgentCommand,
} from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';
import type {
  DwaionRoutineActivationCommand,
  DwaionPersonalRoutine,
  DwaionRoutineDefinition,
} from './agent-routine-execution-contract';

type AgentSchemas = AgentComponents['schemas'];

export type {
  DwaionPersonalRoutine,
  DwaionRoutineDefinition,
} from './agent-routine-execution-contract';
export type DwaionRoutineDryRunReceipt = AgentSchemas['RoutineDryRunReceipt'];
export type DwaionRoutineConsentScope = AgentSchemas['RoutineConsentScope'];
export type DwaionRoutineConsentState = AgentSchemas['RoutineConsentState'];
export type DwaionRoutineLifecycleAction = AgentSchemas['RoutineLifecycleAction'];

const ROUTINE_BASE = '/api/agent/v1/routines';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export async function getDwaionRoutines(): Promise<DwaionPersonalRoutine[]> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(ROUTINE_BASE);
  return expectAgentData(
    response.data.data,
    isRoutineList,
    'Personal routine list response is invalid.'
  );
}

export async function getDwaionRoutine(routineId: string): Promise<DwaionPersonalRoutine> {
  assertAgentUuid(routineId, 'Personal routine identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}`
  );
  return expectAgentData(
    response.data.data,
    isDwaionPersonalRoutine,
    'Personal routine response is invalid.'
  );
}

export async function createDwaionRoutine(
  definition: DwaionRoutineDefinition,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalRoutine> {
  const body = {
    ...newAgentCommand(0, 'USER_CREATE'),
    definition,
  };
  return mutateRoutine(ROUTINE_BASE, body, 'post', authority);
}

export async function updateDwaionRoutine(
  routineId: string,
  expectedRevision: number,
  definition: DwaionRoutineDefinition,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalRoutine> {
  const body = {
    ...newAgentCommand(expectedRevision, 'USER_UPDATE'),
    definition,
  };
  return mutateRoutine(`${ROUTINE_BASE}/${encodeRoutineId(routineId)}`, body, 'put', authority);
}

export async function changeDwaionRoutineConsent(
  routineId: string,
  expectedRevision: number,
  scope: DwaionRoutineConsentScope,
  consentState: Extract<DwaionRoutineConsentState, 'ENABLED' | 'DISABLED'>,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['ChangeRoutineConsentRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_CONSENT_CHANGE'),
    scope,
    consentState,
    changeReason: 'The user explicitly changed this personal routine consent.',
  };
  return mutateRoutine(
    `${ROUTINE_BASE}/${encodeRoutineId(routineId)}/consent`,
    body,
    'post',
    authority
  );
}

export async function changeDwaionRoutineLifecycle(
  routineId: string,
  expectedRevision: number,
  action: DwaionRoutineLifecycleAction,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['ChangeRoutineLifecycleRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_LIFECYCLE_CHANGE'),
    action,
    changeReason: 'The user explicitly changed this personal routine lifecycle.',
  };
  return mutateRoutine(
    `${ROUTINE_BASE}/${encodeRoutineId(routineId)}/lifecycle`,
    body,
    'post',
    authority
  );
}

export async function changeDwaionRoutineActivation(
  routineId: string,
  command: DwaionRoutineActivationCommand
): Promise<DwaionPersonalRoutine> {
  assertAgentUuid(command.commandId, 'Routine activation command identifier');
  assertAgentRevision(command.expectedRevision, 'Routine activation revision', 1);
  const body = {
    commandId: command.commandId,
    expectedRevision: command.expectedRevision,
    reasonCode: command.reasonCode,
    changeReason: command.changeReason.trim(),
    action: command.action,
    startAt: command.startAt ?? null,
  };
  if (!/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(body.reasonCode) || body.changeReason.length < 5)
    throw new TypeError('Routine activation reason is invalid.');
  return mutateRoutine(
    `${ROUTINE_BASE}/${encodeRoutineId(routineId)}/activation`,
    body,
    'post',
    command.authority ?? LEGACY_AUTHORITY
  );
}

export async function dryRunDwaionRoutine(
  routineId: string,
  expectedRevision: number,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionRoutineDryRunReceipt> {
  const body: AgentSchemas['DryRunRoutineRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_DRY_RUN'),
    referenceTime: null,
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${ROUTINE_BASE}/${encodeRoutineId(routineId)}/dry-runs`,
    body,
    productSurfaceGovernedMutationConfig(authority)
  );
  return expectAgentData(
    response.data.data,
    isDryRunReceipt,
    'Personal routine dry-run response is invalid.'
  );
}

export async function archiveDwaionRoutine(
  routineId: string,
  expectedRevision: number,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['ArchiveRoutineRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARCHIVE'),
    changeReason: 'The user explicitly archived this personal routine.',
  };
  return mutateRoutine(
    `${ROUTINE_BASE}/${encodeRoutineId(routineId)}/archive`,
    body,
    'post',
    authority
  );
}

async function mutateRoutine(
  url: string,
  body: object,
  method: 'post' | 'put',
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionPersonalRoutine> {
  const config = productSurfaceGovernedMutationConfig(authority);
  const response =
    method === 'post'
      ? await axiosInstance.post<ApiResponse<unknown>, object>(url, body, config)
      : await axiosInstance.put<ApiResponse<unknown>, object>(url, body, config);
  return expectAgentData(
    response.data.data,
    isDwaionPersonalRoutine,
    'Personal routine response is invalid.'
  );
}

function encodeRoutineId(routineId: string): string {
  assertAgentUuid(routineId, 'Personal routine identifier');
  return encodeURIComponent(routineId);
}

function isRoutineList(value: unknown): value is DwaionPersonalRoutine[] {
  return Array.isArray(value) && value.every(isDwaionPersonalRoutine);
}

export function isDwaionPersonalRoutine(value: unknown): value is DwaionPersonalRoutine {
  if (
    !isAgentRecord(value) ||
    !isAgentRecord(value.definition) ||
    !isAgentRecord(value.consents) ||
    !isAgentRecord(value.capabilities)
  ) {
    return false;
  }
  const capabilities = value.capabilities;
  return (
    typeof value.routineId === 'string' &&
    typeof value.lifecycleState === 'string' &&
    typeof value.consentState === 'string' &&
    ['DRY_RUN_ONLY', 'SCHEDULED', 'WEBHOOK'].includes(String(value.executionMode)) &&
    Number.isInteger(value.revision) &&
    typeof value.definition.name === 'string' &&
    typeof value.definition.objective === 'string' &&
    Array.isArray(value.definition.sources) &&
    isDwaionRoutineDefinition(value.definition) &&
    typeof capabilities.backgroundExecutionAvailable === 'boolean' &&
    typeof capabilities.dryRunAvailable === 'boolean' &&
    typeof capabilities.notificationDeliveryAvailable === 'boolean' &&
    typeof capabilities.proposalDeliveryAvailable === 'boolean' &&
    typeof capabilities.webhookTriggerAvailable === 'boolean' &&
    ROUTINE_WORKFLOW_CAPABILITIES.every((key) => isWorkflowCapability(capabilities[key])) &&
    isAgentDate(value.createdAt) &&
    isAgentDate(value.updatedAt)
  );
}

export function isDwaionRoutineDefinition(value: unknown): value is DwaionRoutineDefinition {
  if (
    !isAgentRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.objective !== 'string' ||
    !Array.isArray(value.sources) ||
    !value.sources.every((source) => ['WORK_ITEM', 'MAIL', 'CALENDAR'].includes(String(source))) ||
    !isRoutineExecutionPolicy(value)
  ) {
    return false;
  }
  const triggerType = value.triggerType;
  if (!['SCHEDULED', 'WEBHOOK'].includes(String(triggerType))) return false;
  if (triggerType === 'SCHEDULED') {
    return (
      ['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'].includes(String(value.cadence)) &&
      (value.cadence !== 'MONTHLY' ||
        (Number.isInteger(value.monthDay) &&
          Number(value.monthDay) >= 1 &&
          Number(value.monthDay) <= 28)) &&
      typeof value.localTime === 'string' &&
      typeof value.timeZone === 'string' &&
      value.timeZone.trim().length > 0 &&
      value.webhookEventType == null &&
      value.webhookEndpointReference == null
    );
  }
  return (
    value.cadence == null &&
    value.localTime == null &&
    value.timeZone == null &&
    typeof value.webhookEventType === 'string' &&
    /^[A-Z][A-Z0-9_.-]{1,63}$/u.test(value.webhookEventType) &&
    (value.webhookEndpointReference == null ||
      (typeof value.webhookEndpointReference === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9:/._-]{0,239}$/u.test(value.webhookEndpointReference)))
  );
}

function isWorkflowCapability(value: unknown): boolean {
  return (
    isAgentRecord(value) &&
    typeof value.available === 'boolean' &&
    typeof value.configured === 'boolean' &&
    (value.reasonCode === null || typeof value.reasonCode === 'string') &&
    (value.recoveryHint === null || typeof value.recoveryHint === 'string') &&
    (!value.available || value.configured)
  );
}

const ROUTINE_WORKFLOW_CAPABILITIES = [
  'agentKernelBinding',
  'whitelistedSourceBinding',
  'blockedSourcePolicy',
  'zeroWritePolicy',
  'semanticVersionDiff',
  'runtimeBudgetRetry',
  'automaticQuarantine',
  'changeApproval',
  'agentSwitching',
  'wormDelivery',
  'oauthReauthorization',
  'temporaryBudgetIncrease',
  'operatorEscalation',
  'providerRollback',
] as const;

function isRoutineExecutionPolicy(value: Record<string, unknown>): boolean {
  if (
    !isAgentRecord(value.budget) ||
    !isAgentRecord(value.retryPolicy) ||
    !isAgentRecord(value.notificationPolicy) ||
    !isAgentRecord(value.compensationPolicy)
  ) {
    return false;
  }
  return (
    Number.isInteger(value.budget.maximumRunsPerMonth) &&
    Number.isInteger(value.budget.maximumTokensPerRun) &&
    Number.isInteger(value.budget.maximumMinutesPerRun) &&
    Number.isInteger(value.retryPolicy.maximumAttempts) &&
    Number.isInteger(value.retryPolicy.initialBackoffSeconds) &&
    typeof value.retryPolicy.backoffMultiplier === 'number' &&
    typeof value.notificationPolicy.notifyOnPartial === 'boolean' &&
    typeof value.notificationPolicy.notifyOnFailure === 'boolean' &&
    typeof value.notificationPolicy.notifyOnRecovery === 'boolean' &&
    typeof value.compensationPolicy.enabled === 'boolean' &&
    ['REVOKE_PENDING_HANDOFFS', 'PROVIDER_MANAGED'].includes(
      String(value.compensationPolicy.strategy)
    )
  );
}

function isDryRunReceipt(value: unknown): value is DwaionRoutineDryRunReceipt {
  return (
    isAgentRecord(value) &&
    typeof value.routineRunId === 'string' &&
    typeof value.routineId === 'string' &&
    Number.isInteger(value.routineRevision) &&
    value.outcome === 'VALIDATED' &&
    value.proposalOnly === true &&
    value.externalWritesPerformed === 0 &&
    isAgentDate(value.evaluatedAt)
  );
}
