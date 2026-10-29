import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  HRM012_QUERY_CONTRACT,
  assertHrm012QueryRequest,
  selectHrm012Projection,
} from './data-quality-contract';

import type {
  HRM012_ADAPTER_KIND,
  Hrm012Projection,
  Hrm012QueryRequest,
} from './data-quality-contract';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';

export const HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT = {
  apiFunction: 'startWorkforceIngestion',
  routeContractKey: 'route.hcm.operations.workforce-ingestion.action',
  method: 'POST',
  path: '/api/people/v1/hris/integrations/workforce-ingestions',
} as const;

export const HRM012_API_CONTRACTS = Object.freeze([
  Object.freeze({
    bindingId: HRM012_QUERY_CONTRACT.queryId,
    operationId: HRM012_QUERY_CONTRACT.operationId,
    method: 'GET',
    browserPath: HRM012_QUERY_CONTRACT.browserPath,
    ownerPath: HRM012_QUERY_CONTRACT.ownerPath,
  }),
] as const);

export type Hrm012QueryAdapter = Readonly<{
  kind: typeof HRM012_ADAPTER_KIND;
  query: (
    request: Hrm012QueryRequest,
    contextScopeKey: string,
    signal: AbortSignal
  ) => Promise<Hrm012Projection>;
}>;

export type WorkforceIngestionCommand = Readonly<{
  objectRef: string;
  objectDigest: string;
  schemaKey: string;
  schemaVersion: number;
  mode: 'VALIDATE_ONLY' | 'APPLY';
  effectiveDate: string;
}>;

export type WorkforceIngestionCommandReceipt = Readonly<{
  receiptId: string;
  commandType: 'WORKFORCE_INGESTION';
  status: 'RECEIVED' | 'RUNNING' | 'FAILED_RETRYABLE' | 'SUCCEEDED' | 'REJECTED' | 'DEAD';
  requestHash: string;
  correlationId: string;
  receivedAt: string;
  originatingAction: 'INITIATE_WORKFORCE_INGESTION';
  subjectPrincipalPublicId: string;
  populationScopeDigest: string;
  fieldPolicyRevision: number;
  purposeCode: 'HRIS_INTEGRATION';
  authorizationRevision: number;
  links: Readonly<{ self: string; result?: string; target?: string }>;
}>;

export type WorkforceIngestionCommandAuthority = Readonly<{
  governance: ProductSurfaceGovernedMutationAuthority;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion: number;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[a-f0-9]{64}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export class WorkforceIngestionCommandOutcomeUnknownError extends Error {
  readonly correlationId: string;

  constructor(correlationId: string, cause: unknown) {
    super(`Workforce-ingestion command outcome is unknown. Correlation: ${correlationId}`, {
      cause,
    });
    this.name = 'WorkforceIngestionCommandOutcomeUnknownError';
    this.correlationId = correlationId;
  }
}

function appendNested(params: URLSearchParams, key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    return value.reduce((appended, entry) => appendNested(params, key, entry) || appended, false);
  }
  if (typeof value === 'object') {
    return Object.entries(value as Readonly<Record<string, unknown>>).reduce(
      (appended, [childKey, childValue]) =>
        appendNested(params, `${key}[${childKey}]`, childValue) || appended,
      false
    );
  }
  params.append(key, String(value));
  return true;
}

export function hrm012QueryString(requestValue: Hrm012QueryRequest): string {
  const request = assertHrm012QueryRequest(requestValue);
  const params = new URLSearchParams({
    limit: String(request.limit),
    locale: request.locale,
    timeZone: request.timeZone,
    correlationId: request.correlationId,
  });
  request.sort.forEach((sort) => params.append('sort', sort));
  if (request.asOf) params.set('asOf', request.asOf);
  if (request.cursor) params.set('cursor', request.cursor);
  const appendedFilter = Object.entries(request.filter).reduce(
    (appended, [key, value]) => appendNested(params, `filter[${key}]`, value) || appended,
    false
  );
  if (!appendedFilter) params.set('filter', '{}');
  return params.toString();
}

export async function queryHrm012Entry(
  request: Hrm012QueryRequest,
  contextScopeKey: string,
  signal: AbortSignal
): Promise<Hrm012Projection> {
  if (!contextScopeKey.trim()) throw new Error('HRM-012 trusted request scope is unavailable.');
  const response = await axiosInstance.get<unknown>(
    `${HRM012_QUERY_CONTRACT.browserPath}?${hrm012QueryString(request)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectHrm012Projection(response.data);
}

export async function startWorkforceIngestion(
  command: WorkforceIngestionCommand,
  authority: WorkforceIngestionCommandAuthority
): Promise<WorkforceIngestionCommandReceipt> {
  assertWorkforceIngestionCommand(command);
  assertWorkforceIngestionAuthority(authority);
  const governed = productSurfaceHighRiskMutationConfig(authority.governance, {
    objectVersionHeader: true,
  });
  const response = await axiosInstance.post<unknown, WorkforceIngestionCommand>(
    HCM_WORKFORCE_INGESTION_MUTATION_API_CONTRACT.path,
    command,
    {
      ...governed,
      headers: {
        ...governed.headers,
        'Idempotency-Key': authority.idempotencyKey,
        'If-Match': `"${authority.expectedObjectVersion}"`,
        'X-Correlation-ID': authority.correlationId,
        'X-Purpose-Code': 'HRIS_INTEGRATION',
      },
      csrfReplay: 'NEVER',
    }
  );
  try {
    const receipt = parseWorkforceIngestionReceipt(response.data);
    if (receipt.correlationId !== authority.correlationId) {
      throw new Error('Workforce-ingestion receipt does not match the submitted command.');
    }
    return receipt;
  } catch (error) {
    throw new WorkforceIngestionCommandOutcomeUnknownError(authority.correlationId, error);
  }
}

function assertWorkforceIngestionAuthority(authority: WorkforceIngestionCommandAuthority): void {
  const governance = authority.governance;
  if (
    authority.idempotencyKey.length < 16 ||
    authority.idempotencyKey.length > 128 ||
    !UUID.test(authority.correlationId) ||
    !Number.isSafeInteger(authority.expectedObjectVersion) ||
    authority.expectedObjectVersion < 0 ||
    governance.mode !== 'SECURE' ||
    !governance.stepUp ||
    governance.idempotencyKey !== authority.idempotencyKey ||
    governance.objectVersion !== authority.expectedObjectVersion
  ) {
    throw new Error('Workforce-ingestion HIGH-risk authority does not match the command.');
  }
}

function assertWorkforceIngestionCommand(command: WorkforceIngestionCommand): void {
  if (
    !/^obj_[A-Za-z0-9_-]{16,128}$/u.test(command.objectRef) ||
    !DIGEST.test(command.objectDigest) ||
    command.schemaKey.length < 1 ||
    command.schemaKey.length > 128 ||
    !Number.isSafeInteger(command.schemaVersion) ||
    command.schemaVersion < 1 ||
    !['VALIDATE_ONLY', 'APPLY'].includes(command.mode) ||
    !civilDate(command.effectiveDate)
  ) {
    throw new Error('Workforce-ingestion command is invalid.');
  }
}

function civilDate(value: string): boolean {
  return DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function parseWorkforceIngestionReceipt(value: unknown): WorkforceIngestionCommandReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Workforce-ingestion receipt is invalid.');
  }
  const source = value as Record<string, unknown>;
  const links = source.links;
  if (
    !UUID.test(String(source.receiptId ?? '')) ||
    !UUID.test(String(source.correlationId ?? '')) ||
    !UUID.test(String(source.subjectPrincipalPublicId ?? '')) ||
    !DIGEST.test(String(source.requestHash ?? '')) ||
    !DIGEST.test(String(source.populationScopeDigest ?? '')) ||
    source.commandType !== 'WORKFORCE_INGESTION' ||
    source.originatingAction !== 'INITIATE_WORKFORCE_INGESTION' ||
    source.purposeCode !== 'HRIS_INTEGRATION' ||
    !Number.isSafeInteger(source.fieldPolicyRevision as number) ||
    Number(source.fieldPolicyRevision) < 1 ||
    !Number.isSafeInteger(source.authorizationRevision as number) ||
    Number(source.authorizationRevision) < 1 ||
    !['RECEIVED', 'RUNNING', 'FAILED_RETRYABLE', 'SUCCEEDED', 'REJECTED', 'DEAD'].includes(
      String(source.status)
    ) ||
    !Number.isFinite(Date.parse(String(source.receivedAt ?? ''))) ||
    !links ||
    typeof links !== 'object' ||
    Array.isArray(links) ||
    typeof (links as Record<string, unknown>).self !== 'string'
  ) {
    throw new Error('Workforce-ingestion receipt is invalid.');
  }
  return Object.freeze({
    ...source,
    links: Object.freeze({ ...(links as object) }),
  }) as WorkforceIngestionCommandReceipt;
}
