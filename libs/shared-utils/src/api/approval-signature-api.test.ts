import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  ApprovalSignatureResponseError,
  cancelApprovalSignatureRequest,
  consentApprovalSignatureRequest,
  createApprovalSignatureRequest,
  getApprovalSignatureCommandReceipt,
  getApprovalSignatureContext,
  signApprovalSignatureRequest,
} from './approval-signature-api';
import {
  readApprovalSignatureCeremony,
  readApprovalSignatureContext,
} from './approval-signature-contract';
import type {
  ApprovalSignatureCeremony,
  ApprovalSignatureContext,
  ApprovalSignatureOperation,
} from './approval-signature-contract';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import {
  approvalSignatureCanonicalJson,
  approvalSignatureSha256,
  verifyApprovalSignatureSource,
} from './approval-signature-verification';

const requestId = '11111111-1111-4111-8111-111111111111';
const signatureRequestId = '22222222-2222-4222-8222-222222222222';
const consentReceiptId = '33333333-3333-4333-8333-333333333333';
const idempotencyKey = 'signature:original';
const revision = `psr-${'a'.repeat(64)}`;
const options = {
  contextScopeKey: 'opaque-current',
  expectedDecisionRevision: revision,
  resourceSetKey: 'RS_APPROVALS',
  requestId,
  beforeDispatch: () => {},
};
afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setupCrypto() {
  vi.stubGlobal('crypto', webcrypto);
}
async function context(): Promise<ApprovalSignatureContext> {
  const content = '{"amount":"1234567890123456789012345678.9","summary":"Exact finalized source"}';
  const sha = await approvalSignatureSha256(content),
    text = 'Internal self-attestation terms, not a qualified external signature.';
  const source = {
    requestId,
    requestVersion: 5,
    payloadRevision: 1,
    payloadSha256: 'a'.repeat(64),
    formVersionId: requestId,
    formSchemaSha256: 'b'.repeat(64),
    workflowVersionId: requestId,
    workflowSha256: 'c'.repeat(64),
    resourceSetKey: options.resourceSetKey,
    manifestSha256: 'd'.repeat(64),
    documentPolicyId: requestId,
    documentPolicyVersion: 1,
    documentPolicyRevision: 1,
    documentPolicySha256: 'e'.repeat(64),
    attachmentPolicyId: requestId,
    attachmentPolicyVersion: 1,
    attachmentPolicyRevision: 1,
    attachmentPolicySha256: 'f'.repeat(64),
    providerId: requestId,
    providerVersion: 1,
    providerSha256: 'a'.repeat(64),
    ownerUserId: 99,
    rendererVersion: 'finalized-v1',
    artifactSha256: sha,
    signingKeySha256: null,
  };
  const terms = {
    termsId: 'SELF_ATTESTATION_TERMS',
    version: 1,
    sha256: await approvalSignatureSha256(text),
    locale: 'en' as const,
    text,
    expiresAt: '2030-01-01T00:00:00Z',
  };
  return {
    signerKind: 'SELF_ATTESTATION',
    source,
    sourceDigest: await approvalSignatureSha256(approvalSignatureCanonicalJson({ source, terms })),
    artifact: {
      rendererVersion: source.rendererVersion,
      mediaType: 'application/json',
      sha256: sha,
      sizeBytes: new TextEncoder().encode(content).length,
      content,
    },
    terms,
    signingReadiness: 'NOT_VERIFIED',
    consentRequired: true,
    evaluatedAt: new Date().toISOString(),
  };
}
async function ceremony(
  state: ApprovalSignatureCeremony['state'] = 'AWAITING_CONSENT'
): Promise<ApprovalSignatureCeremony> {
  const source = await context();
  return {
    signatureRequestId,
    requestId,
    signerKind: 'SELF_ATTESTATION',
    state,
    version: state === 'CONSENTED' || state === 'CANCELLED' ? 1 : 0,
    source: source.source,
    sourceDigest: source.sourceDigest,
    artifact: source.artifact,
    terms: source.terms,
    expiresAt: source.terms.expiresAt,
    consentReceiptId: state === 'CONSENTED' ? consentReceiptId : null,
    evidence: null,
    preservationState: 'NOT_WORM_VERIFIED',
  };
}
async function attested(
  claims: Readonly<Record<string, unknown>> = {}
): Promise<ApprovalSignatureCeremony> {
  const original = await ceremony('CONSENTED');
  const pair = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  const exported = await webcrypto.subtle.exportKey('jwk', pair.publicKey),
    kid = 'approval-self-attestation:fixture';
  const publicKey = { kty: 'RSA', n: exported.n, e: exported.e, kid, use: 'sig', alg: 'RS256' };
  const signingKeySha256 = await approvalSignatureSha256(
    approvalSignatureCanonicalJson({ kty: 'RSA', n: exported.n, e: exported.e })
  );
  const source = { ...original.source, signingKeySha256 },
    sourceDigest = await approvalSignatureSha256(
      approvalSignatureCanonicalJson({ source, terms: original.terms })
    );
  const at = new Date().toISOString();
  const payload = {
    contract: 'DWP_SELF_ATTESTATION_EVIDENCE_V1',
    signerKind: 'SELF_ATTESTATION',
    evidenceId: requestId,
    signatureRequestId,
    signerUserId: 99,
    sourceDigest,
    artifactSha256: original.artifact.sha256,
    consentReceiptId,
    authorityDigest: 'c'.repeat(64),
    attestedAt: at,
    ...claims,
  };
  const encoded = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url');
  const header = encoded({ alg: 'RS256', kid, typ: 'dwp-self-attestation+jws' }),
    body = encoded(payload);
  const signature = Buffer.from(
    await webcrypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      pair.privateKey,
      new TextEncoder().encode(`${header}.${body}`)
    )
  ).toString('base64url');
  return {
    ...original,
    source,
    sourceDigest,
    state: 'ATTESTED',
    version: 2,
    evidence: {
      evidenceId: requestId,
      proofKind: 'SELF_ATTESTATION',
      keyId: kid,
      publicKeyJson: JSON.stringify(publicKey),
      artifactSha256: original.artifact.sha256,
      sourceDigest,
      compactJws: `${header}.${body}.${signature}`,
      attestedAt: at,
    },
  };
}
function secure(version: number, high = false): ApprovalMutationExecution {
  return {
    mode: 'SECURE',
    rolloutState: '110',
    expectedDecisionRevision: revision,
    contextKey: 'context-current',
    contextScopeKey: options.contextScopeKey,
    idempotencyKey,
    objectVersion: version,
    ...(high
      ? {
          stepUp: {
            challenge: 'dedicated-sign-challenge',
            challengeId: requestId,
            decisionRevision: revision,
            expiresAt: '2030-01-01T00:00:00Z',
          },
        }
      : {}),
  };
}
async function command(operation: ApprovalSignatureOperation) {
  const data =
    operation === 'SIGN'
      ? await attested()
      : await ceremony(
          operation === 'CONSENT'
            ? 'CONSENTED'
            : operation === 'CANCEL'
              ? 'CANCELLED'
              : 'AWAITING_CONSENT'
        );
  const version = operation === 'CREATE' ? 5 : operation === 'SIGN' ? 1 : 0;
  const input = { expectedVersion: version, sourceDigest: data.sourceDigest, idempotencyKey };
  const authority = secure(version, operation === 'SIGN');
  const run = (beforeDispatch = options.beforeDispatch, execution = authority) => {
    const bound = { ...options, beforeDispatch };
    if (operation === 'CREATE')
      return createApprovalSignatureRequest(
        requestId,
        { ...input, signerKind: 'SELF_ATTESTATION', locale: 'en' },
        execution,
        bound
      );
    if (operation === 'CONSENT')
      return consentApprovalSignatureRequest(
        signatureRequestId,
        {
          ...input,
          termsId: data.terms.termsId,
          termsVersion: 1,
          termsSha256: data.terms.sha256,
          locale: 'en',
          accepted: true,
        },
        execution,
        bound
      );
    if (operation === 'SIGN')
      return signApprovalSignatureRequest(
        signatureRequestId,
        { ...input, consentReceiptId },
        execution,
        bound
      );
    return cancelApprovalSignatureRequest(signatureRequestId, input, execution, bound);
  };
  const receipt = {
    commandReceiptId: requestId,
    outcome: 'COMMITTED',
    committedAt: new Date().toISOString(),
    ceremony: data,
  };
  return { run, receipt, input, authority };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function fetchResponse(data: unknown, status = 200) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) =>
    url.includes('/csrf')
      ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
      : response(data, status)
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const operations = ['CREATE', 'CONSENT', 'SIGN', 'CANCEL'] as const;
describe('native Source10 signature client contracts (fixtures are not genuine Auth activation)', () => {
  it('rejects a sealed context whose terms locale differs from the requested locale', async () => {
    setupCrypto();
    const fetch = fetchResponse(await context());
    await expect(getApprovalSignatureContext(requestId, 'ko', options)).rejects.toThrow();
    expect(fetch.mock.calls).toHaveLength(1);
  });
  it.each([
    { signerUserId: 98 },
    { contract: 'OTHER_SIGNATURE_PURPOSE' },
    { signerKind: 'QUALIFIED_EXTERNAL' },
    { signatureRequestId: requestId },
  ])(
    'rejects correctly signed RSA evidence with foreign actor/purpose/target claims %j',
    async (claims) => {
      setupCrypto();
      await expect(verifyApprovalSignatureSource(await attested(claims))).rejects.toThrow();
    }
  );
  it.each(operations)(
    '%s empty 403 performs exactly one command attempt with no automatic CSRF replay',
    async (operation) => {
      setupCrypto();
      const { run } = await command(operation);
      const fetch = vi.fn(async (url: string) =>
        url.includes('/csrf')
          ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
          : new Response(null, { status: 403 })
      );
      vi.stubGlobal('fetch', fetch);
      await expect(run()).rejects.toBeInstanceOf(ApprovalSignatureResponseError);
      expect(fetch.mock.calls.filter(([url]) => !url.includes('/csrf'))).toHaveLength(1);
      expect(fetch.mock.calls.filter(([url]) => url.includes('/csrf'))).toHaveLength(1);
    }
  );
  it.each(operations)(
    '%s sends frozen original body, exact headers and COMMAND_BODY CAS only',
    async (operation) => {
      setupCrypto();
      const { run, receipt, input } = await command(operation);
      const fetch = fetchResponse(receipt);
      const guard = vi.fn();
      await expect(run(guard)).resolves.toMatchObject({ outcome: 'COMMITTED' });
      const call = fetch.mock.calls.find(([url]) => !url.includes('/csrf'));
      expect(call).toBeDefined();
      // Inspect the actual fetch boundary, not a mocked axios config.
      const sent = fetch.mock.calls.find(([url]) => url.includes('/api/approvals/'));
      expect(sent?.[1]?.method).toBe('POST');
      expect(JSON.parse(String(sent?.[1]?.body))).toMatchObject(input);
      const headers = new Headers(sent?.[1]?.headers);
      expect(headers.get('Idempotency-Key')).toBe(idempotencyKey);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
      expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
      expect(headers.get('X-DWP-Step-Up-Challenge')).toBe(
        operation === 'SIGN' ? 'dedicated-sign-challenge' : null
      );
      expect(guard.mock.calls.length).toBeGreaterThanOrEqual(4);
    }
  );
  it.each(operations)(
    '%s closes source drift during real CSRF fetch before any POST',
    async (operation) => {
      setupCrypto();
      const { run, receipt } = await command(operation);
      let current = true;
      let finish: (response: Response) => void = () => {
        throw new Error('Not initialized');
      };
      const pending = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      const fetch = vi.fn(async (url: string) =>
        url.includes('/csrf') ? pending : response(receipt)
      );
      vi.stubGlobal('fetch', fetch);
      const result = run(() => {
        if (!current) throw new Error('Source changed');
      });
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      current = false;
      finish(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }));
      await expect(result).rejects.toThrow('Source changed');
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );
  it.each(operations)(
    '%s unverifiable successful response retains original metadata receipt identity',
    async (operation) => {
      setupCrypto();
      const { run } = await command(operation);
      fetchResponse({ unknown: true });
      await expect(run()).rejects.toMatchObject({
        name: 'ApprovalSignatureResponseError',
        receiptQuery: {
          idempotencyKey,
          originalOperation: operation,
          targetId: operation === 'CREATE' ? requestId : signatureRequestId,
          bodySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
    }
  );
  it.each(operations)('%s rejects legacy authority before all HTTP', async (operation) => {
    setupCrypto();
    const { run } = await command(operation);
    const fetch = fetchResponse({});
    await expect(
      run(undefined, { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([403, 409, 503])(
    'structured %i is not replayed or converted into success',
    async (status) => {
      setupCrypto();
      const { run } = await command('CREATE');
      const fetch = fetchResponse({ errorCode: 'DENIED' }, status);
      await expect(run()).rejects.toMatchObject({ name: 'HttpError', status });
      expect(fetch.mock.calls.filter(([url]) => !url.includes('/csrf'))).toHaveLength(1);
    }
  );
  it('verifies terms-inclusive source SHA and exact decimal strings without numeric conversion', async () => {
    setupCrypto();
    const data = await context();
    fetchResponse(data);
    const result = await getApprovalSignatureContext(requestId, 'en', options);
    expect(result.artifact.content).toContain('1234567890123456789012345678.9');
    expect(Object.isFrozen(result.source)).toBe(true);
    fetchResponse({
      ...data,
      sourceDigest: await approvalSignatureSha256(approvalSignatureCanonicalJson(data.source)),
    });
    await expect(getApprovalSignatureContext(requestId, 'en', options)).rejects.toThrow();
  });
  it('validates real RSA cryptographic evidence and rejects mutated bytes/signature/actor/key/purpose', async () => {
    setupCrypto();
    const data = await attested();
    await expect(
      verifyApprovalSignatureSource(readApprovalSignatureCeremony(data))
    ).resolves.toBeDefined();
    await expect(
      verifyApprovalSignatureSource({
        ...data,
        artifact: { ...data.artifact, content: 'tampered' },
      })
    ).rejects.toThrow();
    const evidence = data.evidence!;
    const parts = evidence.compactJws.split('.');
    await expect(
      verifyApprovalSignatureSource({
        ...data,
        evidence: { ...evidence, compactJws: `${parts[0]}.${parts[1]}.AAAA` },
      })
    ).rejects.toThrow();
    await expect(
      verifyApprovalSignatureSource({
        ...data,
        evidence: { ...evidence, keyId: 'approval-self-attestation:wrong' },
      })
    ).rejects.toThrow();
  });
  it('rejects schema additions, unsafe integers, wrong RS, unsupported signer and partial evidence', async () => {
    setupCrypto();
    const data = await context();
    expect(() => readApprovalSignatureContext({ ...data, extra: true })).toThrow();
    expect(() =>
      readApprovalSignatureContext({
        ...data,
        source: { ...data.source, requestVersion: Number.MAX_SAFE_INTEGER + 1 },
      })
    ).toThrow();
    expect(() => readApprovalSignatureContext(data, requestId, 'wrong-rs')).toThrow();
    expect(() =>
      readApprovalSignatureContext({ ...data, signerKind: 'QUALIFIED_EXTERNAL' })
    ).toThrow();
    const original = await ceremony();
    expect(() => readApprovalSignatureCeremony({ ...original, evidence: {} })).toThrow();
  });
  it('metadata-only lookup uses the original operation/target/body SHA, accepts verified mismatch without artifact fetch', async () => {
    setupCrypto();
    const fetch = fetchResponse({
      receiptId: requestId,
      originalOperation: 'SIGN',
      requestId,
      signatureRequestId,
      committedAt: new Date().toISOString(),
      eventSequence: 3,
      resultState: 'ATTESTED',
      resultVersion: 2,
      sourceCurrent: false,
    });
    const data = await getApprovalSignatureCommandReceipt(
      {
        idempotencyKey,
        originalOperation: 'SIGN',
        targetId: signatureRequestId,
        bodySha256: 'b'.repeat(64),
      },
      requestId,
      options
    );
    expect(data.sourceCurrent).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toContain('signature-command-receipts/');
    expect(fetch.mock.calls[0]![0]).toContain('originalOperation=SIGN');
  });
});
