import type {
  SignatureProviderCard,
  SignatureProviderDiagnostics,
  SignatureProviderOverview,
  SignatureProviderScope,
} from './approval-signature-diagnostics-contract';
import type {
  SignatureProviderPolicyRules,
  SignatureProviderPolicyView,
} from './approval-signature-provider-policy-contract';

export const diagnosticFixtureSha = 'a'.repeat(64);
export const diagnosticFixtureNow = '2026-09-14T00:00:00Z';
export const diagnosticFixtureId = '11111111-1111-4111-8111-111111111111';
export const diagnosticFixtureDraftId = '22222222-2222-4222-8222-222222222222';
const maker = '33333333-3333-4333-8333-333333333333';
const checker = '44444444-4444-4444-8444-444444444444';

export function diagnosticScope(): SignatureProviderScope {
  return {
    resourceSetKey: 'RS_APPROVALS',
    contextScopeKey: 'opaque-diagnostic-context',
    decisionRevision: `psr-${diagnosticFixtureSha}`,
    registrySha256: diagnosticFixtureSha,
    sourceRevision: `sigp-${diagnosticFixtureSha}`,
    sourceSha256: diagnosticFixtureSha,
    evaluatedAt: diagnosticFixtureNow,
  };
}
export function diagnosticCard(
  kind: SignatureProviderCard['kind'] = 'DOCUSIGN'
): SignatureProviderCard {
  return {
    providerId: diagnosticFixtureId,
    kind,
    displayName: kind,
    providerVersion: 0,
    providerSha256: diagnosticFixtureSha,
    adapterInstalled: false,
    configurationRegistered: false,
    credentialRegistered: false,
    credentialVerified: false,
    requiredByPolicy: null,
    environment: 'UNCONFIGURED',
    readiness: 'MISSING_INTERNAL',
    gateReasonCodes: ['ADAPTER_NOT_INSTALLED'],
    lastProbeAt: null,
    checks: [],
  };
}
export function diagnosticOverview(): SignatureProviderOverview {
  return {
    scope: diagnosticScope(),
    policy: {
      sourceState: 'NOT_CONFIGURED',
      pin: null,
      requiredProviderKinds: null,
      maxProbeAgeSeconds: null,
      probeIntervalSeconds: null,
      retentionFloorSeconds: null,
    },
    kpis: {
      registeredProviderCount: 3,
      configuredProviderCount: 0,
      verifiedProductionProviderCount: 0,
      requiredProviderCount: null,
      requiredProviderKinds: null,
      externalGateState: 'NOT_EVALUATED',
      gateReasonCodes: ['POLICY_NOT_CONFIGURED'],
      lastProbeAt: null,
      probeIntervalSeconds: null,
    },
    providers: [
      diagnosticCard('INTERNAL'),
      { ...diagnosticCard('DOCUSIGN'), providerId: diagnosticFixtureDraftId },
      { ...diagnosticCard('ADOBE_SIGN'), providerId: maker },
    ],
    phases: [
      {
        phaseKind: 'INTERNAL_DECISION',
        gateState: 'NOT_EVALUATED',
        reasonCodes: [],
        checkKeys: [],
        evidenceIds: [],
      },
      {
        phaseKind: 'EXTERNAL_HANDOVER',
        gateState: 'BLOCKED',
        reasonCodes: ['POLICY_NOT_CONFIGURED'],
        checkKeys: [],
        evidenceIds: [],
      },
      {
        phaseKind: 'VERIFIED_COMPLETION',
        gateState: 'NOT_EVALUATED',
        reasonCodes: [],
        checkKeys: [],
        evidenceIds: [],
      },
    ],
    kms: {
      backend: 'NONE',
      verificationKind: 'NONE',
      state: 'NOT_OBSERVED',
      algorithm: null,
      keySha256: null,
      source: 'NONE',
      checkedAt: null,
      validUntil: null,
      evidenceId: null,
      evidenceSha256: null,
      reasonCodes: [],
    },
    worm: {
      state: 'NOT_OBSERVED',
      storageLocatorSha256: null,
      objectVersionSha256: null,
      objectLockMode: 'NONE',
      retainUntil: null,
      legalHold: null,
      policy: null,
      retentionFloorSeconds: null,
      checkedAt: null,
      validUntil: null,
      evidenceId: null,
      evidenceSha256: null,
      reasonCodes: [],
    },
  };
}
export function diagnosticDetails(): SignatureProviderDiagnostics {
  const overview = diagnosticOverview();
  return {
    scope: overview.scope,
    policy: overview.policy,
    provider: diagnosticCard(),
    settings: {
      configuration: null,
      environment: 'UNCONFIGURED',
      endpointOriginSha256: null,
      accountBindingSha256: null,
      credentialRegistered: false,
      callbackAuthenticationMode: 'NONE',
      configurationOwner: 'UNRECORDED',
    },
    gateReasons: ['ADAPTER_NOT_INSTALLED'],
    guide: { sections: [] },
    phases: overview.phases,
    kms: overview.kms,
    worm: overview.worm,
  };
}
export function diagnosticDisabledRules(): SignatureProviderPolicyRules {
  return {
    signingEnabled: false,
    requiredProviderKinds: [],
    allowedClassifications: [],
    requireVerifiedProviderAccount: true,
    requireAuthenticatedWebhook: true,
    requireTrustedCertificateChain: true,
    requireFreshRevocationEvidence: true,
    requireTrustedTimestamp: true,
    requireComplianceWormStorage: true,
    minimumRetentionDays: 365,
    probeMaxAgeSeconds: 3600,
    trustBundleId: null,
    configurationBinding: null,
  };
}
export function diagnosticPolicy(): SignatureProviderPolicyView {
  return {
    scope: diagnosticScope(),
    policyId: diagnosticFixtureId,
    version: 1,
    workingDraft: {
      versionId: diagnosticFixtureDraftId,
      revision: 1,
      rules: diagnosticDisabledRules(),
      rulesSha256: diagnosticFixtureSha,
      originalMakerPersonPublicId: maker,
      lastEditorPersonPublicId: maker,
      createdAt: diagnosticFixtureNow,
    },
    published: {
      versionId: diagnosticFixtureId,
      revision: 0,
      rules: diagnosticDisabledRules(),
      rulesSha256: diagnosticFixtureSha,
      originalMakerPersonPublicId: maker,
      lastEditorPersonPublicId: maker,
      checkerPersonPublicId: checker,
      reviewEvidenceId: checker,
      reviewContentSha256: diagnosticFixtureSha,
      publishedAt: diagnosticFixtureNow,
    },
    publishReview: null,
  };
}
