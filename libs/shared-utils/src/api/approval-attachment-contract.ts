export type ApprovalAttachmentState =
  | 'RESERVED'
  | 'UPLOADING'
  | 'STORAGE_RECONCILING'
  | 'QUARANTINED'
  | 'SCANNING'
  | 'AVAILABLE'
  | 'REJECTED'
  | 'CANCELLED';
export interface ApprovalAttachmentUpload {
  uploadId: string;
  attachmentId: string;
  state: ApprovalAttachmentState;
  version: number;
  reason: string | null;
  avState: string;
  passiveContentState: string;
  sizeBytes: number;
  sha256: string;
  expiresAt: string;
}
export interface ApprovalAttachmentItem {
  attachmentId: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  avState: string;
  passiveContentState: string;
}
export interface ApprovalAttachments {
  manifest: {
    payloadRevision: number;
    payloadSha256: string;
    manifestSha256: string | null;
    items: readonly ApprovalAttachmentItem[];
    selectionVersion: number;
    sealed: boolean;
    providerReadiness: string;
  };
  policyId: string | null;
  policyVersion: number;
  upload: { allowed: boolean; reason: string };
  download: { allowed: boolean; reason: string };
  maxFileBytes: number;
  maxFiles: number;
  maxRequestBytes: number;
  allowedMediaTypes: readonly string[];
  evaluatedAt: string;
}
export interface ApprovalAttachmentReserveInput {
  expectedVersion: number;
  expectedPayloadRevision: number;
  expectedPolicyVersion: number;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  idempotencyKey: string;
}
export interface ApprovalAttachmentCommandInput {
  expectedVersion: number;
  idempotencyKey: string;
}
export interface ApprovalAttachmentSelectionInput extends ApprovalAttachmentCommandInput {
  expectedPayloadRevision: number;
  expectedSelectionVersion: number;
  expectedPolicyVersion: number;
  attachmentIds: string[];
}
export interface ApprovalAttachmentDownloadInput extends ApprovalAttachmentCommandInput {
  expectedPayloadRevision: number;
  expectedPolicyVersion: number;
  reason: string;
}
export interface ApprovalAttachmentDownloadGrant {
  grantId: string;
  expiresAt: string;
  sha256: string;
  sizeBytes: number;
}
export const APPROVAL_ATTACHMENT_MEDIA_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;
const states = [
  'RESERVED',
  'UPLOADING',
  'STORAGE_RECONCILING',
  'QUARANTINED',
  'SCANNING',
  'AVAILABLE',
  'REJECTED',
  'CANCELLED',
];
export function invalidApprovalAttachment(): never {
  throw new Error('Invalid approval attachment contract');
}
export function approvalAttachmentId(value: string): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value)
  )
    invalidApprovalAttachment();
  return value;
}
export function approvalAttachmentVersion(
  value: number,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    invalidApprovalAttachment();
}
export function approvalAttachmentSha(value: string) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) invalidApprovalAttachment();
}
export function approvalAttachmentText(value: string, maximum: number) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maximum ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127
    )
  )
    invalidApprovalAttachment();
}
export function approvalAttachmentName(value: string) {
  approvalAttachmentText(value, 160);
  if (value.includes('/') || value.includes('\\') || value === '.' || value === '..')
    invalidApprovalAttachment();
}
export function approvalAttachmentKey(value: string) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/u.test(value))
    invalidApprovalAttachment();
}
function timestamp(value: string) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) invalidApprovalAttachment();
}
function scan(value: { avState: string; passiveContentState: string }) {
  approvalAttachmentText(value.avState, 100);
  approvalAttachmentText(value.passiveContentState, 100);
}
export function readApprovalAttachmentUpload(value: ApprovalAttachmentUpload, uploadId?: string) {
  if (!value) invalidApprovalAttachment();
  approvalAttachmentId(value.uploadId);
  approvalAttachmentId(value.attachmentId);
  if ((uploadId !== undefined && value.uploadId !== uploadId) || !states.includes(value.state))
    invalidApprovalAttachment();
  approvalAttachmentVersion(value.version);
  approvalAttachmentVersion(value.sizeBytes, 1, 26_214_400);
  approvalAttachmentSha(value.sha256);
  scan(value);
  timestamp(value.expiresAt);
  if (value.reason !== null) approvalAttachmentText(value.reason, 500);
  if (
    value.state === 'AVAILABLE' &&
    (value.avState !== 'AV_CLEAR' || value.passiveContentState !== 'PASSIVE_ALLOWED')
  )
    invalidApprovalAttachment();
  return Object.freeze({ ...value });
}
export function readApprovalAttachments(
  value: ApprovalAttachments,
  expected?: { payloadRevision: number; payloadSha256: string }
) {
  if (!value?.manifest) invalidApprovalAttachment();
  const manifest = value.manifest;
  approvalAttachmentVersion(manifest.payloadRevision, 1);
  approvalAttachmentVersion(manifest.selectionVersion);
  approvalAttachmentSha(manifest.payloadSha256);
  if (
    expected &&
    (expected.payloadRevision !== manifest.payloadRevision ||
      expected.payloadSha256 !== manifest.payloadSha256)
  )
    invalidApprovalAttachment();
  if (
    typeof manifest.sealed !== 'boolean' ||
    (manifest.sealed ? !manifest.manifestSha256 : manifest.manifestSha256 !== null)
  )
    invalidApprovalAttachment();
  if (manifest.sealed) approvalAttachmentSha(manifest.manifestSha256!);
  if (
    !Array.isArray(manifest.items) ||
    manifest.items.length > 10 ||
    new Set(manifest.items.map((item) => item?.attachmentId)).size !== manifest.items.length
  )
    invalidApprovalAttachment();
  const items = manifest.items.map((item) => {
    if (!item) invalidApprovalAttachment();
    approvalAttachmentId(item.attachmentId);
    approvalAttachmentName(item.fileName);
    approvalAttachmentVersion(item.sizeBytes, 1, 26_214_400);
    approvalAttachmentSha(item.sha256);
    scan(item);
    if (!(APPROVAL_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(item.mediaType))
      invalidApprovalAttachment();
    if (
      manifest.sealed &&
      (item.avState !== 'AV_CLEAR' || item.passiveContentState !== 'PASSIVE_ALLOWED')
    )
      invalidApprovalAttachment();
    return Object.freeze({ ...item });
  });
  approvalAttachmentText(manifest.providerReadiness, 100);
  approvalAttachmentVersion(value.policyVersion);
  for (const tool of [value.upload, value.download])
    if (!tool || typeof tool.allowed !== 'boolean') invalidApprovalAttachment();
    else approvalAttachmentText(tool.reason, 500);
  if (value.policyId === null) {
    if (
      value.upload.allowed ||
      value.download.allowed ||
      value.policyVersion !== 0 ||
      value.maxFileBytes !== 0 ||
      value.maxFiles !== 0 ||
      value.maxRequestBytes !== 0 ||
      !Array.isArray(value.allowedMediaTypes) ||
      value.allowedMediaTypes.length !== 0
    )
      invalidApprovalAttachment();
  } else {
    approvalAttachmentId(value.policyId);
    approvalAttachmentVersion(value.maxFileBytes, 1, 26_214_400);
    approvalAttachmentVersion(value.maxFiles, 1, 10);
    approvalAttachmentVersion(value.maxRequestBytes, 1, 104_857_600);
    if (
      !Array.isArray(value.allowedMediaTypes) ||
      !value.allowedMediaTypes.length ||
      value.allowedMediaTypes.length > 5 ||
      new Set(value.allowedMediaTypes).size !== value.allowedMediaTypes.length ||
      value.allowedMediaTypes.some(
        (type) => !(APPROVAL_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(type)
      )
    )
      invalidApprovalAttachment();
  }
  if (value.download.allowed && !manifest.sealed) invalidApprovalAttachment();
  timestamp(value.evaluatedAt);
  return Object.freeze({
    ...value,
    manifest: Object.freeze({
      ...manifest,
      items: Object.freeze(items),
    }),
    upload: Object.freeze({ ...value.upload }),
    download: Object.freeze({ ...value.download }),
    allowedMediaTypes: Object.freeze([...value.allowedMediaTypes]),
  });
}
export function readApprovalAttachmentDownloadGrant(
  value: ApprovalAttachmentDownloadGrant,
  item?: ApprovalAttachmentItem
) {
  if (!value) invalidApprovalAttachment();
  approvalAttachmentId(value.grantId);
  approvalAttachmentSha(value.sha256);
  approvalAttachmentVersion(value.sizeBytes, 1, 26_214_400);
  timestamp(value.expiresAt);
  if (item && (item.sha256 !== value.sha256 || item.sizeBytes !== value.sizeBytes))
    invalidApprovalAttachment();
  return Object.freeze({ ...value });
}
