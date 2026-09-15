import {
  assertSignatureProviderPolicyCompilable,
  readSignatureProviderPolicyRules,
  readSignatureProviderPolicyView,
  type SignatureProviderPolicyRules,
  type SignatureProviderPolicyView,
} from '@dwp-frontend/shared-utils/api/approval-signature-provider-policy-contract';

export const APPROVAL_SIGNATURE_PROVIDER_KINDS = ['DOCUSIGN', 'ADOBE_SIGN', 'CUSTOM'] as const;
export const APPROVAL_SIGNATURE_CLASSIFICATIONS = [
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
] as const;

export function approvalSignatureInitialPolicyRules(): SignatureProviderPolicyRules {
  return Object.freeze({
    signingEnabled: false,
    requiredProviderKinds: Object.freeze([]),
    allowedClassifications: Object.freeze(['INTERNAL'] as const),
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
  });
}

export function approvalSignaturePolicyRulesValid(rules: SignatureProviderPolicyRules): boolean {
  try {
    assertSignatureProviderPolicyCompilable(readSignatureProviderPolicyRules(rules));
    return true;
  } catch {
    return false;
  }
}

export function approvalSignaturePolicyFingerprint(policy: SignatureProviderPolicyView): string {
  return JSON.stringify(readSignatureProviderPolicyView(policy));
}

export function approvalSignaturePolicyDraftSourceId(policy: SignatureProviderPolicyView): string {
  return policy.workingDraft?.versionId ?? policy.published?.versionId ?? '';
}

export function approvalSignaturePolicyEditableRules(
  policy: SignatureProviderPolicyView
): SignatureProviderPolicyRules {
  return readSignatureProviderPolicyRules(
    policy.workingDraft?.rules ?? policy.published?.rules ?? approvalSignatureInitialPolicyRules()
  );
}
