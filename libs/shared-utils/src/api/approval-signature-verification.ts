import {
  invalidApprovalSignature,
  signatureFields,
  signatureSha,
} from './approval-signature-contract';
import type {
  ApprovalSignatureCeremony,
  ApprovalSignatureContext,
} from './approval-signature-contract';

export function approvalSignatureCanonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(approvalSignatureCanonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${approvalSignatureCanonicalJson(record[key])}`)
      .join(',')}}`;
  }
  return invalidApprovalSignature();
}
export async function approvalSignatureSha256(text: string): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function verifyApprovalSignatureSource<
  T extends ApprovalSignatureContext | ApprovalSignatureCeremony,
>(data: T): Promise<T> {
  const [artifact, terms, source] = await Promise.all([
    approvalSignatureSha256(data.artifact.content),
    approvalSignatureSha256(data.terms.text),
    approvalSignatureSha256(
      approvalSignatureCanonicalJson({ source: data.source, terms: data.terms })
    ),
  ]);
  if (
    artifact !== data.artifact.sha256 ||
    terms !== data.terms.sha256 ||
    source !== data.sourceDigest
  )
    invalidApprovalSignature();
  if ('evidence' in data && data.evidence !== null) await verifyEvidence(data);
  return data;
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 32768) invalidApprovalSignature();
  const raw = atob(
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  );
  const result = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) result[index] = raw.charCodeAt(index);
  return result;
}
function decodedObject(value: string, names: readonly string[]) {
  return signatureFields(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(value))),
    names
  );
}
async function verifyEvidence(ceremony: ApprovalSignatureCeremony) {
  const evidence = ceremony.evidence;
  if (!evidence || !ceremony.consentReceiptId || !ceremony.source.signingKeySha256)
    invalidApprovalSignature();
  const [encodedHeader, encodedPayload, encodedSignature] = evidence.compactJws.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) invalidApprovalSignature();
  const header = decodedObject(encodedHeader, ['alg', 'kid', 'typ']);
  if (
    header.alg !== 'RS256' ||
    header.kid !== evidence.keyId ||
    header.typ !== 'dwp-self-attestation+jws'
  )
    invalidApprovalSignature();
  const publicKey = signatureFields(JSON.parse(evidence.publicKeyJson), [
    'kty',
    'n',
    'e',
    'kid',
    'use',
    'alg',
  ]);
  if (
    publicKey.kty !== 'RSA' ||
    publicKey.kid !== evidence.keyId ||
    publicKey.use !== 'sig' ||
    publicKey.alg !== 'RS256' ||
    typeof publicKey.n !== 'string' ||
    typeof publicKey.e !== 'string' ||
    decode(publicKey.n).byteLength < 256
  )
    invalidApprovalSignature();
  const thumbprint = await approvalSignatureSha256(
    approvalSignatureCanonicalJson({ e: publicKey.e, kty: 'RSA', n: publicKey.n })
  );
  if (thumbprint !== ceremony.source.signingKeySha256) invalidApprovalSignature();
  const jwk: JsonWebKey = { kty: 'RSA', n: publicKey.n, e: publicKey.e, alg: 'RS256', use: 'sig' };
  const key = await globalThis.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  if (
    !(await globalThis.crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    ))
  )
    invalidApprovalSignature();
  const payload = decodedObject(encodedPayload, [
    'contract',
    'signerKind',
    'evidenceId',
    'signatureRequestId',
    'signerUserId',
    'sourceDigest',
    'artifactSha256',
    'consentReceiptId',
    'authorityDigest',
    'attestedAt',
  ]);
  if (
    payload.contract !== 'DWP_SELF_ATTESTATION_EVIDENCE_V1' ||
    payload.signerKind !== 'SELF_ATTESTATION' ||
    payload.evidenceId !== evidence.evidenceId ||
    payload.signatureRequestId !== ceremony.signatureRequestId ||
    payload.signerUserId !== ceremony.source.ownerUserId ||
    payload.sourceDigest !== ceremony.sourceDigest ||
    payload.artifactSha256 !== ceremony.artifact.sha256 ||
    payload.consentReceiptId !== ceremony.consentReceiptId ||
    typeof payload.attestedAt !== 'string' ||
    Date.parse(payload.attestedAt) !== Date.parse(evidence.attestedAt)
  )
    invalidApprovalSignature();
  signatureSha(payload.authorityDigest);
}
