import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { approvalSignatureCanonicalJson } from '../../libs/shared-utils/src/api/approval-signature-verification';
import type {
  ApprovalSignatureCeremony,
  ApprovalSignatureContext,
  ApprovalSignatureReceipt,
} from '../../libs/shared-utils/src/api/approval-signature-contract';
import { approvalDocumentRequestId } from './approval-request-document-fixtures';

export const signatureRequestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const signatureConsentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const exported = pair.publicKey.export({ format: 'jwk' });
const kid = 'approval-self-attestation:ui-fixture';
const publicKey = { kty: 'RSA', n: exported.n, e: exported.e, kid, use: 'sig', alg: 'RS256' };
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

// Real cryptographic evidence over fixture data, not an Auth issuer or runtime activation proof.
export function approvalSignatureContextFixture(): ApprovalSignatureContext {
  const content =
    '{"amount":"1234567890123456789012345678.9","summary":"Approved original document"}';
  const artifactSha256 = sha(content);
  const source = {
    requestId: approvalDocumentRequestId,
    requestVersion: 3,
    payloadRevision: 1,
    payloadSha256: 'a'.repeat(64),
    formVersionId: approvalDocumentRequestId,
    formSchemaSha256: 'b'.repeat(64),
    workflowVersionId: approvalDocumentRequestId,
    workflowSha256: 'c'.repeat(64),
    resourceSetKey: 'RS_DOC_CONTROL',
    manifestSha256: 'd'.repeat(64),
    documentPolicyId: approvalDocumentRequestId,
    documentPolicyVersion: 2,
    documentPolicyRevision: 2,
    documentPolicySha256: 'e'.repeat(64),
    attachmentPolicyId: approvalDocumentRequestId,
    attachmentPolicyVersion: 1,
    attachmentPolicyRevision: 1,
    attachmentPolicySha256: 'f'.repeat(64),
    providerId: approvalDocumentRequestId,
    providerVersion: 1,
    providerSha256: 'a'.repeat(64),
    ownerUserId: 1,
    rendererVersion: 'finalized-v1',
    artifactSha256,
    signingKeySha256: sha(
      approvalSignatureCanonicalJson({ kty: 'RSA', n: exported.n, e: exported.e })
    ),
  };
  const text =
    '원본 문서를 검토하고 본인 확인에 동의합니다. 내부 본인 확인 서명이며 외부 공인 전자서명이 아닙니다.';
  const terms = {
    termsId: 'SELF_ATTESTATION_TERMS',
    version: 1,
    sha256: sha(text),
    locale: 'ko' as const,
    text,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
  return {
    signerKind: 'SELF_ATTESTATION',
    source,
    terms,
    sourceDigest: sha(approvalSignatureCanonicalJson({ source, terms })),
    artifact: {
      rendererVersion: source.rendererVersion,
      mediaType: 'application/json',
      sha256: artifactSha256,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      content,
    },
    signingReadiness: 'VERIFIED_INTERNAL_KEY',
    consentRequired: true,
    evaluatedAt: new Date().toISOString(),
  };
}
export function approvalSignatureCeremonyFixture(
  context: ApprovalSignatureContext,
  state: ApprovalSignatureCeremony['state'] = 'AWAITING_CONSENT',
  version = state === 'CONSENTED' ? 1 : state === 'ATTESTED' ? 2 : 0
): ApprovalSignatureCeremony {
  const ceremony: ApprovalSignatureCeremony = {
    signatureRequestId,
    requestId: context.source.requestId,
    signerKind: 'SELF_ATTESTATION',
    state,
    version,
    source: context.source,
    sourceDigest: context.sourceDigest,
    artifact: context.artifact,
    terms: context.terms,
    expiresAt: context.terms.expiresAt,
    consentReceiptId: ['CONSENTED', 'ATTESTED'].includes(state) ? signatureConsentId : null,
    evidence: null,
    preservationState: 'NOT_WORM_VERIFIED',
  };
  if (state !== 'ATTESTED') return ceremony;
  const attestedAt = new Date().toISOString();
  const evidenceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const claims = {
    contract: 'DWP_SELF_ATTESTATION_EVIDENCE_V1',
    signerKind: 'SELF_ATTESTATION',
    evidenceId,
    signatureRequestId,
    signerUserId: 1,
    sourceDigest: context.sourceDigest,
    artifactSha256: context.artifact.sha256,
    consentReceiptId: signatureConsentId,
    authorityDigest: 'e'.repeat(64),
    attestedAt,
  };
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encoded({ alg: 'RS256', kid, typ: 'dwp-self-attestation+jws' })}.${encoded(claims)}`;
  return {
    ...ceremony,
    evidence: {
      evidenceId,
      proofKind: 'SELF_ATTESTATION',
      keyId: kid,
      publicKeyJson: JSON.stringify(publicKey),
      artifactSha256: context.artifact.sha256,
      sourceDigest: context.sourceDigest,
      compactJws: `${signingInput}.${sign('RSA-SHA256', Buffer.from(signingInput), pair.privateKey).toString('base64url')}`,
      attestedAt,
    },
  };
}
export function approvalSignatureReceiptFixture(
  ceremony: ApprovalSignatureCeremony
): ApprovalSignatureReceipt {
  return {
    commandReceiptId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    outcome: 'COMMITTED',
    committedAt: new Date().toISOString(),
    ceremony,
  };
}
