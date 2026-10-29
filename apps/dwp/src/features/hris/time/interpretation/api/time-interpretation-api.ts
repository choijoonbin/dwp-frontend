import { axiosInstance, productSurfaceGovernedMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  parseTimeInterpretationReceipt,
  parseTimeInterpretationTrace,
  parseTimeInterpretationWorkbench,
} from '../model/time-interpretation-model';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  TimeInterpretationReceipt,
  TimeInterpretationTrace,
  TimeInterpretationWorkbench,
} from '../model/time-interpretation-model';

const INTERPRETATION_WORKBENCH = '/api/time/v1/hris/workbench/time-interpretation' as const;
const INTERPRETATION_RUNS = '/api/time/v1/interpretation-runs' as const;

export const TIME_INTERPRETATION_API_CONTRACTS = Object.freeze([
  { bindingId: 'IAQ-041', method: 'GET', path: INTERPRETATION_WORKBENCH },
  { bindingId: 'PEP-TIM-009', method: 'POST', path: INTERPRETATION_RUNS },
  {
    bindingId: 'PEP-TIM-010',
    method: 'GET',
    path: `${INTERPRETATION_RUNS}/{runId}/trace`,
  },
] as const);

export const HCM_TIME_INTERPRETATION_MUTATION_API_CONTRACT = Object.freeze({
  apiFunction: 'runTimeInterpretation',
  routeContractKey: 'route.hcm.operations.time-interpretation-run.action',
  method: 'POST',
  path: INTERPRETATION_RUNS,
});

export const TIME_INTERPRETATION_AUTHORIZATION_CONTRACT = Object.freeze({
  version: 38,
  sha256: 'a41145d6a2faefd2e6030a2ca9a070769019d4db5513ea214bf542dda31c374a',
  gatewayOpenApiSha256: '453f3620dca02a5ce82df273be986633fb5d694084ca080859bb47472027d234',
  readCapabilities: Object.freeze(['hcm.operations.time.view'] as const),
  runCapabilities: Object.freeze([
    'hcm.operations.time.update',
    'hcm.personal.time.submit',
  ] as const),
  traceCapabilities: Object.freeze([
    'hcm.operations.time.update',
    'hcm.personal.time.view',
  ] as const),
  populationScopes: Object.freeze([
    'LEGAL_ENTITY',
    'ORG_TREE',
    'ORG_UNIT',
    'SELF',
    'TIME_GROUP',
  ] as const),
});

export type TimeInterpretationScope = Readonly<{
  ready: boolean;
  contextScopeKey: string;
  decisionRevision: string;
  locale: string;
  timeZone: string;
  correlationId: string;
}>;

export type TimeInterpretationPageRequest = Readonly<{
  asOf?: string;
  cursor?: string;
}>;

export type TimeInterpretationRunRequest = Readonly<{
  workerIds: readonly string[];
  periodStart: string;
  periodEnd: string;
  asOf: string;
}>;

export type TimeInterpretationHttpConfig = Readonly<{
  contextScopeKey: string;
  signal: AbortSignal;
  headers?: Record<string, string>;
}>;

export type TimeInterpretationHttpClient = Readonly<{
  get: (
    url: string,
    config: TimeInterpretationHttpConfig
  ) => Promise<Readonly<{ data: ApiResponse<unknown> }>>;
  post: (
    url: string,
    body: unknown,
    config: TimeInterpretationHttpConfig
  ) => Promise<Readonly<{ data: ApiResponse<unknown> }>>;
}>;

export type TimeInterpretationDataSource = Readonly<{
  read: (
    scope: TimeInterpretationScope,
    page: TimeInterpretationPageRequest,
    signal: AbortSignal
  ) => Promise<TimeInterpretationWorkbench>;
  run: (
    request: TimeInterpretationRunRequest,
    scope: TimeInterpretationScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<TimeInterpretationReceipt>;
  trace: (
    runId: string,
    scope: TimeInterpretationScope,
    signal: AbortSignal
  ) => Promise<TimeInterpretationTrace>;
}>;

export class TimeInterpretationCommandOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super('The TIM owner returned an unverifiable interpretation receipt.', { cause });
    this.name = 'TimeInterpretationCommandOutcomeUnknownError';
  }
}

export const timeInterpretationHttpClient: TimeInterpretationHttpClient = Object.freeze({
  get: (url, config) =>
    axiosInstance.get<ApiResponse<unknown>>(url, {
      ...productSurfaceReadScopeConfig(config.contextScopeKey, config.signal),
      ...(config.headers ? { headers: config.headers } : {}),
    }),
  post: (url, body, config) =>
    axiosInstance.post<ApiResponse<unknown>, unknown>(url, body, {
      contextScopeKey: config.contextScopeKey,
      signal: config.signal,
      ...(config.headers ? { headers: config.headers } : {}),
    }),
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;

function safeText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    ![...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
    })
  );
}

function instant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value));
}

function civilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function unwrap(response: Readonly<{ data: ApiResponse<unknown> }>): unknown {
  const envelope: unknown = response?.data;
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid TIM interpretation owner response envelope.');
  }
  if (!Object.hasOwn(envelope, 'data')) {
    throw new Error('Invalid TIM interpretation owner response envelope.');
  }
  return (envelope as { data: unknown }).data;
}

export function assertTimeInterpretationScope(scope: TimeInterpretationScope): void {
  if (
    !scope ||
    scope.ready !== true ||
    !safeText(scope.contextScopeKey, 500) ||
    !safeText(scope.decisionRevision, 500) ||
    !safeText(scope.locale, 35) ||
    !safeText(scope.timeZone, 255) ||
    !UUID.test(scope.correlationId)
  ) {
    throw new Error('Invalid TIM interpretation operation scope.');
  }
}

export function assertTimeInterpretationRunRequest(request: TimeInterpretationRunRequest): void {
  if (
    !request ||
    !Array.isArray(request.workerIds) ||
    request.workerIds.length < 1 ||
    request.workerIds.length > 1_000 ||
    request.workerIds.some((workerId) => !UUID.test(workerId)) ||
    new Set(request.workerIds.map((workerId) => workerId.toLowerCase())).size !==
      request.workerIds.length ||
    !civilDate(request.periodStart) ||
    !civilDate(request.periodEnd) ||
    request.periodStart > request.periodEnd ||
    !instant(request.asOf)
  ) {
    throw new Error('Invalid TIM interpretation run request.');
  }
}

function pageUrl(scope: TimeInterpretationScope, page: TimeInterpretationPageRequest): string {
  if (
    (page.asOf !== undefined && !instant(page.asOf)) ||
    (page.cursor !== undefined && (!page.asOf || !CURSOR.test(page.cursor)))
  ) {
    throw new Error('Invalid TIM interpretation continuation request.');
  }
  const query = new URLSearchParams();
  query.set('limit', '100');
  query.append('sort', 'interpretationResult:DESC');
  query.append('sort', 'itemPublicId:ASC');
  query.set('locale', scope.locale);
  query.set('timeZone', scope.timeZone);
  query.set('correlationId', scope.correlationId);
  if (page.asOf) query.set('asOf', page.asOf);
  if (page.cursor) query.set('cursor', page.cursor);
  return `${INTERPRETATION_WORKBENCH}?${query.toString()}`;
}

function governedConfig(
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: TimeInterpretationScope
): TimeInterpretationHttpConfig['headers'] {
  if (
    authority.mode !== 'SECURE' ||
    authority.expectedDecisionRevision !== scope.decisionRevision ||
    authority.contextScopeKey !== scope.contextScopeKey ||
    !authority.idempotencyKey ||
    !UUID.test(authority.idempotencyKey) ||
    authority.objectVersion !== undefined
  ) {
    throw new Error('Governed TIM interpretation authority is invalid.');
  }
  return {
    ...productSurfaceGovernedMutationConfig(authority).headers,
    'X-Correlation-ID': scope.correlationId,
  };
}

export async function runTimeInterpretation(
  request: TimeInterpretationRunRequest,
  scope: TimeInterpretationScope,
  authority: ProductSurfaceGovernedMutationAuthority,
  signal: AbortSignal,
  client: TimeInterpretationHttpClient = timeInterpretationHttpClient
): Promise<TimeInterpretationReceipt> {
  assertTimeInterpretationScope(scope);
  assertTimeInterpretationRunRequest(request);
  const response = await client.post(INTERPRETATION_RUNS, request, {
    contextScopeKey: scope.contextScopeKey,
    signal,
    headers: governedConfig(authority, scope),
  });
  try {
    const receipt = parseTimeInterpretationReceipt(unwrap(response));
    if (
      receipt.commandType !== 'INTERPRETATION_RUN' ||
      receipt.originatingAction !== 'TIME_INTERPRET_RUN' ||
      receipt.purposeCode !== 'TIME_INTERPRETATION' ||
      receipt.correlationId !== scope.correlationId
    ) {
      throw new Error('TIM interpretation receipt does not match the command.');
    }
    return receipt;
  } catch (error) {
    throw new TimeInterpretationCommandOutcomeUnknownError(error);
  }
}

export function createTimeInterpretationDataSource(
  client: TimeInterpretationHttpClient = timeInterpretationHttpClient
): TimeInterpretationDataSource {
  return Object.freeze({
    async read(scope, page, signal) {
      assertTimeInterpretationScope(scope);
      const response = await client.get(pageUrl(scope, page), {
        contextScopeKey: scope.contextScopeKey,
        signal,
        headers: { 'X-Correlation-ID': scope.correlationId },
      });
      return parseTimeInterpretationWorkbench(unwrap(response));
    },
    run: (request, scope, authority, signal) =>
      runTimeInterpretation(request, scope, authority, signal, client),
    async trace(runId, scope, signal) {
      assertTimeInterpretationScope(scope);
      if (!UUID.test(runId)) throw new Error('Invalid TIM interpretation run identifier.');
      const response = await client.get(
        `${INTERPRETATION_RUNS}/${encodeURIComponent(runId)}/trace`,
        {
          contextScopeKey: scope.contextScopeKey,
          signal,
          headers: { 'X-Correlation-ID': scope.correlationId },
        }
      );
      const trace = parseTimeInterpretationTrace(unwrap(response));
      if (trace.runId.toLowerCase() !== runId.toLowerCase()) {
        throw new Error('TIM interpretation trace does not match the selected run.');
      }
      return trace;
    },
  });
}
