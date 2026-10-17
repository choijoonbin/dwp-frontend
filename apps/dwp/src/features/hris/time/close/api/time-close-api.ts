import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  assertStrongTimeCloseEtag,
  assertTimeCloseInstant,
  assertTimeCloseReceiptBinding,
  assertTimeCloseScope,
  isTimeCloseUuid,
  parsePayrollTimeHandoffStatus,
  parseTimeCloseCommandReceipt,
  parseTimeCloseProjection,
} from '../model/time-close-model';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  PayrollTimeHandoffStatus,
  TimeCloseCommandKind,
  TimeCloseCommandReceipt,
  TimeCloseEntryMode,
  TimeCloseProjection,
  TimeCloseScope,
} from '../model/time-close-model';

const COMMAND_CENTER = '/api/time/v1/hris/workbench/time-command-center' as const;
const DAILY_CLOSE = '/api/time/v1/hris/workbench/time-daily-close' as const;
const MONTHLY_CLOSE = '/api/time/v1/hris/workbench/time-monthly-close' as const;
const CLOSE_PERIODS = '/api/time/v1/close-periods' as const;
const PAYROLL_HANDOFFS = '/api/time/v1/payroll-handoffs' as const;
const COMMAND_RECEIPTS = '/api/time/v1/command-receipts' as const;

export const TIME_CLOSE_API_CONTRACTS = Object.freeze([
  { bindingId: 'IAQ-039', method: 'GET', path: COMMAND_CENTER },
  { bindingId: 'IAQ-043', method: 'GET', path: DAILY_CLOSE },
  { bindingId: 'IAQ-044', method: 'GET', path: MONTHLY_CLOSE },
  {
    bindingId: 'PEP-TIM-022',
    method: 'POST',
    path: `${CLOSE_PERIODS}/{periodId}/validations`,
  },
  { bindingId: 'PEP-TIM-023', method: 'POST', path: `${CLOSE_PERIODS}/{periodId}/close` },
  { bindingId: 'PEP-TIM-024', method: 'POST', path: `${CLOSE_PERIODS}/{periodId}/reopen` },
  {
    bindingId: 'PEP-TIM-025',
    method: 'POST',
    path: `${CLOSE_PERIODS}/{periodId}/payroll-handoffs`,
  },
  {
    bindingId: 'PEP-TIM-026',
    method: 'GET',
    path: `${PAYROLL_HANDOFFS}/{handoffId}`,
  },
] as const);

export type TimeCloseHttpConfig = Readonly<{
  contextScopeKey: string;
  signal: AbortSignal;
  headers?: Record<string, string>;
  csrfReplay?: 'NEVER';
}>;

export type TimeCloseHttpResponse = Readonly<{
  data: unknown;
  headers: unknown;
  status: number;
}>;

export type TimeCloseHttpClient = Readonly<{
  get: (url: string, config: TimeCloseHttpConfig) => Promise<TimeCloseHttpResponse>;
  post: (url: string, body: unknown, config: TimeCloseHttpConfig) => Promise<TimeCloseHttpResponse>;
}>;

function captureResponse(response: { data: unknown; headers?: unknown; status?: unknown }) {
  return Object.freeze({
    data: response.data,
    headers: response.headers ?? {},
    status: typeof response.status === 'number' ? response.status : Number.NaN,
  });
}

export const timeCloseHttpClient: TimeCloseHttpClient = Object.freeze({
  get: async (url, config) =>
    captureResponse(
      await axiosInstance.get<unknown>(url, {
        ...productSurfaceReadScopeConfig(config.contextScopeKey, config.signal),
        ...(config.headers ? { headers: config.headers } : {}),
      })
    ),
  post: async (url, body, config) =>
    captureResponse(
      await axiosInstance.post<unknown, unknown>(url, body, {
        contextScopeKey: config.contextScopeKey,
        signal: config.signal,
        headers: config.headers,
        csrfReplay: config.csrfReplay,
      })
    ),
});

export type TimeClosePageRequest = Readonly<{ asOf?: string; cursor?: string }>;
export type TimeClosePeriodSnapshot = Readonly<{ periodId: string; version: number }>;
export type TimeCloseValidationCommand = Readonly<{ asOf: string }>;
export type TimeCloseCommand = Readonly<{ asOf: string; approvalReceiptId: string }>;
export type TimeReopenCommand = Readonly<{
  asOf: string;
  approvalReceiptId: string;
  reasonCode: string;
}>;
export type PayrollTimeHandoffCommand = Readonly<{
  closedTimeResultId: string;
  payrollEntityId: string;
  payPeriodId: string;
}>;

export type TimeCloseDataSource = Readonly<{
  readProjection: (
    entryMode: TimeCloseEntryMode,
    scope: TimeCloseScope,
    page: TimeClosePageRequest,
    signal: AbortSignal
  ) => Promise<TimeCloseProjection>;
  validate: (
    snapshot: TimeClosePeriodSnapshot,
    request: TimeCloseValidationCommand,
    idempotencyKey: string,
    scope: TimeCloseScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCloseCommandReceipt>;
  close: (
    snapshot: TimeClosePeriodSnapshot,
    request: TimeCloseCommand,
    idempotencyKey: string,
    scope: TimeCloseScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCloseCommandReceipt>;
  reopen: (
    snapshot: TimeClosePeriodSnapshot,
    request: TimeReopenCommand,
    idempotencyKey: string,
    scope: TimeCloseScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCloseCommandReceipt>;
  createHandoff: (
    snapshot: TimeClosePeriodSnapshot,
    request: PayrollTimeHandoffCommand,
    idempotencyKey: string,
    scope: TimeCloseScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeCloseCommandReceipt>;
  readReceipt: (
    receiptId: string,
    scope: TimeCloseScope,
    signal: AbortSignal
  ) => Promise<TimeCloseCommandReceipt>;
  readHandoff: (
    handoffId: string,
    scope: TimeCloseScope,
    signal: AbortSignal
  ) => Promise<PayrollTimeHandoffStatus>;
}>;

export class TimeCloseCommandOutcomeUnknownError extends Error {
  readonly receiptId?: string;

  constructor(cause: unknown, receiptId?: string) {
    super('The TIM owner returned an unverifiable close command receipt.', { cause });
    this.name = 'TimeCloseCommandOutcomeUnknownError';
    this.receiptId = receiptId;
  }
}

function responseHeader(headers: unknown, name: string): string {
  if (!headers || typeof headers !== 'object') return '';
  const getter = Reflect.get(headers, 'get');
  if (typeof getter === 'function') {
    const value = Reflect.apply(getter, headers, [name]);
    return typeof value === 'string' ? value : '';
  }
  const source = headers as Record<string, unknown>;
  const key = Object.keys(source).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase()
  );
  return key && typeof source[key] === 'string' ? source[key] : '';
}

function assertNoStoreHeaders(
  response: TimeCloseHttpResponse,
  scope: TimeCloseScope,
  includeDecision = true
): void {
  if (
    responseHeader(response.headers, 'Cache-Control') !== 'no-store' ||
    responseHeader(response.headers, 'X-Correlation-ID') !== scope.correlationId ||
    (includeDecision &&
      responseHeader(response.headers, 'X-DWP-Decision-Revision') !== scope.decisionRevision)
  ) {
    throw new Error('Invalid TIM close response authority headers.');
  }
}

function projectionUrl(
  entryMode: TimeCloseEntryMode,
  scope: TimeCloseScope,
  page: TimeClosePageRequest
): string {
  const base = {
    COMMAND_CENTER,
    DAILY_CLOSE,
    MONTHLY_CLOSE,
  }[entryMode];
  if (page.asOf !== undefined) {
    assertInstant(page.asOf, 'continuation as-of');
  }
  if (
    page.cursor !== undefined &&
    (page.asOf === undefined || !/^[A-Za-z0-9_-]{16,1024}$/u.test(page.cursor))
  ) {
    throw new Error('Invalid TIM close continuation request.');
  }
  const query = new URLSearchParams();
  query.set('limit', '100');
  query.set('filter[effectiveOn]', scope.effectiveOn);
  query.append('sort', 'timePeriod:DESC');
  query.append('sort', 'itemPublicId:ASC');
  query.set('locale', scope.locale);
  query.set('timeZone', scope.timeZone);
  query.set('correlationId', scope.correlationId);
  if (page.asOf) query.set('asOf', page.asOf);
  if (page.cursor) query.set('cursor', page.cursor);
  return `${base}?${query.toString()}`;
}

function assertInstant(value: string, label: string): void {
  assertTimeCloseInstant(value, label);
}

function assertIdempotencyKey(value: string): void {
  if (value.length < 16 || value.length > 128 || value !== value.trim() || /[\r\n]/u.test(value)) {
    throw new Error('Invalid TIM close idempotency key.');
  }
}

function commandAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  snapshot: TimeClosePeriodSnapshot,
  idempotencyKey: string,
  scope: TimeCloseScope,
  highRisk: boolean
) {
  if (
    authority.mode !== 'SECURE' ||
    authority.expectedDecisionRevision !== scope.decisionRevision ||
    authority.contextScopeKey !== scope.contextScopeKey ||
    authority.objectVersion !== snapshot.version ||
    authority.idempotencyKey !== idempotencyKey ||
    (highRisk ? !authority.stepUp : authority.stepUp !== undefined) ||
    (authority.stepUp !== undefined && Date.parse(authority.stepUp.expiresAt) <= Date.now())
  ) {
    throw new Error('Invalid governed TIM close command authority.');
  }
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: false })
    : productSurfaceGovernedMutationConfig(authority, { objectVersionHeader: false });
  return {
    contextScopeKey: authority.contextScopeKey,
    headers: governed.headers,
  } as const;
}

function commandPath(kind: TimeCloseCommandKind, periodId: string): string {
  const suffix = {
    VALIDATE: 'validations',
    CLOSE: 'close',
    REOPEN: 'reopen',
    HANDOFF: 'payroll-handoffs',
  }[kind];
  return `${CLOSE_PERIODS}/${encodeURIComponent(periodId)}/${suffix}`;
}

function exactReceiptLocationId(location: string): string | undefined {
  const prefix = `${COMMAND_RECEIPTS}/`;
  if (!location.startsWith(prefix) || location.length !== prefix.length + 36) return undefined;
  const receiptId = location.slice(prefix.length);
  return isTimeCloseUuid(receiptId) ? receiptId : undefined;
}

async function dispatchCommand(
  kind: TimeCloseCommandKind,
  snapshot: TimeClosePeriodSnapshot,
  body: unknown,
  idempotencyKey: string,
  scope: TimeCloseScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimeCloseHttpClient
): Promise<TimeCloseCommandReceipt> {
  assertTimeCloseScope(scope);
  if (
    !isTimeCloseUuid(snapshot.periodId) ||
    !Number.isSafeInteger(snapshot.version) ||
    snapshot.version < 1
  ) {
    throw new Error('Invalid TIM close period snapshot.');
  }
  assertIdempotencyKey(idempotencyKey);
  const highRisk = kind === 'CLOSE' || kind === 'REOPEN';
  const governed = commandAuthority(authority, snapshot, idempotencyKey, scope, highRisk);
  const purpose = kind === 'HANDOFF' ? 'CLOSED_TIME_PAYROLL_TRANSFER' : 'WORK_TIME_PERIOD_CLOSURE';
  const response = await client.post(commandPath(kind, snapshot.periodId), body, {
    contextScopeKey: governed.contextScopeKey,
    signal,
    csrfReplay: 'NEVER',
    headers: {
      ...governed.headers,
      'If-Match': `"${snapshot.version}"`,
      'X-Correlation-ID': scope.correlationId,
      'X-Purpose-Code': purpose,
    },
  });
  let receiptId: string | undefined;
  try {
    if (response.status !== 202) throw new Error('Invalid TIM close command success status.');
    assertNoStoreHeaders(response, scope);
    const location = responseHeader(response.headers, 'Location');
    if (
      responseHeader(response.headers, 'Retry-After') !== '1' ||
      responseHeader(response.headers, 'ETag').length !== 0
    ) {
      throw new Error('Invalid TIM close command response headers.');
    }
    const locationReceiptId = exactReceiptLocationId(location);
    const rawReceiptId =
      response.data && typeof response.data === 'object' && !Array.isArray(response.data)
        ? Reflect.get(response.data, 'receiptId')
        : undefined;
    if (
      !locationReceiptId ||
      !isTimeCloseUuid(rawReceiptId) ||
      rawReceiptId !== locationReceiptId
    ) {
      throw new Error('TIM close receipt Location does not match its identity.');
    }
    // Only a 202 response with verified authority/cache headers and the exact public receipt
    // Location may seed outcome-unknown recovery. No other unparsed fields are trusted.
    receiptId = rawReceiptId;
    const receipt = parseTimeCloseCommandReceipt(response.data);
    assertTimeCloseReceiptBinding(kind, receipt, scope.correlationId);
    return receipt;
  } catch (error) {
    throw new TimeCloseCommandOutcomeUnknownError(error, receiptId);
  }
}

export async function validateTimeClosePeriod(
  snapshot: TimeClosePeriodSnapshot,
  request: TimeCloseValidationCommand,
  idempotencyKey: string,
  scope: TimeCloseScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimeCloseHttpClient = timeCloseHttpClient
) {
  assertInstant(request.asOf, 'validation as-of');
  return dispatchCommand(
    'VALIDATE',
    snapshot,
    { asOf: request.asOf },
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export async function closeTimePeriod(
  snapshot: TimeClosePeriodSnapshot,
  request: TimeCloseCommand,
  idempotencyKey: string,
  scope: TimeCloseScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimeCloseHttpClient = timeCloseHttpClient
) {
  assertInstant(request.asOf, 'close as-of');
  if (!isTimeCloseUuid(request.approvalReceiptId))
    throw new Error('Invalid close approval receipt.');
  return dispatchCommand(
    'CLOSE',
    snapshot,
    { asOf: request.asOf, approvalReceiptId: request.approvalReceiptId },
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export async function reopenTimePeriod(
  snapshot: TimeClosePeriodSnapshot,
  request: TimeReopenCommand,
  idempotencyKey: string,
  scope: TimeCloseScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimeCloseHttpClient = timeCloseHttpClient
) {
  assertInstant(request.asOf, 'reopen as-of');
  if (
    !isTimeCloseUuid(request.approvalReceiptId) ||
    !/^[A-Z][A-Z0-9._-]{0,79}$/u.test(request.reasonCode)
  ) {
    throw new Error('Invalid reopen command.');
  }
  return dispatchCommand(
    'REOPEN',
    snapshot,
    {
      asOf: request.asOf,
      approvalReceiptId: request.approvalReceiptId,
      reasonCode: request.reasonCode,
    },
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export async function createPayrollTimeHandoff(
  snapshot: TimeClosePeriodSnapshot,
  request: PayrollTimeHandoffCommand,
  idempotencyKey: string,
  scope: TimeCloseScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimeCloseHttpClient = timeCloseHttpClient
) {
  if (
    !isTimeCloseUuid(request.closedTimeResultId) ||
    !isTimeCloseUuid(request.payrollEntityId) ||
    !isTimeCloseUuid(request.payPeriodId)
  ) {
    throw new Error('Invalid payroll handoff command.');
  }
  return dispatchCommand(
    'HANDOFF',
    snapshot,
    {
      closedTimeResultId: request.closedTimeResultId,
      payrollEntityId: request.payrollEntityId,
      payPeriodId: request.payPeriodId,
    },
    idempotencyKey,
    scope,
    authority,
    signal,
    client
  );
}

export async function readTimeCloseReceipt(
  receiptId: string,
  scope: TimeCloseScope,
  signal: AbortSignal,
  client: TimeCloseHttpClient = timeCloseHttpClient
) {
  assertTimeCloseScope(scope);
  if (!isTimeCloseUuid(receiptId)) throw new Error('Invalid time close receipt id.');
  const response = await client.get(`${COMMAND_RECEIPTS}/${encodeURIComponent(receiptId)}`, {
    contextScopeKey: scope.contextScopeKey,
    signal,
  });
  if (response.status !== 200) throw new Error('Invalid TIM receipt success status.');
  if (responseHeader(response.headers, 'Cache-Control') !== 'no-store') {
    throw new Error('Invalid TIM receipt cache policy.');
  }
  const receipt = parseTimeCloseCommandReceipt(response.data);
  if (receipt.receiptId !== receiptId) throw new Error('TIM receipt path identity does not match.');
  return receipt;
}

export async function readPayrollTimeHandoff(
  handoffId: string,
  scope: TimeCloseScope,
  signal: AbortSignal,
  client: TimeCloseHttpClient = timeCloseHttpClient
) {
  assertTimeCloseScope(scope);
  if (!isTimeCloseUuid(handoffId)) throw new Error('Invalid payroll handoff id.');
  const response = await client.get(`${PAYROLL_HANDOFFS}/${encodeURIComponent(handoffId)}`, {
    contextScopeKey: scope.contextScopeKey,
    signal,
    headers: {
      'X-Correlation-ID': scope.correlationId,
      'X-Purpose-Code': 'CLOSED_TIME_PAYROLL_TRANSFER',
      'X-DWP-Expected-Decision-Revision': scope.decisionRevision,
    },
  });
  if (response.status !== 200) throw new Error('Invalid TIM handoff success status.');
  assertNoStoreHeaders(response, scope);
  const etag = responseHeader(response.headers, 'ETag');
  assertStrongTimeCloseEtag(etag);
  const handoff = parsePayrollTimeHandoffStatus(response.data, etag);
  if (handoff.handoffId !== handoffId) throw new Error('TIM handoff path identity does not match.');
  return handoff;
}

export function createTimeCloseDataSource(
  client: TimeCloseHttpClient = timeCloseHttpClient
): TimeCloseDataSource {
  return Object.freeze({
    async readProjection(entryMode, scope, page, signal) {
      assertTimeCloseScope(scope);
      const response = await client.get(projectionUrl(entryMode, scope, page), {
        contextScopeKey: scope.contextScopeKey,
        signal,
      });
      if (response.status !== 200) throw new Error('Invalid TIM close projection success status.');
      assertNoStoreHeaders(response, scope);
      const projection = parseTimeCloseProjection(response.data, entryMode);
      if (projection.correlationId !== scope.correlationId) {
        throw new Error('TIM close projection correlation does not match.');
      }
      if (projection.cacheAuthorizationDecisionRevision !== scope.decisionRevision) {
        throw new Error('TIM close projection cache authority does not match.');
      }
      return projection;
    },
    validate: (snapshot, request, key, scope, authority, signal) =>
      validateTimeClosePeriod(snapshot, request, key, scope, authority, signal, client),
    close: (snapshot, request, key, scope, authority, signal) =>
      closeTimePeriod(snapshot, request, key, scope, authority, signal, client),
    reopen: (snapshot, request, key, scope, authority, signal) =>
      reopenTimePeriod(snapshot, request, key, scope, authority, signal, client),
    createHandoff: (snapshot, request, key, scope, authority, signal) =>
      createPayrollTimeHandoff(snapshot, request, key, scope, authority, signal, client),
    readReceipt: (receiptId, scope, signal) =>
      readTimeCloseReceipt(receiptId, scope, signal, client),
    readHandoff: (handoffId, scope, signal) =>
      readPayrollTimeHandoff(handoffId, scope, signal, client),
  });
}
