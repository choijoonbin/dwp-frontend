import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  diagnosticDetails,
  diagnosticFixtureDraftId,
  diagnosticFixtureId,
  diagnosticFixtureSha,
  diagnosticOverview,
  diagnosticPolicy,
} from './approval-signature-diagnostics.test-support';
import { snapshotApprovalSignatureProviderTarget } from './approval-signature-provider-api';
import {
  initializeApprovalSignaturePolicy,
  inspectApprovalSignatureWorm,
  publishApprovalSignaturePolicy,
  saveApprovalSignaturePolicyDraft,
  snapshotApprovalSignaturePolicyDraftInput,
  snapshotApprovalSignaturePolicyInitializeInput,
  snapshotApprovalSignaturePolicyPublishInput,
  snapshotApprovalSignatureWormInspectionInput,
} from './approval-signature-policy-api';

const revision = `psr-${diagnosticFixtureSha}`;
const authority = {
  contextScopeKey: 'opaque-diagnostic-context',
  expectedDecisionRevision: revision,
  resourceSetKey: 'RS_APPROVALS',
  registrySha256: diagnosticFixtureSha,
  sourceRevision: `sigp-${diagnosticFixtureSha}`,
  sourceSha256: diagnosticFixtureSha,
  beforeDispatch: vi.fn(),
};
const execution = (idempotencyKey: string, objectVersion?: number) => ({
  mode: 'SECURE' as const,
  rolloutState: '111' as const,
  contextKey: 'ctx:approvals:admin',
  contextScopeKey: authority.contextScopeKey,
  expectedDecisionRevision: revision,
  idempotencyKey,
  ...(objectVersion === undefined ? {} : { objectVersion }),
  ...(objectVersion === undefined
    ? {}
    : {
        stepUp: {
          challenge: 'signed-step-up-proof',
          challengeId: diagnosticFixtureId,
          decisionRevision: revision,
          expiresAt: '2026-09-15T01:00:00Z',
        },
      }),
});

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

afterEach(() => {
  resetCsrfToken();
  authority.beforeDispatch.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('native signature policy API', () => {
  it('freezes initialize/draft/publish/WORM DTOs to backend fields', () => {
    const rules = diagnosticPolicy().workingDraft!.rules;
    expect(
      snapshotApprovalSignaturePolicyInitializeInput({
        expectedAbsent: true,
        expectedSourceRevision: authority.sourceRevision,
        expectedSourceSha256: authority.sourceSha256,
        rules,
        idempotencyKey: 'policy:init:1',
      })
    ).toEqual({
      expectedAbsent: true,
      expectedSourceRevision: authority.sourceRevision,
      expectedSourceSha256: authority.sourceSha256,
      rules,
      idempotencyKey: 'policy:init:1',
    });
    expect(
      snapshotApprovalSignaturePolicyDraftInput({
        expectedVersion: 1,
        expectedDraftVersionId: diagnosticFixtureDraftId,
        expectedSourceRevision: authority.sourceRevision,
        expectedSourceSha256: authority.sourceSha256,
        rules,
        idempotencyKey: 'policy:draft:1',
      }).expectedDraftVersionId
    ).toBe(diagnosticFixtureDraftId);
    expect(
      snapshotApprovalSignaturePolicyPublishInput({
        expectedVersion: 1,
        expectedDraftVersionId: diagnosticFixtureDraftId,
        expectedSourceRevision: authority.sourceRevision,
        expectedSourceSha256: authority.sourceSha256,
        reviewContentSha256: diagnosticFixtureSha,
        idempotencyKey: 'policy:publish:1',
      }).reviewContentSha256
    ).toBe(diagnosticFixtureSha);
    expect(
      snapshotApprovalSignatureWormInspectionInput({
        expectedSourceRevision: authority.sourceRevision,
        expectedSourceSha256: authority.sourceSha256,
        target: snapshotApprovalSignatureProviderTarget(diagnosticDetails()),
        artifactId: null,
        idempotencyKey: 'worm:inspect:1',
      }).artifactId
    ).toBeNull();
  });

  it('uses governed low writes and an exact object-version header only for publish', async () => {
    const policy = diagnosticPolicy();
    const rules = policy.workingDraft!.rules;
    const fetch = transport((url) =>
      url.includes('/worm-inspections') ? diagnosticOverview() : policy
    );
    const initialize = snapshotApprovalSignaturePolicyInitializeInput({
      expectedAbsent: true,
      expectedSourceRevision: authority.sourceRevision,
      expectedSourceSha256: authority.sourceSha256,
      rules,
      idempotencyKey: 'policy:init:1',
    });
    const draft = snapshotApprovalSignaturePolicyDraftInput({
      expectedVersion: 1,
      expectedDraftVersionId: diagnosticFixtureDraftId,
      expectedSourceRevision: authority.sourceRevision,
      expectedSourceSha256: authority.sourceSha256,
      rules,
      idempotencyKey: 'policy:draft:1',
    });
    const publish = snapshotApprovalSignaturePolicyPublishInput({
      expectedVersion: 1,
      expectedDraftVersionId: diagnosticFixtureDraftId,
      expectedSourceRevision: authority.sourceRevision,
      expectedSourceSha256: authority.sourceSha256,
      reviewContentSha256: diagnosticFixtureSha,
      idempotencyKey: 'policy:publish:1',
    });
    const worm = snapshotApprovalSignatureWormInspectionInput({
      expectedSourceRevision: authority.sourceRevision,
      expectedSourceSha256: authority.sourceSha256,
      target: snapshotApprovalSignatureProviderTarget(diagnosticDetails()),
      artifactId: null,
      idempotencyKey: 'worm:inspect:1',
    });

    await initializeApprovalSignaturePolicy(
      initialize,
      execution(initialize.idempotencyKey),
      authority
    );
    await saveApprovalSignaturePolicyDraft(
      diagnosticFixtureId,
      draft,
      execution(draft.idempotencyKey),
      authority
    );
    await inspectApprovalSignatureWorm(worm, execution(worm.idempotencyKey), authority);
    await publishApprovalSignaturePolicy(
      diagnosticFixtureId,
      publish,
      execution(publish.idempotencyKey, publish.expectedVersion),
      authority
    );

    const calls = fetch.mock.calls.filter(([url]) => !String(url).includes('/csrf'));
    expect(calls).toHaveLength(4);
    for (const [, init] of calls) {
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body));
      expect(headers.get('Idempotency-Key')).toBe(body.idempotencyKey);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    }
    expect(new Headers(calls[0]![1]?.headers).has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(new Headers(calls[1]![1]?.headers).has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(new Headers(calls[2]![1]?.headers).has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(new Headers(calls[3]![1]?.headers).get('X-DWP-Expected-Object-Version')).toBe('1');
  });

  it('rejects source drift and unverifiable command responses', async () => {
    const policy = diagnosticPolicy();
    const input = snapshotApprovalSignaturePolicyDraftInput({
      expectedVersion: 1,
      expectedDraftVersionId: diagnosticFixtureDraftId,
      expectedSourceRevision: authority.sourceRevision,
      expectedSourceSha256: authority.sourceSha256,
      rules: policy.workingDraft!.rules,
      idempotencyKey: 'policy:draft:1',
    });
    transport(() => ({ ...policy, secret: 'must-not-cross' }));
    await expect(
      saveApprovalSignaturePolicyDraft(
        diagnosticFixtureId,
        input,
        execution(input.idempotencyKey),
        authority
      )
    ).rejects.toThrow('unverifiable');
    await expect(
      saveApprovalSignaturePolicyDraft(
        diagnosticFixtureId,
        input,
        execution(input.idempotencyKey),
        { ...authority, sourceSha256: 'b'.repeat(64) }
      )
    ).rejects.toThrow();
  });
});
