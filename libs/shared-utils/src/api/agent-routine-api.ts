import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  assertAgentUuid,
  expectAgentData,
  isAgentDate,
  isAgentRecord,
  newAgentCommand,
} from './agent-governed-api';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionRoutineDefinition = AgentSchemas['RoutineDefinition'];
export type DwaionPersonalRoutine = AgentSchemas['PersonalRoutine'];
export type DwaionRoutineDryRunReceipt = AgentSchemas['RoutineDryRunReceipt'];
export type DwaionRoutineConsentScope = AgentSchemas['RoutineConsentScope'];
export type DwaionRoutineConsentState = AgentSchemas['RoutineConsentState'];
export type DwaionRoutineLifecycleAction = AgentSchemas['RoutineLifecycleAction'];

const ROUTINE_BASE = '/api/agent/v1/routines';

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
  return expectAgentData(response.data.data, isRoutine, 'Personal routine response is invalid.');
}

export async function createDwaionRoutine(
  definition: DwaionRoutineDefinition
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['CreateRoutineRequest'] = {
    ...newAgentCommand(0, 'USER_CREATE'),
    definition,
  };
  return mutateRoutine(ROUTINE_BASE, body, 'post');
}

export async function updateDwaionRoutine(
  routineId: string,
  expectedRevision: number,
  definition: DwaionRoutineDefinition
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['UpdateRoutineRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_UPDATE'),
    definition,
  };
  return mutateRoutine(`${ROUTINE_BASE}/${encodeRoutineId(routineId)}`, body, 'put');
}

export async function changeDwaionRoutineConsent(
  routineId: string,
  expectedRevision: number,
  scope: DwaionRoutineConsentScope,
  consentState: Extract<DwaionRoutineConsentState, 'ENABLED' | 'DISABLED'>
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['ChangeRoutineConsentRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_CONSENT_CHANGE'),
    scope,
    consentState,
    changeReason: 'The user explicitly changed this personal routine consent.',
  };
  return mutateRoutine(`${ROUTINE_BASE}/${encodeRoutineId(routineId)}/consent`, body, 'post');
}

export async function changeDwaionRoutineLifecycle(
  routineId: string,
  expectedRevision: number,
  action: DwaionRoutineLifecycleAction
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['ChangeRoutineLifecycleRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_LIFECYCLE_CHANGE'),
    action,
    changeReason: 'The user explicitly changed this personal routine lifecycle.',
  };
  return mutateRoutine(`${ROUTINE_BASE}/${encodeRoutineId(routineId)}/lifecycle`, body, 'post');
}

export async function dryRunDwaionRoutine(
  routineId: string,
  expectedRevision: number
): Promise<DwaionRoutineDryRunReceipt> {
  const body: AgentSchemas['DryRunRoutineRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_DRY_RUN'),
    referenceTime: null,
  };
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${ROUTINE_BASE}/${encodeRoutineId(routineId)}/dry-runs`,
    body
  );
  return expectAgentData(
    response.data.data,
    isDryRunReceipt,
    'Personal routine dry-run response is invalid.'
  );
}

export async function archiveDwaionRoutine(
  routineId: string,
  expectedRevision: number
): Promise<DwaionPersonalRoutine> {
  const body: AgentSchemas['ArchiveRoutineRequest'] = {
    ...newAgentCommand(expectedRevision, 'USER_ARCHIVE'),
    changeReason: 'The user explicitly archived this personal routine.',
  };
  return mutateRoutine(`${ROUTINE_BASE}/${encodeRoutineId(routineId)}/archive`, body, 'post');
}

async function mutateRoutine(
  url: string,
  body: object,
  method: 'post' | 'put'
): Promise<DwaionPersonalRoutine> {
  const response =
    method === 'post'
      ? await axiosInstance.post<ApiResponse<unknown>, object>(url, body)
      : await axiosInstance.put<ApiResponse<unknown>, object>(url, body);
  return expectAgentData(response.data.data, isRoutine, 'Personal routine response is invalid.');
}

function encodeRoutineId(routineId: string): string {
  assertAgentUuid(routineId, 'Personal routine identifier');
  return encodeURIComponent(routineId);
}

function isRoutineList(value: unknown): value is DwaionPersonalRoutine[] {
  return Array.isArray(value) && value.every(isRoutine);
}

function isRoutine(value: unknown): value is DwaionPersonalRoutine {
  if (!isAgentRecord(value) || !isAgentRecord(value.definition) || !isAgentRecord(value.consents)) {
    return false;
  }
  return (
    typeof value.routineId === 'string' &&
    typeof value.lifecycleState === 'string' &&
    typeof value.consentState === 'string' &&
    typeof value.executionMode === 'string' &&
    Number.isInteger(value.revision) &&
    typeof value.definition.name === 'string' &&
    typeof value.definition.objective === 'string' &&
    Array.isArray(value.definition.sources) &&
    isAgentDate(value.createdAt) &&
    isAgentDate(value.updatedAt)
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
