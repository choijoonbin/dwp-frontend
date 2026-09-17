import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';
import {
  assertAgentRevision,
  assertAgentUuid,
  isAgentDate,
  isAgentRecord,
} from './agent-governed-api';
import {
  productSurfaceGovernedMutationConfig,
  type ProductSurfaceGovernedMutationAuthority,
} from './product-surface-governed-mutation';

export type DwaionAttachmentRevisionBinding = {
  attachmentId: string;
  expectedRevision: number;
};

export type DwaionAttachmentDetachReceipt = {
  receiptId: string;
  commandId: string;
  conversationId: string;
  detachedAttachments: Array<{ attachmentId: string; revision: number }>;
  integrityFingerprint: string;
  detachedAt: string;
};

export type DwaionAttachmentAuditReportReceipt = {
  reportId: string;
  commandId: string;
  conversationId: string;
  attachmentIds: string[];
  contentSha256: string;
  signatureAlgorithm: string;
  signature: string;
  signingKeyFingerprint: string;
  downloadPath: string;
  createdAt: string;
};

type CommandAttempt = { commandId: string; idempotencyKey: string };
const LEGACY_AUTHORITY = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export async function detachDwaionConversationAttachments(
  conversationId: string,
  attachments: readonly DwaionAttachmentRevisionBinding[],
  attempt: CommandAttempt,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionAttachmentDetachReceipt> {
  validateRequest(conversationId, attachments, attempt);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `/api/agent/v1/attachments/conversations/${encodeURIComponent(conversationId)}/detach-all`,
    {
      ...attempt,
      attachments,
      reason: 'Detach every selected attachment from this conversation without deleting it.',
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionAttachmentDetachReceipt(response.data.data);
}

export async function createDwaionAttachmentAuditReport(
  conversationId: string,
  attachments: readonly DwaionAttachmentRevisionBinding[],
  attempt: CommandAttempt,
  authority: ProductSurfaceGovernedMutationAuthority = LEGACY_AUTHORITY
): Promise<DwaionAttachmentAuditReportReceipt> {
  validateRequest(conversationId, attachments, attempt);
  const response = await axiosInstance.post<ApiResponse<unknown>, object>(
    `/api/agent/v1/attachments/conversations/${encodeURIComponent(conversationId)}/audit-reports`,
    {
      ...attempt,
      attachments,
      reason: 'Issue a signed verification report for the current secure attachment evidence.',
    },
    productSurfaceGovernedMutationConfig(authority)
  );
  return parseDwaionAttachmentAuditReportReceipt(response.data.data);
}

export async function downloadDwaionAttachmentAuditReport(reportId: string): Promise<Blob> {
  assertAgentUuid(reportId, 'Attachment audit report');
  const response = await axiosInstance.get<Blob>(
    `/api/agent/v1/attachments/audit-reports/${encodeURIComponent(reportId)}/download`,
    { responseType: 'blob', headers: { Accept: 'application/pdf' } }
  );
  if (!(response.data instanceof Blob) || response.data.size < 1) {
    throw new HttpError('Attachment audit report download is empty or invalid.', 502);
  }
  return response.data;
}

export function parseDwaionAttachmentDetachReceipt(value: unknown): DwaionAttachmentDetachReceipt {
  if (
    !isAgentRecord(value) ||
    !uuid(value.receiptId) ||
    !uuid(value.commandId) ||
    !uuid(value.conversationId) ||
    !Array.isArray(value.detachedAttachments) ||
    value.detachedAttachments.length < 1 ||
    !value.detachedAttachments.every(
      (item) =>
        isAgentRecord(item) &&
        uuid(item.attachmentId) &&
        Number.isSafeInteger(item.revision) &&
        Number(item.revision) >= 2
    ) ||
    typeof value.integrityFingerprint !== 'string' ||
    !SHA256.test(value.integrityFingerprint) ||
    !isAgentDate(value.detachedAt)
  ) {
    throw new HttpError('Attachment detach receipt is invalid.', 502, value);
  }
  return value as DwaionAttachmentDetachReceipt;
}

export function parseDwaionAttachmentAuditReportReceipt(
  value: unknown
): DwaionAttachmentAuditReportReceipt {
  if (
    !isAgentRecord(value) ||
    !uuid(value.reportId) ||
    !uuid(value.commandId) ||
    !uuid(value.conversationId) ||
    !Array.isArray(value.attachmentIds) ||
    value.attachmentIds.length < 1 ||
    !value.attachmentIds.every(uuid) ||
    typeof value.contentSha256 !== 'string' ||
    !SHA256.test(value.contentSha256) ||
    typeof value.signatureAlgorithm !== 'string' ||
    !value.signatureAlgorithm ||
    typeof value.signature !== 'string' ||
    !value.signature ||
    typeof value.signingKeyFingerprint !== 'string' ||
    !SHA256.test(value.signingKeyFingerprint) ||
    typeof value.downloadPath !== 'string' ||
    value.downloadPath !== `/v1/attachments/audit-reports/${value.reportId}/download` ||
    !isAgentDate(value.createdAt)
  ) {
    throw new HttpError('Attachment audit report receipt is invalid.', 502, value);
  }
  return value as DwaionAttachmentAuditReportReceipt;
}

function validateRequest(
  conversationId: string,
  attachments: readonly DwaionAttachmentRevisionBinding[],
  attempt: CommandAttempt
) {
  assertAgentUuid(conversationId, 'Attachment conversation');
  assertAgentUuid(attempt.commandId, 'Attachment action command');
  assertAgentUuid(attempt.idempotencyKey, 'Attachment action idempotency key');
  if (attachments.length < 1 || attachments.length > 20) {
    throw new TypeError('Attachment action selection is invalid.');
  }
  const ids = new Set<string>();
  for (const attachment of attachments) {
    assertAgentUuid(attachment.attachmentId, 'Attachment');
    assertAgentRevision(attachment.expectedRevision, 'Attachment revision', 1);
    if (ids.has(attachment.attachmentId))
      throw new TypeError('Attachment selection is duplicated.');
    ids.add(attachment.attachmentId);
  }
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
