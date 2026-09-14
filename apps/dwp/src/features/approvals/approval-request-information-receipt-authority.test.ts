import { describe, expect, it } from 'vitest';
import {
  approvalInformationReceiptAuthority,
  approvalInformationReceiptEntry,
  approvalInformationReceiptRouteInstalled,
} from './approval-request-information-receipt-authority';
import { approvalInformationReceiptFixture } from '../../../../../e2e/support/approval-information-receipt-fixtures';

describe('distinct information receipt DATA authority', () => {
  it('does not invent an installed receipt profile when the route is absent', () => {
    const { source } = approvalInformationReceiptFixture();
    expect(approvalInformationReceiptRouteInstalled([])).toBe(false);
    expect(approvalInformationReceiptEntry({ ...source, projections: [] })).toBeUndefined();
  });
  it.each(['110', '111'] as const)('admits fresh read-only DATA proof in unit %s', (state) => {
    const { source, evaluation } = approvalInformationReceiptFixture(state);
    const entry = approvalInformationReceiptEntry(source)!;
    expect(entry).toBeDefined();
    expect(approvalInformationReceiptAuthority(entry, evaluation)?.authority).toEqual({
      mode: 'SECURE',
      rolloutState: state,
      routeContractKey: source.projections[0]!.routeContractKey,
      expectedDecisionRevision: evaluation.decisionRevision,
      contextKey: source.contextKey,
      contextScopeKey: source.contextScopeKey,
    });
  });
  it.each(['000', '100'] as const)('never uses legacy rollout %s for receipt reads', (state) => {
    const { source } = approvalInformationReceiptFixture();
    source.snapshot!.envelope.rollouts[0]!.state = state;
    expect(approvalInformationReceiptEntry(source)).toBeUndefined();
  });
  it.each([
    'ready',
    'actor',
    'context',
    'scope',
    'expiry',
    'support',
    'routeKind',
    'method',
    'path',
    'duplicate',
  ])('fails closed for %s entry drift', (change) => {
    const fixture = approvalInformationReceiptFixture();
    let source = fixture.source;
    if (change === 'ready') source = { ...source, ready: false };
    if (change === 'actor') source = { ...source, actorId: '' };
    if (change === 'context') source = { ...source, contextKey: 'other' };
    if (change === 'scope') source = { ...source, contextScopeKey: 'other' };
    if (change === 'expiry')
      source.snapshot!.envelope.contexts[0]!.revalidateAt = new Date(0).toISOString();
    if (change === 'support')
      source.snapshot!.envelope.contexts[0]!.accessMode = 'PROVIDER_SUPPORT';
    if (['routeKind', 'method', 'path'].includes(change)) {
      const route = source.projections[0]!;
      source = {
        ...source,
        projections: [
          {
            ...route,
            ...(change === 'routeKind' ? { routeKind: 'ACTION' as const } : {}),
            gatewayBindings: [
              {
                method: change === 'method' ? 'GET' : 'POST',
                path: change === 'path' ? '/old-action' : route.gatewayBindings[0]!.path,
              },
            ],
          },
        ],
      };
    }
    if (change === 'duplicate')
      source = { ...source, projections: [...source.projections, ...source.projections] };
    expect(approvalInformationReceiptEntry(source)).toBeUndefined();
  });
  it.each([
    'denied',
    'revision',
    'writable',
    'oldAction',
    'predicate',
    'permission',
    'scope',
    'duplicateGrant',
    'expired',
    'display',
    'accessSource',
    'emptyScopeLabel',
    'scopeFlag',
  ])('cannot borrow a %s proof for a receipt', (change) => {
    const { source, evaluation } = approvalInformationReceiptFixture();
    const entry = approvalInformationReceiptEntry(source)!;
    const grant = evaluation.context!.effectiveGrants[0]!;
    if (grant.grantKind !== 'CAPABILITY') throw new Error('Expected fixture capability');
    if (change === 'denied') evaluation.decision = 'ROUTE_DENIED';
    if (change === 'revision') evaluation.decisionRevision = 'old';
    if (change === 'writable') evaluation.effectiveReadOnly = false;
    if (change === 'oldAction')
      grant.capabilityContractKey = 'approvals.work.request.information.reply';
    if (change === 'predicate') grant.predicatePolicyKeys = [];
    if (change === 'permission') grant.resolvedCapabilityCode = 'ACTION.APPROVAL_REQUEST:UPDATE';
    if (change === 'scope') grant.scopeKeys = ['other'];
    if (change === 'duplicateGrant')
      evaluation.context!.effectiveGrants.push(structuredClone(grant));
    if (change === 'expired') evaluation.revalidateAt = new Date(0).toISOString();
    if (change === 'display') evaluation.scope!.displayName = 'Other';
    if (change === 'accessSource') evaluation.context!.accessSource = 'RELATIONSHIP';
    if (change === 'emptyScopeLabel') {
      evaluation.context!.scopes[0]!.displayName = '';
      evaluation.scope!.displayName = '';
    }
    if (change === 'scopeFlag') {
      Object.assign(evaluation.context!.scopes[0]!, { isDefault: 'yes' });
      Object.assign(evaluation.scope!, { isDefault: 'yes' });
    }
    expect(approvalInformationReceiptAuthority(entry, evaluation)).toBeUndefined();
  });
});
