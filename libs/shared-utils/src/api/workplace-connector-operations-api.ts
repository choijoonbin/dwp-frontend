import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { WorkplaceConnectorKind } from './workplace-collaboration-api';

const BASE = '/api/platform/v1/admin/workplace/connectors';

export const WORKPLACE_CONNECTOR_KINDS = [
  'CALENDAR',
  'ACTUAL_PRESENCE',
  'ACCESS_CONTROL',
  'SIGNAGE',
  'VISITOR',
  'VEHICLE',
  'FACILITY_WORK_ORDER',
] as const;

export type WorkplaceConnectorProviderState = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
export type WorkplaceConnectorRuntimeState =
  | 'NOT_CONFIGURED'
  | 'DISABLED'
  | 'CONFIGURED_UNVERIFIED'
  | 'HEALTHY'
  | 'DEGRADED'
  | 'STALE'
  | 'REPLAYING';
export type WorkplaceConnectorCapability = 'HEALTH' | 'CHECKPOINT' | 'RETRY_QUEUE' | 'REPLAY';
export type WorkplaceConnectorReplayState =
  'QUEUED' | 'DISPATCHING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';

export type WorkplaceConnectorRuntimeTruth = Readonly<{
  kind: WorkplaceConnectorKind;
  provider: string | null;
  enabled: boolean;
  state: WorkplaceConnectorRuntimeState;
  providerReportedState: WorkplaceConnectorProviderState | null;
  capabilities: readonly WorkplaceConnectorCapability[];
  configurationVersion: number;
  observedConfigurationVersion: number | null;
  runtimeVersion: number | null;
  sourceObservedAt: string | null;
  receivedAt: string | null;
  lastSuccessAt: string | null;
  lagSeconds: number | null;
  checkpointReference: string | null;
  retryQueueDepth: number | null;
  deadLetterQueueDepth: number | null;
  errorCode: string | null;
  activeReplayJobId: string | null;
  evaluatedAt: string;
}>;

export type WorkplaceConnectorOperations = Readonly<{
  connectors: readonly WorkplaceConnectorRuntimeTruth[];
  generatedAt: string;
}>;

export type WorkplaceConnectorReplayPreviewInput = Readonly<{
  from: string;
  to: string;
  failedOnly: boolean;
  maximumRecords: number;
  configurationVersion: number;
  runtimeVersion: number;
}>;

export type WorkplaceConnectorReplayPreview = WorkplaceConnectorReplayPreviewInput &
  Readonly<{
    previewId: string;
    kind: WorkplaceConnectorKind;
    provider: string;
    estimatedRecords: number;
    eligible: boolean;
    limitations: readonly string[];
    expiresAt: string;
    createdAt: string;
  }>;

export type WorkplaceConnectorReplayStartInput = Readonly<{
  previewId: string;
  configurationVersion: number;
  runtimeVersion: number;
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceConnectorReplayJob = Readonly<{
  jobId: string;
  previewId: string;
  kind: WorkplaceConnectorKind;
  provider: string;
  state: WorkplaceConnectorReplayState;
  reason: string;
  providerOperationReference: string | null;
  resultSummary: string | null;
  configurationVersion: number;
  runtimeVersion: number;
  version: number;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}>;

export type WorkplaceConnectorCommandReceipt = Readonly<{
  commandId: string;
  state: WorkplaceConnectorReplayState;
  acceptedAt: string;
  statusHref: string;
  idempotentReplay: boolean;
  correlationId: string;
}>;

export type WorkplaceConnectorReplayStartResponse = Readonly<{
  job: WorkplaceConnectorReplayJob;
  receipt: WorkplaceConnectorCommandReceipt;
}>;

const KINDS = new Set<string>(WORKPLACE_CONNECTOR_KINDS);
const PROVIDER_STATES = new Set<string>(['HEALTHY', 'DEGRADED', 'UNAVAILABLE']);
const RUNTIME_STATES = new Set<string>([
  'NOT_CONFIGURED',
  'DISABLED',
  'CONFIGURED_UNVERIFIED',
  'HEALTHY',
  'DEGRADED',
  'STALE',
  'REPLAYING',
]);
const CAPABILITIES = new Set<string>(['HEALTH', 'CHECKPOINT', 'RETRY_QUEUE', 'REPLAY']);
const REPLAY_STATES = new Set<string>([
  'QUEUED',
  'DISPATCHING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,160}$/u;

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function invalid(path: string): never {
  throw new Error(`Invalid Workplace connector operations response at ${path}.`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, maximum = 1000): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value.length > maximum ||
    hasControlCharacter(value)
  )
    return invalid(path);
  return value;
}

function nullableText(value: unknown, path: string, maximum = 1000): string | null {
  return value === null ? null : text(value, path, maximum);
}

function enumeration<T extends string>(value: unknown, values: Set<string>, path: string): T {
  if (typeof value !== 'string' || !values.has(value)) return invalid(path);
  return value as T;
}

function integer(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid(path);
  return value;
}

function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}

function instant(value: unknown, path: string): string {
  const result = text(value, path, 64);
  if (!Number.isFinite(Date.parse(result)) || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(result)) {
    return invalid(path);
  }
  return result;
}

function nullableInstant(value: unknown, path: string): string | null {
  return value === null ? null : instant(value, path);
}

function uuid(value: unknown, path: string): string {
  const result = text(value, path, 36);
  return UUID.test(result) ? result : invalid(path);
}

function nullableUuid(value: unknown, path: string): string | null {
  return value === null ? null : uuid(value, path);
}

function boolean(value: unknown, path: string): boolean {
  return typeof value === 'boolean' ? value : invalid(path);
}

function stringList(value: unknown, path: string, maximum = 100): readonly string[] {
  if (!Array.isArray(value) || value.length > maximum) return invalid(path);
  return value.map((item, index) => text(item, `${path}[${index}]`, 160));
}

function capabilities(value: unknown, path: string): readonly WorkplaceConnectorCapability[] {
  if (!Array.isArray(value) || value.length > CAPABILITIES.size) return invalid(path);
  const parsed = value.map((item, index) =>
    enumeration<WorkplaceConnectorCapability>(item, CAPABILITIES, `${path}[${index}]`)
  );
  return new Set(parsed).size === parsed.length ? parsed : invalid(path);
}

export function parseWorkplaceConnectorRuntimeTruth(
  value: unknown,
  path = 'connector'
): WorkplaceConnectorRuntimeTruth {
  const data = record(value, path);
  const kind = enumeration<WorkplaceConnectorKind>(data.kind, KINDS, `${path}.kind`);
  const provider = nullableText(data.provider, `${path}.provider`, 120);
  const enabled = boolean(data.enabled, `${path}.enabled`);
  const rawState = enumeration<WorkplaceConnectorRuntimeState>(
    data.state,
    RUNTIME_STATES,
    `${path}.state`
  );
  const providerReportedState =
    data.providerReportedState === null
      ? null
      : enumeration<WorkplaceConnectorProviderState>(
          data.providerReportedState,
          PROVIDER_STATES,
          `${path}.providerReportedState`
        );
  const parsedCapabilities = capabilities(data.capabilities, `${path}.capabilities`);
  const configurationVersion = integer(data.configurationVersion, `${path}.configurationVersion`);
  const observedConfigurationVersion = nullableInteger(
    data.observedConfigurationVersion,
    `${path}.observedConfigurationVersion`
  );
  const runtimeVersion = nullableInteger(data.runtimeVersion, `${path}.runtimeVersion`);
  const sourceObservedAt = nullableInstant(data.sourceObservedAt, `${path}.sourceObservedAt`);
  const receivedAt = nullableInstant(data.receivedAt, `${path}.receivedAt`);
  const lastSuccessAt = nullableInstant(data.lastSuccessAt, `${path}.lastSuccessAt`);
  const healthyEvidence =
    enabled &&
    provider !== null &&
    providerReportedState === 'HEALTHY' &&
    observedConfigurationVersion === configurationVersion &&
    runtimeVersion !== null &&
    sourceObservedAt !== null &&
    receivedAt !== null &&
    lastSuccessAt !== null &&
    parsedCapabilities.includes('HEALTH');
  return Object.freeze({
    kind,
    provider,
    enabled,
    state: rawState === 'HEALTHY' && !healthyEvidence ? 'CONFIGURED_UNVERIFIED' : rawState,
    providerReportedState,
    capabilities: parsedCapabilities,
    configurationVersion,
    observedConfigurationVersion,
    runtimeVersion,
    sourceObservedAt,
    receivedAt,
    lastSuccessAt,
    lagSeconds: nullableInteger(data.lagSeconds, `${path}.lagSeconds`),
    checkpointReference: nullableText(data.checkpointReference, `${path}.checkpointReference`, 320),
    retryQueueDepth: nullableInteger(data.retryQueueDepth, `${path}.retryQueueDepth`),
    deadLetterQueueDepth: nullableInteger(
      data.deadLetterQueueDepth,
      `${path}.deadLetterQueueDepth`
    ),
    errorCode: nullableText(data.errorCode, `${path}.errorCode`, 120),
    activeReplayJobId: nullableUuid(data.activeReplayJobId, `${path}.activeReplayJobId`),
    evaluatedAt: instant(data.evaluatedAt, `${path}.evaluatedAt`),
  });
}

export function parseWorkplaceConnectorOperations(value: unknown): WorkplaceConnectorOperations {
  const data = record(value, 'operations');
  if (
    !Array.isArray(data.connectors) ||
    data.connectors.length !== WORKPLACE_CONNECTOR_KINDS.length
  )
    return invalid('operations.connectors');
  const connectors = data.connectors.map((item, index) =>
    parseWorkplaceConnectorRuntimeTruth(item, `operations.connectors[${index}]`)
  );
  if (new Set(connectors.map((connector) => connector.kind)).size !== connectors.length) {
    return invalid('operations.connectors.kind');
  }
  return Object.freeze({
    connectors,
    generatedAt: instant(data.generatedAt, 'operations.generatedAt'),
  });
}

export function parseWorkplaceConnectorReplayPreview(
  value: unknown
): WorkplaceConnectorReplayPreview {
  const data = record(value, 'preview');
  return Object.freeze({
    previewId: uuid(data.previewId, 'preview.previewId'),
    kind: enumeration<WorkplaceConnectorKind>(data.kind, KINDS, 'preview.kind'),
    provider: text(data.provider, 'preview.provider', 120),
    from: instant(data.from, 'preview.from'),
    to: instant(data.to, 'preview.to'),
    failedOnly: boolean(data.failedOnly, 'preview.failedOnly'),
    maximumRecords: integer(data.maximumRecords, 'preview.maximumRecords'),
    estimatedRecords: integer(data.estimatedRecords, 'preview.estimatedRecords'),
    eligible: boolean(data.eligible, 'preview.eligible'),
    limitations: stringList(data.limitations, 'preview.limitations'),
    configurationVersion: integer(data.configurationVersion, 'preview.configurationVersion'),
    runtimeVersion: integer(data.runtimeVersion, 'preview.runtimeVersion'),
    expiresAt: instant(data.expiresAt, 'preview.expiresAt'),
    createdAt: instant(data.createdAt, 'preview.createdAt'),
  });
}

export function parseWorkplaceConnectorReplayJob(value: unknown): WorkplaceConnectorReplayJob {
  const data = record(value, 'job');
  return Object.freeze({
    jobId: uuid(data.jobId, 'job.jobId'),
    previewId: uuid(data.previewId, 'job.previewId'),
    kind: enumeration<WorkplaceConnectorKind>(data.kind, KINDS, 'job.kind'),
    provider: text(data.provider, 'job.provider', 120),
    state: enumeration<WorkplaceConnectorReplayState>(data.state, REPLAY_STATES, 'job.state'),
    reason: text(data.reason, 'job.reason', 500),
    providerOperationReference: nullableText(
      data.providerOperationReference,
      'job.providerOperationReference',
      320
    ),
    resultSummary: nullableText(data.resultSummary, 'job.resultSummary', 1000),
    configurationVersion: integer(data.configurationVersion, 'job.configurationVersion'),
    runtimeVersion: integer(data.runtimeVersion, 'job.runtimeVersion'),
    version: integer(data.version, 'job.version'),
    requestedAt: instant(data.requestedAt, 'job.requestedAt'),
    startedAt: nullableInstant(data.startedAt, 'job.startedAt'),
    finishedAt: nullableInstant(data.finishedAt, 'job.finishedAt'),
    updatedAt: instant(data.updatedAt, 'job.updatedAt'),
  });
}

function parseReceipt(value: unknown): WorkplaceConnectorCommandReceipt {
  const data = record(value, 'receipt');
  const statusHref = text(data.statusHref, 'receipt.statusHref', 500);
  if (!statusHref.startsWith('/v1/admin/workplace/connectors/'))
    return invalid('receipt.statusHref');
  return Object.freeze({
    commandId: uuid(data.commandId, 'receipt.commandId'),
    state: enumeration<WorkplaceConnectorReplayState>(data.state, REPLAY_STATES, 'receipt.state'),
    acceptedAt: instant(data.acceptedAt, 'receipt.acceptedAt'),
    statusHref,
    idempotentReplay: boolean(data.idempotentReplay, 'receipt.idempotentReplay'),
    correlationId: text(data.correlationId, 'receipt.correlationId', 160),
  });
}

export function parseWorkplaceConnectorReplayStartResponse(
  value: unknown
): WorkplaceConnectorReplayStartResponse {
  const data = record(value, 'start');
  const job = parseWorkplaceConnectorReplayJob(data.job);
  const receipt = parseReceipt(data.receipt);
  if (receipt.commandId !== job.jobId || receipt.state !== job.state)
    return invalid('start.receipt');
  return Object.freeze({ job, receipt });
}

function connectorPath(kind: WorkplaceConnectorKind) {
  if (!KINDS.has(kind)) throw new Error('Workplace connector kind is invalid.');
  return `${BASE}/${encodeURIComponent(kind)}`;
}

function validatePreviewInput(input: WorkplaceConnectorReplayPreviewInput) {
  const from = Date.parse(input.from);
  const to = Date.parse(input.to);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to) ||
    to <= from ||
    to - from > 7 * 24 * 60 * 60 * 1000 ||
    !Number.isSafeInteger(input.maximumRecords) ||
    input.maximumRecords < 1 ||
    input.maximumRecords > 100_000 ||
    !Number.isSafeInteger(input.configurationVersion) ||
    input.configurationVersion < 0 ||
    !Number.isSafeInteger(input.runtimeVersion) ||
    input.runtimeVersion < 0
  )
    throw new Error('Workplace connector replay preview input is invalid.');
}

export async function getWorkplaceConnectorOperations() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${BASE}/operations`);
  return parseWorkplaceConnectorOperations(response.data.data);
}

export async function getWorkplaceConnectorOperation(kind: WorkplaceConnectorKind) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${connectorPath(kind)}/operations`
  );
  return parseWorkplaceConnectorRuntimeTruth(response.data.data);
}

export async function previewWorkplaceConnectorReplay(
  kind: WorkplaceConnectorKind,
  input: WorkplaceConnectorReplayPreviewInput,
  options: { idempotencyKey: string; activeAccessMode: 'ELEVATED'; correlationId?: string }
) {
  validatePreviewInput(input);
  if (!IDEMPOTENCY_KEY.test(options.idempotencyKey))
    throw new Error('Workplace connector replay preview idempotency key is invalid.');
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${connectorPath(kind)}/replays:preview`,
    input,
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
      },
    }
  );
  return parseWorkplaceConnectorReplayPreview(response.data.data);
}

export async function startWorkplaceConnectorReplay(
  kind: WorkplaceConnectorKind,
  input: WorkplaceConnectorReplayStartInput,
  options: { idempotencyKey: string; activeAccessMode: 'ELEVATED'; correlationId?: string }
) {
  const reason = input.reason.trim();
  if (
    !UUID.test(input.previewId) ||
    !Number.isSafeInteger(input.configurationVersion) ||
    input.configurationVersion < 0 ||
    !Number.isSafeInteger(input.runtimeVersion) ||
    input.runtimeVersion < 0 ||
    !reason ||
    reason.length > 500 ||
    hasControlCharacter(reason) ||
    input.explicitConfirmation !== true ||
    !IDEMPOTENCY_KEY.test(options.idempotencyKey)
  )
    throw new Error('Workplace connector replay command is invalid.');
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceConnectorReplayStartInput
  >(
    `${connectorPath(kind)}/replays`,
    { ...input, reason },
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        'X-DWP-Active-Access-Mode': options.activeAccessMode,
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
      },
    }
  );
  return parseWorkplaceConnectorReplayStartResponse(response.data.data);
}

export async function getWorkplaceConnectorReplay(kind: WorkplaceConnectorKind, jobId: string) {
  if (!UUID.test(jobId)) throw new Error('Workplace connector replay job identifier is invalid.');
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${connectorPath(kind)}/replays/${encodeURIComponent(jobId)}`
  );
  return parseWorkplaceConnectorReplayJob(response.data.data);
}
