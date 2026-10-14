import { axiosInstance, productSurfaceGovernedMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type { operations } from '@dwp-frontend/api-contracts';
import {
  assertTimecardOperationScope,
  assertTimecardReceiptBinding,
  isTimecardUuid,
  parseTimecard,
  parseTimecardCorrectionCommand,
  parseTimecardDecisionCommand,
  parseTimecardSnapshot,
  parseTimecardSubmitCommand,
  parseTimeCommandReceipt,
  timecardCommandAllowed,
} from '../model/timecard-model';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  TimecardCommandKind,
  TimecardCorrectionCommand,
  TimecardDecisionCommand,
  TimecardOperationScope,
  TimecardSnapshot,
  TimecardSubmitCommand,
  TimeCommandReceipt,
} from '../model/timecard-model';

export type TimecardGeneratedContracts = Readonly<{
  read: operations['time_getTimecard'];
  correct: operations['time_correctTimecard'];
  submit: operations['time_submitTimecard'];
  decide: operations['time_decideTimecard'];
  receipt: operations['time_getTimeCommandReceipt'];
}>;

type TimecardReadBody =
  TimecardGeneratedContracts['read']['responses'][200]['content']['application/json'];
type TimecardCorrectionBody =
  TimecardGeneratedContracts['correct']['requestBody']['content']['application/json'];
type TimecardSubmitBody =
  TimecardGeneratedContracts['submit']['requestBody']['content']['application/json'];
type TimecardDecisionBody =
  TimecardGeneratedContracts['decide']['requestBody']['content']['application/json'];
type TimecardCommandResponse =
  TimecardGeneratedContracts['correct']['responses'][202]['content']['application/json'];
type TimecardReceiptResponse =
  TimecardGeneratedContracts['receipt']['responses'][200]['content']['application/json'];
type TimecardCommandHeaders = TimecardGeneratedContracts['correct']['parameters']['header'];

const TIMECARD_READ_SUCCESS_STATUS =
  200 as const satisfies keyof TimecardGeneratedContracts['read']['responses'];
const TIMECARD_COMMAND_SUCCESS_STATUS =
  202 as const satisfies keyof TimecardGeneratedContracts['correct']['responses'];
const TIMECARD_RECEIPT_SUCCESS_STATUS =
  200 as const satisfies keyof TimecardGeneratedContracts['receipt']['responses'];

const TIMECARDS = '/api/time/v1/timecards' as const;
const COMMAND_RECEIPTS = '/api/time/v1/command-receipts' as const;

export const TIMECARD_API_CONTRACTS = Object.freeze([
  { bindingId: 'PEP-TIM-011', method: 'GET', path: `${TIMECARDS}/{timecardId}` },
  {
    bindingId: 'PEP-TIM-012',
    method: 'POST',
    path: `${TIMECARDS}/{timecardId}/corrections`,
  },
  { bindingId: 'PEP-TIM-013', method: 'POST', path: `${TIMECARDS}/{timecardId}/submit` },
  {
    bindingId: 'PEP-TIM-014',
    method: 'POST',
    path: `${TIMECARDS}/{timecardId}/decisions`,
  },
  {
    bindingId: 'PEP-TIM-028',
    method: 'GET',
    path: `${COMMAND_RECEIPTS}/{receiptId}`,
  },
] as const);

export const TIMECARD_ACTION_CONTRACTS = Object.freeze({
  CORRECT: Object.freeze({
    contractId: 'PEP-TIM-012',
    actionKey: 'hris.action.tim.timecard.correct',
    routeContractKey: 'route.hcm.time.timecard-correction.action',
  }),
  SUBMIT: Object.freeze({
    contractId: 'PEP-TIM-013',
    actionKey: 'hris.action.tim.timecard.submit',
    routeContractKey: 'route.hcm.time.timecard-submit.action',
  }),
  DECIDE: Object.freeze({
    contractId: 'PEP-TIM-014',
    actionKey: 'hris.action.tim.timecard.decide',
    routeContractKey: 'route.hcm.time.timecard-decision.action',
  }),
} as const);

export const TIMECARD_AUTHORIZATION_CONTRACT = Object.freeze({
  version: 42,
  sha256: 'f73f9a64816ac8f5567a2a7c292821f4a40e6d675915ebc3c3ac8aad7d1fd983',
  gatewayOpenApiSha256: '50a57ad5aa93178f47d724ca3dfa08a64985de93a099071db66220dfe686c2a2',
  timeOpenApiSha256: '6702161141add3acde02896bb6844e5e40c6c6c0dc4b93eab859e77e9446f0e5',
  timecardSchemaGraphSha256: '96f3a6b0d7c6e7f228442f956daab0cfa44ce78dd65c8b477192ec77d0145db4',
  timecardPurpose: 'TIME_TIMECARD',
  receiptPurpose: 'COMMAND_STATUS',
  trustedHeadersFromBrowser: Object.freeze([] as const),
});

type TimecardHttpConfig = Readonly<{
  contextScopeKey: string;
  signal: AbortSignal;
  headers?: Record<string, string>;
  csrfReplay?: 'NEVER';
}>;

export type TimecardHttpResponse = Readonly<{
  data: unknown;
  headers?: unknown;
  status: number;
}>;

export type TimecardHttpClient = Readonly<{
  get: (url: string, config: TimecardHttpConfig) => Promise<TimecardHttpResponse>;
  post: (url: string, body: unknown, config: TimecardHttpConfig) => Promise<TimecardHttpResponse>;
}>;

export type TimecardDataSource = Readonly<{
  read: (
    timecardId: string,
    scope: TimecardOperationScope,
    signal: AbortSignal
  ) => Promise<TimecardSnapshot>;
  correct: (
    snapshot: TimecardSnapshot,
    request: TimecardCorrectionCommand,
    idempotencyKey: string,
    scope: TimecardOperationScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCommandReceipt>;
  submit: (
    snapshot: TimecardSnapshot,
    request: TimecardSubmitCommand,
    idempotencyKey: string,
    scope: TimecardOperationScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCommandReceipt>;
  decide: (
    snapshot: TimecardSnapshot,
    request: TimecardDecisionCommand,
    idempotencyKey: string,
    scope: TimecardOperationScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCommandReceipt>;
  receipt: (
    receiptId: string,
    scope: TimecardOperationScope,
    signal: AbortSignal
  ) => Promise<TimeCommandReceipt>;
}>;

export class TimecardCommandOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super('The TIM owner returned an unverifiable timecard receipt.', { cause });
    this.name = 'TimecardCommandOutcomeUnknownError';
  }
}

function captureTimecardHttpResponse(response: {
  data: unknown;
  headers?: unknown;
}): TimecardHttpResponse {
  const status = Reflect.get(response, 'status');
  return Object.freeze({
    data: response.data,
    ...(response.headers === undefined ? {} : { headers: response.headers }),
    status: typeof status === 'number' ? status : Number.NaN,
  });
}

export const timecardHttpClient: TimecardHttpClient = Object.freeze({
  get: async (url, config) =>
    captureTimecardHttpResponse(
      await axiosInstance.get<unknown>(
        url,
        productSurfaceReadScopeConfig(config.contextScopeKey, config.signal)
      )
    ),
  post: async (url, body, config) =>
    captureTimecardHttpResponse(
      await axiosInstance.post<unknown, unknown>(url, body, {
        contextScopeKey: config.contextScopeKey,
        signal: config.signal,
        headers: config.headers,
        csrfReplay: config.csrfReplay,
      })
    ),
});

function safeText(value: unknown, minimum: number, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimum &&
    value.length <= maximum &&
    value === value.trim() &&
    ![...value].some((character) => {
      const point = character.codePointAt(0);
      return point !== undefined && (point < 0x20 || point === 0x7f);
    })
  );
}

function responseHeader(headers: unknown, name: string): string {
  if (!headers || typeof headers !== 'object') return '';
  const getter = Reflect.get(headers, 'get');
  if (typeof getter === 'function') {
    const value = Reflect.apply(getter, headers, [name]);
    return typeof value === 'string' ? value : '';
  }
  const source = headers as Record<string, unknown>;
  const value = source[name] ?? source[name.toLowerCase()] ?? source[name.toUpperCase()];
  return typeof value === 'string' ? value : '';
}

function timecardPath(timecardId: string): string {
  if (!isTimecardUuid(timecardId)) throw new Error('Invalid TIM timecard identity.');
  return `${TIMECARDS}/${encodeURIComponent(timecardId.toLowerCase())}`;
}

function receiptPath(receiptId: string): string {
  if (!isTimecardUuid(receiptId)) throw new Error('Invalid TIM receipt identity.');
  return `${COMMAND_RECEIPTS}/${encodeURIComponent(receiptId.toLowerCase())}`;
}

function commandConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: TimecardOperationScope,
  snapshot: TimecardSnapshot,
  idempotencyKey: string,
  signal: AbortSignal
): TimecardHttpConfig {
  if (
    authority.mode !== 'SECURE' ||
    authority.contextScopeKey !== scope.contextScopeKey ||
    authority.expectedDecisionRevision !== scope.decisionRevision ||
    authority.stepUp !== undefined ||
    (authority.idempotencyKey !== undefined && authority.idempotencyKey !== idempotencyKey) ||
    (authority.objectVersion !== undefined &&
      authority.objectVersion !== snapshot.timecard.version) ||
    !safeText(idempotencyKey, 16, 128)
  ) {
    throw new Error('Governed TIM timecard authority is invalid.');
  }
  const governed = productSurfaceGovernedMutationConfig(authority);
  const expectedDecisionRevision = governed.headers['X-DWP-Expected-Decision-Revision'];
  if (expectedDecisionRevision !== scope.decisionRevision) {
    throw new Error('Governed TIM timecard authority is invalid.');
  }
  const headers: TimecardCommandHeaders = {
    'X-DWP-Expected-Decision-Revision': expectedDecisionRevision,
    'Idempotency-Key': idempotencyKey,
    'If-Match': snapshot.etag,
  };
  return {
    contextScopeKey: scope.contextScopeKey,
    signal,
    csrfReplay: 'NEVER',
    headers,
  };
}

export async function readTimecard(
  timecardId: string,
  scope: TimecardOperationScope,
  signal: AbortSignal,
  client: TimecardHttpClient = timecardHttpClient
): Promise<TimecardSnapshot> {
  assertTimecardOperationScope(scope);
  const canonicalId = timecardId.toLowerCase();
  const response = await client.get(timecardPath(canonicalId), {
    contextScopeKey: scope.contextScopeKey,
    signal,
  });
  if (response.status !== TIMECARD_READ_SUCCESS_STATUS) {
    throw new Error('Invalid TIM timecard success status.');
  }
  const body: TimecardReadBody = parseTimecard(response.data);
  const snapshot = parseTimecardSnapshot(body, responseHeader(response.headers, 'ETag'));
  if (snapshot.timecard.timecardId !== canonicalId) {
    throw new Error('Invalid TIM timecard resource binding.');
  }
  return snapshot;
}

async function postTimecardCommand(
  kind: TimecardCommandKind,
  snapshotInput: TimecardSnapshot,
  body: unknown,
  suffix: 'corrections' | 'submit' | 'decisions',
  idempotencyKey: string,
  scope: TimecardOperationScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimecardHttpClient
): Promise<TimeCommandReceipt> {
  assertTimecardOperationScope(scope);
  const snapshot = parseTimecardSnapshot(snapshotInput.timecard, snapshotInput.etag);
  if (!timecardCommandAllowed(kind, snapshot.timecard, scope)) {
    throw new Error('Canonical TIM timecard command is not available for this scope and state.');
  }
  const config = commandConfig(authority, scope, snapshot, idempotencyKey, signal);
  const response = await client.post(
    `${timecardPath(snapshot.timecard.timecardId)}/${suffix}`,
    body,
    {
      ...config,
      signal,
    }
  );
  try {
    if (response.status !== TIMECARD_COMMAND_SUCCESS_STATUS) {
      throw new Error('Invalid TIM timecard command success status.');
    }
    const receipt: TimecardCommandResponse = parseTimeCommandReceipt(response.data);
    assertTimecardReceiptBinding(receipt, kind, snapshot.timecard.timecardId);
    return receipt;
  } catch (error) {
    throw new TimecardCommandOutcomeUnknownError(error);
  }
}

export function correctTimecard(
  snapshot: TimecardSnapshot,
  request: TimecardCorrectionCommand,
  idempotencyKey: string,
  scope: TimecardOperationScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimecardHttpClient = timecardHttpClient
): Promise<TimeCommandReceipt> {
  const body: TimecardCorrectionBody = parseTimecardCorrectionCommand(request, snapshot.timecard);
  return postTimecardCommand(
    'CORRECT',
    snapshot,
    body,
    'corrections',
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export function submitTimecard(
  snapshot: TimecardSnapshot,
  request: TimecardSubmitCommand,
  idempotencyKey: string,
  scope: TimecardOperationScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimecardHttpClient = timecardHttpClient
): Promise<TimeCommandReceipt> {
  const body: TimecardSubmitBody = parseTimecardSubmitCommand(request);
  return postTimecardCommand(
    'SUBMIT',
    snapshot,
    body,
    'submit',
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export function decideTimecard(
  snapshot: TimecardSnapshot,
  request: TimecardDecisionCommand,
  idempotencyKey: string,
  scope: TimecardOperationScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimecardHttpClient = timecardHttpClient
): Promise<TimeCommandReceipt> {
  const body: TimecardDecisionBody = parseTimecardDecisionCommand(request);
  return postTimecardCommand(
    'DECIDE',
    snapshot,
    body,
    'decisions',
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export async function readTimeCommandReceipt(
  receiptId: string,
  scope: TimecardOperationScope,
  signal: AbortSignal,
  client: TimecardHttpClient = timecardHttpClient
): Promise<TimeCommandReceipt> {
  assertTimecardOperationScope(scope);
  const canonicalId = receiptId.toLowerCase();
  const response = await client.get(receiptPath(canonicalId), {
    contextScopeKey: scope.contextScopeKey,
    signal,
  });
  if (response.status !== TIMECARD_RECEIPT_SUCCESS_STATUS) {
    throw new Error('Invalid TIM receipt success status.');
  }
  const receipt: TimecardReceiptResponse = parseTimeCommandReceipt(response.data);
  if (receipt.receiptId !== canonicalId) {
    throw new Error('Invalid TIM receipt resource binding.');
  }
  return receipt;
}

export function createTimecardDataSource(
  client: TimecardHttpClient = timecardHttpClient
): TimecardDataSource {
  return Object.freeze({
    read: (timecardId, scope, signal) => readTimecard(timecardId, scope, signal, client),
    correct: (snapshot, request, idempotencyKey, scope, authority, signal) =>
      correctTimecard(snapshot, request, idempotencyKey, scope, authority, signal, client),
    submit: (snapshot, request, idempotencyKey, scope, authority, signal) =>
      submitTimecard(snapshot, request, idempotencyKey, scope, authority, signal, client),
    decide: (snapshot, request, idempotencyKey, scope, authority, signal) =>
      decideTimecard(snapshot, request, idempotencyKey, scope, authority, signal, client),
    receipt: (receiptId, scope, signal) => readTimeCommandReceipt(receiptId, scope, signal, client),
  });
}
