import { axiosInstance } from '../axios-instance';
import type { ApiResponse } from '../types';

export const APPROVAL_INFORMATION_RECEIPT_ROUTE =
  'route.approvals.work.information-command-receipt.data' as const;

export type ApprovalInformationReceipt = Readonly<{
  status: 'COMPLETED';
  roundId: string;
  generation: number;
  requestVersion: number;
  payloadRevision: number;
  payloadSha256: string;
  materialChange: boolean;
}>;
export type ApprovalInformationReceiptInput = Readonly<{
  operation: 'REQUEST_INFO' | 'REPLY';
  originalBodyBase64: string;
}>;
export type ApprovalInformationReceiptReadAuthority = Readonly<{
  mode: 'SECURE';
  rolloutState: '110' | '111';
  routeContractKey: typeof APPROVAL_INFORMATION_RECEIPT_ROUTE;
  expectedDecisionRevision: string;
  contextKey: string;
  contextScopeKey: string;
}>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function invalid(): never {
  throw new Error('Invalid approval information receipt contract');
}
function text(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 500 &&
    value === value.trim() &&
    !Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
    )
  );
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function validateOriginalBody(value: string) {
  if (!value || value.length > 349528 || value.length % 4 !== 0) invalid();
  let body: unknown;
  try {
    const binary = atob(value);
    if (!binary.length || binary.length > 262144 || btoa(binary) !== value) invalid();
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    invalid();
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid();
  const remaining: { value: unknown; depth: number }[] = [{ value: body, depth: 0 }];
  let count = 0;
  let characters = 0;
  while (remaining.length) {
    const node = remaining.pop()!;
    if (++count > 50000 || node.depth > 32) invalid();
    if (typeof node.value === 'string') characters += node.value.length;
    else if (typeof node.value === 'number' && !Number.isFinite(node.value)) invalid();
    else if (node.value && typeof node.value === 'object') {
      for (const [key, child] of Object.entries(node.value)) {
        if (!Array.isArray(node.value)) characters += key.length;
        remaining.push({ value: child, depth: node.depth + 1 });
      }
    }
    if (characters > 200000) invalid();
  }
}
export function readApprovalInformationReceipt(value: unknown): ApprovalInformationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const data = value as Record<string, unknown>;
  const keys = [
    'status',
    'roundId',
    'generation',
    'requestVersion',
    'payloadRevision',
    'payloadSha256',
    'materialChange',
  ];
  if (
    Object.keys(data).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(data, key)) ||
    data.status !== 'COMPLETED' ||
    typeof data.roundId !== 'string' ||
    !uuid.test(data.roundId) ||
    !positive(data.generation) ||
    !positive(data.requestVersion) ||
    !positive(data.payloadRevision) ||
    typeof data.payloadSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(data.payloadSha256) ||
    typeof data.materialChange !== 'boolean'
  )
    invalid();
  return Object.freeze({ ...data }) as ApprovalInformationReceipt;
}

/** Read-only DATA lookup: the original command identity is never a new mutation key. */
export async function getApprovalInformationCommandReceipt(
  requestId: string,
  originalKey: string,
  input: ApprovalInformationReceiptInput,
  authority: ApprovalInformationReceiptReadAuthority,
  options?: { beforeDispatch?: () => void; signal?: AbortSignal }
): Promise<ApprovalInformationReceipt> {
  if (
    !uuid.test(requestId) ||
    !/^[A-Za-z0-9._:-]{1,120}$/u.test(originalKey) ||
    originalKey === '.' ||
    originalKey === '..' ||
    !input ||
    Object.keys(input).length !== 2 ||
    !['REQUEST_INFO', 'REPLY'].includes(input.operation) ||
    typeof input.originalBodyBase64 !== 'string' ||
    !authority ||
    authority.mode !== 'SECURE' ||
    !['110', '111'].includes(authority.rolloutState) ||
    authority.routeContractKey !== APPROVAL_INFORMATION_RECEIPT_ROUTE ||
    !/^psr-[0-9a-f]{64}$/u.test(authority.expectedDecisionRevision) ||
    !text(authority.contextKey) ||
    !text(authority.contextScopeKey) ||
    ['idempotencyKey', 'stepUp', 'objectVersion'].some((key) => Object.hasOwn(authority, key))
  )
    invalid();
  validateOriginalBody(input.originalBodyBase64);
  const body = Object.freeze({
    operation: input.operation,
    originalBodyBase64: input.originalBodyBase64,
  });
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `/api/approvals/v1/requests/${requestId}/information-commands/${originalKey}/receipt`,
    body,
    {
      headers: { 'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision },
      contextScopeKey: authority.contextScopeKey,
      beforeDispatch: options?.beforeDispatch,
      signal: options?.signal,
      timeoutMs: 10000,
    }
  );
  return readApprovalInformationReceipt(response.data.data);
}
