import { describe, expect, it } from 'vitest';
import {
  diagnosticFixtureDraftId,
  diagnosticFixtureSha,
  diagnosticPolicy,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics.test-support';
import {
  approvalSignatureInitialPolicyRules,
  approvalSignaturePolicyDraftSourceId,
  approvalSignaturePolicyEditableRules,
  approvalSignaturePolicyFingerprint,
  approvalSignaturePolicyRulesValid,
} from './approval-signature-policy-model';

describe('signature provider policy editor model', () => {
  it('initializes only a disabled, verified, authenticated policy', () => {
    const rules = approvalSignatureInitialPolicyRules();
    expect(rules).toMatchObject({
      signingEnabled: false,
      requiredProviderKinds: [],
      requireVerifiedProviderAccount: true,
      requireAuthenticatedWebhook: true,
      configurationBinding: null,
    });
    expect(approvalSignaturePolicyRulesValid(rules)).toBe(true);
  });

  it('requires production configuration, providers and classifications before enabling signing', () => {
    const base = approvalSignatureInitialPolicyRules();
    expect(approvalSignaturePolicyRulesValid({ ...base, signingEnabled: true })).toBe(false);
    expect(
      approvalSignaturePolicyRulesValid({
        ...base,
        signingEnabled: true,
        requiredProviderKinds: ['DOCUSIGN'],
        allowedClassifications: ['CONFIDENTIAL'],
        trustBundleId: diagnosticFixtureDraftId,
        configurationBinding: {
          sourceId: diagnosticFixtureDraftId,
          version: 4,
          sha256: diagnosticFixtureSha,
        },
      })
    ).toBe(true);
  });

  it('pins edits and fingerprints to the exact current server policy', () => {
    const policy = diagnosticPolicy();
    expect(approvalSignaturePolicyDraftSourceId(policy)).toBe(diagnosticFixtureDraftId);
    expect(approvalSignaturePolicyEditableRules(policy)).toEqual(policy.workingDraft!.rules);
    expect(approvalSignaturePolicyFingerprint(policy)).toBe(JSON.stringify(policy));
    expect(approvalSignaturePolicyFingerprint({ ...policy, version: policy.version + 1 })).not.toBe(
      approvalSignaturePolicyFingerprint(policy)
    );
  });
});
