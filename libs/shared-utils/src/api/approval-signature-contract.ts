export type ApprovalSignatureState = 'AWAITING_CONSENT' | 'CONSENTED' | 'ATTESTED' | 'CANCELLED';
export type ApprovalSignatureOperation = 'CREATE' | 'CONSENT' | 'SIGN' | 'CANCEL';
export type ApprovalSignatureSource = Readonly<{
  requestId: string;
  requestVersion: number;
  payloadRevision: number;
  payloadSha256: string;
  formVersionId: string;
  formSchemaSha256: string;
  workflowVersionId: string;
  workflowSha256: string;
  resourceSetKey: string;
  manifestSha256: string;
  documentPolicyId: string;
  documentPolicyVersion: number;
  documentPolicyRevision: number;
  documentPolicySha256: string;
  attachmentPolicyId: string;
  attachmentPolicyVersion: number;
  attachmentPolicyRevision: number;
  attachmentPolicySha256: string;
  providerId: string;
  providerVersion: number;
  providerSha256: string;
  ownerUserId: number;
  rendererVersion: string;
  artifactSha256: string;
  signingKeySha256: string | null;
}>;
export type ApprovalSignatureTerms = Readonly<{
  termsId: string;
  version: number;
  sha256: string;
  locale: 'ko' | 'en';
  text: string;
  expiresAt: string;
}>;
export type ApprovalSignatureArtifact = Readonly<{
  rendererVersion: string;
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  content: string;
}>;
export type ApprovalSignatureContext = Readonly<{
  signerKind: 'SELF_ATTESTATION';
  source: ApprovalSignatureSource;
  sourceDigest: string;
  artifact: ApprovalSignatureArtifact;
  terms: ApprovalSignatureTerms;
  signingReadiness: 'NOT_VERIFIED' | 'VERIFIED_INTERNAL_KEY';
  consentRequired: true;
  evaluatedAt: string;
}>;
export type ApprovalSignatureEvidence = Readonly<{
  evidenceId: string;
  proofKind: 'SELF_ATTESTATION';
  keyId: string;
  publicKeyJson: string;
  artifactSha256: string;
  sourceDigest: string;
  compactJws: string;
  attestedAt: string;
}>;
export type ApprovalSignatureCeremony = Readonly<{
  signatureRequestId: string;
  requestId: string;
  signerKind: 'SELF_ATTESTATION';
  state: ApprovalSignatureState;
  version: number;
  source: ApprovalSignatureSource;
  sourceDigest: string;
  artifact: ApprovalSignatureArtifact;
  terms: ApprovalSignatureTerms;
  expiresAt: string;
  consentReceiptId: string | null;
  evidence: ApprovalSignatureEvidence | null;
  preservationState: 'NOT_WORM_VERIFIED';
}>;
export type ApprovalSignatureReceipt = Readonly<{
  commandReceiptId: string;
  outcome: string;
  committedAt: string;
  ceremony: ApprovalSignatureCeremony;
}>;
export type ApprovalSignatureEvent = Readonly<{
  eventId: string;
  sequence: number;
  action: string;
  sourceDigest: string;
  occurredAt: string;
}>;
export type ApprovalSignatureAudit = Readonly<{
  items: readonly ApprovalSignatureEvent[];
  truncated: boolean;
}>;
export type ApprovalSignatureCommandReceipt = Readonly<{
  receiptId: string;
  originalOperation: ApprovalSignatureOperation;
  requestId: string;
  signatureRequestId: string;
  committedAt: string;
  eventSequence: number;
  resultState: ApprovalSignatureState;
  resultVersion: number;
  sourceCurrent: boolean;
}>;
export type ApprovalSignatureCreateInput = Readonly<{
  expectedVersion: number;
  signerKind: 'SELF_ATTESTATION';
  locale: 'ko' | 'en';
  sourceDigest: string;
  idempotencyKey: string;
}>;
export type ApprovalSignatureConsentInput = Readonly<{
  expectedVersion: number;
  sourceDigest: string;
  termsId: string;
  termsVersion: number;
  termsSha256: string;
  locale: 'ko' | 'en';
  accepted: boolean;
  idempotencyKey: string;
}>;
export type ApprovalSignatureSignInput = Readonly<{
  expectedVersion: number;
  sourceDigest: string;
  consentReceiptId: string;
  idempotencyKey: string;
}>;
export type ApprovalSignatureCancelInput = Readonly<{
  expectedVersion: number;
  sourceDigest: string;
  idempotencyKey: string;
}>;

export const APPROVAL_SIGNATURE_BINDINGS = {
  'signature-context.data': ['GET', '/api/approvals/v1/requests/{requestId}/signature-context'],
  'signature-request-create.action': [
    'POST',
    '/api/approvals/v1/requests/{requestId}/signature-requests',
  ],
  'signature-request.data': ['GET', '/api/approvals/v1/signature-requests/{signatureRequestId}'],
  'signature-consent.action': [
    'POST',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/consents',
  ],
  'signature-sign.action': [
    'POST',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/sign',
  ],
  'signature-cancel.action': [
    'POST',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/cancel',
  ],
  'signature-audit.data': [
    'GET',
    '/api/approvals/v1/signature-requests/{signatureRequestId}/audit',
  ],
  'signature-command-receipt.data': [
    'GET',
    '/api/approvals/v1/signature-command-receipts/{idempotencyKey}',
  ],
} as const;

export function invalidApprovalSignature(): never {
  throw new Error('Invalid approval signature source or command');
}
export function signatureFields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  )
    invalidApprovalSignature();
  return value as Record<string, unknown>;
}
export function signatureText(value: unknown, max = 500): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    })
  )
    invalidApprovalSignature();
  return value;
}
export function signatureId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
  )
    invalidApprovalSignature();
  return value;
}
export function signatureSha(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) invalidApprovalSignature();
  return value;
}
export function signatureVersion(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    invalidApprovalSignature();
  return value;
}
export function signatureInstant(value: unknown): string {
  const text = signatureText(value, 100);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || !Number.isFinite(Date.parse(text)))
    invalidApprovalSignature();
  return text;
}
export function signatureKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(value))
    invalidApprovalSignature();
  return value;
}
export function signatureLocale(value: unknown): 'ko' | 'en' {
  if (value !== 'ko' && value !== 'en') invalidApprovalSignature();
  return value;
}
export function signatureState(value: unknown): ApprovalSignatureState {
  if (
    value !== 'AWAITING_CONSENT' &&
    value !== 'CONSENTED' &&
    value !== 'ATTESTED' &&
    value !== 'CANCELLED'
  )
    invalidApprovalSignature();
  return value;
}
export function signatureOperation(value: unknown): ApprovalSignatureOperation {
  if (value !== 'CREATE' && value !== 'CONSENT' && value !== 'SIGN' && value !== 'CANCEL')
    invalidApprovalSignature();
  return value;
}
export function readApprovalSignatureSource(value: unknown): ApprovalSignatureSource {
  const data = signatureFields(value, [
    'requestId',
    'requestVersion',
    'payloadRevision',
    'payloadSha256',
    'formVersionId',
    'formSchemaSha256',
    'workflowVersionId',
    'workflowSha256',
    'resourceSetKey',
    'manifestSha256',
    'documentPolicyId',
    'documentPolicyVersion',
    'documentPolicyRevision',
    'documentPolicySha256',
    'attachmentPolicyId',
    'attachmentPolicyVersion',
    'attachmentPolicyRevision',
    'attachmentPolicySha256',
    'providerId',
    'providerVersion',
    'providerSha256',
    'ownerUserId',
    'rendererVersion',
    'artifactSha256',
    'signingKeySha256',
  ]);
  return Object.freeze({
    requestId: signatureId(data.requestId),
    requestVersion: signatureVersion(data.requestVersion),
    payloadRevision: signatureVersion(data.payloadRevision, 1, 2147483647),
    payloadSha256: signatureSha(data.payloadSha256),
    formVersionId: signatureId(data.formVersionId),
    formSchemaSha256: signatureSha(data.formSchemaSha256),
    workflowVersionId: signatureId(data.workflowVersionId),
    workflowSha256: signatureSha(data.workflowSha256),
    resourceSetKey: signatureText(data.resourceSetKey),
    manifestSha256: signatureSha(data.manifestSha256),
    documentPolicyId: signatureId(data.documentPolicyId),
    documentPolicyVersion: signatureVersion(data.documentPolicyVersion),
    documentPolicyRevision: signatureVersion(data.documentPolicyRevision, 0, 2147483647),
    documentPolicySha256: signatureSha(data.documentPolicySha256),
    attachmentPolicyId: signatureId(data.attachmentPolicyId),
    attachmentPolicyVersion: signatureVersion(data.attachmentPolicyVersion),
    attachmentPolicyRevision: signatureVersion(data.attachmentPolicyRevision, 0, 2147483647),
    attachmentPolicySha256: signatureSha(data.attachmentPolicySha256),
    providerId: signatureId(data.providerId),
    providerVersion: signatureVersion(data.providerVersion),
    providerSha256: signatureSha(data.providerSha256),
    ownerUserId: signatureVersion(data.ownerUserId, 1),
    rendererVersion: signatureText(data.rendererVersion, 100),
    artifactSha256: signatureSha(data.artifactSha256),
    signingKeySha256: data.signingKeySha256 === null ? null : signatureSha(data.signingKeySha256),
  });
}
export function readApprovalSignatureTerms(value: unknown): ApprovalSignatureTerms {
  const data = signatureFields(value, [
    'termsId',
    'version',
    'sha256',
    'locale',
    'text',
    'expiresAt',
  ]);
  return Object.freeze({
    termsId: signatureText(data.termsId, 80),
    version: signatureVersion(data.version, 1),
    sha256: signatureSha(data.sha256),
    locale: signatureLocale(data.locale),
    text: signatureText(data.text, 16000),
    expiresAt: signatureInstant(data.expiresAt),
  });
}
export function readApprovalSignatureArtifact(value: unknown): ApprovalSignatureArtifact {
  const data = signatureFields(value, [
    'rendererVersion',
    'mediaType',
    'sha256',
    'sizeBytes',
    'content',
  ]);
  if (data.mediaType !== 'application/json') invalidApprovalSignature();
  const content = signatureText(data.content, 5242880),
    sizeBytes = signatureVersion(data.sizeBytes, 1, 5242880);
  if (new TextEncoder().encode(content).byteLength !== sizeBytes) invalidApprovalSignature();
  return Object.freeze({
    rendererVersion: signatureText(data.rendererVersion, 100),
    mediaType: data.mediaType,
    sha256: signatureSha(data.sha256),
    sizeBytes,
    content,
  });
}
export function readApprovalSignatureEvidence(value: unknown): ApprovalSignatureEvidence {
  const data = signatureFields(value, [
    'evidenceId',
    'proofKind',
    'keyId',
    'publicKeyJson',
    'artifactSha256',
    'sourceDigest',
    'compactJws',
    'attestedAt',
  ]);
  if (data.proofKind !== 'SELF_ATTESTATION') invalidApprovalSignature();
  const keyId = signatureText(data.keyId, 200),
    compactJws = signatureText(data.compactJws, 32768);
  if (
    !keyId.startsWith('approval-self-attestation:') ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(compactJws)
  )
    invalidApprovalSignature();
  return Object.freeze({
    evidenceId: signatureId(data.evidenceId),
    proofKind: data.proofKind,
    keyId,
    publicKeyJson: signatureText(data.publicKeyJson, 16000),
    artifactSha256: signatureSha(data.artifactSha256),
    sourceDigest: signatureSha(data.sourceDigest),
    compactJws,
    attestedAt: signatureInstant(data.attestedAt),
  });
}
export function readApprovalSignatureContext(
  value: unknown,
  requestId?: string,
  resourceSetKey?: string
): ApprovalSignatureContext {
  const data = signatureFields(value, [
    'signerKind',
    'source',
    'sourceDigest',
    'artifact',
    'terms',
    'signingReadiness',
    'consentRequired',
    'evaluatedAt',
  ]);
  if (
    data.signerKind !== 'SELF_ATTESTATION' ||
    data.consentRequired !== true ||
    (data.signingReadiness !== 'NOT_VERIFIED' && data.signingReadiness !== 'VERIFIED_INTERNAL_KEY')
  )
    invalidApprovalSignature();
  const source = readApprovalSignatureSource(data.source),
    artifact = readApprovalSignatureArtifact(data.artifact);
  checkSource(source, artifact, requestId, resourceSetKey);
  if ((source.signingKeySha256 === null) !== (data.signingReadiness === 'NOT_VERIFIED'))
    invalidApprovalSignature();
  return Object.freeze({
    signerKind: data.signerKind,
    source,
    sourceDigest: signatureSha(data.sourceDigest),
    artifact,
    terms: readApprovalSignatureTerms(data.terms),
    signingReadiness: data.signingReadiness,
    consentRequired: data.consentRequired,
    evaluatedAt: signatureInstant(data.evaluatedAt),
  });
}
function checkSource(
  source: ApprovalSignatureSource,
  artifact: ApprovalSignatureArtifact,
  requestId?: string,
  resourceSetKey?: string
) {
  if (
    (requestId !== undefined && source.requestId !== signatureId(requestId)) ||
    (resourceSetKey !== undefined && source.resourceSetKey !== resourceSetKey) ||
    artifact.sha256 !== source.artifactSha256 ||
    artifact.rendererVersion !== source.rendererVersion
  )
    invalidApprovalSignature();
}
export function readApprovalSignatureCeremony(
  value: unknown,
  expected: { requestId?: string; signatureRequestId?: string; resourceSetKey?: string } = {}
): ApprovalSignatureCeremony {
  const data = signatureFields(value, [
    'signatureRequestId',
    'requestId',
    'signerKind',
    'state',
    'version',
    'source',
    'sourceDigest',
    'artifact',
    'terms',
    'expiresAt',
    'consentReceiptId',
    'evidence',
    'preservationState',
  ]);
  if (data.signerKind !== 'SELF_ATTESTATION' || data.preservationState !== 'NOT_WORM_VERIFIED')
    invalidApprovalSignature();
  const source = readApprovalSignatureSource(data.source),
    artifact = readApprovalSignatureArtifact(data.artifact);
  const requestId = signatureId(data.requestId),
    signatureRequestId = signatureId(data.signatureRequestId),
    state = signatureState(data.state);
  checkSource(source, artifact, expected.requestId ?? requestId, expected.resourceSetKey);
  if (
    source.requestId !== requestId ||
    (expected.signatureRequestId !== undefined &&
      signatureRequestId !== signatureId(expected.signatureRequestId))
  )
    invalidApprovalSignature();
  const consentReceiptId =
    data.consentReceiptId === null ? null : signatureId(data.consentReceiptId);
  const evidence = data.evidence === null ? null : readApprovalSignatureEvidence(data.evidence);
  const sourceDigest = signatureSha(data.sourceDigest);
  if (
    (state === 'ATTESTED') !== (evidence !== null) ||
    ((state === 'CONSENTED' || state === 'ATTESTED') && consentReceiptId === null) ||
    (state === 'AWAITING_CONSENT' && consentReceiptId !== null) ||
    (evidence &&
      (evidence.sourceDigest !== sourceDigest || evidence.artifactSha256 !== artifact.sha256))
  )
    invalidApprovalSignature();
  return Object.freeze({
    signatureRequestId,
    requestId,
    signerKind: data.signerKind,
    state,
    version: signatureVersion(data.version),
    source,
    sourceDigest,
    artifact,
    terms: readApprovalSignatureTerms(data.terms),
    expiresAt: signatureInstant(data.expiresAt),
    consentReceiptId,
    evidence,
    preservationState: data.preservationState,
  });
}
export function readApprovalSignatureReceipt(
  value: unknown,
  expected: Parameters<typeof readApprovalSignatureCeremony>[1] = {}
): ApprovalSignatureReceipt {
  const data = signatureFields(value, ['commandReceiptId', 'outcome', 'committedAt', 'ceremony']);
  if (data.outcome !== 'COMMITTED') invalidApprovalSignature();
  return Object.freeze({
    commandReceiptId: signatureId(data.commandReceiptId),
    outcome: signatureText(data.outcome, 100),
    committedAt: signatureInstant(data.committedAt),
    ceremony: readApprovalSignatureCeremony(data.ceremony, expected),
  });
}
export function readApprovalSignatureAudit(value: unknown): ApprovalSignatureAudit {
  const data = signatureFields(value, ['items', 'truncated']);
  if (!Array.isArray(data.items) || data.items.length > 1000 || typeof data.truncated !== 'boolean')
    invalidApprovalSignature();
  const ids = new Set<string>();
  let previous = -1;
  const items = data.items.map((value): ApprovalSignatureEvent => {
    const row = signatureFields(value, [
      'eventId',
      'sequence',
      'action',
      'sourceDigest',
      'occurredAt',
    ]);
    const eventId = signatureId(row.eventId),
      sequence = signatureVersion(row.sequence, 1);
    if (ids.has(eventId) || sequence <= previous) invalidApprovalSignature();
    ids.add(eventId);
    previous = sequence;
    return Object.freeze({
      eventId,
      sequence,
      action: signatureText(row.action, 100),
      sourceDigest: signatureSha(row.sourceDigest),
      occurredAt: signatureInstant(row.occurredAt),
    });
  });
  return Object.freeze({ items: Object.freeze(items), truncated: data.truncated });
}
export function readApprovalSignatureCommandReceipt(
  value: unknown,
  expected: { originalOperation: ApprovalSignatureOperation; targetId: string; requestId?: string }
): ApprovalSignatureCommandReceipt {
  const data = signatureFields(value, [
    'receiptId',
    'originalOperation',
    'requestId',
    'signatureRequestId',
    'committedAt',
    'eventSequence',
    'resultState',
    'resultVersion',
    'sourceCurrent',
  ]);
  const originalOperation = signatureOperation(data.originalOperation),
    requestId = signatureId(data.requestId),
    signatureRequestId = signatureId(data.signatureRequestId);
  if (
    originalOperation !== expected.originalOperation ||
    (originalOperation === 'CREATE' ? requestId : signatureRequestId) !==
      signatureId(expected.targetId) ||
    (expected.requestId !== undefined && requestId !== signatureId(expected.requestId)) ||
    typeof data.sourceCurrent !== 'boolean'
  )
    invalidApprovalSignature();
  return Object.freeze({
    receiptId: signatureId(data.receiptId),
    originalOperation,
    requestId,
    signatureRequestId,
    committedAt: signatureInstant(data.committedAt),
    eventSequence: signatureVersion(data.eventSequence, 1),
    resultState: signatureState(data.resultState),
    resultVersion: signatureVersion(data.resultVersion),
    sourceCurrent: data.sourceCurrent,
  });
}
