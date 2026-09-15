import { describe, expect, it } from 'vitest';
import {
  diagnosticCard,
  diagnosticFixtureSha,
  diagnosticOverview,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics.test-support';
import {
  approvalExternalSignatureContextCurrent,
  approvalExternalSignatureProviderTarget,
  approvalExternalSignatureRequestCurrent,
  approvalExternalSignatureSessionKey,
  readApprovalExternalSignatureSessionId,
} from './approval-external-signature-model';

const requestId = '11111111-1111-4111-8111-111111111111';
const providerId = '22222222-2222-4222-8222-222222222222';
const versionId = '33333333-3333-4333-8333-333333333333';
const source = {
  requestId,
  requestVersion: 3,
  resourceSetKey: 'RS_APPROVALS',
  dataClassification: 'CONFIDENTIAL' as const,
  workflowVersionId: versionId,
  formVersionId: versionId,
  payloadRevision: 1,
  payloadSha256: diagnosticFixtureSha,
  sourceSha256: diagnosticFixtureSha,
};
const context = {
  scope: diagnosticOverview().scope,
  source,
  policy: diagnosticOverview().policy,
  providers: [],
  gateState: 'BLOCKED' as const,
  reasonCodes: ['POLICY_NOT_CONFIGURED'],
  evaluatedAt: '2026-09-15T00:00:00Z',
};

describe('external signature owner and provider binding', () => {
  it('accepts only a configured, verified production provider target', () => {
    const verified = {
      ...diagnosticCard('DOCUSIGN'),
      providerId,
      providerVersion: 5,
      providerSha256: diagnosticFixtureSha,
      adapterInstalled: true,
      configurationRegistered: true,
      credentialRegistered: true,
      credentialVerified: true,
      environment: 'PRODUCTION' as const,
      readiness: 'VERIFIED_PRODUCTION' as const,
      lastProbeAt: '2026-09-15T00:00:00Z',
      requiredByPolicy: true,
      gateReasonCodes: [],
    };
    expect(approvalExternalSignatureProviderTarget(verified)).toEqual({
      providerId,
      expectedProviderVersion: 5,
      expectedProviderSha256: diagnosticFixtureSha,
      expectedConfiguration: {
        sourceId: providerId,
        version: 5,
        sha256: diagnosticFixtureSha,
      },
    });
    expect(
      approvalExternalSignatureProviderTarget({ ...verified, environment: 'SANDBOX' })
    ).toBeNull();
    expect(
      approvalExternalSignatureProviderTarget({ ...verified, readiness: 'NOT_VERIFIED' })
    ).toBeNull();
    expect(
      approvalExternalSignatureProviderTarget({ ...verified, adapterInstalled: false })
    ).toBeNull();
    expect(
      approvalExternalSignatureProviderTarget({ ...verified, credentialVerified: false })
    ).toBeNull();
  });

  it('binds the context and request to exact request, version, resource set and source', () => {
    const now = Date.parse('2026-09-15T00:00:01Z');
    expect(
      approvalExternalSignatureContextCurrent(context, requestId, 3, 'RS_APPROVALS', now)
    ).toBe(true);
    expect(approvalExternalSignatureContextCurrent(context, requestId, 3, 'RS_FOREIGN', now)).toBe(
      false
    );
    expect(
      approvalExternalSignatureContextCurrent(context, requestId, 4, 'RS_APPROVALS', now)
    ).toBe(false);

    const request = {
      scope: context.scope,
      signatureRequestId: providerId,
      source,
      provider: {
        providerId,
        expectedProviderVersion: 5,
        expectedProviderSha256: diagnosticFixtureSha,
        expectedConfiguration: null,
      },
      policyId: versionId,
      policyVersionId: versionId,
      policySha256: diagnosticFixtureSha,
      state: 'PREPARED' as const,
      version: 0,
      remoteReferenceSha256: null,
      reasonCodes: [],
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
    };
    expect(approvalExternalSignatureRequestCurrent(request, context)).toBe(true);
    expect(
      approvalExternalSignatureRequestCurrent(
        { ...request, source: { ...source, requestVersion: 4 } },
        context
      )
    ).toBe(false);
  });

  it('isolates restored sessions by actor, scope and owner request', () => {
    expect(approvalExternalSignatureSessionKey('7', 'scope-a', requestId)).toBe(
      `dwp:approval:external-signature:7:scope-a:${requestId}`
    );
    expect(readApprovalExternalSignatureSessionId(providerId)).toBe(providerId);
    expect(readApprovalExternalSignatureSessionId('../foreign')).toBeNull();
  });
});
