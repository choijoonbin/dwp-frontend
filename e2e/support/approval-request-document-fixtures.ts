import { APPROVAL_REQUEST_DETAIL_FIXTURE, APPROVAL_REQUEST_FIXTURE } from './product-area-fixtures';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type {
  ApprovalDocumentTools,
  ApprovalGeneratedDocument,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

export const approvalDocumentRequestId = '33333333-3333-4333-8333-333333333333';
export function approvalDocumentRequestDetail(
  id = approvalDocumentRequestId
): ApprovalRequestDetail {
  return {
    ...APPROVAL_REQUEST_DETAIL_FIXTURE,
    request: { ...APPROVAL_REQUEST_FIXTURE, requestId: id, status: 'APPROVED', version: 3 },
  };
}
export function approvalDocumentTools(id = approvalDocumentRequestId): ApprovalDocumentTools {
  const allowed = { allowed: true, reason: 'ALLOWED' };
  return {
    requestId: id,
    taskId: null,
    requestVersion: 3,
    taskVersion: null,
    payloadRevision: 1,
    payloadSha256: 'a'.repeat(64),
    policyId: '55555555-5555-4555-8555-555555555555',
    resourceSetKey: 'RS_DOC_CONTROL',
    policyVersion: 2,
    commentsVersion: 0,
    holdVersion: 0,
    legalHold: false,
    copyIdentifier: allowed,
    history: allowed,
    comment: allowed,
    print: allowed,
    jsonExport: allowed,
    archiveExport: allowed,
    attachments: { allowed: false, reason: 'ATTACHMENT_STORAGE_NOT_CONFIGURED' },
    evaluatedAt: new Date().toISOString(),
    maxBatchItems: 10,
    preservationPending: false,
  };
}
export async function approvalDocumentArtifact(
  intent: 'PRINT' | 'DOWNLOAD',
  requestIds: readonly string[] = [approvalDocumentRequestId]
): Promise<ApprovalGeneratedDocument> {
  const exportId = '66666666-6666-4666-8666-666666666666';
  const generatedAt = new Date(Date.now() - 1000).toISOString();
  const content =
    intent === 'PRINT'
      ? `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Approval</title></head><body><h1>검토 완료 문서</h1><p>검증된 요청 원문</p></body></html>`
      : JSON.stringify({
          schemaVersion: 1,
          format: 'JSON',
          generatedAt,
          documents: requestIds.map((requestId) => ({
            requestId,
            sourceTaskId: null,
            requestNumber: approvalDocumentRequestDetail(requestId).request.requestNumber,
            title: '검토 완료 문서',
            summary: '검증된 요청 원문',
            status: 'APPROVED',
            classification: 'CONFIDENTIAL',
            requestVersion: 3,
            taskVersion: null,
            payloadRevision: 1,
            payloadSha256: 'a'.repeat(64),
            fields: [],
            comments: [],
            evidence: [],
            legalHold: false,
            retainUntil: new Date(Date.now() + 86400_000).toISOString(),
            preservationPending: false,
          })),
        });
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return {
    exportId,
    format: intent === 'PRINT' ? 'HTML' : 'JSON',
    mediaType: intent === 'PRINT' ? 'text/html' : 'application/json',
    fileName: `approval-${exportId}.${intent === 'PRINT' ? 'html' : 'json'}`,
    content,
    sizeBytes: bytes.byteLength,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    ),
    policyVersion: 2,
    generatedAt,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    retainUntil: new Date(Date.now() + 86400_000).toISOString(),
  };
}
