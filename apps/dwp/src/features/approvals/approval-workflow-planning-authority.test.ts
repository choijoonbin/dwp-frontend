import { describe, expect, it } from 'vitest';
import { planningAuthorityFixture } from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-fixtures';
import {
  APPROVAL_WORKFLOW_PLANNING_ROUTE,
  APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
} from '@dwp-frontend/shared-utils/api/approval-workflow-planning-contract';
import {
  approvalWorkflowPlanningAuthority,
  approvalWorkflowPlanningEntry,
  approvalWorkflowPlanningInstalled,
} from './approval-workflow-planning-authority';

describe('Source11 installation and independent paired planning authority', () => {
  it('does not treat Source10 POST alone as installed selection', () => {
    const { source } = planningAuthorityFixture();
    expect(approvalWorkflowPlanningInstalled(source.projections)).toBe(true);
    expect(
      approvalWorkflowPlanningEntry({
        ...source,
        projections: source.projections.filter(
          (route) => route.routeContractKey === APPROVAL_WORKFLOW_PLANNING_ROUTE
        ),
      })
    ).toBeUndefined();
  });
  it.each([APPROVAL_WORKFLOW_PLANNING_ROUTE, APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE])(
    'requires exact two separate typed grants for %s',
    (route) => {
      const { source, evaluation } = planningAuthorityFixture(route);
      const entry = approvalWorkflowPlanningEntry(source)!;
      expect(approvalWorkflowPlanningAuthority(entry, evaluation, route)?.resourceSetKey).toBe(
        'RS_APPROVAL_FINANCE'
      );
    }
  );
  it.each([
    'missing',
    'duplicate',
    'wrongPermission',
    'wrongRS',
    'expired',
    'writable',
    'taskPurpose',
    'wrongPredicate',
  ])('rejects %s without borrowing broader admin/TASK authority', (kind) => {
    const { source, evaluation } = planningAuthorityFixture();
    const entry = approvalWorkflowPlanningEntry(source)!;
    const grants = evaluation.context!.effectiveGrants;
    if (kind === 'missing') grants.pop();
    if (kind === 'duplicate') grants[1] = structuredClone(grants[0]!);
    if (kind === 'writable') evaluation.effectiveReadOnly = false;
    const grant = grants[1];
    if (grant?.grantKind === 'CAPABILITY') {
      if (kind === 'wrongPermission') grant.resolvedCapabilityCode = 'ADMIN.APPROVAL_DESIGN:MANAGE';
      if (kind === 'wrongRS') grant.responsibility!.resourceSetKey = 'RS_OTHER';
      if (kind === 'expired') grant.validUntil = new Date(Date.now() - 1).toISOString();
      if (kind === 'taskPurpose') grant.capabilityContractKey = 'approvals.work.task.approve';
      if (kind === 'wrongPredicate')
        grant.predicatePolicyKeys = ['predicate.approval.workflow-planning-simulation.v1'];
    }
    expect(
      approvalWorkflowPlanningAuthority(
        entry,
        evaluation,
        APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE
      )
    ).toBeUndefined();
  });
  it('rejects substituted scope and current access mode before any proof', () => {
    const { source } = planningAuthorityFixture();
    expect(approvalWorkflowPlanningEntry({ ...source, contextScopeKey: 'OTHER' })).toBeUndefined();
    expect(approvalWorkflowPlanningEntry({ ...source, ready: false })).toBeUndefined();
  });
});
