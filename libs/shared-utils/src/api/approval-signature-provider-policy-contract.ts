import {
  diagnosticBoolean,
  diagnosticEnum,
  diagnosticFields,
  diagnosticId,
  diagnosticInstant,
  diagnosticInteger,
  diagnosticList,
  diagnosticNullable,
  diagnosticSha,
  diagnosticText,
  diagnosticUnique,
  diagnosticReasons,
  SIGNATURE_GATE_STATES,
  invalidSignatureDiagnostics,
} from './approval-signature-diagnostics-primitives';
import {
  readSignatureProviderPin,
  readSignatureProviderScope,
} from './approval-signature-diagnostics-contract';
import type {
  SignatureProviderPin,
  SignatureProviderScope,
} from './approval-signature-diagnostics-contract';

export type SignatureProviderPolicyRules = Readonly<{
  signingEnabled: boolean;
  requiredProviderKinds: readonly ('DOCUSIGN' | 'ADOBE_SIGN' | 'CUSTOM')[];
  allowedClassifications: readonly ('INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED')[];
  requireVerifiedProviderAccount: boolean;
  requireAuthenticatedWebhook: boolean;
  requireTrustedCertificateChain: boolean;
  requireFreshRevocationEvidence: boolean;
  requireTrustedTimestamp: boolean;
  requireComplianceWormStorage: boolean;
  minimumRetentionDays: number;
  probeMaxAgeSeconds: number;
  trustBundleId: string | null;
  configurationBinding: SignatureProviderPin | null;
}>;
export type SignatureProviderPolicyDraft = Readonly<{
  versionId: string;
  revision: number;
  rules: SignatureProviderPolicyRules;
  rulesSha256: string;
  originalMakerPersonPublicId: string;
  lastEditorPersonPublicId: string;
  createdAt: string;
}>;
export type SignatureProviderPolicyPublished = Readonly<{
  versionId: string;
  revision: number;
  rules: SignatureProviderPolicyRules;
  rulesSha256: string;
  originalMakerPersonPublicId: string;
  lastEditorPersonPublicId: string;
  checkerPersonPublicId: string;
  reviewEvidenceId: string;
  reviewContentSha256: string;
  publishedAt: string;
}>;
export type SignatureProviderPolicyHistoryItem = Readonly<{
  versionId: string;
  revision: number;
  state: 'DRAFT' | 'PUBLISHED';
  rules: SignatureProviderPolicyRules;
  rulesSha256: string;
  originalMakerPersonPublicId: string;
  lastEditorPersonPublicId: string;
  checkerPersonPublicId: string | null;
  reviewEvidenceId: string | null;
  reviewContentSha256: string | null;
  createdAt: string;
  publishedAt: string | null;
}>;
export type SignatureProviderPolicyHistory = Readonly<{
  scope: SignatureProviderScope;
  policyId: string;
  items: readonly SignatureProviderPolicyHistoryItem[];
  nextCursor: string | null;
  truncated: boolean;
}>;
export type SignatureProviderPolicyPublishReview = Readonly<{
  draftVersionId: string;
  policyVersion: number;
  draftRevision: number;
  reviewContentSha256: string;
  eligibility: (typeof SIGNATURE_GATE_STATES)[number];
  reasonCodes: readonly string[];
  stepUpRequired: true;
  validUntil: string | null;
}>;
export type SignatureProviderPolicyView = Readonly<{
  scope: SignatureProviderScope;
  policyId: string;
  version: number;
  workingDraft: SignatureProviderPolicyDraft | null;
  published: SignatureProviderPolicyPublished | null;
  publishReview: SignatureProviderPolicyPublishReview | null;
}>;
const ruleFields = [
  'signingEnabled',
  'requiredProviderKinds',
  'allowedClassifications',
  'requireVerifiedProviderAccount',
  'requireAuthenticatedWebhook',
  'requireTrustedCertificateChain',
  'requireFreshRevocationEvidence',
  'requireTrustedTimestamp',
  'requireComplianceWormStorage',
  'minimumRetentionDays',
  'probeMaxAgeSeconds',
  'trustBundleId',
  'configurationBinding',
];

export function readSignatureProviderPolicyRules(value: unknown): SignatureProviderPolicyRules {
  const v = diagnosticFields(value, ruleFields);
  const result = Object.freeze({
    signingEnabled: diagnosticBoolean(v.signingEnabled),
    requiredProviderKinds: diagnosticUnique(
      diagnosticList(
        v.requiredProviderKinds,
        (item) => diagnosticEnum(item, ['DOCUSIGN', 'ADOBE_SIGN', 'CUSTOM']),
        3
      )
    ),
    allowedClassifications: diagnosticUnique(
      diagnosticList(
        v.allowedClassifications,
        (item) => diagnosticEnum(item, ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']),
        3
      )
    ),
    requireVerifiedProviderAccount: diagnosticBoolean(v.requireVerifiedProviderAccount),
    requireAuthenticatedWebhook: diagnosticBoolean(v.requireAuthenticatedWebhook),
    requireTrustedCertificateChain: diagnosticBoolean(v.requireTrustedCertificateChain),
    requireFreshRevocationEvidence: diagnosticBoolean(v.requireFreshRevocationEvidence),
    requireTrustedTimestamp: diagnosticBoolean(v.requireTrustedTimestamp),
    requireComplianceWormStorage: diagnosticBoolean(v.requireComplianceWormStorage),
    minimumRetentionDays: diagnosticInteger(v.minimumRetentionDays, 1, 36_500),
    probeMaxAgeSeconds: diagnosticInteger(v.probeMaxAgeSeconds, 60, 86_400),
    trustBundleId: diagnosticNullable(v.trustBundleId, diagnosticId),
    configurationBinding: diagnosticNullable(v.configurationBinding, readSignatureProviderPin),
  });
  if (
    !result.requireVerifiedProviderAccount ||
    !result.requireAuthenticatedWebhook ||
    (result.signingEnabled &&
      (!result.requiredProviderKinds.length || !result.allowedClassifications.length))
  )
    invalidSignatureDiagnostics();
  return result;
}
export function assertSignatureProviderPolicyCompilable(rules: SignatureProviderPolicyRules): void {
  readSignatureProviderPolicyRules(rules);
  if (
    rules.signingEnabled &&
    (rules.configurationBinding === null ||
      ((rules.requireTrustedCertificateChain ||
        rules.requireFreshRevocationEvidence ||
        rules.requireTrustedTimestamp) &&
        rules.trustBundleId === null))
  )
    invalidSignatureDiagnostics();
}
export function readSignatureProviderPolicyDraft(value: unknown): SignatureProviderPolicyDraft {
  const v = diagnosticFields(value, [
    'versionId',
    'revision',
    'rules',
    'rulesSha256',
    'originalMakerPersonPublicId',
    'lastEditorPersonPublicId',
    'createdAt',
  ]);
  return Object.freeze({
    versionId: diagnosticId(v.versionId),
    revision: diagnosticInteger(v.revision),
    rules: readSignatureProviderPolicyRules(v.rules),
    rulesSha256: diagnosticSha(v.rulesSha256),
    originalMakerPersonPublicId: diagnosticId(v.originalMakerPersonPublicId),
    lastEditorPersonPublicId: diagnosticId(v.lastEditorPersonPublicId),
    createdAt: diagnosticInstant(v.createdAt),
  });
}
export function readSignatureProviderPolicyPublished(
  value: unknown
): SignatureProviderPolicyPublished {
  const v = diagnosticFields(value, [
    'versionId',
    'revision',
    'rules',
    'rulesSha256',
    'originalMakerPersonPublicId',
    'lastEditorPersonPublicId',
    'checkerPersonPublicId',
    'reviewEvidenceId',
    'reviewContentSha256',
    'publishedAt',
  ]);
  const result = Object.freeze({
    versionId: diagnosticId(v.versionId),
    revision: diagnosticInteger(v.revision),
    rules: readSignatureProviderPolicyRules(v.rules),
    rulesSha256: diagnosticSha(v.rulesSha256),
    originalMakerPersonPublicId: diagnosticId(v.originalMakerPersonPublicId),
    lastEditorPersonPublicId: diagnosticId(v.lastEditorPersonPublicId),
    checkerPersonPublicId: diagnosticId(v.checkerPersonPublicId),
    reviewEvidenceId: diagnosticId(v.reviewEvidenceId),
    reviewContentSha256: diagnosticSha(v.reviewContentSha256),
    publishedAt: diagnosticInstant(v.publishedAt),
  });
  if (
    result.checkerPersonPublicId === result.originalMakerPersonPublicId ||
    result.checkerPersonPublicId === result.lastEditorPersonPublicId
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderPolicyHistoryItem(
  value: unknown
): SignatureProviderPolicyHistoryItem {
  const v = diagnosticFields(value, [
    'versionId',
    'revision',
    'state',
    'rules',
    'rulesSha256',
    'originalMakerPersonPublicId',
    'lastEditorPersonPublicId',
    'checkerPersonPublicId',
    'reviewEvidenceId',
    'reviewContentSha256',
    'createdAt',
    'publishedAt',
  ]);
  const result = Object.freeze({
    versionId: diagnosticId(v.versionId),
    revision: diagnosticInteger(v.revision),
    state: diagnosticEnum(v.state, ['DRAFT', 'PUBLISHED']),
    rules: readSignatureProviderPolicyRules(v.rules),
    rulesSha256: diagnosticSha(v.rulesSha256),
    originalMakerPersonPublicId: diagnosticId(v.originalMakerPersonPublicId),
    lastEditorPersonPublicId: diagnosticId(v.lastEditorPersonPublicId),
    checkerPersonPublicId: diagnosticNullable(v.checkerPersonPublicId, diagnosticId),
    reviewEvidenceId: diagnosticNullable(v.reviewEvidenceId, diagnosticId),
    reviewContentSha256: diagnosticNullable(v.reviewContentSha256, diagnosticSha),
    createdAt: diagnosticInstant(v.createdAt),
    publishedAt: diagnosticNullable(v.publishedAt, diagnosticInstant),
  });
  if (result.state === 'PUBLISHED')
    readSignatureProviderPolicyPublished({
      versionId: result.versionId,
      revision: result.revision,
      rules: result.rules,
      rulesSha256: result.rulesSha256,
      originalMakerPersonPublicId: result.originalMakerPersonPublicId,
      lastEditorPersonPublicId: result.lastEditorPersonPublicId,
      checkerPersonPublicId: result.checkerPersonPublicId,
      reviewEvidenceId: result.reviewEvidenceId,
      reviewContentSha256: result.reviewContentSha256,
      publishedAt: result.publishedAt,
    });
  else if (
    result.checkerPersonPublicId !== null ||
    result.reviewEvidenceId !== null ||
    result.reviewContentSha256 !== null ||
    result.publishedAt !== null
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderPolicyHistory(value: unknown): SignatureProviderPolicyHistory {
  const v = diagnosticFields(value, ['scope', 'policyId', 'items', 'nextCursor', 'truncated']);
  const result = Object.freeze({
    scope: readSignatureProviderScope(v.scope),
    policyId: diagnosticId(v.policyId),
    items: diagnosticList(v.items, readSignatureProviderPolicyHistoryItem, 50),
    nextCursor: diagnosticNullable(v.nextCursor, (item) => diagnosticText(item, 4096)),
    truncated: diagnosticBoolean(v.truncated),
  });
  if (
    result.truncated !== (result.nextCursor !== null) ||
    result.items.some(
      (item, index) => index > 0 && item.revision >= result.items[index - 1].revision
    )
  )
    invalidSignatureDiagnostics();
  return result;
}

export function readSignatureProviderPolicyPublishReview(
  value: unknown
): SignatureProviderPolicyPublishReview {
  const v = diagnosticFields(value, [
    'draftVersionId',
    'policyVersion',
    'draftRevision',
    'reviewContentSha256',
    'eligibility',
    'reasonCodes',
    'stepUpRequired',
    'validUntil',
  ]);
  if (v.stepUpRequired !== true) invalidSignatureDiagnostics();
  const result = Object.freeze({
    draftVersionId: diagnosticId(v.draftVersionId),
    policyVersion: diagnosticInteger(v.policyVersion),
    draftRevision: diagnosticInteger(v.draftRevision),
    reviewContentSha256: diagnosticSha(v.reviewContentSha256),
    eligibility: diagnosticEnum(v.eligibility, SIGNATURE_GATE_STATES),
    reasonCodes: diagnosticReasons(v.reasonCodes),
    stepUpRequired: true as const,
    validUntil: diagnosticNullable(v.validUntil, diagnosticInstant),
  });
  if (
    result.eligibility === 'ELIGIBLE'
      ? result.validUntil === null || result.reasonCodes.length !== 0
      : result.reasonCodes.length === 0
  )
    invalidSignatureDiagnostics();
  return result;
}
export function readSignatureProviderPolicyView(value: unknown): SignatureProviderPolicyView {
  const v = diagnosticFields(value, [
    'scope',
    'policyId',
    'version',
    'workingDraft',
    'published',
    'publishReview',
  ]);
  const result = Object.freeze({
    scope: readSignatureProviderScope(v.scope),
    policyId: diagnosticId(v.policyId),
    version: diagnosticInteger(v.version),
    workingDraft: diagnosticNullable(v.workingDraft, readSignatureProviderPolicyDraft),
    published: diagnosticNullable(v.published, readSignatureProviderPolicyPublished),
    publishReview: diagnosticNullable(v.publishReview, readSignatureProviderPolicyPublishReview),
  });
  if (
    (result.workingDraft === null && result.published === null) ||
    (result.workingDraft !== null &&
      result.published !== null &&
      result.workingDraft.versionId === result.published.versionId) ||
    (result.publishReview !== null &&
      (result.workingDraft === null ||
        result.publishReview.policyVersion !== result.version ||
        result.publishReview.draftVersionId !== result.workingDraft.versionId ||
        result.publishReview.draftRevision !== result.workingDraft.revision))
  )
    invalidSignatureDiagnostics();
  return result;
}
