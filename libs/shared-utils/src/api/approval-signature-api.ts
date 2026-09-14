import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';
import type { ApiResponse } from '../types';
import {
  approvalHighRiskMutationExecutionConfig,
  approvalMutationExecutionConfig,
} from './approval-governed-mutation';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import {
  invalidApprovalSignature,
  readApprovalSignatureAudit,
  readApprovalSignatureCeremony,
  readApprovalSignatureCommandReceipt,
  readApprovalSignatureContext,
  readApprovalSignatureReceipt,
  signatureFields,
  signatureId,
  signatureKey,
  signatureLocale,
  signatureOperation,
  signatureSha,
  signatureText,
  signatureVersion,
} from './approval-signature-contract';
import type {
  ApprovalSignatureCancelInput,
  ApprovalSignatureConsentInput,
  ApprovalSignatureCreateInput,
  ApprovalSignatureOperation,
  ApprovalSignatureSignInput,
} from './approval-signature-contract';
import {
  approvalSignatureCanonicalJson,
  approvalSignatureSha256,
  verifyApprovalSignatureSource,
} from './approval-signature-verification';

export type ApprovalSignatureReadOptions = Readonly<{
  contextScopeKey: string;
  expectedDecisionRevision: string;
  resourceSetKey?: string;
  signal?: AbortSignal;
  beforeDispatch?: () => void;
}>;
export type ApprovalSignatureDispatchOptions = ApprovalSignatureReadOptions &
  Readonly<{ beforeDispatch: () => void; requestId: string; resourceSetKey: string }>;
export type ApprovalSignatureReceiptQuery = Readonly<{
  idempotencyKey: string;
  originalOperation: ApprovalSignatureOperation;
  targetId: string;
  bodySha256: string;
}>;
export class ApprovalSignatureResponseError extends Error {
  constructor(
    readonly receiptQuery: ApprovalSignatureReceiptQuery,
    cause: unknown
  ) {
    super('Approval signature command result is unverifiable', { cause });
    this.name = 'ApprovalSignatureResponseError';
  }
}
const base = '/api/approvals/v1';
function guardOptions(options: ApprovalSignatureReadOptions) {
  signatureText(options.contextScopeKey);
  if (options.resourceSetKey !== undefined) signatureText(options.resourceSetKey);
  if (!/^psr-[a-f0-9]{64}$/.test(options.expectedDecisionRevision)) invalidApprovalSignature();
}
async function read(path: string, options: ApprovalSignatureReadOptions) {
  guardOptions(options);
  const response = await axiosInstance.get<ApiResponse<unknown>>(path, {
    contextScopeKey: options.contextScopeKey,
    headers: { 'X-DWP-Expected-Decision-Revision': options.expectedDecisionRevision },
    signal: options.signal,
    timeoutMs: 10000,
    beforeDispatch: options.beforeDispatch,
  });
  options.beforeDispatch?.();
  return response.data.data;
}
export async function getApprovalSignatureContext(
  requestId: string,
  locale: 'ko' | 'en',
  options: ApprovalSignatureReadOptions
) {
  options = Object.freeze({ ...options });
  signatureId(requestId);
  signatureLocale(locale);
  const data = readApprovalSignatureContext(
    await read(`${base}/requests/${requestId}/signature-context?locale=${locale}`, options),
    requestId,
    options.resourceSetKey
  );
  if (data.terms.locale !== locale) invalidApprovalSignature();
  const verified = await verifyApprovalSignatureSource(data);
  options.beforeDispatch?.();
  return verified;
}
export async function getApprovalSignatureCeremony(
  signatureRequestId: string,
  requestId: string,
  options: ApprovalSignatureReadOptions
) {
  options = Object.freeze({ ...options });
  signatureId(signatureRequestId);
  signatureId(requestId);
  const data = readApprovalSignatureCeremony(
    await read(`${base}/signature-requests/${signatureRequestId}`, options),
    { signatureRequestId, requestId, resourceSetKey: options.resourceSetKey }
  );
  const verified = await verifyApprovalSignatureSource(data);
  options.beforeDispatch?.();
  return verified;
}
export async function getApprovalSignatureAudit(
  signatureRequestId: string,
  options: ApprovalSignatureReadOptions
) {
  options = Object.freeze({ ...options });
  signatureId(signatureRequestId);
  return readApprovalSignatureAudit(
    await read(`${base}/signature-requests/${signatureRequestId}/audit`, options)
  );
}
export async function getApprovalSignatureCommandReceipt(
  query: ApprovalSignatureReceiptQuery,
  requestId: string,
  options: ApprovalSignatureReadOptions
) {
  options = Object.freeze({ ...options });
  signatureKey(query.idempotencyKey);
  signatureOperation(query.originalOperation);
  signatureId(query.targetId);
  signatureId(requestId);
  signatureSha(query.bodySha256);
  if (query.idempotencyKey === '.' || query.idempotencyKey === '..') invalidApprovalSignature();
  const params = new URLSearchParams({
    originalOperation: query.originalOperation,
    targetId: query.targetId,
    bodySha256: query.bodySha256,
  });
  return readApprovalSignatureCommandReceipt(
    await read(
      `${base}/signature-command-receipts/${encodeURIComponent(query.idempotencyKey)}?${params}`,
      options
    ),
    { ...query, requestId }
  );
}
async function command(
  operation: ApprovalSignatureOperation,
  targetId: string,
  path: string,
  body: Readonly<{ expectedVersion: number; sourceDigest: string; idempotencyKey: string }>,
  execution: ApprovalMutationExecution,
  options: ApprovalSignatureDispatchOptions
) {
  options = Object.freeze({ ...options });
  guardOptions(options);
  signatureId(targetId);
  signatureId(options.requestId);
  signatureText(options.resourceSetKey);
  if (
    typeof options.beforeDispatch !== 'function' ||
    execution.mode !== 'SECURE' ||
    !['110', '111'].includes(execution.rolloutState) ||
    execution.contextScopeKey !== options.contextScopeKey ||
    execution.expectedDecisionRevision !== options.expectedDecisionRevision ||
    (execution.idempotencyKey !== undefined && execution.idempotencyKey !== body.idempotencyKey) ||
    (execution.objectVersion !== undefined && execution.objectVersion !== body.expectedVersion) ||
    (operation !== 'SIGN' && execution.stepUp !== undefined)
  )
    invalidApprovalSignature();
  const frozenExecution = Object.freeze({
    ...execution,
    stepUp: execution.stepUp ? Object.freeze({ ...execution.stepUp }) : undefined,
  });
  const config =
    operation === 'SIGN'
      ? approvalHighRiskMutationExecutionConfig(frozenExecution, { objectVersionHeader: false })
      : approvalMutationExecutionConfig(frozenExecution);
  const beforeDispatch = () => {
    if (
      options.signal?.aborted ||
      (operation === 'SIGN' &&
        (!frozenExecution.stepUp || Date.parse(frozenExecution.stepUp.expiresAt) <= Date.now()))
    )
      invalidApprovalSignature();
    options.beforeDispatch();
  };
  beforeDispatch();
  const receiptQuery = Object.freeze({
    idempotencyKey: body.idempotencyKey,
    originalOperation: operation,
    targetId,
    bodySha256: await approvalSignatureSha256(approvalSignatureCanonicalJson(body)),
  });
  beforeDispatch();
  let raw: unknown;
  try {
    const response = await axiosInstance.post<ApiResponse<unknown>>(path, body, {
      ...config,
      headers: { ...config.headers, 'Idempotency-Key': body.idempotencyKey },
      beforeDispatch,
      signal: options.signal,
      timeoutMs: 10000,
      csrfReplay: 'NEVER',
    });
    raw = response.data.data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 403 && error.details === undefined)
      throw new ApprovalSignatureResponseError(receiptQuery, error);
    throw error;
  }
  try {
    beforeDispatch();
    const receipt = readApprovalSignatureReceipt(raw, {
      requestId: options.requestId,
      resourceSetKey: options.resourceSetKey,
      ...(operation === 'CREATE' ? {} : { signatureRequestId: targetId }),
    });
    if (
      receipt.ceremony.sourceDigest !== body.sourceDigest ||
      receipt.ceremony.version !== (operation === 'CREATE' ? 0 : body.expectedVersion + 1)
    )
      invalidApprovalSignature();
    const expectedState =
      operation === 'CREATE'
        ? 'AWAITING_CONSENT'
        : operation === 'CONSENT'
          ? 'CONSENTED'
          : operation === 'SIGN'
            ? 'ATTESTED'
            : 'CANCELLED';
    if (receipt.ceremony.state !== expectedState) invalidApprovalSignature();
    await verifyApprovalSignatureSource(receipt.ceremony);
    beforeDispatch();
    return receipt;
  } catch (error) {
    throw new ApprovalSignatureResponseError(receiptQuery, error);
  }
}
function common(input: { expectedVersion: number; sourceDigest: string; idempotencyKey: string }) {
  return {
    expectedVersion: signatureVersion(input.expectedVersion),
    sourceDigest: signatureSha(input.sourceDigest),
    idempotencyKey: signatureKey(input.idempotencyKey),
  };
}
export function createApprovalSignatureRequest(
  requestId: string,
  input: ApprovalSignatureCreateInput,
  execution: ApprovalMutationExecution,
  options: ApprovalSignatureDispatchOptions
) {
  signatureFields(input, [
    'expectedVersion',
    'signerKind',
    'locale',
    'sourceDigest',
    'idempotencyKey',
  ]);
  signatureId(requestId);
  if (input.signerKind !== 'SELF_ATTESTATION' || requestId !== options.requestId)
    invalidApprovalSignature();
  const body = Object.freeze({
    ...common(input),
    signerKind: input.signerKind,
    locale: signatureLocale(input.locale),
  });
  return command(
    'CREATE',
    requestId,
    `${base}/requests/${requestId}/signature-requests`,
    body,
    execution,
    options
  );
}
export function consentApprovalSignatureRequest(
  signatureRequestId: string,
  input: ApprovalSignatureConsentInput,
  execution: ApprovalMutationExecution,
  options: ApprovalSignatureDispatchOptions
) {
  signatureFields(input, [
    'expectedVersion',
    'sourceDigest',
    'termsId',
    'termsVersion',
    'termsSha256',
    'locale',
    'accepted',
    'idempotencyKey',
  ]);
  signatureId(signatureRequestId);
  if (input.accepted !== true) invalidApprovalSignature();
  const body = Object.freeze({
    ...common(input),
    termsId: signatureText(input.termsId, 80),
    termsVersion: signatureVersion(input.termsVersion, 1),
    termsSha256: signatureSha(input.termsSha256),
    locale: signatureLocale(input.locale),
    accepted: input.accepted,
  });
  return command(
    'CONSENT',
    signatureRequestId,
    `${base}/signature-requests/${signatureRequestId}/consents`,
    body,
    execution,
    options
  );
}
export function signApprovalSignatureRequest(
  signatureRequestId: string,
  input: ApprovalSignatureSignInput,
  execution: ApprovalMutationExecution,
  options: ApprovalSignatureDispatchOptions
) {
  signatureFields(input, ['expectedVersion', 'sourceDigest', 'consentReceiptId', 'idempotencyKey']);
  signatureId(signatureRequestId);
  const body = Object.freeze({
    ...common(input),
    consentReceiptId: signatureId(input.consentReceiptId),
  });
  return command(
    'SIGN',
    signatureRequestId,
    `${base}/signature-requests/${signatureRequestId}/sign`,
    body,
    execution,
    options
  );
}
export function cancelApprovalSignatureRequest(
  signatureRequestId: string,
  input: ApprovalSignatureCancelInput,
  execution: ApprovalMutationExecution,
  options: ApprovalSignatureDispatchOptions
) {
  signatureFields(input, ['expectedVersion', 'sourceDigest', 'idempotencyKey']);
  signatureId(signatureRequestId);
  return command(
    'CANCEL',
    signatureRequestId,
    `${base}/signature-requests/${signatureRequestId}/cancel`,
    Object.freeze(common(input)),
    execution,
    options
  );
}
