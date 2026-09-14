import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';
import {
  assertApprovalRetentionReceiptOriginal,
  bindApprovalRetentionReceipt,
} from './approval-retention-receipt-profile';
import type {
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from './approval-retention-receipt-profile';

export const APPROVAL_RETENTION_RECEIPT_BINDINGS = {
  INITIALIZE_POLICY: {
    routeContractKey: 'route.approvals.admin.retention-policy-initialization-command.data',
    path: '/v1/admin/retention/policy-initialization-commands/{idempotencyKey}',
  },
  SAVE_POLICY: {
    routeContractKey: 'route.approvals.admin.retention-policy-draft-command.data',
    path: '/v1/admin/retention/policies/{policyId}/draft-commands/{idempotencyKey}',
  },
  PUBLISH_POLICY: {
    routeContractKey: 'route.approvals.admin.retention-policy-publication-command.data',
    path: '/v1/admin/retention/policies/{policyId}/publication-commands/{idempotencyKey}',
  },
  CLAIM_RECORD: {
    routeContractKey: 'route.approvals.admin.retention-record-command.data',
    path: '/v1/admin/retention/records/{requestId}/claim-commands/{idempotencyKey}',
  },
} as const;

export type ApprovalRetentionReceiptReadAuthority = Readonly<{
  mode: 'SECURE';
  rolloutState: '110' | '111';
  routeContractKey: (typeof APPROVAL_RETENTION_RECEIPT_BINDINGS)[keyof typeof APPROVAL_RETENTION_RECEIPT_BINDINGS]['routeContractKey'];
  expectedDecisionRevision: string;
  contextKey: string;
  contextScopeKey: string;
}>;
type ReadOptions = Readonly<{
  routeInstalled: () => boolean;
  beforeDispatch: () => void;
  signal?: AbortSignal;
}>;

function text(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 500 &&
    value.trim() === value &&
    !Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  );
}

/** The original key identifies a DATA lookup; it is never a new mutation or challenge. */
export async function getApprovalRetentionCommandReceipt(
  original: ApprovalRetentionReceiptOriginal,
  authority: ApprovalRetentionReceiptReadAuthority,
  options: ReadOptions
): Promise<ApprovalRetentionReceiptMetadata> {
  assertApprovalRetentionReceiptOriginal(original);
  const binding = APPROVAL_RETENTION_RECEIPT_BINDINGS[original.command.operation];
  if (
    !binding ||
    !authority ||
    authority.mode !== 'SECURE' ||
    !['110', '111'].includes(authority.rolloutState) ||
    authority.routeContractKey !== binding.routeContractKey ||
    !/^psr-[a-f0-9]{64}$/.test(authority.expectedDecisionRevision) ||
    !text(authority.contextKey) ||
    !text(authority.contextScopeKey) ||
    ['idempotencyKey', 'stepUp', 'objectVersion'].some((key) => Object.hasOwn(authority, key)) ||
    typeof options?.routeInstalled !== 'function' ||
    typeof options.beforeDispatch !== 'function'
  )
    throw new Error('Invalid approval retention receipt DATA authority');
  const beforeDispatch = () => {
    if (options.signal?.aborted || !options.routeInstalled())
      throw new Error('Approval retention receipt route is unavailable');
    options.beforeDispatch();
  };
  beforeDispatch();
  const path = binding.path
    .replace('{policyId}', original.command.originalTargetId ?? '')
    .replace('{requestId}', original.command.originalTargetId ?? '')
    .replace('{idempotencyKey}', original.command.body.idempotencyKey);
  const response = await axiosInstance.get<ApiResponse<unknown>>(`/api/approvals${path}`, {
    headers: { 'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision },
    contextScopeKey: authority.contextScopeKey,
    signal: options.signal,
    beforeDispatch,
    timeoutMs: 10000,
  });
  beforeDispatch();
  return bindApprovalRetentionReceipt(response.data.data, original);
}
