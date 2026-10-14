import { describe, expect, it } from 'vitest';

import {
  HR_OPERATIONS_NAVIGATION_CATALOG,
  HR_OPERATIONS_NODE_IDS,
  projectHrisNavigationPolicy,
  resolveHrisPolicyDeepLink,
  resolveHrisPolicyLanding,
} from './hr-operations-navigation-policy';

import type {
  HrisNavigationPolicyLayer,
  HrisNavigationProjectionInput,
} from './hr-operations-navigation-policy';

describe('HR Operations navigation-policy projection', () => {
  it('pins the recovered catalog to seven groups and seventeen unique nodes', () => {
    expect(HR_OPERATIONS_NAVIGATION_CATALOG).toHaveLength(7);
    expect(HR_OPERATIONS_NODE_IDS.size).toBe(17);
    expect(HR_OPERATIONS_NAVIGATION_CATALOG.map((group) => group.groupId)).toEqual([
      'HROPS-01',
      'HROPS-02',
      'HROPS-03',
      'HROPS-04',
      'HROPS-05',
      'HROPS-06',
      'HROPS-07',
    ]);
  });

  it('computes the exact five-way intersection and never manufactures PAGE authority', () => {
    const nodeIds = [...HR_OPERATIONS_NODE_IDS];
    const input = enforcedInput();
    const pageAuthorizedNodeIds = without(nodeIds, nodeIds[4]);
    const projection = projectHrisNavigationPolicy({
      ...input,
      canonicalDeployedNodeIds: without(nodeIds, nodeIds[0]),
      installedEligibleNodeIds: without(nodeIds, nodeIds[1]),
      tenantBaseline: layer('10000000-0000-4000-8000-000000000001', without(nodeIds, nodeIds[2])),
      legalEntityOverlay: layer(
        '20000000-0000-4000-8000-000000000001',
        without(nodeIds, nodeIds[3])
      ),
      pageAuthorizedNodeIds,
    });

    expect(projection.state).toBe('READY');
    expect(projection.orderedNodeIds).toHaveLength(12);
    for (const excluded of nodeIds.slice(0, 5)) {
      expect(projection.orderedNodeIds).not.toContain(excluded);
    }
    expect(projection.orderedNodeIds.every((nodeId) => pageAuthorizedNodeIds.has(nodeId))).toBe(
      true
    );
  });

  it('prevents a legal overlay from re-enabling a tenant-disabled node', () => {
    const nodeIds = [...HR_OPERATIONS_NODE_IDS];
    const deniedByTenant = nodeIds[0];
    const projection = projectHrisNavigationPolicy({
      ...enforcedInput(),
      tenantBaseline: layer(
        '10000000-0000-4000-8000-000000000001',
        without(nodeIds, deniedByTenant)
      ),
      legalEntityOverlay: layer('20000000-0000-4000-8000-000000000001', new Set(nodeIds)),
    });

    expect(projection.orderedNodeIds).not.toContain(deniedByTenant);
  });

  it('uses one immutable revision key for landing and direct deep-link decisions', () => {
    const projection = projectHrisNavigationPolicy(enforcedInput());
    const landing = resolveHrisPolicyLanding(projection);
    const deepLink = resolveHrisPolicyDeepLink(projection, `${landing.route}?focus=worker-1`);

    expect(landing.decision).toBe('ALLOW');
    expect(deepLink.decision).toBe('ALLOW');
    expect(deepLink.nodeId).toBe(landing.nodeId);
    expect(deepLink.policyRevisionKey).toBe(landing.policyRevisionKey);
    expect(deepLink.authorizationDecisionRevision).toBe(landing.authorizationDecisionRevision);
    expect(resolveHrisPolicyDeepLink(projection, '/hr/operations/not-canonical').decision).toBe(
      'DENY'
    );
  });

  it('fails closed for an enrolled enforced tenant with missing or stale policy evidence', () => {
    for (const policyFreshness of ['MISSING', 'STALE'] as const) {
      const projection = projectHrisNavigationPolicy({
        ...enforcedInput(),
        policyFreshness,
        tenantBaseline: policyFreshness === 'MISSING' ? undefined : enforcedInput().tenantBaseline,
      });
      expect(projection.state).toBe('FAIL_CLOSED');
      expect(projection.orderedNodeIds).toEqual([]);
      expect(resolveHrisPolicyLanding(projection).decision).toBe('DENY');
    }
  });

  it('keeps OFF and SHADOW non-enforcing while preserving canonical and PAGE restrictions', () => {
    const onlyAuthorized = [...HR_OPERATIONS_NODE_IDS][5];
    for (const rolloutMode of ['OFF', 'SHADOW'] as const) {
      const projection = projectHrisNavigationPolicy({
        ...enforcedInput(),
        rolloutMode,
        tenantBaseline: undefined,
        legalEntityOverlay: undefined,
        policyFreshness: 'MISSING',
        pageAuthorizedNodeIds: new Set([onlyAuthorized]),
      });
      expect(projection.state).toBe('READY');
      expect(projection.orderedNodeIds).toEqual([onlyAuthorized]);
    }
  });
});

function enforcedInput(): HrisNavigationProjectionInput {
  const all = new Set(HR_OPERATIONS_NODE_IDS);
  return {
    rolloutMode: 'ENFORCED',
    enrolled: true,
    policyFreshness: 'CURRENT',
    canonicalDeployedNodeIds: all,
    installedEligibleNodeIds: all,
    pageAuthorizedNodeIds: all,
    tenantBaseline: layer('10000000-0000-4000-8000-000000000001', all),
    legalEntityOverlay: layer('20000000-0000-4000-8000-000000000001', all),
    authorizationDecisionRevision: 'auth-revision-9',
  };
}

function layer(revisionId: string, enabledIds: ReadonlySet<string>): HrisNavigationPolicyLayer {
  return {
    revisionId,
    revision: 4,
    digest: 'a'.repeat(64),
    groups: HR_OPERATIONS_NAVIGATION_CATALOG.map((group) => {
      const nodes = group.nodes.map((node) => ({ ...node, enabled: enabledIds.has(node.nodeId) }));
      const first = nodes.find((node) => node.enabled);
      return {
        ...group,
        enabled: Boolean(first),
        defaultNodeId: first?.nodeId ?? group.defaultNodeId,
        nodes,
      };
    }),
  };
}

function without(values: readonly string[], value: string) {
  return new Set(values.filter((candidate) => candidate !== value));
}
