import type { MailAdminOverview } from '@dwp-frontend/shared-utils';
import type { MailAdminEvidenceState, MailPolicyGovernance } from './mail-admin-operations-model';

export type MailGovernanceTab = 'content' | 'ai' | 'evidence' | 'history';

export type MailGovernanceDomain = 'CONTENT' | 'AI';

export type MailGovernancePolicyView = {
  id: string;
  policyKey: string;
  domain: MailGovernanceDomain;
  configuredValue?: string | null;
  effectiveValue?: string | null;
  effectiveState: 'ENFORCED' | 'PARTIAL' | 'PENDING' | 'UNVERIFIED' | 'UNAVAILABLE';
  scope: string;
  evidenceSource?: string | null;
  evidenceAt?: string | null;
  evidenceState: MailAdminEvidenceState;
  errorCode?: string | null;
  missingContract: boolean;
};

const CONTENT_POLICY_KEYS = new Set([
  'externalSenderBanner',
  'blockRemoteImages',
  'allowSharedInboxes',
  'maximumAttachmentMb',
  'retentionDays',
]);

const AI_POLICY_KEYS = new Set([
  'aiAssistanceEnabled',
  'aiCrossAppActionsEnabled',
  'aiAutoExecuteEnabled',
]);

const REQUIRED_CONTENT_CONTRACTS = [
  'allowedAttachmentTypes',
  'attachmentInspectionReadiness',
  'dlpReadiness',
] as const;

const REQUIRED_AI_CONTRACTS = [
  'aiContentGeneration',
  'aiTargetApplications',
  'aiDataScopes',
  'aiExternalTransfer',
  'aiReviewRequirement',
] as const;

function policyDomain(policyKey: string): MailGovernanceDomain | null {
  if (CONTENT_POLICY_KEYS.has(policyKey)) return 'CONTENT';
  if (AI_POLICY_KEYS.has(policyKey)) return 'AI';
  return null;
}

function evidenceState(input: {
  effectiveState: MailGovernancePolicyView['effectiveState'];
  evidenceSource?: string | null;
  evidenceAt?: string | null;
}): MailAdminEvidenceState {
  if (input.effectiveState === 'PARTIAL') return 'PARTIAL';
  if (input.effectiveState === 'PENDING') return 'REPORTED';
  if (
    input.effectiveState === 'ENFORCED' &&
    Boolean(input.evidenceSource) &&
    Boolean(input.evidenceAt)
  ) {
    return 'VERIFIED';
  }
  return 'UNAVAILABLE';
}

function unavailableContract(
  policyKey: string,
  domain: MailGovernanceDomain
): MailGovernancePolicyView {
  return {
    id: `required:${policyKey}`,
    policyKey,
    domain,
    configuredValue: null,
    effectiveValue: null,
    effectiveState: 'UNAVAILABLE',
    scope: 'UNAVAILABLE',
    evidenceSource: null,
    evidenceAt: null,
    evidenceState: 'UNAVAILABLE',
    errorCode: 'POLICY_CONTRACT_NOT_PROVIDED',
    missingContract: true,
  };
}

function fallbackPolicies(overview: MailAdminOverview): MailGovernancePolicyView[] {
  const configured: ReadonlyArray<readonly [string, MailGovernanceDomain, boolean | number]> = [
    ['externalSenderBanner', 'CONTENT', overview.policy.externalSenderBanner],
    ['blockRemoteImages', 'CONTENT', overview.policy.blockRemoteImages],
    ['allowSharedInboxes', 'CONTENT', overview.policy.allowSharedInboxes],
    ['maximumAttachmentMb', 'CONTENT', overview.policy.maximumAttachmentMb],
    ['retentionDays', 'CONTENT', overview.policy.retentionDays],
    ['aiAssistanceEnabled', 'AI', overview.policy.aiAssistanceEnabled],
    ['aiCrossAppActionsEnabled', 'AI', overview.policy.aiCrossAppActionsEnabled],
    ['aiAutoExecuteEnabled', 'AI', overview.policy.aiAutoExecuteEnabled],
  ];

  return configured.map(([policyKey, domain, value]) => ({
    id: `configured:${policyKey}`,
    policyKey,
    domain,
    configuredValue: String(value),
    effectiveValue: null,
    effectiveState: 'UNVERIFIED',
    scope: 'TENANT',
    evidenceSource: null,
    evidenceAt: null,
    evidenceState: 'UNAVAILABLE',
    errorCode: 'EFFECTIVE_POLICY_EVIDENCE_UNAVAILABLE',
    missingContract: false,
  }));
}

export function buildMailGovernancePolicyViews(
  overview: MailAdminOverview,
  governance?: MailPolicyGovernance
): readonly MailGovernancePolicyView[] {
  const projected = governance?.rows.flatMap((row) => {
    const domain = policyDomain(row.policyKey);
    if (!domain) return [];
    const view: MailGovernancePolicyView = {
      id: `policy:${row.policyKey}`,
      policyKey: row.policyKey,
      domain,
      configuredValue: row.configuredValue,
      effectiveValue: row.effectiveValue,
      effectiveState: row.effectiveState,
      scope: row.scope,
      evidenceSource: row.evidenceSource,
      evidenceAt: row.evidenceAt,
      evidenceState: evidenceState(row),
      errorCode: row.errorCode,
      missingContract: false,
    };
    return [view];
  });
  const rows = projected?.length ? projected : fallbackPolicies(overview);
  const policyKeys = new Set(rows.map((row) => row.policyKey));
  const missing = [
    ...REQUIRED_CONTENT_CONTRACTS.filter((key) => !policyKeys.has(key)).map((key) =>
      unavailableContract(key, 'CONTENT')
    ),
    ...REQUIRED_AI_CONTRACTS.filter((key) => !policyKeys.has(key)).map((key) =>
      unavailableContract(key, 'AI')
    ),
  ];
  return [...rows, ...missing];
}

export function mailGovernanceRowsForDomain(
  rows: readonly MailGovernancePolicyView[],
  domain: MailGovernanceDomain
) {
  return rows.filter((row) => row.domain === domain);
}

export function mailGovernanceEvidenceCounts(rows: readonly MailGovernancePolicyView[]) {
  return rows.reduce(
    (counts, row) => {
      counts[row.evidenceState] += 1;
      return counts;
    },
    {
      VERIFIED: 0,
      REPORTED: 0,
      PARTIAL: 0,
      STALE: 0,
      UNAVAILABLE: 0,
    } satisfies Record<MailAdminEvidenceState, number>
  );
}
