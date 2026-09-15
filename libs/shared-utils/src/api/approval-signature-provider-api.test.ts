import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  diagnosticDetails,
  diagnosticFixtureId,
  diagnosticFixtureNow,
  diagnosticFixtureSha,
  diagnosticOverview,
  diagnosticPolicy,
} from './approval-signature-diagnostics.test-support';
import {
  getApprovalSignatureProviderDiagnosticHistory,
  getApprovalSignatureProviderDiagnostics,
  getApprovalSignatureProviderOverview,
  getApprovalSignatureProviderPolicy,
  getApprovalSignatureProviderPolicyHistory,
  probeApprovalSignatureProviderKms,
  probeApprovalSignatureProviders,
  snapshotApprovalSignatureProviderKmsProbeInput,
  snapshotApprovalSignatureProviderProbeInput,
  snapshotApprovalSignatureProviderTarget,
} from './approval-signature-provider-api';

const revision = `psr-${diagnosticFixtureSha}`;
const readAuthority = {
  contextScopeKey: 'opaque-diagnostic-context',
  expectedDecisionRevision: revision,
};
const pinnedAuthority = {
  ...readAuthority,
  resourceSetKey: 'RS_APPROVALS',
  registrySha256: diagnosticFixtureSha,
  sourceRevision: `sigp-${diagnosticFixtureSha}`,
  sourceSha256: diagnosticFixtureSha,
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status,
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Source13 signature provider API boundary', () => {
  it('reads every production diagnostic source with exact scope pins and no credential payload', async () => {
    const details = diagnosticDetails();
    const policy = diagnosticPolicy();
    const diagnosticHistory = {
      scope: diagnosticOverview().scope,
      items: [],
      nextCursor: null,
      truncated: false,
    };
    const policyHistory = {
      scope: policy.scope,
      policyId: policy.policyId,
      items: [],
      nextCursor: null,
      truncated: false,
    };
    const fetch = transport((url) => {
      if (url.includes('/providers/')) return details;
      if (url.includes('/diagnostic-history')) return diagnosticHistory;
      if (url.includes('/signatures/diagnostics?')) return diagnosticOverview();
      if (url.includes('/policy?')) return policy;
      if (url.includes('/policies/')) return policyHistory;
      throw new Error(`Unexpected ${url}`);
    });
    const guard = vi.fn();
    const authority = { ...pinnedAuthority, beforeDispatch: guard };

    await expect(
      getApprovalSignatureProviderOverview({ ...readAuthority, beforeDispatch: guard })
    ).resolves.toEqual(diagnosticOverview());
    await expect(
      getApprovalSignatureProviderDiagnostics(diagnosticFixtureId, authority)
    ).resolves.toEqual(details);
    await expect(getApprovalSignatureProviderDiagnosticHistory(null, authority)).resolves.toEqual(
      diagnosticHistory
    );
    await expect(getApprovalSignatureProviderPolicy(authority)).resolves.toEqual(policy);
    await expect(
      getApprovalSignatureProviderPolicyHistory(policy.policyId, null, authority)
    ).resolves.toEqual(policyHistory);

    const calls = fetch.mock.calls.filter(([url]) => !String(url).includes('/csrf'));
    expect(calls).toHaveLength(5);
    for (const [, init] of calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
      expect(JSON.stringify(init)).not.toContain('credentialSecret');
    }
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('rejects extra secret fields, a foreign scope and malformed history cursors', async () => {
    const source = diagnosticOverview();
    transport(() => ({
      ...source,
      providers: [{ ...source.providers[0], credentialSecret: 'must-never-cross' }],
    }));
    await expect(getApprovalSignatureProviderOverview(readAuthority)).rejects.toThrow();

    vi.unstubAllGlobals();
    transport(() => ({
      ...source,
      scope: { ...source.scope, contextScopeKey: 'foreign-context' },
    }));
    await expect(getApprovalSignatureProviderOverview(readAuthority)).rejects.toThrow();
    expect(() =>
      getApprovalSignatureProviderDiagnosticHistory('../cursor', pinnedAuthority)
    ).toThrow();
  });

  it('runs one frozen provider probe with current authority, version and idempotency only', async () => {
    const details = diagnosticDetails();
    const target = snapshotApprovalSignatureProviderTarget(details);
    const input = snapshotApprovalSignatureProviderProbeInput({
      expectedSourceRevision: pinnedAuthority.sourceRevision,
      expectedSourceSha256: pinnedAuthority.sourceSha256,
      allProviders: false,
      targets: [target],
      idempotencyKey: 'probe:original',
    });
    const run = {
      scope: diagnosticOverview().scope,
      probeRunId: diagnosticFixtureId,
      state: 'COMPLETE',
      startedAt: diagnosticFixtureNow,
      completedAt: '2026-09-14T00:00:01Z',
      originalBodySha256: diagnosticFixtureSha,
      originalTargets: [target],
      providerResults: [
        {
          providerId: target.providerId,
          originalTarget: target,
          outcome: 'FAIL',
          observedAt: diagnosticFixtureNow,
          cooldownUntil: null,
          reasonCodes: ['PRODUCTION_PROBE_FAILED'],
          checks: [],
        },
      ],
    };
    const fetch = transport(() => run);
    const guard = vi.fn();
    const execution = {
      mode: 'SECURE' as const,
      rolloutState: '110' as const,
      contextKey: 'ctx:approvals:admin',
      contextScopeKey: readAuthority.contextScopeKey,
      expectedDecisionRevision: revision,
      idempotencyKey: input.idempotencyKey,
    };

    await expect(
      probeApprovalSignatureProviders(input, execution, {
        ...pinnedAuthority,
        beforeDispatch: guard,
      })
    ).resolves.toMatchObject({ state: 'COMPLETE', originalTargets: [target] });
    const call = fetch.mock.calls.find(([url]) => String(url).includes('/probes?'));
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual(input);
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Idempotency-Key')).toBe(input.idempotencyKey);
    expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects response targets that do not match the frozen cohort', async () => {
    const target = snapshotApprovalSignatureProviderTarget(diagnosticDetails());
    const input = snapshotApprovalSignatureProviderProbeInput({
      expectedSourceRevision: pinnedAuthority.sourceRevision,
      expectedSourceSha256: pinnedAuthority.sourceSha256,
      allProviders: false,
      targets: [target],
      idempotencyKey: 'probe:original',
    });
    transport(() => ({
      scope: diagnosticOverview().scope,
      probeRunId: diagnosticFixtureId,
      state: 'COMPLETE',
      startedAt: diagnosticFixtureNow,
      completedAt: '2026-09-14T00:00:01Z',
      originalBodySha256: diagnosticFixtureSha,
      originalTargets: [{ ...target, expectedProviderVersion: target.expectedProviderVersion + 1 }],
      providerResults: [],
    }));
    await expect(
      probeApprovalSignatureProviders(
        input,
        {
          mode: 'SECURE',
          rolloutState: '110',
          contextKey: 'ctx:approvals:admin',
          contextScopeKey: readAuthority.contextScopeKey,
          expectedDecisionRevision: revision,
          idempotencyKey: input.idempotencyKey,
        },
        { ...pinnedAuthority, beforeDispatch: () => {} }
      )
    ).rejects.toThrow();
  });

  it('runs a KMS probe against one frozen configuration and accepts only the newly verified source', async () => {
    const target = snapshotApprovalSignatureProviderTarget(diagnosticDetails());
    const input = snapshotApprovalSignatureProviderKmsProbeInput({
      expectedSourceRevision: pinnedAuthority.sourceRevision,
      expectedSourceSha256: pinnedAuthority.sourceSha256,
      target,
      idempotencyKey: 'kms:original',
    });
    const nextSha = 'b'.repeat(64);
    const next = diagnosticOverview();
    const fetch = transport(() => ({
      ...next,
      scope: {
        ...next.scope,
        sourceRevision: `sigp-${nextSha}`,
        sourceSha256: nextSha,
      },
    }));
    const guard = vi.fn();

    await expect(
      probeApprovalSignatureProviderKms(
        input,
        {
          mode: 'SECURE',
          rolloutState: '110',
          contextKey: 'ctx:approvals:admin',
          contextScopeKey: readAuthority.contextScopeKey,
          expectedDecisionRevision: revision,
          idempotencyKey: input.idempotencyKey,
        },
        { ...pinnedAuthority, beforeDispatch: guard }
      )
    ).resolves.toMatchObject({ scope: { sourceSha256: nextSha } });

    const call = fetch.mock.calls.find(([url]) => String(url).includes('/kms/probes?'));
    expect(call?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual(input);
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('Idempotency-Key')).toBe(input.idempotencyKey);
    expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
