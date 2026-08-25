import { describe, expect, it } from 'vitest';

import {
  hasWritableProductSurfaceCapability,
  resolveCanonicalProductSurfaceContext,
} from '../../components/product-surface-capability-access';
import {
  canDiscloseHcmApprovalAction,
  hcmApprovalCapabilityKey,
} from './hcm-approval-action-access';

import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils';

type AllowedSurfaceDecision = NonNullable<
  Parameters<typeof resolveCanonicalProductSurfaceContext>[0]
>;

const NOW = Date.parse('2029-01-01T00:00:00Z');
const FUTURE = '2030-01-01T00:00:00Z';

function access({
  capability = 'hcm.operations.time.approve',
  decisionReadOnly = false,
  scopeReadOnly = false,
}: {
  capability?: string;
  decisionReadOnly?: boolean;
  scopeReadOnly?: boolean;
} = {}) {
  const selectedScope = {
    key: 'scope:operations/non-default',
    kind: 'ORG_UNIT' as const,
    displayName: 'West operations',
    isDefault: false,
    readOnly: scopeReadOnly,
  };
  const decision: AllowedSurfaceDecision = {
    state: 'allowed',
    routeGrantRef: 'route.hcm.operations.time.page:read',
    effectiveReadOnly: decisionReadOnly,
    revalidateAt: FUTURE,
    decisionRevision: 'psr-direct-page-revision',
    scope: selectedScope,
    context: {
      contextKey: 'context:hcm-operations',
      productKey: 'hcm',
      surfaceKey: 'hcm.operations',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.HCM',
      scopes: [selectedScope],
      effectiveGrants: [],
      revalidateAt: FUTURE,
    },
  };
  const snapshot: ProductSurfaceAuthoritySnapshot = {
    envelope: {
      contractVersion: '3',
      decisionRevision: 'psr-list-revision-is-intentionally-different',
      sourceRevisions: { auth: 'auth-1' },
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts: [
        {
          ...decision.context,
          scopes: [{ ...selectedScope, validUntil: null }],
          effectiveGrants: [
            {
              grantKind: 'CAPABILITY',
              capabilityContractKey: capability,
              resolvedCapabilityCode: 'ACTION.HR_OPERATIONS:APPROVE',
              authorityMode: 'PERMISSION',
              predicatePolicyKeys: ['predicate.hcm-domain-target-population.v1'],
              responsibilityRequirement: 'REQUIRED',
              scopeKeys: [selectedScope.key],
              requiresProductEntitlement: false,
              readOnly: false,
              activationState: 'ACTIVE',
              validUntil: null,
            },
          ],
        },
      ],
      rollouts: [],
    },
    receivedAtMs: NOW,
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse(FUTURE),
  };
  const canonical = resolveCanonicalProductSurfaceContext(decision, snapshot);
  return {
    governed: true,
    hasWritableCapability: (key: string) =>
      hasWritableProductSurfaceCapability(decision, canonical, key, NOW),
  };
}

describe('HCM approval action disclosure', () => {
  it('maps the four callers to their independent canonical capabilities', () => {
    expect(hcmApprovalCapabilityKey('operations', 'time')).toBe('hcm.operations.time.approve');
    expect(hcmApprovalCapabilityKey('operations', 'absence')).toBe(
      'hcm.operations.absence.approve'
    );
    expect(hcmApprovalCapabilityKey('team', 'time')).toBe('hcm.team.time.approve');
    expect(hcmApprovalCapabilityKey('team', 'absence')).toBe('hcm.team.absence.approve');
  });

  it('discloses only the exact capability on a non-default selected scope', () => {
    const timeOnly = access();
    expect(canDiscloseHcmApprovalAction(timeOnly, 'operations', 'time')).toBe(true);
    expect(canDiscloseHcmApprovalAction(timeOnly, 'operations', 'absence')).toBe(false);
    expect(canDiscloseHcmApprovalAction(timeOnly, 'team', 'time')).toBe(false);
  });

  it('fails closed for read-only PAGE or selected-scope evidence', () => {
    expect(
      canDiscloseHcmApprovalAction(access({ decisionReadOnly: true }), 'operations', 'time')
    ).toBe(false);
    expect(
      canDiscloseHcmApprovalAction(access({ scopeReadOnly: true }), 'operations', 'time')
    ).toBe(false);
  });

  it('preserves legacy disclosure when there is no governed decision', () => {
    expect(
      canDiscloseHcmApprovalAction(
        { governed: false, hasWritableCapability: () => false },
        'team',
        'absence'
      )
    ).toBe(true);
  });
});
