import {
  APPROVAL_POLICY_IMPACT_GRANTS,
  APPROVAL_POLICY_IMPACT_ROUTE,
} from '../api/approval-policy-impact-contract';
import type { ApprovalPolicyImpactReadAuthority } from '../api/approval-policy-impact-contract';

export const policyImpactId = '11111111-1111-4111-8111-111111111111';
export const policyImpactAuthority: ApprovalPolicyImpactReadAuthority = {
  tenantId: 1,
  actorId: 13,
  resourceSetKey: 'RS_APPROVAL_FINANCE',
  contextKey: 'ctx-admin',
  contextScopeKey: 'opaque-owner-scope',
  expectedDecisionRevision: `psr-${'a'.repeat(64)}`,
  routeContractKey: APPROVAL_POLICY_IMPACT_ROUTE,
  mode: 'SECURE',
  rolloutState: '111',
  accessMode: 'NORMAL',
};
export function policyImpactFixture(now = Date.now()) {
  const rules = {
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    lifecycleState: 'ACTIVE',
    rule: { requesterCannotDecide: true },
  };
  const family = () => ({
    counts: {
      examined: 0,
      constraintChanged: 0,
      pinConflict: 0,
      configurationOnly: 0,
      unknown: 0,
      complete: true,
      countKind: 'EXACT_OBSERVED_AT',
    },
    items: [] as Array<{
      id: string;
      version: number;
      effect: {
        reasons: string[];
        constraintChanged: boolean;
        pinConflict: boolean;
        configurationOnly: boolean;
        unknown: boolean;
      };
    }>,
  });
  return {
    status: 'COMPLETE',
    policy: {
      policyId: policyImpactId,
      policyKey: 'BLOCK_SELF_APPROVAL',
      rowVersion: 2,
      current: rules,
      pending: { ...rules, severity: 'CRITICAL' },
      metadataProvenance: 'REVIEWED_PUBLISH',
    },
    sourceDigest: 'b'.repeat(64),
    semanticDiff: [{ path: '$.severity', kind: 'CHANGE', current: 'HIGH', proposed: 'CRITICAL' }],
    workflows: family(),
    requests: family(),
    tasks: family(),
    observedAt: new Date(now).toISOString(),
    authority: {
      tenantId: 1,
      actorId: 13,
      resourceSetKey: 'RS_APPROVAL_FINANCE',
      contextKey: 'ctx-admin',
      contextScopeKey: 'opaque-owner-scope',
      decisionRevision: policyImpactAuthority.expectedDecisionRevision,
      routeKey: APPROVAL_POLICY_IMPACT_ROUTE,
      rolloutState: '111',
      validUntil: new Date(now + 30000).toISOString(),
      accessMode: 'NORMAL',
      providerIdentity: false,
      supportSession: false,
      entitlementSatisfied: true,
      grants: Object.fromEntries(
        Object.entries(APPROVAL_POLICY_IMPACT_GRANTS).map(([key, permission]) => [
          key,
          { resourceSetKey: 'RS_APPROVAL_FINANCE', permission },
        ])
      ),
    },
  };
}
