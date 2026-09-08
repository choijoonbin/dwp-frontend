import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionRunState = AgentSchemas['AgentRunState'];
export type DwaionRunStageKey =
  'AUTHORIZING' | 'RETRIEVING' | 'REASONING' | 'VERIFYING' | 'PERSISTING' | 'COMPLETED' | 'FAILED';
export type DwaionRunStageState = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type DwaionRunMeasurementStatus = 'MEASURING' | 'MEASURED' | 'PARTIAL' | 'NOT_AVAILABLE';

export type DwaionRunStage = {
  key: DwaionRunStageKey;
  state: DwaionRunStageState;
  sequence: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
};

export type DwaionRunLease = {
  status: 'ACTIVE' | 'EXPIRED' | 'RELEASED';
  expiresAt: string | null;
};

export type DwaionRunAuditEvidence = {
  auditId: string | null;
  auditRecordId: string | null;
  status: 'LINKED' | 'PENDING' | 'NOT_AVAILABLE';
};

export type DwaionRunSourceHealth = {
  sourceType: string;
  status: 'SUCCESS' | 'UNAVAILABLE' | 'NOT_CONFIGURED';
  latencyMs: number | null;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
};

type DwaionRunObservability = {
  dataProvenance?: 'LIVE' | 'SAMPLE';
  /** Privacy-minimized server title; question and answer plaintext are never accepted here. */
  activityTitle?: string;
  attempt?: number;
  lease?: DwaionRunLease;
  currentStage?: DwaionRunStageKey | null;
  progressPercent?: number | null;
  measurementStatus?: DwaionRunMeasurementStatus;
  stages?: DwaionRunStage[];
  auditEvidence?: DwaionRunAuditEvidence;
  sourceHealth?: DwaionRunSourceHealth[];
};

// Optional during a rolling Agent deployment. When the server supplies observability fields,
// the runtime validator below validates every value before the UI can display it.
export type DwaionUserRun = Omit<
  AgentSchemas['UserAgentRunSummary'],
  keyof DwaionRunObservability
> &
  DwaionRunObservability;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const RUN_STATES = new Set<DwaionRunState>(['RUNNING', 'COMPLETED', 'FAILED']);
const USER_RUN_KEYS = new Set([
  'runId',
  'agentKey',
  'agentRevision',
  'runState',
  'answerState',
  'riskTier',
  'policyOutcome',
  'statusCode',
  'sourceCount',
  'latencyMs',
  'conversationId',
  'createdAt',
  'completedAt',
  'dataProvenance',
  'activityTitle',
  'attempt',
  'lease',
  'currentStage',
  'progressPercent',
  'measurementStatus',
  'stages',
  'auditEvidence',
  'sourceHealth',
]);

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
    hasOnlyKeys(run, USER_RUN_KEYS) &&
    typeof run.runId === 'string' &&
    UUID_PATTERN.test(run.runId) &&
    typeof run.agentKey === 'string' &&
    run.agentKey.length >= 1 &&
    run.agentKey.length <= 100 &&
    isNonnegativeInteger(run.agentRevision) &&
    typeof run.runState === 'string' &&
    RUN_STATES.has(run.runState as DwaionRunState) &&
    (run.answerState === null ||
      ['COMPLETED', 'ABSTAINED', 'CONFIGURATION_REQUIRED'].includes(String(run.answerState))) &&
    ['L0', 'L1', 'L2', 'L3'].includes(String(run.riskTier)) &&
    ['ALLOW', 'HANDOFF', 'DENY'].includes(String(run.policyOutcome)) &&
    (run.statusCode === null ||
      (typeof run.statusCode === 'string' && run.statusCode.length <= 128)) &&
    isNonnegativeInteger(run.sourceCount) &&
    isNonnegativeInteger(run.latencyMs) &&
    (run.conversationId === null ||
      (typeof run.conversationId === 'string' && UUID_PATTERN.test(run.conversationId))) &&
    isDate(run.createdAt) &&
    (run.completedAt === null || isDate(run.completedAt)) &&
    isRunObservability(run)
  );
}

const STAGE_KEYS = new Set<DwaionRunStageKey>([
  'AUTHORIZING',
  'RETRIEVING',
  'REASONING',
  'VERIFYING',
  'PERSISTING',
  'COMPLETED',
  'FAILED',
]);
const STAGE_SEQUENCES: Readonly<Record<DwaionRunStageKey, number>> = {
  AUTHORIZING: 10,
  RETRIEVING: 20,
  REASONING: 30,
  VERIFYING: 40,
  PERSISTING: 50,
  COMPLETED: 60,
  FAILED: 60,
};
const STAGE_STATES = new Set<DwaionRunStageState>(['ACTIVE', 'COMPLETED', 'FAILED', 'SKIPPED']);
const MEASUREMENT_STATES = new Set<DwaionRunMeasurementStatus>([
  'MEASURING',
  'MEASURED',
  'PARTIAL',
  'NOT_AVAILABLE',
]);

function isRunObservability(run: Record<string, unknown>): boolean {
  return (
    optional(run.dataProvenance, (value) => ['LIVE', 'SAMPLE'].includes(String(value))) &&
    optional(run.activityTitle, isActivityTitle) &&
    optional(run.attempt, isPositiveInteger) &&
    optional(run.lease, isRunLease) &&
    optionalNullable(run.currentStage, isStageKey) &&
    optionalNullable(run.progressPercent, isPercentage) &&
    optional(run.measurementStatus, (value) =>
      typeof value === 'string'
        ? MEASUREMENT_STATES.has(value as DwaionRunMeasurementStatus)
        : false
    ) &&
    optional(run.stages, (value) => Array.isArray(value) && value.every(isRunStage)) &&
    optional(run.auditEvidence, isAuditEvidence) &&
    optional(run.sourceHealth, (value) => Array.isArray(value) && value.every(isSourceHealth))
  );
}

function isActivityTitle(value: unknown): boolean {
  return typeof value === 'string' && value.length >= 1 && value.length <= 160;
}

function isRunLease(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(value, new Set(['status', 'expiresAt'])) &&
    ['ACTIVE', 'EXPIRED', 'RELEASED'].includes(String(value.status)) &&
    (value.expiresAt === null || isDate(value.expiresAt))
  );
}

function isRunStage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasOnlyKeys(
      value,
      new Set(['key', 'state', 'sequence', 'startedAt', 'completedAt', 'durationMs'])
    ) &&
    isStageKey(value.key) &&
    typeof value.state === 'string' &&
    STAGE_STATES.has(value.state as DwaionRunStageState) &&
    value.sequence === STAGE_SEQUENCES[value.key as DwaionRunStageKey] &&
    isDate(value.startedAt) &&
    (value.completedAt === null || isDate(value.completedAt)) &&
    (value.durationMs === null || isNonnegativeInteger(value.durationMs)) &&
    ((value.state === 'ACTIVE' && value.completedAt === null) ||
      (value.state !== 'ACTIVE' && value.completedAt !== null)) &&
    (value.completedAt === null || Date.parse(value.completedAt) >= Date.parse(value.startedAt))
  );
}

function isAuditEvidence(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const validShape =
    hasOnlyKeys(value, new Set(['auditId', 'auditRecordId', 'status'])) &&
    (value.auditId === null ||
      (typeof value.auditId === 'string' &&
        value.auditId.trim().length >= 1 &&
        value.auditId.length <= 128)) &&
    (value.auditRecordId === null ||
      (typeof value.auditRecordId === 'string' && UUID_PATTERN.test(value.auditRecordId))) &&
    ['LINKED', 'PENDING', 'NOT_AVAILABLE'].includes(String(value.status));
  if (!validShape) return false;
  return value.status === 'NOT_AVAILABLE'
    ? value.auditId === null && value.auditRecordId === null
    : value.auditId !== null && value.auditRecordId !== null;
}

function isSourceHealth(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const validShape =
    hasOnlyKeys(
      value,
      new Set(['sourceType', 'status', 'latencyMs', 'lastAttemptAt', 'lastSuccessAt'])
    ) &&
    typeof value.sourceType === 'string' &&
    [
      'WORK_ITEM',
      'MAIL',
      'CALENDAR',
      'APPROVAL_TASK',
      'APPROVAL_REQUEST',
      'APPROVAL_FORM',
      'APPROVAL_OPERATION',
    ].includes(value.sourceType) &&
    ['SUCCESS', 'UNAVAILABLE', 'NOT_CONFIGURED'].includes(String(value.status)) &&
    (value.latencyMs === null || isNonnegativeInteger(value.latencyMs)) &&
    isDate(value.lastAttemptAt) &&
    (value.lastSuccessAt === null || isDate(value.lastSuccessAt));
  if (!validShape) return false;
  return value.status === 'SUCCESS'
    ? value.lastSuccessAt === value.lastAttemptAt
    : value.lastSuccessAt === null;
}

function isStageKey(value: unknown): value is DwaionRunStageKey {
  return typeof value === 'string' && STAGE_KEYS.has(value as DwaionRunStageKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function optional(value: unknown, predicate: (candidate: unknown) => boolean): boolean {
  return value === undefined || predicate(value);
}

function optionalNullable(value: unknown, predicate: (candidate: unknown) => boolean): boolean {
  return value === undefined || value === null || predicate(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isNonnegativeInteger(value) && value > 0;
}

function isPercentage(value: unknown): value is number {
  return isNonnegativeInteger(value) && value <= 100;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
