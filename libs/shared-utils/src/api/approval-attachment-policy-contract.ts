import {
  APPROVAL_ATTACHMENT_MEDIA_TYPES,
  approvalAttachmentId,
  approvalAttachmentKey,
  approvalAttachmentSha,
  approvalAttachmentText,
  approvalAttachmentVersion,
  invalidApprovalAttachment,
} from './approval-attachment-contract';

export interface ApprovalAttachmentRules {
  allowUpload: boolean;
  allowDownload: boolean;
  maxFileBytes: number;
  maxFiles: number;
  maxRequestBytes: number;
  maxConcurrentUploads: number;
  allowedMediaTypes: readonly string[];
  grantTtlSeconds: number;
  retentionDays: number;
}
export interface ApprovalAttachmentPolicy {
  policyId: string;
  resourceSetKey: string;
  version: number;
  published: Readonly<ApprovalAttachmentRules>;
  pending: Readonly<ApprovalAttachmentRules> | null;
  providerReadiness: string;
  publishedRevision: number;
  pendingRevision: number | null;
  pendingMakerUserId: number | null;
  publishedRulesSha256: string;
  pendingRulesSha256: string | null;
  downloadReadiness: string;
  publishEligible: boolean;
  publishReason:
    | 'PENDING_POLICY_REQUIRED'
    | 'MAKER_CANNOT_PUBLISH'
    | 'UPLOAD_PROVIDER_UNAVAILABLE'
    | 'DOWNLOAD_PROVIDER_UNAVAILABLE'
    | 'ALLOWED';
}
export interface ApprovalAttachmentPolicyDraftInput {
  expectedVersion: number;
  idempotencyKey: string;
  rules: ApprovalAttachmentRules;
}
export interface ApprovalAttachmentPolicyPublishInput {
  expectedVersion: number;
  idempotencyKey: string;
  reviewComment: string;
}

function fields(
  value: unknown,
  names: readonly string[]
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.prototype.hasOwnProperty.call(value, name))
  )
    invalidApprovalAttachment();
}

export function readApprovalAttachmentRules(value: unknown): Readonly<ApprovalAttachmentRules> {
  fields(value, [
    'allowUpload',
    'allowDownload',
    'maxFileBytes',
    'maxFiles',
    'maxRequestBytes',
    'maxConcurrentUploads',
    'allowedMediaTypes',
    'grantTtlSeconds',
    'retentionDays',
  ]);
  const rules = value as unknown as ApprovalAttachmentRules;
  if (typeof rules.allowUpload !== 'boolean' || typeof rules.allowDownload !== 'boolean')
    invalidApprovalAttachment();
  approvalAttachmentVersion(rules.maxFileBytes, 1, 26_214_400);
  approvalAttachmentVersion(rules.maxFiles, 1, 10);
  approvalAttachmentVersion(rules.maxRequestBytes, rules.maxFileBytes, 104_857_600);
  approvalAttachmentVersion(rules.maxConcurrentUploads, 1, 2);
  approvalAttachmentVersion(rules.grantTtlSeconds, 60, 900);
  approvalAttachmentVersion(rules.retentionDays, 1, 3650);
  if (
    !Array.isArray(rules.allowedMediaTypes) ||
    !rules.allowedMediaTypes.length ||
    rules.allowedMediaTypes.length > APPROVAL_ATTACHMENT_MEDIA_TYPES.length ||
    new Set(rules.allowedMediaTypes).size !== rules.allowedMediaTypes.length ||
    rules.allowedMediaTypes.some(
      (type) => !(APPROVAL_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(type)
    )
  )
    invalidApprovalAttachment();
  return Object.freeze({
    ...rules,
    allowedMediaTypes: Object.freeze([...rules.allowedMediaTypes]),
  });
}

export function readApprovalAttachmentPolicy(
  value: unknown,
  policyId?: string,
  resourceSetKey?: string
) {
  fields(value, [
    'policyId',
    'resourceSetKey',
    'version',
    'published',
    'pending',
    'providerReadiness',
    'publishedRevision',
    'pendingRevision',
    'pendingMakerUserId',
    'publishedRulesSha256',
    'pendingRulesSha256',
    'downloadReadiness',
    'publishEligible',
    'publishReason',
  ]);
  const policy = value as unknown as ApprovalAttachmentPolicy;
  approvalAttachmentId(policy.policyId);
  approvalAttachmentVersion(policy.version);
  if (
    !/^RS_[A-Z0-9_]{1,76}$/u.test(policy.resourceSetKey) ||
    (policyId !== undefined && policy.policyId !== policyId) ||
    (resourceSetKey !== undefined && policy.resourceSetKey !== resourceSetKey)
  )
    invalidApprovalAttachment();
  approvalAttachmentText(policy.providerReadiness, 100);
  approvalAttachmentText(policy.downloadReadiness, 100);
  approvalAttachmentVersion(policy.publishedRevision, 0, 2_147_483_647);
  approvalAttachmentSha(policy.publishedRulesSha256);
  if (policy.pending === null) {
    if (
      policy.pendingRevision !== null ||
      policy.pendingMakerUserId !== null ||
      policy.pendingRulesSha256 !== null
    )
      invalidApprovalAttachment();
  } else {
    if (
      policy.pendingRevision === null ||
      policy.pendingMakerUserId === null ||
      policy.pendingRulesSha256 === null
    )
      invalidApprovalAttachment();
    approvalAttachmentVersion(policy.pendingRevision, policy.publishedRevision + 1, 2_147_483_647);
    approvalAttachmentVersion(policy.pendingMakerUserId, 1);
    approvalAttachmentSha(policy.pendingRulesSha256);
  }
  if (
    typeof policy.publishEligible !== 'boolean' ||
    ![
      'PENDING_POLICY_REQUIRED',
      'MAKER_CANNOT_PUBLISH',
      'UPLOAD_PROVIDER_UNAVAILABLE',
      'DOWNLOAD_PROVIDER_UNAVAILABLE',
      'ALLOWED',
    ].includes(policy.publishReason) ||
    policy.publishEligible !== (policy.publishReason === 'ALLOWED') ||
    (policy.pending === null) !== (policy.publishReason === 'PENDING_POLICY_REQUIRED')
  )
    invalidApprovalAttachment();
  return Object.freeze({
    ...policy,
    published: readApprovalAttachmentRules(policy.published),
    pending: policy.pending === null ? null : readApprovalAttachmentRules(policy.pending),
  });
}

export function snapshotApprovalAttachmentPolicyDraft(value: ApprovalAttachmentPolicyDraftInput) {
  fields(value, ['expectedVersion', 'idempotencyKey', 'rules']);
  approvalAttachmentVersion(value.expectedVersion);
  approvalAttachmentKey(value.idempotencyKey);
  return Object.freeze({ ...value, rules: readApprovalAttachmentRules(value.rules) });
}

export function snapshotApprovalAttachmentPolicyPublish(
  value: ApprovalAttachmentPolicyPublishInput
) {
  fields(value, ['expectedVersion', 'idempotencyKey', 'reviewComment']);
  approvalAttachmentVersion(value.expectedVersion);
  approvalAttachmentKey(value.idempotencyKey);
  approvalAttachmentText(value.reviewComment, 1000);
  return Object.freeze({ ...value });
}
