import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  diagnosticFixtureSha,
  diagnosticOverview,
} from './approval-signature-diagnostics.test-support';
import {
  cancelApprovalExternalSignatureRequest,
  createApprovalExternalSignatureRequest,
  getApprovalExternalSignatureArtifact,
  getApprovalExternalSignatureAudit,
  getApprovalExternalSignatureContext,
  getApprovalExternalSignatureRequest,
  handoverApprovalExternalSignatureRequest,
  refreshApprovalExternalSignatureRequest,
} from './approval-external-signature-api';
import {
  snapshotApprovalExternalSignatureCommandInput,
  snapshotApprovalExternalSignatureCreateInput,
} from './approval-external-signature-contract';

const signatureRequestId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const providerId = '33333333-3333-4333-8333-333333333333';
const policyId = '44444444-4444-4444-8444-444444444444';
const versionId = '55555555-5555-4555-8555-555555555555';
const artifactId = '66666666-6666-4666-8666-666666666666';
const scope = diagnosticOverview().scope;
const revision = scope.decisionRevision;
const provider = {
  providerId,
  expectedProviderVersion: 3,
  expectedProviderSha256: diagnosticFixtureSha,
  expectedConfiguration: {
    sourceId: providerId,
    version: 3,
    sha256: diagnosticFixtureSha,
  },
};
const source = {
  requestId,
  requestVersion: 7,
  resourceSetKey: scope.resourceSetKey,
  dataClassification: 'CONFIDENTIAL' as const,
  workflowVersionId: versionId,
  formVersionId: policyId,
  payloadRevision: 2,
  payloadSha256: diagnosticFixtureSha,
  sourceSha256: diagnosticFixtureSha,
};
const request = {
  scope,
  signatureRequestId,
  source,
  provider,
  policyId,
  policyVersionId: versionId,
  policySha256: diagnosticFixtureSha,
  state: 'PREPARED' as const,
  version: 4,
  remoteReferenceSha256: null,
  reasonCodes: [],
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:01Z',
};
const receipt = {
  receiptId: policyId,
  outcome: 'COMMITTED',
  committedAt: '2026-09-15T00:00:02Z',
  signatureRequest: request,
};
const authority = {
  contextScopeKey: scope.contextScopeKey,
  expectedDecisionRevision: revision,
  resourceSetKey: scope.resourceSetKey,
  requestId,
  requestVersion: source.requestVersion,
  sourceRevision: scope.sourceRevision,
  sourceSha256: scope.sourceSha256,
  beforeDispatch: vi.fn(),
};

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function transport(resolve: (url: string, init?: RequestInit) => unknown) {
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    return url.includes('/csrf')
      ? response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })
      : response(resolve(url, init));
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const execution = (idempotencyKey: string, objectVersion?: number) => ({
  mode: 'SECURE' as const,
  rolloutState: '111' as const,
  contextKey: 'ctx:approvals:work',
  contextScopeKey: scope.contextScopeKey,
  expectedDecisionRevision: revision,
  idempotencyKey,
  ...(objectVersion === undefined ? {} : { objectVersion }),
  ...(objectVersion === undefined
    ? {}
    : {
        stepUp: {
          challenge: 'signed-step-up-proof',
          challengeId: signatureRequestId,
          decisionRevision: revision,
          expiresAt: '2026-09-15T01:00:00Z',
        },
      }),
});

afterEach(() => {
  resetCsrfToken();
  authority.beforeDispatch.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('native external signature API', () => {
  it('reads context, request, audit and artifact with exact authority pins', async () => {
    const overview = diagnosticOverview();
    const context = {
      scope,
      source,
      policy: {
        sourceState: 'AVAILABLE',
        pin: { sourceId: policyId, version: 1, sha256: diagnosticFixtureSha },
        requiredProviderKinds: ['DOCUSIGN'],
        maxProbeAgeSeconds: 3600,
        probeIntervalSeconds: 300,
        retentionFloorSeconds: 31_536_000,
      },
      providers: overview.providers,
      gateState: 'ELIGIBLE',
      reasonCodes: [],
      evaluatedAt: '2026-09-15T00:00:00Z',
    };
    const audit = { items: [], truncated: false };
    const artifact = {
      artifactId,
      kind: 'SIGNED_PDF',
      mediaType: 'application/pdf',
      sha256: diagnosticFixtureSha,
      sizeBytes: 2048,
      storageLocatorSha256: diagnosticFixtureSha,
      objectVersionSha256: diagnosticFixtureSha,
      retainUntil: '2036-09-15T00:00:00Z',
      evidenceId: policyId,
      evidenceSha256: diagnosticFixtureSha,
      recordedAt: '2026-09-15T00:00:00Z',
    };
    const fetch = transport((url) => {
      if (url.includes(`/artifacts/${artifactId}`)) return artifact;
      if (url.endsWith('/audit?contextScopeKey=opaque-diagnostic-context')) return audit;
      if (url.includes(`/external-signature-requests/${signatureRequestId}`)) return request;
      return context;
    });

    await expect(getApprovalExternalSignatureContext(requestId, authority)).resolves.toMatchObject({
      source: { requestId, requestVersion: 7 },
    });
    await expect(
      getApprovalExternalSignatureRequest(signatureRequestId, authority)
    ).resolves.toMatchObject({ signatureRequestId, version: 4 });
    await expect(getApprovalExternalSignatureAudit(signatureRequestId, authority)).resolves.toEqual(
      audit
    );
    await expect(
      getApprovalExternalSignatureArtifact(signatureRequestId, artifactId, authority)
    ).resolves.toEqual(artifact);

    const calls = fetch.mock.calls.filter(([url]) => !String(url).includes('/csrf'));
    expect(calls).toHaveLength(4);
    for (const [, init] of calls) {
      expect(new Headers(init?.headers).get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    }
    expect(authority.beforeDispatch.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('uses low-risk transport for create/refresh/cancel and HIGH CAS only for handover', async () => {
    const create = snapshotApprovalExternalSignatureCreateInput({
      expectedRequestVersion: source.requestVersion,
      expectedSourceRevision: scope.sourceRevision,
      expectedSourceSha256: scope.sourceSha256,
      provider,
      idempotencyKey: 'external:create:1',
    });
    const command = snapshotApprovalExternalSignatureCommandInput({
      expectedVersion: request.version,
      expectedSourceRevision: scope.sourceRevision,
      expectedSourceSha256: scope.sourceSha256,
      idempotencyKey: 'external:command:1',
    });
    const fetch = transport(() => receipt);

    await createApprovalExternalSignatureRequest(
      requestId,
      create,
      execution(create.idempotencyKey),
      authority
    );
    await refreshApprovalExternalSignatureRequest(
      signatureRequestId,
      command,
      execution(command.idempotencyKey),
      authority
    );
    await cancelApprovalExternalSignatureRequest(
      signatureRequestId,
      command,
      execution(command.idempotencyKey),
      authority
    );
    await handoverApprovalExternalSignatureRequest(
      signatureRequestId,
      command,
      execution(command.idempotencyKey, command.expectedVersion),
      authority
    );

    const calls = fetch.mock.calls.filter(([url]) => !String(url).includes('/csrf'));
    expect(calls).toHaveLength(4);
    for (const [, init] of calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('Idempotency-Key')).toBe(JSON.parse(String(init?.body)).idempotencyKey);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    }
    expect(new Headers(calls[0]![1]?.headers).has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(new Headers(calls[1]![1]?.headers).has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(new Headers(calls[2]![1]?.headers).has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(new Headers(calls[3]![1]?.headers).get('X-DWP-Expected-Object-Version')).toBe('4');
  });

  it('rejects response, source and object-version drift before trusting a command', async () => {
    const command = snapshotApprovalExternalSignatureCommandInput({
      expectedVersion: request.version,
      expectedSourceRevision: scope.sourceRevision,
      expectedSourceSha256: scope.sourceSha256,
      idempotencyKey: 'external:handover:1',
    });
    transport(() => ({ ...receipt, signatureRequest: { ...request, secret: 'forbidden' } }));
    await expect(
      handoverApprovalExternalSignatureRequest(
        signatureRequestId,
        command,
        execution(command.idempotencyKey, command.expectedVersion),
        authority
      )
    ).rejects.toThrow('unverifiable');
    await expect(
      handoverApprovalExternalSignatureRequest(
        signatureRequestId,
        command,
        execution(command.idempotencyKey, command.expectedVersion + 1),
        authority
      )
    ).rejects.toThrow();
    await expect(
      refreshApprovalExternalSignatureRequest(signatureRequestId, command, execution('other'), {
        ...authority,
        sourceSha256: 'b'.repeat(64),
      })
    ).rejects.toThrow();
  });
});
