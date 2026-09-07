import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionRunState = AgentSchemas['AgentRunState'];
export type DwaionUserRun = AgentSchemas['UserAgentRunSummary'];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RUN_STATES = new Set<DwaionRunState>(['RUNNING', 'COMPLETED', 'FAILED']);

export async function getDwaionUserRuns(
  state?: DwaionRunState,
  limit = 50
): Promise<DwaionUserRun[]> {
  if (state && !RUN_STATES.has(state)) throw new TypeError('Agent run state is invalid.');
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const params = new URLSearchParams({ limit: String(boundedLimit) });
  if (state) params.set('state', state);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/runs?${params.toString()}`
  );
  if (!Array.isArray(response.data.data) || !response.data.data.every(isUserRun)) {
    throw new HttpError('Agent activity response is invalid.', 502, response.data);
  }
  return response.data.data;
}

export async function getDwaionUserRun(
  runId: string,
  signal?: AbortSignal
): Promise<DwaionUserRun> {
  if (!UUID_PATTERN.test(runId)) throw new TypeError('Agent run ID is invalid.');
  const canonicalRunId = runId.toLowerCase();
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `/api/agent/v1/runs/${encodeURIComponent(canonicalRunId)}`,
    { signal }
  );
  const run = response.data.data;
  if (!isUserRun(run) || run.runId.toLowerCase() !== canonicalRunId) {
    throw new HttpError('Agent run detail response is invalid.', 502, response.data);
  }
  return { ...run, runId: canonicalRunId };
}

function isUserRun(value: unknown): value is DwaionUserRun {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const run = value as Record<string, unknown>;
  return (
    typeof run.runId === 'string' &&
    UUID_PATTERN.test(run.runId) &&
    typeof run.agentKey === 'string' &&
    /^[A-Z][A-Z0-9_.-]{0,99}$/u.test(run.agentKey) &&
    isNonnegativeInteger(run.agentRevision) &&
    typeof run.runState === 'string' &&
    RUN_STATES.has(run.runState as DwaionRunState) &&
    (run.answerState === null ||
      ['COMPLETED', 'ABSTAINED', 'CONFIGURATION_REQUIRED'].includes(String(run.answerState))) &&
    ['L0', 'L1', 'L2', 'L3'].includes(String(run.riskTier)) &&
    ['ALLOW', 'HANDOFF', 'DENY'].includes(String(run.policyOutcome)) &&
    (run.statusCode === null || typeof run.statusCode === 'string') &&
    isNonnegativeInteger(run.sourceCount) &&
    isNonnegativeInteger(run.latencyMs) &&
    (run.conversationId === null ||
      (typeof run.conversationId === 'string' && UUID_PATTERN.test(run.conversationId))) &&
    isDate(run.createdAt) &&
    (run.completedAt === null || isDate(run.completedAt))
  );
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
