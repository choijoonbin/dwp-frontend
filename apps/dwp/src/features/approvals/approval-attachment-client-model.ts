import { HttpError } from '@dwp-frontend/shared-utils';
import { approvalAttachmentName } from '@dwp-frontend/shared-utils/api/approval-attachment-contract';

import { sameApprovalDocumentSnapshot } from './approval-document-snapshot';

import type {
  ApprovalAttachments,
  ApprovalAttachmentUpload,
  ApprovalAttachmentItem,
  ApprovalAttachmentSelectionInput,
} from '@dwp-frontend/shared-utils/api/approval-attachment-contract';
import type {
  ApprovalDocumentOwner,
  ApprovalDocumentTools,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

export type ApprovalAttachmentSource = Readonly<{
  owner: ApprovalDocumentOwner;
  tools: ApprovalDocumentTools;
  attachments: ApprovalAttachments;
}>;

export function approvalAttachmentSourceMatches(
  source: ApprovalAttachmentSource,
  owner: ApprovalDocumentOwner,
  version: number
) {
  return (
    source.owner.type === owner.type &&
    source.owner.id === owner.id &&
    (owner.type === 'REQUEST'
      ? source.tools.requestId === owner.id && source.tools.requestVersion === version
      : source.tools.taskId === owner.id && source.tools.taskVersion === version) &&
    source.tools.payloadRevision === source.attachments.manifest.payloadRevision &&
    source.tools.payloadSha256 === source.attachments.manifest.payloadSha256
  );
}

export function sameApprovalAttachmentSource(
  previous: ApprovalAttachmentSource,
  current: ApprovalAttachmentSource
) {
  const left = previous.attachments;
  const right = current.attachments;
  return (
    previous.owner.type === current.owner.type &&
    previous.owner.id === current.owner.id &&
    sameApprovalDocumentSnapshot(previous.tools, current.tools) &&
    left.policyId === right.policyId &&
    left.policyVersion === right.policyVersion &&
    left.manifest.payloadRevision === right.manifest.payloadRevision &&
    left.manifest.payloadSha256 === right.manifest.payloadSha256 &&
    left.manifest.manifestSha256 === right.manifest.manifestSha256 &&
    left.manifest.selectionVersion === right.manifest.selectionVersion &&
    left.manifest.sealed === right.manifest.sealed &&
    left.manifest.providerReadiness === right.manifest.providerReadiness &&
    left.upload.allowed === right.upload.allowed &&
    left.download.allowed === right.download.allowed &&
    left.maxFileBytes === right.maxFileBytes &&
    left.maxFiles === right.maxFiles &&
    left.maxRequestBytes === right.maxRequestBytes &&
    JSON.stringify(left.allowedMediaTypes) === JSON.stringify(right.allowedMediaTypes) &&
    JSON.stringify(left.manifest.items) === JSON.stringify(right.manifest.items)
  );
}

export function approvalAttachmentOwnerVersion(source: ApprovalAttachmentSource) {
  const version =
    source.owner.type === 'TASK' ? source.tools.taskVersion : source.tools.requestVersion;
  if (version === null || !Number.isSafeInteger(version) || version < 0)
    throw new HttpError('Attachment owner version is unavailable.', 409);
  return version;
}

export function approvalAttachmentFileAllowed(file: File, source: ApprovalAttachmentSource) {
  try {
    approvalAttachmentName(file.name);
  } catch {
    return false;
  }
  const policy = source.attachments;
  return (
    policy.upload.allowed &&
    source.owner.type === 'REQUEST' &&
    !policy.manifest.sealed &&
    file.size > 0 &&
    file.size <= policy.maxFileBytes &&
    policy.allowedMediaTypes.includes(file.type) &&
    policy.manifest.items.length < policy.maxFiles &&
    policy.manifest.items.reduce((sum, item) => sum + item.sizeBytes, file.size) <=
      policy.maxRequestBytes
  );
}

export function approvalAttachmentScanEligible(upload: ApprovalAttachmentUpload) {
  return (
    upload.state === 'AVAILABLE' &&
    upload.avState === 'AV_CLEAR' &&
    upload.passiveContentState === 'PASSIVE_ALLOWED' &&
    Date.parse(upload.expiresAt) > Date.now()
  );
}

export function approvalAttachmentUploadMatches(
  original: ApprovalAttachmentUpload,
  current: ApprovalAttachmentUpload
) {
  return (
    original.uploadId === current.uploadId &&
    original.attachmentId === current.attachmentId &&
    original.sha256 === current.sha256 &&
    original.sizeBytes === current.sizeBytes &&
    current.version >= original.version &&
    Date.parse(current.expiresAt) === Date.parse(original.expiresAt)
  );
}

export function approvalAttachmentItemMatches(
  original: ApprovalAttachmentItem,
  current: ApprovalAttachmentItem
) {
  return (
    original.attachmentId === current.attachmentId &&
    original.fileName === current.fileName &&
    original.mediaType === current.mediaType &&
    original.sha256 === current.sha256 &&
    original.sizeBytes === current.sizeBytes &&
    current.avState === 'AV_CLEAR' &&
    current.passiveContentState === 'PASSIVE_ALLOWED'
  );
}

export function approvalAttachmentOriginalKey() {
  return `apr-att-${crypto.randomUUID()}`;
}

export function approvalAttachmentSelectionReplayMatches(
  previous: ApprovalAttachmentSource,
  current: ApprovalAttachmentSource,
  input: ApprovalAttachmentSelectionInput
) {
  const manifest = current.attachments.manifest;
  return (
    !manifest.sealed &&
    manifest.manifestSha256 === null &&
    manifest.selectionVersion === input.expectedSelectionVersion + 1 &&
    JSON.stringify(manifest.items.map((item) => item.attachmentId).sort()) ===
      JSON.stringify([...input.attachmentIds].sort()) &&
    sameApprovalAttachmentSource(
      { ...previous, attachments: { ...previous.attachments, manifest } },
      current
    )
  );
}
