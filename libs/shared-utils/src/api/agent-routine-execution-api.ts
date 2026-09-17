import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import { assertAgentRevision, assertAgentUuid } from './agent-governed-api';
import {
  parseDwaionRoutineCapabilities,
  parseDwaionRoutineRun,
} from './agent-routine-execution-parser';
import { productSurfaceGovernedMutationConfig } from './product-surface-governed-mutation';

import type { ApiResponse } from '../types';
import type {
  DwaionRoutineExecutionRun,
  DwaionRoutineHighRiskCommand,
  DwaionRoutineRunCommand,
  DwaionRoutineRuntimeCapabilities,
} from './agent-routine-execution-contract';

export type * from './agent-routine-execution-contract';

const ROUTINE_BASE = '/api/agent/v1/routines';
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;

export async function getDwaionRoutineRuntimeCapabilities(
  signal?: AbortSignal
): Promise<DwaionRoutineRuntimeCapabilities> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ROUTINE_BASE}/capabilities`, {
    signal,
  });
  return parseDwaionRoutineCapabilities(response.data.data);
}

export async function getDwaionRoutineRuns(
  routineId: string,
  limit = 30,
  signal?: AbortSignal
): Promise<DwaionRoutineExecutionRun[]> {
  assertAgentUuid(routineId, 'Routine identifier');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new TypeError('Routine run limit must be between 1 and 100.');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs?limit=${limit}`,
    { signal }
  );
  if (!Array.isArray(response.data.data))
    throw new HttpError('Routine execution list response is invalid.', 502, response.data);
  return response.data.data.map(parseDwaionRoutineRun);
}

export async function getDwaionRoutineRun(
  routineId: string,
  routineRunId: string,
  signal?: AbortSignal
): Promise<DwaionRoutineExecutionRun> {
  assertAgentUuid(routineId, 'Routine identifier');
  assertAgentUuid(routineRunId, 'Routine run identifier');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs/${encodeURIComponent(routineRunId)}`,
    { signal }
  );
  return parseDwaionRoutineRun(response.data.data);
}

export async function triggerDwaionRoutineRun(
  routineId: string,
  command: DwaionRoutineHighRiskCommand
): Promise<DwaionRoutineExecutionRun> {
  validateCommand(routineId, command);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs`,
    commandBody(command),
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  return parseDwaionRoutineRun(response.data.data);
}

export async function commandDwaionRoutineRun(
  routineId: string,
  routineRunId: string,
  command: DwaionRoutineRunCommand
): Promise<DwaionRoutineExecutionRun> {
  validateCommand(routineId, command);
  assertAgentUuid(routineRunId, 'Routine run identifier');
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `${ROUTINE_BASE}/${encodeURIComponent(routineId)}/runs/${encodeURIComponent(routineRunId)}/commands`,
    { ...commandBody(command), action: command.action },
    productSurfaceGovernedMutationConfig(command.authority ?? LEGACY_AUTHORITY)
  );
  return parseDwaionRoutineRun(response.data.data);
}

function validateCommand(routineId: string, command: DwaionRoutineHighRiskCommand) {
  assertAgentUuid(routineId, 'Routine identifier');
  assertAgentUuid(command.commandId, 'Routine command identifier');
  assertAgentRevision(command.expectedRevision, 'Routine command revision', 1);
  if (!/^[A-Z][A-Z0-9_.-]{1,63}$/u.test(command.reasonCode))
    throw new TypeError('Routine command reason code is invalid.');
  if (command.changeReason.trim().length < 5)
    throw new TypeError('Routine command change reason is required.');
}

function commandBody(command: DwaionRoutineHighRiskCommand) {
  return {
    commandId: command.commandId,
    expectedRevision: command.expectedRevision,
    reasonCode: command.reasonCode,
    changeReason: command.changeReason.trim(),
  };
}

export function newDwaionRoutineCommandId(): string {
  return crypto.randomUUID();
}
