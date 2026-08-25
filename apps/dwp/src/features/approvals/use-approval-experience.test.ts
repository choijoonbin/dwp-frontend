import { describe, expect, it } from 'vitest';

import { resolveApprovalExperience } from './use-approval-experience';

import type {
  AllowedSurfaceDecision,
  EffectiveCapabilityGrant,
} from '../../components/product-surface-context';

const NOW = Date.parse('2026-08-24T00:00:00.000Z');

function grant(
  capabilityContractKey: string,
  options: { readOnly?: boolean; activationState?: string } = {}
): EffectiveCapabilityGrant {
  return {
    grantKind: 'CAPABILITY',
    capabilityContractKey,
    resolvedCapabilityCode: 'TEST:VIEW',
    authorityMode: 'PERMISSION',
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED',
    scopeKeys: ['scope-1'],
    requiresProductEntitlement: false,
    readOnly: options.readOnly ?? false,
    activationState: options.activationState ?? 'ACTIVE',
    validUntil: '2026-08-24T01:00:00.000Z',
  };
}

function decision(
  grants: EffectiveCapabilityGrant[],
  options: { effectiveReadOnly?: boolean; scopeReadOnly?: boolean } = {}
): AllowedSurfaceDecision {
  return {
    state: 'allowed',
    routeGrantRef: 'route-grant-1',
    effectiveReadOnly: options.effectiveReadOnly ?? false,
    revalidateAt: '2026-08-24T01:00:00.000Z',
    decisionRevision: 'decision-1',
    scope: {
      key: 'scope-1',
      kind: 'RESOURCE_SET',
      displayName: 'Approvals',
      isDefault: true,
      readOnly: options.scopeReadOnly ?? false,
      validUntil: '2026-08-24T01:00:00.000Z',
    },
    context: {
      contextKey: 'approval-management-1',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      plane: 'management',
      accessMode: 'NORMAL',
      accessSource: 'MANAGEMENT',
      appResourceKey: 'APP.APPROVALS',
      effectiveGrants: grants,
      scopes: [
        {
          key: 'scope-1',
          kind: 'RESOURCE_SET',
          displayName: 'Approvals',
          isDefault: true,
          readOnly: options.scopeReadOnly ?? false,
          validUntil: '2026-08-24T01:00:00.000Z',
        },
      ],
      revalidateAt: '2026-08-24T01:00:00.000Z',
    },
  };
}

describe('approval experience authority source', () => {
  it('keeps legacy MANAGE compatibility only when no governed surface exists', () => {
    const experience = resolveApprovalExperience({
      decision: null,
      hasPermission: (_resource, action) => action === 'MANAGE',
      nowMs: NOW,
    });

    expect(experience.canEditDesign).toBe(true);
    expect(experience.canUpdateRequests).toBe(true);
    expect(experience.canManageDelegations).toBe(true);
  });

  it('does not allow a raw MANAGE permission to expand a governed grant', () => {
    const surfaceDecision = decision([grant('approvals.design.read')]);
    const experience = resolveApprovalExperience({
      decision: surfaceDecision,
      entryContext: surfaceDecision.context,
      hasPermission: (_resource, action) => action === 'MANAGE',
      nowMs: NOW,
    });

    expect(experience.canDesign).toBe(true);
    expect(experience.canEditDesign).toBe(false);
    expect(experience.canPublish).toBe(false);
    expect(experience.canOperate).toBe(false);
  });

  it('uses exact publish and execute contracts without inferring sibling actions', () => {
    const surfaceDecision = decision([
      grant('approvals.design.publish'),
      grant('approvals.operations.execute'),
      grant('approvals.signature.read'),
    ]);
    const experience = resolveApprovalExperience({
      decision: surfaceDecision,
      entryContext: surfaceDecision.context,
      hasPermission: () => false,
      nowMs: NOW,
    });

    expect(experience.canPublish).toBe(true);
    expect(experience.canEditDesign).toBe(false);
    expect(experience.canOperate).toBe(true);
    expect(experience.canViewSignatures).toBe(true);
    expect(experience.canManageSignatures).toBe(false);
  });

  it('keeps HIGH actions discoverable for ELIGIBLE grants without accepting REQUIRED grants', () => {
    const eligibleDecision = decision([
      grant('approvals.design.publish', { activationState: 'ELIGIBLE' }),
      grant('approvals.policy.publish', { activationState: 'ELIGIBLE' }),
      grant('approvals.operations.execute', { activationState: 'ELIGIBLE' }),
    ]);
    const requiredDecision = decision([
      grant('approvals.design.publish', { activationState: 'REQUIRED' }),
      grant('approvals.policy.publish', { activationState: 'REQUIRED' }),
      grant('approvals.operations.execute', { activationState: 'REQUIRED' }),
    ]);
    const eligible = resolveApprovalExperience({
      decision: eligibleDecision,
      entryContext: eligibleDecision.context,
      hasPermission: () => false,
      nowMs: NOW,
    });
    const required = resolveApprovalExperience({
      decision: requiredDecision,
      entryContext: requiredDecision.context,
      hasPermission: () => false,
      nowMs: NOW,
    });

    expect(eligible.canPublish).toBe(true);
    expect(eligible.canPublishPolicies).toBe(true);
    expect(eligible.canOperate).toBe(true);
    expect(required.canPublish).toBe(false);
    expect(required.canPublishPolicies).toBe(false);
    expect(required.canOperate).toBe(false);
  });

  it('removes every mutation affordance from an effective read-only context', () => {
    const surfaceDecision = decision(
      [
        grant('approvals.design.update'),
        grant('approvals.policy.publish'),
        grant('approvals.work.request.update'),
        grant('approvals.work.delegation.manage'),
      ],
      { effectiveReadOnly: true }
    );
    const experience = resolveApprovalExperience({
      decision: surfaceDecision,
      entryContext: surfaceDecision.context,
      hasPermission: () => false,
      nowMs: NOW,
    });

    expect(experience.canDesign).toBe(true);
    expect(experience.canEditDesign).toBe(false);
    expect(experience.canPublishPolicies).toBe(false);
    expect(experience.canUpdateRequests).toBe(false);
    expect(experience.canManageDelegations).toBe(false);
  });

  it('uses the canonical entry context for HIGH discoverability, not page-route grants', () => {
    const pageDecision = decision([grant('approvals.design.read')]);
    const entry = {
      ...pageDecision.context,
      contextKey: 'approval-management-entry',
      effectiveGrants: [
        grant('approvals.design.read'),
        grant('approvals.design.publish', { activationState: 'ELIGIBLE' }),
      ],
    };

    expect(
      resolveApprovalExperience({
        decision: pageDecision,
        entryContext: entry,
        hasPermission: () => false,
        nowMs: NOW,
      }).canPublish
    ).toBe(true);
    expect(
      resolveApprovalExperience({
        decision: pageDecision,
        entryContext: null,
        hasPermission: (_resource, action) => action === 'MANAGE',
        nowMs: NOW,
      }).canPublish
    ).toBe(false);

    expect(
      resolveApprovalExperience({
        decision: pageDecision,
        entryContext: {
          ...entry,
          contextKey: pageDecision.context.contextKey,
          accessMode: 'ELEVATED',
        },
        hasPermission: () => false,
        nowMs: NOW,
      }).canPublish
    ).toBe(false);
  });
});
