import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import {
  approvalRetentionId,
  approvalRetentionKey,
  approvalRetentionVersion,
  readApprovalRetentionClaim,
  readApprovalRetentionPolicy,
  readApprovalRetentionRecord,
  readApprovalRetentionRules,
} from './approval-retention-contract';
import type {
  ApprovalRetentionClaimInput,
  ApprovalRetentionSaveInput,
} from './approval-retention-contract';

const base = '/api/approvals/v1/admin/retention';
type ReadOptions = Readonly<{
  contextScopeKey?: string;
  expectedDecisionRevision?: string;
  signal?: AbortSignal;
  beforeDispatch?: () => void;
}>;
async function read(path: string, options: ReadOptions) {
  if (options.contextScopeKey !== undefined || options.expectedDecisionRevision !== undefined) {
    if (
      typeof options.contextScopeKey !== 'string' ||
      options.contextScopeKey.length < 1 ||
      options.contextScopeKey.length > 500 ||
      [...options.contextScopeKey].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ) ||
      typeof options.expectedDecisionRevision !== 'string' ||
      !/^psr-[a-f0-9]{64}$/.test(options.expectedDecisionRevision)
    )
      throw new Error('Invalid retention read authority');
  }
  const response = await axiosInstance.get<ApiResponse<unknown>>(path, {
    contextScopeKey: options.contextScopeKey,
    headers: options.expectedDecisionRevision
      ? { 'X-DWP-Expected-Decision-Revision': options.expectedDecisionRevision }
      : undefined,
    signal: options.signal,
    timeoutMs: 10000,
    beforeDispatch: options.beforeDispatch,
  });
  options.beforeDispatch?.();
  return response.data.data;
}
export async function getApprovalRetentionPolicy(options: ReadOptions = {}) {
  return readApprovalRetentionPolicy(await read(`${base}/policy`, options));
}
export async function getApprovalRetentionRecord(requestId: string, options: ReadOptions = {}) {
  approvalRetentionId(requestId);
  return readApprovalRetentionRecord(
    await read(`${base}/records/${requestId}`, options),
    requestId
  );
}
export async function getApprovalRetentionClaim(claimId: string, options: ReadOptions = {}) {
  approvalRetentionId(claimId);
  return readApprovalRetentionClaim(await read(`${base}/claims/${claimId}`, options), { claimId });
}
async function command(
  path: string,
  body: Readonly<{ idempotencyKey: string; expectedVersion?: number }>,
  execution: ApprovalMutationExecution,
  options: Readonly<{ high?: boolean; method?: 'POST' | 'PUT'; beforeDispatch?: () => void }> = {}
) {
  approvalRetentionKey(body.idempotencyKey);
  if (body.expectedVersion != null) approvalRetentionVersion(body.expectedVersion);
  if (options.high && execution.mode !== 'SECURE')
    throw new Error('Signed retention authority is required');
  const config = options.high
    ? approvalHighRiskMutationExecutionConfig(execution, { objectVersionHeader: true })
    : approvalMutationExecutionConfig(execution);
  if (
    (config.headers['Idempotency-Key'] != null &&
      config.headers['Idempotency-Key'] !== body.idempotencyKey) ||
    (options.high &&
      execution.mode === 'SECURE' &&
      execution.objectVersion !== body.expectedVersion)
  )
    throw new Error('Retention command authority changed');
  const dispatch = {
    ...config,
    headers: { ...config.headers, 'Idempotency-Key': body.idempotencyKey },
    beforeDispatch: options.beforeDispatch,
    timeoutMs: 10000,
    csrfReplay: 'NEVER' as const,
  };
  const response =
    options.method === 'PUT'
      ? await axiosInstance.put<ApiResponse<unknown>>(path, body, dispatch)
      : await axiosInstance.post<ApiResponse<unknown>>(path, body, dispatch);
  options.beforeDispatch?.();
  return response.data.data;
}
export async function initializeApprovalRetentionPolicy(
  input: Readonly<{ expectedAbsent: true; idempotencyKey: string }>,
  execution: ApprovalMutationExecution,
  beforeDispatch?: () => void
) {
  if (input.expectedAbsent !== true)
    throw new Error('Retention initialization requires an absent policy');
  const body = Object.freeze({
    expectedAbsent: true,
    idempotencyKey: approvalRetentionKey(input.idempotencyKey),
  });
  return readApprovalRetentionPolicy(
    await command(`${base}/policies`, body, execution, { beforeDispatch })
  );
}
export async function saveApprovalRetentionPolicy(
  policyId: string,
  input: ApprovalRetentionSaveInput,
  execution: ApprovalMutationExecution,
  beforeDispatch?: () => void
) {
  approvalRetentionId(policyId);
  const body = Object.freeze({
    expectedVersion: approvalRetentionVersion(input.expectedVersion),
    idempotencyKey: approvalRetentionKey(input.idempotencyKey),
    rules: readApprovalRetentionRules(input.rules),
  });
  return readApprovalRetentionPolicy(
    await command(`${base}/policies/${policyId}/draft`, body, execution, {
      method: 'PUT',
      beforeDispatch,
    }),
    policyId
  );
}
export async function publishApprovalRetentionPolicy(
  policyId: string,
  input: Readonly<{ expectedVersion: number; idempotencyKey: string; reviewComment: string }>,
  execution: ApprovalMutationExecution,
  beforeDispatch?: () => void
) {
  approvalRetentionId(policyId);
  if (
    typeof input.reviewComment !== 'string' ||
    input.reviewComment.trim().length < 10 ||
    input.reviewComment.length > 1000 ||
    input.reviewComment.includes('\0')
  )
    throw new Error('Invalid retention review');
  const body = Object.freeze({
    expectedVersion: approvalRetentionVersion(input.expectedVersion),
    idempotencyKey: approvalRetentionKey(input.idempotencyKey),
    reviewComment: input.reviewComment,
  });
  return readApprovalRetentionPolicy(
    await command(`${base}/policies/${policyId}/publish`, body, execution, {
      high: true,
      beforeDispatch,
    }),
    policyId
  );
}
export async function createApprovalRetentionClaim(
  requestId: string,
  input: ApprovalRetentionClaimInput,
  execution: ApprovalMutationExecution,
  beforeDispatch?: () => void
) {
  approvalRetentionId(requestId);
  if (!/^[a-f0-9]{64}$/.test(input.inventorySha256)) throw new Error('Invalid retention inventory');
  const body = Object.freeze({
    expectedVersion: approvalRetentionVersion(input.expectedVersion),
    policyId: approvalRetentionId(input.policyId),
    expectedPolicyVersion: approvalRetentionVersion(input.expectedPolicyVersion),
    expectedHoldVersion: approvalRetentionVersion(input.expectedHoldVersion),
    inventorySha256: input.inventorySha256,
    idempotencyKey: approvalRetentionKey(input.idempotencyKey),
  });
  return readApprovalRetentionClaim(
    await command(`${base}/records/${requestId}/claims`, body, execution, {
      high: true,
      beforeDispatch,
    }),
    { requestId }
  );
}
