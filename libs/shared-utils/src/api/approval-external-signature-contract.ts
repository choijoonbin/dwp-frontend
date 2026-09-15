import {
  readSignatureProviderCard,
  readSignatureProviderPin,
  readSignatureProviderPolicySource,
  readSignatureProviderScope,
  type SignatureProviderCard,
  type SignatureProviderPin,
  type SignatureProviderPolicySource,
  type SignatureProviderScope,
} from './approval-signature-diagnostics-contract';
import {
  diagnosticFields,
  diagnosticId,
  diagnosticInstant,
  diagnosticInteger,
  diagnosticKey,
  diagnosticList,
  diagnosticNullable,
  diagnosticReasons,
  diagnosticSha,
  diagnosticText,
  invalidSignatureDiagnostics,
} from './approval-signature-diagnostics-primitives';

export const APPROVAL_EXTERNAL_SIGNATURE_STATES = [
  'PREPARED',
  'HANDOVER_PENDING',
  'OUT_FOR_SIGNATURE',
  'COMPLETION_PENDING',
  'COMPLETED_VERIFIED',
  'CANCEL_PENDING',
  'CANCELLED',
  'FAILED',
  'UNKNOWN_REMOTE_OUTCOME',
] as const;

export const APPROVAL_EXTERNAL_SIGNATURE_ARTIFACT_KINDS = [
  'UNSIGNED_PDF',
  'SIGNED_PDF',
  'CERTIFICATE',
  'AUDIT_TRAIL',
  'TSA',
] as const;

export type ApprovalExternalSignatureProviderTarget = Readonly<{
  providerId: string;
  expectedProviderVersion: number;
  expectedProviderSha256: string;
  expectedConfiguration: SignatureProviderPin | null;
}>;
export type ApprovalExternalSignatureSource = Readonly<{
  requestId: string;
  requestVersion: number;
  resourceSetKey: string;
  dataClassification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  workflowVersionId: string;
  formVersionId: string;
  payloadRevision: number;
  payloadSha256: string;
  sourceSha256: string;
}>;
export type ApprovalExternalSignatureContext = Readonly<{
  scope: SignatureProviderScope;
  source: ApprovalExternalSignatureSource;
  policy: SignatureProviderPolicySource;
  providers: readonly SignatureProviderCard[];
  gateState: 'NOT_EVALUATED' | 'BLOCKED' | 'ELIGIBLE';
  reasonCodes: readonly string[];
  evaluatedAt: string;
}>;
export type ApprovalExternalSignatureCreateInput = Readonly<{
  expectedRequestVersion: number;
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  provider: ApprovalExternalSignatureProviderTarget;
  idempotencyKey: string;
}>;
export type ApprovalExternalSignatureCommandInput = Readonly<{
  expectedVersion: number;
  expectedSourceRevision: string;
  expectedSourceSha256: string;
  idempotencyKey: string;
}>;
export type ApprovalExternalSignatureRequest = Readonly<{
  scope: SignatureProviderScope;
  signatureRequestId: string;
  source: ApprovalExternalSignatureSource;
  provider: ApprovalExternalSignatureProviderTarget;
  policyId: string;
  policyVersionId: string;
  policySha256: string;
  state: (typeof APPROVAL_EXTERNAL_SIGNATURE_STATES)[number];
  version: number;
  remoteReferenceSha256: string | null;
  reasonCodes: readonly string[];
  createdAt: string;
  updatedAt: string;
}>;
export type ApprovalExternalSignatureReceipt = Readonly<{
  receiptId: string;
  outcome: 'COMMITTED';
  committedAt: string;
  signatureRequest: ApprovalExternalSignatureRequest;
}>;
export type ApprovalExternalSignatureEvent = Readonly<{
  eventId: string;
  sequence: number;
  action: string;
  state: (typeof APPROVAL_EXTERNAL_SIGNATURE_STATES)[number];
  reasonCodes: readonly string[];
  evidenceId: string | null;
  evidenceSha256: string | null;
  occurredAt: string;
}>;
export type ApprovalExternalSignatureAudit = Readonly<{
  items: readonly ApprovalExternalSignatureEvent[];
  truncated: boolean;
}>;
export type ApprovalExternalSignatureArtifact = Readonly<{
  artifactId: string;
  kind: (typeof APPROVAL_EXTERNAL_SIGNATURE_ARTIFACT_KINDS)[number];
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  storageLocatorSha256: string;
  objectVersionSha256: string;
  retainUntil: string;
  evidenceId: string;
  evidenceSha256: string;
  recordedAt: string;
}>;

const enumValue = <const T extends readonly string[]>(value: unknown, values: T): T[number] => {
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) invalidSignatureDiagnostics();
  return found;
};

function sourcePin(revision: unknown, digest: unknown) {
  const sha = diagnosticSha(digest);
  if (revision !== `sigp-${sha}`) invalidSignatureDiagnostics();
  return { revision: revision as string, sha };
}

export function readApprovalExternalSignatureProviderTarget(
  value: unknown
): ApprovalExternalSignatureProviderTarget {
  const fields = diagnosticFields(value, [
    'providerId',
    'expectedProviderVersion',
    'expectedProviderSha256',
    'expectedConfiguration',
  ]);
  return Object.freeze({
    providerId: diagnosticId(fields.providerId),
    expectedProviderVersion: diagnosticInteger(fields.expectedProviderVersion),
    expectedProviderSha256: diagnosticSha(fields.expectedProviderSha256),
    expectedConfiguration: diagnosticNullable(
      fields.expectedConfiguration,
      readSignatureProviderPin
    ),
  });
}

export function readApprovalExternalSignatureSource(
  value: unknown
): ApprovalExternalSignatureSource {
  const fields = diagnosticFields(value, [
    'requestId',
    'requestVersion',
    'resourceSetKey',
    'dataClassification',
    'workflowVersionId',
    'formVersionId',
    'payloadRevision',
    'payloadSha256',
    'sourceSha256',
  ]);
  const resourceSetKey = diagnosticText(fields.resourceSetKey, 80);
  if (!/^RS_[A-Z0-9_]{1,76}$/.test(resourceSetKey)) invalidSignatureDiagnostics();
  return Object.freeze({
    requestId: diagnosticId(fields.requestId),
    requestVersion: diagnosticInteger(fields.requestVersion),
    resourceSetKey,
    dataClassification: enumValue(fields.dataClassification, [
      'INTERNAL',
      'CONFIDENTIAL',
      'RESTRICTED',
    ]),
    workflowVersionId: diagnosticId(fields.workflowVersionId),
    formVersionId: diagnosticId(fields.formVersionId),
    payloadRevision: diagnosticInteger(fields.payloadRevision, 1),
    payloadSha256: diagnosticSha(fields.payloadSha256),
    sourceSha256: diagnosticSha(fields.sourceSha256),
  });
}

export function readApprovalExternalSignatureContext(
  value: unknown
): ApprovalExternalSignatureContext {
  const fields = diagnosticFields(value, [
    'scope',
    'source',
    'policy',
    'providers',
    'gateState',
    'reasonCodes',
    'evaluatedAt',
  ]);
  const result = Object.freeze({
    scope: readSignatureProviderScope(fields.scope),
    source: readApprovalExternalSignatureSource(fields.source),
    policy: readSignatureProviderPolicySource(fields.policy),
    providers: diagnosticList(fields.providers, readSignatureProviderCard, 10),
    gateState: enumValue(fields.gateState, ['NOT_EVALUATED', 'BLOCKED', 'ELIGIBLE']),
    reasonCodes: diagnosticReasons(fields.reasonCodes),
    evaluatedAt: diagnosticInstant(fields.evaluatedAt),
  });
  const eligible =
    result.policy.sourceState === 'AVAILABLE' &&
    Boolean(result.policy.requiredProviderKinds?.length) &&
    result.reasonCodes.length === 0;
  if (result.gateState === 'ELIGIBLE' ? !eligible : result.reasonCodes.length === 0)
    invalidSignatureDiagnostics();
  return result;
}

export function readApprovalExternalSignatureRequest(
  value: unknown
): ApprovalExternalSignatureRequest {
  const fields = diagnosticFields(value, [
    'scope',
    'signatureRequestId',
    'source',
    'provider',
    'policyId',
    'policyVersionId',
    'policySha256',
    'state',
    'version',
    'remoteReferenceSha256',
    'reasonCodes',
    'createdAt',
    'updatedAt',
  ]);
  const state = enumValue(fields.state, APPROVAL_EXTERNAL_SIGNATURE_STATES);
  const createdAt = diagnosticInstant(fields.createdAt);
  const updatedAt = diagnosticInstant(fields.updatedAt);
  const remoteReferenceSha256 = diagnosticNullable(fields.remoteReferenceSha256, diagnosticSha);
  if (
    Date.parse(updatedAt) < Date.parse(createdAt) ||
    (state === 'COMPLETED_VERIFIED' && remoteReferenceSha256 === null)
  )
    invalidSignatureDiagnostics();
  return Object.freeze({
    scope: readSignatureProviderScope(fields.scope),
    signatureRequestId: diagnosticId(fields.signatureRequestId),
    source: readApprovalExternalSignatureSource(fields.source),
    provider: readApprovalExternalSignatureProviderTarget(fields.provider),
    policyId: diagnosticId(fields.policyId),
    policyVersionId: diagnosticId(fields.policyVersionId),
    policySha256: diagnosticSha(fields.policySha256),
    state,
    version: diagnosticInteger(fields.version),
    remoteReferenceSha256,
    reasonCodes: diagnosticReasons(fields.reasonCodes),
    createdAt,
    updatedAt,
  });
}

export function readApprovalExternalSignatureReceipt(
  value: unknown
): ApprovalExternalSignatureReceipt {
  const fields = diagnosticFields(value, [
    'receiptId',
    'outcome',
    'committedAt',
    'signatureRequest',
  ]);
  if (fields.outcome !== 'COMMITTED') invalidSignatureDiagnostics();
  return Object.freeze({
    receiptId: diagnosticId(fields.receiptId),
    outcome: 'COMMITTED',
    committedAt: diagnosticInstant(fields.committedAt),
    signatureRequest: readApprovalExternalSignatureRequest(fields.signatureRequest),
  });
}

export function readApprovalExternalSignatureAudit(value: unknown): ApprovalExternalSignatureAudit {
  const fields = diagnosticFields(value, ['items', 'truncated']);
  return Object.freeze({
    items: diagnosticList(
      fields.items,
      (entry) => {
        const event = diagnosticFields(entry, [
          'eventId',
          'sequence',
          'action',
          'state',
          'reasonCodes',
          'evidenceId',
          'evidenceSha256',
          'occurredAt',
        ]);
        const evidenceId = diagnosticNullable(event.evidenceId, diagnosticId);
        const evidenceSha256 = diagnosticNullable(event.evidenceSha256, diagnosticSha);
        if ((evidenceId === null) !== (evidenceSha256 === null)) invalidSignatureDiagnostics();
        return Object.freeze({
          eventId: diagnosticId(event.eventId),
          sequence: diagnosticInteger(event.sequence),
          action: diagnosticKey(event.action),
          state: enumValue(event.state, APPROVAL_EXTERNAL_SIGNATURE_STATES),
          reasonCodes: diagnosticReasons(event.reasonCodes),
          evidenceId,
          evidenceSha256,
          occurredAt: diagnosticInstant(event.occurredAt),
        });
      },
      1_000
    ),
    truncated:
      typeof fields.truncated === 'boolean' ? fields.truncated : invalidSignatureDiagnostics(),
  });
}

export function readApprovalExternalSignatureArtifact(
  value: unknown
): ApprovalExternalSignatureArtifact {
  const fields = diagnosticFields(value, [
    'artifactId',
    'kind',
    'mediaType',
    'sha256',
    'sizeBytes',
    'storageLocatorSha256',
    'objectVersionSha256',
    'retainUntil',
    'evidenceId',
    'evidenceSha256',
    'recordedAt',
  ]);
  const retainUntil = diagnosticInstant(fields.retainUntil);
  const recordedAt = diagnosticInstant(fields.recordedAt);
  if (Date.parse(retainUntil) <= Date.parse(recordedAt)) invalidSignatureDiagnostics();
  return Object.freeze({
    artifactId: diagnosticId(fields.artifactId),
    kind: enumValue(fields.kind, APPROVAL_EXTERNAL_SIGNATURE_ARTIFACT_KINDS),
    mediaType: diagnosticText(fields.mediaType, 120),
    sha256: diagnosticSha(fields.sha256),
    sizeBytes: diagnosticInteger(fields.sizeBytes, 1, 52_428_800),
    storageLocatorSha256: diagnosticSha(fields.storageLocatorSha256),
    objectVersionSha256: diagnosticSha(fields.objectVersionSha256),
    retainUntil,
    evidenceId: diagnosticId(fields.evidenceId),
    evidenceSha256: diagnosticSha(fields.evidenceSha256),
    recordedAt,
  });
}

export function snapshotApprovalExternalSignatureCreateInput(
  value: ApprovalExternalSignatureCreateInput
): ApprovalExternalSignatureCreateInput {
  const fields = diagnosticFields(value, [
    'expectedRequestVersion',
    'expectedSourceRevision',
    'expectedSourceSha256',
    'provider',
    'idempotencyKey',
  ]);
  const pin = sourcePin(fields.expectedSourceRevision, fields.expectedSourceSha256);
  return Object.freeze({
    expectedRequestVersion: diagnosticInteger(fields.expectedRequestVersion),
    expectedSourceRevision: pin.revision,
    expectedSourceSha256: pin.sha,
    provider: readApprovalExternalSignatureProviderTarget(fields.provider),
    idempotencyKey: diagnosticKey(fields.idempotencyKey),
  });
}

export function snapshotApprovalExternalSignatureCommandInput(
  value: ApprovalExternalSignatureCommandInput
): ApprovalExternalSignatureCommandInput {
  const fields = diagnosticFields(value, [
    'expectedVersion',
    'expectedSourceRevision',
    'expectedSourceSha256',
    'idempotencyKey',
  ]);
  const pin = sourcePin(fields.expectedSourceRevision, fields.expectedSourceSha256);
  return Object.freeze({
    expectedVersion: diagnosticInteger(fields.expectedVersion),
    expectedSourceRevision: pin.revision,
    expectedSourceSha256: pin.sha,
    idempotencyKey: diagnosticKey(fields.idempotencyKey),
  });
}
