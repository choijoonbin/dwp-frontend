import { describe, expect, it } from 'vitest';
import {
  diagnosticInstant,
  diagnosticOfficialLink,
} from './approval-signature-diagnostics-primitives';
import {
  readSignatureProviderCard,
  readSignatureProviderCheck,
  readSignatureProviderDiagnosticHistory,
  readSignatureProviderDiagnostics,
  readSignatureProviderKms,
  readSignatureProviderOverview,
  readSignatureProviderScope,
  readSignatureProviderWorm,
} from './approval-signature-diagnostics-contract';
import {
  assertSignatureProviderPolicyCompilable,
  readSignatureProviderPolicyHistory,
  readSignatureProviderPolicyPublished,
  readSignatureProviderPolicyPublishReview,
  readSignatureProviderPolicyRules,
  readSignatureProviderPolicyView,
} from './approval-signature-provider-policy-contract';
import {
  diagnosticCard,
  diagnosticDetails,
  diagnosticDisabledRules,
  diagnosticFixtureDraftId,
  diagnosticFixtureId,
  diagnosticFixtureNow,
  diagnosticFixtureSha,
  diagnosticOverview,
  diagnosticPolicy,
  diagnosticScope,
} from './approval-signature-diagnostics.test-support';

describe('native signature diagnostics closed contracts, not source authority', () => {
  it('reads every overview section without turning missing policy into an empty denominator', () => {
    const source = { ...diagnosticOverview(), providers: [...diagnosticOverview().providers] },
      parsed = readSignatureProviderOverview(source);
    expect(parsed.kpis.requiredProviderCount).toBeNull();
    expect(parsed.policy.requiredProviderKinds).toBeNull();
    source.providers = [];
    expect(parsed.providers).toHaveLength(3);
    expect(Object.isFrozen(parsed.providers)).toBe(true);
    expect(Object.isFrozen(parsed.kms)).toBe(true);
  });
  it.each(['scope', 'policy', 'kpis', 'providers', 'phases', 'kms', 'worm'])(
    'rejects missing overview field %s',
    (key) => {
      const value: Record<string, unknown> = { ...diagnosticOverview() };
      delete value[key];
      expect(() => readSignatureProviderOverview(value)).toThrow();
    }
  );
  it('rejects nested unknown fields and unknown enums rather than downgrading them', () => {
    expect(() =>
      readSignatureProviderOverview({
        ...diagnosticOverview(),
        kms: { ...diagnosticOverview().kms, callerVerified: true },
      })
    ).toThrow();
    expect(() => readSignatureProviderCard({ ...diagnosticCard(), kind: 'K_SIGN' })).toThrow();
    expect(() => readSignatureProviderCard({ ...diagnosticCard(), readiness: 'READY' })).toThrow();
    expect(() =>
      readSignatureProviderOverview({ ...diagnosticOverview(), forgedScope: {} })
    ).toThrow();
  });
  it('keeps opaque request context distinct from the owner resource set', () => {
    const scope = readSignatureProviderScope(diagnosticScope());
    expect(scope.contextScopeKey).not.toBe(scope.resourceSetKey);
    expect(() =>
      readSignatureProviderScope({ ...scope, resourceSetKey: scope.contextScopeKey })
    ).toThrow();
    expect(() =>
      readSignatureProviderScope({ ...scope, sourceRevision: `sigp-${'b'.repeat(64)}` })
    ).toThrow();
  });
  it.each([0.5, Number.MAX_SAFE_INTEGER + 1, -1, '12'])(
    'rejects inexact provider version %s',
    (version) => {
      expect(() =>
        readSignatureProviderCard({ ...diagnosticCard(), providerVersion: version })
      ).toThrow();
    }
  );
  it('preserves registered CUSTOM providers with a missing native adapter', () => {
    expect(readSignatureProviderCard(diagnosticCard('CUSTOM')).adapterInstalled).toBe(false);
    expect(() =>
      readSignatureProviderCard({
        ...diagnosticCard('CUSTOM'),
        providerId: null,
        providerVersion: null,
        providerSha256: null,
      })
    ).toThrow();
  });
  it('never upgrades a declared provider or registered credential into production verification', () => {
    expect(() =>
      readSignatureProviderCard({ ...diagnosticCard(), readiness: 'VERIFIED_PRODUCTION' })
    ).toThrow();
    expect(() =>
      readSignatureProviderCard({ ...diagnosticCard(), credentialVerified: true })
    ).toThrow();
    expect(() =>
      readSignatureProviderCard({ ...diagnosticCard(), adapterInstalled: true })
    ).toThrow();
    expect(
      readSignatureProviderCard({
        ...diagnosticCard(),
        adapterInstalled: true,
        readiness: 'DISABLED',
      }).readiness
    ).toBe('DISABLED');
  });
  it('rejects impossible verified and policy-target counts', () => {
    const value = diagnosticOverview();
    expect(() =>
      readSignatureProviderOverview({
        ...value,
        kpis: { ...value.kpis, verifiedProductionProviderCount: 1 },
      })
    ).toThrow();
    expect(() =>
      readSignatureProviderOverview({
        ...value,
        kpis: { ...value.kpis, requiredProviderCount: 0, requiredProviderKinds: [] },
      })
    ).toThrow();
    expect(() =>
      readSignatureProviderOverview({
        ...value,
        kpis: { ...value.kpis, externalGateState: 'ELIGIBLE' },
      })
    ).toThrow();
  });
  it('rejects policy/KPI disagreement instead of using a fabricated published-policy denominator', () => {
    const value = diagnosticOverview();
    const policy = {
      sourceState: 'AVAILABLE',
      pin: { sourceId: diagnosticFixtureId, version: 0, sha256: diagnosticFixtureSha },
      requiredProviderKinds: ['DOCUSIGN'],
      maxProbeAgeSeconds: 3600,
      probeIntervalSeconds: 300,
      retentionFloorSeconds: 3600,
    };
    const kpis = {
      ...value.kpis,
      requiredProviderCount: 1,
      requiredProviderKinds: ['DOCUSIGN'],
      probeIntervalSeconds: 300,
    };
    expect(
      readSignatureProviderOverview({ ...value, policy, kpis }).kpis.requiredProviderCount
    ).toBe(1);
    expect(() =>
      readSignatureProviderOverview({
        ...value,
        policy,
        kpis: { ...kpis, requiredProviderKinds: ['ADOBE_SIGN'] },
      })
    ).toThrow();
    expect(() =>
      readSignatureProviderOverview({
        ...value,
        policy,
        kpis: { ...kpis, probeIntervalSeconds: 301 },
      })
    ).toThrow();
    const details = diagnosticDetails();
    expect(() =>
      readSignatureProviderDiagnostics({
        ...details,
        provider: { ...details.provider, requiredByPolicy: true },
      })
    ).toThrow();
  });
  it('requires paired actual evidence and valid time intervals for observed checks', () => {
    const check = {
      checkKey: 'PROVIDER_ACCOUNT',
      state: 'PASS',
      reasonCodes: [],
      observedAt: diagnosticFixtureNow,
      validUntil: '2026-09-14T00:01:00Z',
      evidenceId: diagnosticFixtureId,
      evidenceSha256: diagnosticFixtureSha,
    };
    expect(readSignatureProviderCheck(check).state).toBe('PASS');
    expect(() => readSignatureProviderCheck({ ...check, evidenceSha256: null })).toThrow();
    expect(() =>
      readSignatureProviderCheck({ ...check, validUntil: diagnosticFixtureNow })
    ).toThrow();
    expect(() => readSignatureProviderCheck({ ...check, state: 'NOT_OBSERVED' })).toThrow();
  });
  it('rejects calendar overflow while preserving native nanosecond timestamp strings', () => {
    expect(() => diagnosticInstant('2026-02-30T00:00:00Z')).toThrow();
    expect(diagnosticInstant('2026-09-14T00:00:00.123456789Z')).toBe(
      '2026-09-14T00:00:00.123456789Z'
    );
  });
  it('does not confuse internal or managed KMS keys with hardware-token evidence', () => {
    const value = diagnosticOverview().kms;
    expect(() =>
      readSignatureProviderKms({ ...value, backend: 'AWS_KMS', verificationKind: 'HARDWARE_TOKEN' })
    ).toThrow();
    expect(() => readSignatureProviderKms({ ...value, state: 'PASS' })).toThrow();
  });
  it('requires actual version retention proof rather than legal-hold/append-only assertions', () => {
    const value = diagnosticOverview().worm;
    expect(() => readSignatureProviderWorm({ ...value, state: 'PASS', legalHold: true })).toThrow();
  });
  it('reads credential-safe registered settings and rejects invented registration evidence', () => {
    const value = diagnosticDetails();
    expect(readSignatureProviderDiagnostics(value).settings.configuration).toBeNull();
    expect(() =>
      readSignatureProviderDiagnostics({
        ...value,
        settings: { ...value.settings, credentialRegistered: true },
      })
    ).toThrow();
    expect(() =>
      readSignatureProviderDiagnostics({
        ...value,
        settings: { ...value.settings, rawCredential: 'secret' },
      })
    ).toThrow();
  });
  it.each([
    'https://www.docusign.com@localhost/',
    'https://www.docusign.com:443/',
    'https://www.docusign.com/../foo',
    'https://www.docusign.com/%2e%2e/',
    'https://www.docusign.com/?next=https://localhost',
    'javascript:alert(1)',
  ])('rejects unsafe official documentation origin %s', (link) => {
    expect(() => diagnosticOfficialLink(link)).toThrow();
  });
  it('accepts only the fixed primary documentation link without normalizing away evidence', () => {
    expect(diagnosticOfficialLink('https://developers.docusign.com/docs/esign-rest-api/')).toBe(
      'https://developers.docusign.com/docs/esign-rest-api/'
    );
  });
  it('decodes bounded diagnostic history without upgrading it into a current observation', () => {
    const history = {
      scope: diagnosticScope(),
      items: [
        {
          probeRunId: diagnosticFixtureId,
          providerId: null,
          sourceRevision: `sigp-${diagnosticFixtureSha}`,
          sourceSha256: diagnosticFixtureSha,
          state: 'PARTIAL',
          occurredAt: diagnosticFixtureNow,
          reasonCodes: [],
          evidenceId: null,
          evidenceSha256: null,
        },
      ],
      nextCursor: null,
      truncated: false,
    };
    expect(readSignatureProviderDiagnosticHistory(history).items[0].providerId).toBeNull();
    expect(() => readSignatureProviderDiagnosticHistory({ ...history, truncated: true })).toThrow();
    expect(() =>
      readSignatureProviderDiagnosticHistory({
        ...history,
        items: Array.from({ length: 51 }, () => history.items[0]),
      })
    ).toThrow();
    expect(() =>
      readSignatureProviderDiagnosticHistory({
        ...history,
        items: [{ ...history.items[0], evidenceId: diagnosticFixtureId }],
      })
    ).toThrow();
  });
});

describe('native signature provider policy producer contracts', () => {
  it('reads actual disabled authored rules without filling missing fields', () => {
    const rules = readSignatureProviderPolicyRules(diagnosticDisabledRules());
    expect(rules.signingEnabled).toBe(false);
    expect(rules.requiredProviderKinds).toEqual([]);
    expect(Object.isFrozen(rules.requiredProviderKinds)).toBe(true);
    const missing: Record<string, unknown> = { ...rules };
    delete missing.minimumRetentionDays;
    expect(() => readSignatureProviderPolicyRules(missing)).toThrow();
  });
  it.each([
    { requireAuthenticatedWebhook: false },
    { requireVerifiedProviderAccount: false },
    { minimumRetentionDays: 0 },
    { probeMaxAgeSeconds: 86401 },
    { requiredProviderKinds: ['INTERNAL'] },
    { allowedClassifications: ['PUBLIC'] },
    { minimumRetentionDays: 12.5 },
  ])('rejects lowered or unsupported rules %j', (patch) => {
    expect(() =>
      readSignatureProviderPolicyRules({ ...diagnosticDisabledRules(), ...patch })
    ).toThrow();
  });
  it('validates compiler references without inventing a configuration or trust-bundle UUID', () => {
    const rules = readSignatureProviderPolicyRules({
      ...diagnosticDisabledRules(),
      signingEnabled: true,
      requiredProviderKinds: ['DOCUSIGN'],
      allowedClassifications: ['INTERNAL'],
    });
    expect(() => assertSignatureProviderPolicyCompilable(rules)).toThrow();
    expect(() =>
      assertSignatureProviderPolicyCompilable({
        ...rules,
        configurationBinding: {
          sourceId: diagnosticFixtureId,
          version: 0,
          sha256: diagnosticFixtureSha,
        },
        trustBundleId: diagnosticFixtureDraftId,
      })
    ).not.toThrow();
  });
  it('keeps published and working draft pointers distinct and nullable review unevaluated', () => {
    const policy = readSignatureProviderPolicyView(diagnosticPolicy());
    expect(policy.publishReview).toBeNull();
    expect(policy.workingDraft?.versionId).not.toBe(policy.published?.versionId);
    expect(() =>
      readSignatureProviderPolicyView({
        ...policy,
        workingDraft: { ...policy.workingDraft, versionId: policy.published?.versionId },
      })
    ).toThrow();
    expect(() =>
      readSignatureProviderPolicyView({ ...policy, published: null, workingDraft: null })
    ).toThrow();
  });
  it('rejects maker/last-editor self-publication evidence', () => {
    const published = diagnosticPolicy().published;
    expect(() =>
      readSignatureProviderPolicyPublished({
        ...published,
        checkerPersonPublicId: published?.originalMakerPersonPublicId,
      })
    ).toThrow();
  });
  it('binds authoritative eight-field review to draft UUID, revision and head CAS', () => {
    const policy = diagnosticPolicy();
    const review = {
      draftVersionId: diagnosticFixtureDraftId,
      policyVersion: 1,
      draftRevision: 1,
      reviewContentSha256: diagnosticFixtureSha,
      eligibility: 'ELIGIBLE',
      reasonCodes: [],
      stepUpRequired: true,
      validUntil: '2026-09-14T00:01:00Z',
    };
    expect(
      readSignatureProviderPolicyView({ ...policy, publishReview: review }).publishReview
        ?.reviewContentSha256
    ).toBe(diagnosticFixtureSha);
    for (const patch of [
      { policyVersion: 2 },
      { draftVersionId: diagnosticFixtureId },
      { draftRevision: 2 },
    ])
      expect(() =>
        readSignatureProviderPolicyView({ ...policy, publishReview: { ...review, ...patch } })
      ).toThrow();
    for (const patch of [
      { stepUpRequired: false },
      { validUntil: null },
      { reasonCodes: ['SOURCE_UNAVAILABLE'] },
      { eligibility: 'NOT_EVALUATED' },
    ])
      expect(() => readSignatureProviderPolicyPublishReview({ ...review, ...patch })).toThrow();
  });
  it('requires truthful keyset history and no fabricated publication metadata', () => {
    const policy = diagnosticPolicy(),
      draft = policy.workingDraft;
    const item = {
      ...draft,
      state: 'DRAFT',
      checkerPersonPublicId: null,
      reviewEvidenceId: null,
      reviewContentSha256: null,
      publishedAt: null,
    };
    const history = {
      scope: policy.scope,
      policyId: policy.policyId,
      items: [item],
      nextCursor: null,
      truncated: false,
    };
    expect(readSignatureProviderPolicyHistory(history).items).toHaveLength(1);
    expect(() => readSignatureProviderPolicyHistory({ ...history, truncated: true })).toThrow();
    expect(() => readSignatureProviderPolicyHistory({ ...history, items: [item, item] })).toThrow();
    expect(() =>
      readSignatureProviderPolicyHistory({
        ...history,
        items: [{ ...item, publishedAt: diagnosticFixtureNow }],
      })
    ).toThrow();
  });
});
