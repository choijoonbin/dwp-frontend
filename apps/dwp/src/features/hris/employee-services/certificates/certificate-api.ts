import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import { parseHrisCommandReceipt } from '../../people/command-receipts/model/command-receipt';
import {
  HRM009_ADAPTER_KIND,
  HRM009_QUERY_CONTRACTS,
  HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT,
  assertHrm009CertificateRequest,
  assertHrm009QueryRequest,
  selectHrm009Projection,
} from './certificate-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { HrisCommandReceipt } from '../../people/command-receipts/model/command-receipt';
import type {
  Hrm009CertificateRequest,
  Hrm009Projection,
  Hrm009QueryId,
  Hrm009QueryRequest,
} from './certificate-contract';

const CERTIFICATE_PATH = '/api/people/v1/hris/certificates';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const HCM_CERTIFICATE_ISSUE_MUTATION_API_CONTRACT = Object.freeze({
  apiFunction: 'requestCertificate',
  routeContractKey: HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT,
  method: 'POST',
  path: CERTIFICATE_PATH,
});

export const HRM009_API_CONTRACTS = Object.freeze([
  Object.freeze({
    bindingId: 'IAQ-003',
    operationId: 'IAQ.OP.003',
    method: 'GET',
    browserPath: HRM009_QUERY_CONTRACTS['IAQ-003'].path,
    ownerPath: HRM009_QUERY_CONTRACTS['IAQ-003'].ownerPath,
  }),
  Object.freeze({
    bindingId: 'IAQ-010',
    operationId: 'IAQ.OP.010',
    method: 'GET',
    browserPath: HRM009_QUERY_CONTRACTS['IAQ-010'].path,
    ownerPath: HRM009_QUERY_CONTRACTS['IAQ-010'].ownerPath,
  }),
  Object.freeze({
    bindingId: 'PEP-HRM-012',
    operationId: 'requestCertificate',
    routeContractKey: HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT,
    method: 'POST',
    browserPath: CERTIFICATE_PATH,
    ownerPath: '/v1/hris/certificates',
    successStatus: 202,
    requiredHeaders: Object.freeze([
      'Authorization',
      'Idempotency-Key',
      'If-Match',
      'X-Correlation-ID',
    ]),
    optionalHeader: 'X-Purpose-Code',
    requestFields: Object.freeze([
      'personPublicId',
      'certificateType',
      'purposeCode',
      'locale',
      'asOf',
    ]),
    response: 'CommandReceiptV1',
  }),
] as const);

export type Hrm009QueryAdapter = Readonly<{
  kind: typeof HRM009_ADAPTER_KIND;
  query: (
    queryId: Hrm009QueryId,
    request: Hrm009QueryRequest,
    contextScopeKey: string,
    signal: AbortSignal
  ) => Promise<Hrm009Projection>;
}>;

export type Hrm009RequestCertificateCommand = Readonly<{
  request: Hrm009CertificateRequest;
  expectedObjectVersion: number;
  idempotencyKey: string;
  correlationId: string;
}>;

function appendNested(params: URLSearchParams, key: string, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) {
    let appended = false;
    value.forEach((entry) => {
      appended = appendNested(params, key, entry) || appended;
    });
    return appended;
  }
  if (typeof value === 'object') {
    let appended = false;
    Object.entries(value as Readonly<Record<string, unknown>>).forEach(([childKey, childValue]) => {
      appended = appendNested(params, `${key}[${childKey}]`, childValue) || appended;
    });
    return appended;
  }
  params.append(key, String(value));
  return true;
}

export function hrm009QueryString(
  queryId: Hrm009QueryId,
  requestValue: Hrm009QueryRequest
): string {
  const request = assertHrm009QueryRequest(queryId, requestValue);
  const params = new URLSearchParams({
    limit: String(request.limit),
    locale: request.locale,
    timeZone: request.timeZone,
    correlationId: request.correlationId,
  });
  request.sort.forEach((sort) => params.append('sort', sort));
  if (request.asOf) params.set('asOf', request.asOf);
  if (request.cursor) params.set('cursor', request.cursor);
  let appendedFilter = false;
  Object.entries(request.filter).forEach(([key, value]) => {
    appendedFilter = appendNested(params, `filter[${key}]`, value) || appendedFilter;
  });
  if (!appendedFilter) params.set('filter', '{}');
  return params.toString();
}

export async function queryHrm009Entry(
  queryId: Hrm009QueryId,
  request: Hrm009QueryRequest,
  contextScopeKey: string,
  signal: AbortSignal
): Promise<Hrm009Projection> {
  if (!contextScopeKey.trim()) throw new Error('HRM-009 trusted request scope is unavailable.');
  const response = await axiosInstance.get<unknown>(
    `${HRM009_QUERY_CONTRACTS[queryId].path}?${hrm009QueryString(queryId, request)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectHrm009Projection(queryId, response.data);
}

function commandHeaders(command: Hrm009RequestCertificateCommand): Record<string, string> {
  if (!Number.isSafeInteger(command.expectedObjectVersion) || command.expectedObjectVersion < 1) {
    throw new Error('Certificate optimistic version is invalid.');
  }
  const idempotencyKeyLength =
    typeof command.idempotencyKey === 'string' ? [...command.idempotencyKey].length : 0;
  if (idempotencyKeyLength < 16 || idempotencyKeyLength > 128) {
    throw new Error('Certificate idempotency key is invalid.');
  }
  if (!UUID.test(command.correlationId)) {
    throw new Error('Certificate correlation identifier is invalid.');
  }
  return {
    'Idempotency-Key': command.idempotencyKey,
    'If-Match': `"v:${command.expectedObjectVersion}"`,
    'X-Correlation-ID': command.correlationId,
    'X-Purpose-Code': command.request.purposeCode,
  };
}

export async function requestCertificate(
  command: Hrm009RequestCertificateCommand,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<HrisCommandReceipt> {
  const request = assertHrm009CertificateRequest(command.request);
  if (
    authority.mode !== 'SECURE' ||
    !authority.stepUp ||
    authority.idempotencyKey !== command.idempotencyKey ||
    authority.objectVersion !== command.expectedObjectVersion
  ) {
    throw new Error('Certificate HIGH-risk authority does not match the command.');
  }
  const governed = productSurfaceHighRiskMutationConfig(authority, {
    objectVersionHeader: true,
  });
  const response = await axiosInstance.post<unknown, Hrm009CertificateRequest>(
    CERTIFICATE_PATH,
    request,
    {
      ...governed,
      headers: { ...governed.headers, ...commandHeaders(command) },
      csrfReplay: 'NEVER',
    }
  );
  const receipt = parseHrisCommandReceipt(response.data);
  if (
    receipt.correlationId !== command.correlationId ||
    receipt.purposeCode !== request.purposeCode ||
    receipt.commandType !== 'CERTIFICATE_REQUEST' ||
    receipt.originatingAction !== 'REQUEST_CERTIFICATE' ||
    receipt.subjectPrincipalPublicId !== request.personPublicId
  ) {
    throw new Error('Certificate receipt does not match the submitted command.');
  }
  return receipt;
}

export function createHrm009QueryAdapter(): Hrm009QueryAdapter {
  return Object.freeze({
    kind: HRM009_ADAPTER_KIND,
    query: queryHrm009Entry,
  });
}
