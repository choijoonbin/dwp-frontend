import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  parseClockCommandReceipt,
  parseClockExceptionWorkbench,
  parseClockWorkbench,
} from '../model/clock-ingestion-model';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  ClockCommandReceipt,
  ClockExceptionWorkbench,
  ClockIngestionScope,
  ClockWorkbench,
  RecordClockEventRequest,
} from '../model/clock-ingestion-model';

const CLOCK_EVENT_BASE = '/api/time/v1/clock-events' as const;
const CLOCK_WORKBENCH = '/api/time/v1/hris/workbench/clock-ingestion' as const;
const CLOCK_EXCEPTIONS = '/api/time/v1/hris/workbench/time-exceptions' as const;

export const CLOCK_INGESTION_API_CONTRACTS = [
  { bindingId: 'IAQ-034', method: 'GET', path: CLOCK_WORKBENCH },
  { bindingId: 'IAQ-042', method: 'GET', path: CLOCK_EXCEPTIONS },
  { bindingId: 'PEP-TIM-007', method: 'POST', path: CLOCK_EVENT_BASE },
  {
    bindingId: 'PEP-TIM-008',
    method: 'POST',
    path: `${CLOCK_EVENT_BASE}/{eventId}/voids`,
  },
] as const;

export type ClockHttpConfig = Readonly<{
  contextScopeKey: string;
  signal: AbortSignal;
  headers?: Record<string, string>;
}>;

export type ClockHttpClient = Readonly<{
  get: (url: string, config: ClockHttpConfig) => Promise<Readonly<{ data: ApiResponse<unknown> }>>;
  post: (
    url: string,
    body: unknown,
    config: ClockHttpConfig
  ) => Promise<Readonly<{ data: ApiResponse<unknown> }>>;
}>;

export type ClockIngestionDataSource = Readonly<{
  readEvents: (scope: ClockIngestionScope, signal: AbortSignal) => Promise<ClockWorkbench>;
  readExceptions: (
    scope: ClockIngestionScope,
    signal: AbortSignal
  ) => Promise<ClockExceptionWorkbench>;
  record: (
    request: RecordClockEventRequest,
    scope: ClockIngestionScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<ClockCommandReceipt>;
  voidEvent: (
    eventId: string,
    reasonCode: string,
    scope: ClockIngestionScope,
    authority: ProductSurfaceGovernedMutationAuthority,
    signal: AbortSignal
  ) => Promise<ClockCommandReceipt>;
}>;

export type ClockIdFactory = () => string;

export const clockHttpClient: ClockHttpClient = Object.freeze({
  get: (url, config) =>
    axiosInstance.get<ApiResponse<unknown>>(
      url,
      productSurfaceReadScopeConfig(config.contextScopeKey, config.signal)
    ),
  post: (url, body, config) =>
    axiosInstance.post<ApiResponse<unknown>, unknown>(url, body, {
      contextScopeKey: config.contextScopeKey,
      signal: config.signal,
      ...(config.headers ? { headers: config.headers } : {}),
    }),
});

function unwrap(response: Readonly<{ data: ApiResponse<unknown> }>): unknown {
  const envelope: unknown = response?.data;
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid TIM clock owner response envelope.');
  }
  if (!Object.hasOwn(envelope, 'data')) {
    throw new Error('Invalid TIM clock owner response envelope.');
  }
  return (envelope as { data: unknown }).data;
}

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

function validUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
  );
}

function assertScope(scope: ClockIngestionScope): void {
  if (
    !scope ||
    scope.ready !== true ||
    !safeText(scope.contextScopeKey, 500) ||
    !safeText(scope.decisionRevision, 500) ||
    !safeText(scope.locale, 35) ||
    !safeText(scope.timeZone, 255) ||
    !validUuid(scope.correlationId)
  ) {
    throw new Error('Invalid TIM clock operation scope.');
  }
}

function projectionUrl(base: string, scope: ClockIngestionScope, sort: readonly string[]): string {
  const query = new URLSearchParams();
  query.set('limit', '100');
  sort.forEach((value) => query.append('sort', value));
  query.set('locale', scope.locale);
  query.set('timeZone', scope.timeZone);
  query.set('correlationId', scope.correlationId);
  return `${base}?${query.toString()}`;
}

function assertRecordRequest(request: RecordClockEventRequest): void {
  if (
    !request ||
    !validUuid(request.sourcePublicId) ||
    !safeText(request.sourceEventKey, 200) ||
    !Number.isSafeInteger(request.sourceSequence) ||
    request.sourceSequence < 1 ||
    !validUuid(request.workerPublicId) ||
    !validUuid(request.peopleAssignmentPublicId) ||
    !Number.isSafeInteger(request.peopleAssignmentRevision) ||
    request.peopleAssignmentRevision < 0 ||
    !Number.isFinite(Date.parse(request.occurredAt)) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/u.test(request.sourceLocalDateTime) ||
    !safeText(request.sourceTimeZone, 80) ||
    !Number.isSafeInteger(request.sourceUtcOffsetMinutes) ||
    request.sourceUtcOffsetMinutes < -840 ||
    request.sourceUtcOffsetMinutes > 840 ||
    !safeText(request.tzdbVersion, 40) ||
    !safeText(request.timeZoneRuleVersion, 80) ||
    !/^[0-9a-f]{64}$/u.test(request.sourceProvenanceDigest) ||
    (request.sourceType === 'MOBILE' ||
      request.sourceType === 'KIOSK' ||
      request.sourceType === 'DEVICE') !== validUuid(request.devicePublicId) ||
    (request.captureMode === 'OFFLINE') !== validUuid(request.offlineBatchPublicId)
  ) {
    throw new Error('Invalid TIM clock evidence request.');
  }
}

function secureAuthority(
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: ClockIngestionScope,
  highRisk: boolean,
  idFactory: ClockIdFactory
) {
  if (
    authority.mode !== 'SECURE' ||
    authority.expectedDecisionRevision !== scope.decisionRevision ||
    authority.contextScopeKey !== scope.contextScopeKey ||
    (highRisk && !authority.stepUp) ||
    (!highRisk && (authority.stepUp !== undefined || authority.objectVersion !== undefined))
  ) {
    throw new Error('Governed TIM clock authority is invalid.');
  }
  const idempotencyKey = authority.idempotencyKey ?? idFactory();
  if (!validUuid(idempotencyKey)) throw new Error('Invalid TIM clock idempotency key.');
  const boundAuthority = { ...authority, idempotencyKey };
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(boundAuthority, { objectVersionHeader: false })
    : productSurfaceGovernedMutationConfig(boundAuthority);
  return {
    idempotencyKey,
    config: {
      contextScopeKey: scope.contextScopeKey,
      headers: governed.headers,
    },
  };
}

function defaultIdFactory(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('A secure idempotency key is unavailable.');
  return globalThis.crypto.randomUUID();
}

export function createClockIngestionDataSource(
  client: ClockHttpClient = clockHttpClient,
  idFactory: ClockIdFactory = defaultIdFactory
): ClockIngestionDataSource {
  return {
    async readEvents(scope, signal) {
      assertScope(scope);
      const response = await client.get(
        projectionUrl(CLOCK_WORKBENCH, scope, ['clockEvent:DESC', 'itemPublicId:ASC']),
        {
          contextScopeKey: scope.contextScopeKey,
          signal,
        }
      );
      return parseClockWorkbench(unwrap(response));
    },
    async readExceptions(scope, signal) {
      assertScope(scope);
      const response = await client.get(
        projectionUrl(CLOCK_EXCEPTIONS, scope, ['exception:DESC', 'itemPublicId:ASC']),
        {
          contextScopeKey: scope.contextScopeKey,
          signal,
        }
      );
      return parseClockExceptionWorkbench(unwrap(response));
    },
    async record(request, scope, authority, signal) {
      assertScope(scope);
      assertRecordRequest(request);
      const governed = secureAuthority(authority, scope, false, idFactory);
      const response = await client.post(CLOCK_EVENT_BASE, request, {
        ...governed.config,
        signal,
      });
      const receipt = parseClockCommandReceipt(unwrap(response));
      if (
        receipt.commandType !== 'CLOCK_RECORD' ||
        receipt.idempotencyKey !== governed.idempotencyKey
      ) {
        throw new Error('TIM clock record receipt does not match the command.');
      }
      return receipt;
    },
    async voidEvent(eventId, reasonCode, scope, authority, signal) {
      assertScope(scope);
      if (!validUuid(eventId) || !/^[A-Z][A-Z0-9_]{1,79}$/u.test(reasonCode)) {
        throw new Error('Invalid TIM corrective void command.');
      }
      const governed = secureAuthority(authority, scope, true, idFactory);
      const response = await client.post(
        `${CLOCK_EVENT_BASE}/${encodeURIComponent(eventId)}/voids`,
        { reasonCode },
        { ...governed.config, signal }
      );
      const receipt = parseClockCommandReceipt(unwrap(response));
      if (
        receipt.commandType !== 'CLOCK_VOID' ||
        receipt.idempotencyKey !== governed.idempotencyKey
      ) {
        throw new Error('TIM corrective void receipt does not match the command.');
      }
      return receipt;
    },
  };
}
