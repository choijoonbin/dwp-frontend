import { createHash } from 'node:crypto';

import {
  approvalDocumentRequestDetail,
  approvalDocumentTools,
} from './approval-request-document-fixtures';

import type { ApprovalAttachmentSource } from '../../apps/dwp/src/features/approvals/approval-attachment-client-model';
import type { ApprovalAttachmentUpload } from '@dwp-frontend/shared-utils/api/approval-attachment-contract';

export const ATTACHMENT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const ATTACHMENT_TASK_ID = '55555555-5555-4555-8555-555555555555';
export const ATTACHMENT_UPLOAD_ID = '22222222-2222-4222-8222-222222222222';
export const ATTACHMENT_ID = '33333333-3333-4333-8333-333333333333';
export const ATTACHMENT_GRANT_ID = '44444444-4444-4444-8444-444444444444';
export const ATTACHMENT_BYTES = new TextEncoder().encode(
  'Approval evidence\nUnicode: \uacb0\uc7ac\n'
);
export const ATTACHMENT_SHA = createHash('sha256').update(ATTACHMENT_BYTES).digest('hex');
export const ATTACHMENT_FILE_NAME = 'approval-evidence.txt';
export const attachmentItem = () => ({
  attachmentId: ATTACHMENT_ID,
  fileName: ATTACHMENT_FILE_NAME,
  mediaType: 'text/plain',
  sizeBytes: ATTACHMENT_BYTES.length,
  sha256: ATTACHMENT_SHA,
  avState: 'AV_CLEAR',
  passiveContentState: 'PASSIVE_ALLOWED',
});
export const attachmentDetail = () => {
  const detail = approvalDocumentRequestDetail(ATTACHMENT_REQUEST_ID);
  return { ...detail, request: { ...detail.request, status: 'DRAFT' as const } };
};
export const attachmentSource = (sealed = false, task = false): ApprovalAttachmentSource => {
  const tools = {
    ...approvalDocumentTools(ATTACHMENT_REQUEST_ID),
    ...(task ? { taskId: ATTACHMENT_TASK_ID, taskVersion: 19 } : {}),
  };
  return {
    owner: {
      type: task ? 'TASK' : 'REQUEST',
      id: task ? ATTACHMENT_TASK_ID : ATTACHMENT_REQUEST_ID,
    },
    tools,
    attachments: {
      manifest: {
        payloadRevision: tools.payloadRevision,
        payloadSha256: tools.payloadSha256,
        manifestSha256: sealed ? 'b'.repeat(64) : null,
        items: sealed ? [attachmentItem()] : [],
        selectionVersion: 0,
        sealed,
        providerReadiness: 'COMPONENTS_VERIFIED_NOT_SANITIZED',
      },
      policyId: ATTACHMENT_REQUEST_ID,
      policyVersion: 3,
      upload: { allowed: !sealed && !task, reason: !sealed && !task ? 'ALLOWED' : 'READ_ONLY' },
      download: { allowed: sealed, reason: sealed ? 'ALLOWED' : 'UNSEALED' },
      maxFileBytes: 26_214_400,
      maxFiles: 10,
      maxRequestBytes: 104_857_600,
      allowedMediaTypes: ['text/plain'],
      evaluatedAt: new Date().toISOString(),
    },
  };
};
export const attachmentUpload = (): ApprovalAttachmentUpload => ({
  uploadId: ATTACHMENT_UPLOAD_ID,
  attachmentId: ATTACHMENT_ID,
  state: 'RESERVED',
  version: 0,
  reason: null,
  avState: 'NOT_CHECKED',
  passiveContentState: 'NOT_CHECKED',
  sizeBytes: ATTACHMENT_BYTES.length,
  sha256: ATTACHMENT_SHA,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
});
