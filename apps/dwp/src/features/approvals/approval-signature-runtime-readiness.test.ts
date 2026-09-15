import { describe, expect, it } from 'vitest';
import {
  diagnosticCard,
  diagnosticFixtureId,
  diagnosticFixtureNow,
  diagnosticFixtureSha,
  diagnosticOverview,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics.test-support';
import type { SignatureProviderOverview } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import {
  approvalSignatureInternalRuntimeReady,
  approvalSignatureProviderRuntimeReady,
} from './approval-signature-runtime-readiness';
import { approvalSignatureContextFixture } from '../../../../../e2e/support/approval-signature-fixtures';

const now = Date.parse(diagnosticFixtureNow) + 1_000;
const validUntil = '2030-09-15T00:00:00Z';

function readyOverview(): SignatureProviderOverview {
  const base = diagnosticOverview();
  return {
    ...base,
    policy: {
      sourceState: 'AVAILABLE',
      pin: { sourceId: diagnosticFixtureId, version: 2, sha256: diagnosticFixtureSha },
      requiredProviderKinds: ['DOCUSIGN'],
      maxProbeAgeSeconds: 3_600,
      probeIntervalSeconds: 900,
      retentionFloorSeconds: 31_536_000,
    },
    kpis: {
      ...base.kpis,
      configuredProviderCount: 1,
      verifiedProductionProviderCount: 1,
      requiredProviderCount: 1,
      requiredProviderKinds: ['DOCUSIGN'],
      externalGateState: 'ELIGIBLE',
      gateReasonCodes: [],
      lastProbeAt: diagnosticFixtureNow,
      probeIntervalSeconds: 900,
    },
    providers: [
      {
        ...diagnosticCard('DOCUSIGN'),
        adapterInstalled: true,
        configurationRegistered: true,
        credentialRegistered: true,
        credentialVerified: true,
        requiredByPolicy: true,
        environment: 'PRODUCTION',
        readiness: 'VERIFIED_PRODUCTION',
        gateReasonCodes: [],
        lastProbeAt: diagnosticFixtureNow,
      },
    ],
    kms: {
      backend: 'AWS_KMS',
      verificationKind: 'CONFIGURED_KMS',
      state: 'PASS',
      algorithm: 'ECDSA_P384_SHA384',
      keySha256: diagnosticFixtureSha,
      source: 'AWS_KMS_DESCRIBE_KEY',
      checkedAt: diagnosticFixtureNow,
      validUntil,
      evidenceId: diagnosticFixtureId,
      evidenceSha256: diagnosticFixtureSha,
      reasonCodes: [],
    },
    worm: {
      state: 'PASS',
      storageLocatorSha256: diagnosticFixtureSha,
      objectVersionSha256: diagnosticFixtureSha,
      objectLockMode: 'COMPLIANCE',
      retainUntil: validUntil,
      legalHold: false,
      policy: { sourceId: diagnosticFixtureId, version: 2, sha256: diagnosticFixtureSha },
      retentionFloorSeconds: 31_536_000,
      checkedAt: diagnosticFixtureNow,
      validUntil,
      evidenceId: diagnosticFixtureId,
      evidenceSha256: diagnosticFixtureSha,
      reasonCodes: [],
    },
  };
}

describe('APR-16B runtime readiness', () => {
  it('requires the live internal signing key state', () => {
    const context = approvalSignatureContextFixture();
    expect(approvalSignatureInternalRuntimeReady(context)).toBe(true);
    expect(
      approvalSignatureInternalRuntimeReady({
        ...context,
        signingReadiness: 'NOT_VERIFIED',
        source: { ...context.source, signingKeySha256: null },
      })
    ).toBe(false);
    expect(approvalSignatureInternalRuntimeReady(undefined)).toBe(false);
  });

  it('requires verified production provider, KMS and compliance WORM evidence together', () => {
    const ready = readyOverview();
    expect(approvalSignatureProviderRuntimeReady(ready, now)).toBe(true);
    expect(
      approvalSignatureProviderRuntimeReady(
        { ...ready, providers: [{ ...ready.providers[0]!, adapterInstalled: false }] },
        now
      )
    ).toBe(false);
    expect(
      approvalSignatureProviderRuntimeReady({ ...ready, kms: { ...ready.kms, state: 'FAIL' } }, now)
    ).toBe(false);
    expect(
      approvalSignatureProviderRuntimeReady(
        { ...ready, worm: { ...ready.worm, state: 'NOT_OBSERVED' } },
        now
      )
    ).toBe(false);
  });

  it('fails closed for missing, stale, or backend-blocked runtime evidence', () => {
    const ready = readyOverview();
    expect(approvalSignatureProviderRuntimeReady(undefined, now)).toBe(false);
    expect(
      approvalSignatureProviderRuntimeReady(
        { ...ready, kpis: { ...ready.kpis, externalGateState: 'BLOCKED' } },
        now
      )
    ).toBe(false);
    expect(approvalSignatureProviderRuntimeReady(ready, Date.parse(validUntil))).toBe(false);
  });
});
