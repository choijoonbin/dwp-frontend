import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  parseWorkplaceServiceAccessCredentialGrant,
  parseWorkplaceServiceAccessCredentialStatus,
  parseWorkplaceServiceAssignees,
  parseWorkplaceServiceAssignmentResult,
  parseWorkplaceServiceCapacityRange,
  parseWorkplaceServiceCapacityUpsertResult,
  parseWorkplaceServiceContactResult,
  parseWorkplaceServiceInspection,
  parseWorkplaceServiceInspectionCommandResult,
  parseWorkplaceServiceProvider,
  parseWorkplaceServiceProviderCommandResult,
  parseWorkplaceServiceProviders,
} from './workplace-services-operations-contract';

import type {
  WorkplaceServiceInspectionDecision,
  WorkplaceServiceProviderLifecycleState,
  WorkplaceServiceProviderSupport,
} from './workplace-services-operations-contract';

const USER_BASE = '/api/platform/v1/workplace';
const ADMIN_BASE = '/api/platform/v1/admin/workplace';

export type WorkplaceServiceElevatedCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode: 'ELEVATED';
}>;

export type WorkplaceServiceUserCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
}>;

export type WorkplaceServiceCredentialIssueInput = Readonly<{
  stepUpReceipt: string;
  expectedOrderVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceCredentialRevokeInput = Readonly<{
  expectedOrderVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceInspectionAttemptInput = Readonly<{
  decision: WorkplaceServiceInspectionDecision;
  checklistResponses: Readonly<Record<string, unknown>>;
  attachmentIds: readonly string[];
  expectedOrderVersion: number;
  expectedTaskVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceCapacityWriteInput = Readonly<{
  siteReference: string;
  buckets: readonly Readonly<{
    startsAt: string;
    endsAt: string;
    capacityLimit: number;
    sourceVersion: string;
    sourceObservedAt: string;
  }>[];
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceProviderCreateInput = Readonly<{
  providerCode: string;
  displayNameKo: string;
  displayNameEn: string;
  adapterType: string;
  siteScope: readonly string[];
  capabilities: readonly string[];
  support: WorkplaceServiceProviderSupport;
  credentialBindingReference: string | null;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceProviderUpdateInput = Readonly<{
  expectedVersion: number;
  displayNameKo: string;
  displayNameEn: string;
  adapterType: string;
  siteScope: readonly string[];
  capabilities: readonly string[];
  support: WorkplaceServiceProviderSupport;
  credentialBindingReference: string | null;
  clearCredentialBinding: boolean;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceAssigneeSearchInput = Readonly<{
  providerId: string;
  siteReference: string;
  query: string;
  limit?: number;
}>;

export type WorkplaceServiceAssignmentInput = Readonly<{
  directorySubjectId: string;
  expectedTaskVersion: number;
  explicitConfirmation: true;
  reason: string;
}>;

export type WorkplaceServiceContactInput = Readonly<{
  target: 'ASSIGNEE' | 'SERVICE_DESK';
  serviceOrderLineId: string;
  expectedOrderVersion: number;
  message: string;
  explicitConfirmation: true;
  reason: string;
}>;

function required(value: string, label: string, maximum = 500) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error(`${label} is invalid.`);
  return normalized;
}

function commandHeaders(
  options: WorkplaceServiceUserCommandOptions | WorkplaceServiceElevatedCommandOptions
) {
  const idempotencyKey = required(options.idempotencyKey, 'Idempotency key', 160);
  return {
    'Idempotency-Key': idempotencyKey,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
    ...('activeAccessMode' in options
      ? { 'X-DWP-Active-Access-Mode': options.activeAccessMode }
      : {}),
  };
}

function orderLinePath(orderId: string, lineId: string, administrator = false) {
  return `${administrator ? ADMIN_BASE : USER_BASE}/service-orders/${encodeURIComponent(
    required(orderId, 'Service order id', 200)
  )}/lines/${encodeURIComponent(required(lineId, 'Service order line id', 200))}`;
}

export async function issueWorkplaceServiceAccessCredential(
  orderId: string,
  lineId: string,
  input: WorkplaceServiceCredentialIssueInput,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceCredentialIssueInput
  >(`${orderLinePath(orderId, lineId)}/access-credentials:issue`, input, {
    headers: { ...commandHeaders(options), 'Cache-Control': 'no-store' },
  });
  return parseWorkplaceServiceAccessCredentialGrant(response.data.data);
}

export async function revokeWorkplaceServiceAccessCredential(
  orderId: string,
  lineId: string,
  grantId: string,
  input: WorkplaceServiceCredentialRevokeInput,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceCredentialRevokeInput
  >(
    `${orderLinePath(orderId, lineId)}/access-credentials/${encodeURIComponent(
      required(grantId, 'Credential grant id', 200)
    )}:revoke`,
    input,
    { headers: { ...commandHeaders(options), 'Cache-Control': 'no-store' } }
  );
  return parseWorkplaceServiceAccessCredentialStatus(response.data.data);
}

export async function getWorkplaceServiceInspection(
  orderId: string,
  lineId: string,
  administrator = false
) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${orderLinePath(orderId, lineId, administrator)}/inspection`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplaceServiceInspection(response.data.data);
}

export async function recordWorkplaceServiceInspectionAttempt(
  orderId: string,
  lineId: string,
  input: WorkplaceServiceInspectionAttemptInput,
  options: WorkplaceServiceUserCommandOptions | WorkplaceServiceElevatedCommandOptions,
  administrator = false
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceInspectionAttemptInput
  >(`${orderLinePath(orderId, lineId, administrator)}/inspection-attempts`, input, {
    headers: commandHeaders(options),
  });
  return parseWorkplaceServiceInspectionCommandResult(response.data.data);
}

export async function getWorkplaceServiceCapacity(
  catalogItemId: string,
  siteReference: string,
  from: string,
  to: string,
  administrator = false
) {
  const query = new URLSearchParams({
    siteReference: required(siteReference, 'Site reference', 160),
    from: required(from, 'Capacity start', 80),
    to: required(to, 'Capacity end', 80),
  });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${administrator ? `${ADMIN_BASE}/service-catalog` : `${USER_BASE}/service-catalog`}/${encodeURIComponent(
      required(catalogItemId, 'Catalog item id', 200)
    )}/capacity?${query.toString()}`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplaceServiceCapacityRange(response.data.data);
}

export async function updateWorkplaceServiceCapacity(
  catalogItemId: string,
  input: WorkplaceServiceCapacityWriteInput,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceServiceCapacityWriteInput
  >(
    `${ADMIN_BASE}/service-catalog/${encodeURIComponent(
      required(catalogItemId, 'Catalog item id', 200)
    )}/capacity`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceCapacityUpsertResult(response.data.data);
}

export async function getWorkplaceServiceProviders() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/service-providers`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplaceServiceProviders(response.data.data);
}

export async function getWorkplaceServiceProvider(providerId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/service-providers/${encodeURIComponent(
      required(providerId, 'Provider id', 200)
    )}`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplaceServiceProvider(response.data.data);
}

export async function createWorkplaceServiceProvider(
  input: WorkplaceServiceProviderCreateInput,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceServiceProviderCreateInput
  >(`${ADMIN_BASE}/service-providers`, input, { headers: commandHeaders(options) });
  return parseWorkplaceServiceProviderCommandResult(response.data.data);
}

export async function updateWorkplaceServiceProvider(
  providerId: string,
  input: WorkplaceServiceProviderUpdateInput,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceServiceProviderUpdateInput
  >(
    `${ADMIN_BASE}/service-providers/${encodeURIComponent(
      required(providerId, 'Provider id', 200)
    )}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceProviderCommandResult(response.data.data);
}

export async function setWorkplaceServiceProviderState(
  providerId: string,
  input: Readonly<{
    expectedVersion: number;
    lifecycleState: WorkplaceServiceProviderLifecycleState;
    explicitConfirmation: true;
    reason: string;
  }>,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${ADMIN_BASE}/service-providers/${encodeURIComponent(
      required(providerId, 'Provider id', 200)
    )}:state`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceProviderCommandResult(response.data.data);
}

export async function verifyWorkplaceServiceProvider(
  providerId: string,
  input: Readonly<{
    expectedVersion: number;
    explicitConfirmation: true;
    reason: string;
  }>,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof input>(
    `${ADMIN_BASE}/service-providers/${encodeURIComponent(
      required(providerId, 'Provider id', 200)
    )}:verify`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceProviderCommandResult(response.data.data);
}

export async function getWorkplaceServiceAssignees(input: WorkplaceServiceAssigneeSearchInput) {
  const queryText = required(input.query, 'Assignee query', 200);
  if (queryText.length < 2) throw new Error('Assignee query must contain at least two characters.');
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error('Assignee limit must be between 1 and 50.');
  }
  const query = new URLSearchParams({
    purpose: 'FULFILLMENT',
    providerId: required(input.providerId, 'Provider id', 200),
    siteReference: required(input.siteReference, 'Site reference', 160),
    q: queryText,
    limit: String(limit),
  });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/service-assignees?${query.toString()}`,
    { headers: { 'Cache-Control': 'no-store' } }
  );
  return parseWorkplaceServiceAssignees(response.data.data);
}

export async function assignWorkplaceServiceTask(
  orderId: string,
  taskId: string,
  input: WorkplaceServiceAssignmentInput,
  options: WorkplaceServiceElevatedCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServiceAssignmentInput>(
    `${ADMIN_BASE}/service-orders/${encodeURIComponent(
      required(orderId, 'Service order id', 200)
    )}/tasks/${encodeURIComponent(required(taskId, 'Fulfillment task id', 200))}:assign`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceAssignmentResult(response.data.data);
}

export async function contactWorkplaceServiceOrder(
  orderId: string,
  input: WorkplaceServiceContactInput,
  options: WorkplaceServiceUserCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceServiceContactInput>(
    `${USER_BASE}/service-orders/${encodeURIComponent(
      required(orderId, 'Service order id', 200)
    )}/contacts`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceServiceContactResult(response.data.data);
}
