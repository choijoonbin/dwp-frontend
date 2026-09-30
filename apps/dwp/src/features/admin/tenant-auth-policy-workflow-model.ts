import type { TenantAuthPolicyDraft } from '@dwp-frontend/shared-utils';

const POLICY_STATES = new Set([
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'SUPERSEDED',
]);
const IMPACT_CONFIDENCE = new Set(['UNKNOWN', 'ESTIMATED', 'EXACT']);

export function authPolicyStateLabelKey(state: string): string {
  return `settingsHome.authPolicyWorkflow.states.${POLICY_STATES.has(state) ? state : 'UNKNOWN'}`;
}

export function authPolicyImpactConfidenceLabelKey(confidence: string): string {
  return `settingsHome.authPolicyWorkflow.confidence.${IMPACT_CONFIDENCE.has(confidence) ? confidence : 'UNKNOWN'}`;
}

export function authPolicyCoverageLabelKey(coverage: string): string {
  return coverage === 'INTERNAL_AUTH_DIRECTORY_ACTIVE_IDENTITIES'
    ? 'settingsHome.authPolicyWorkflow.coverageStates.INTERNAL_AUTH_DIRECTORY_ACTIVE_IDENTITIES'
    : 'settingsHome.authPolicyWorkflow.coverageStates.UNKNOWN';
}

export function resolveTenantAuthPolicyDraft(
  current: TenantAuthPolicyDraft | null
): TenantAuthPolicyDraft {
  return (
    current ?? {
      defaultLoginType: 'LOCAL',
      allowedLoginTypes: ['LOCAL'],
      localLoginEnabled: true,
      ssoLoginEnabled: false,
      ssoProviderKey: null,
      requireMfa: false,
      tokenTtlSec: null,
    }
  );
}
