import { describe, expect, it } from 'vitest';

import {
  canCancelTenantLifecycle,
  canDecideResourceChange,
  canDecideTenantLifecycle,
  tenantExecutionPresentationState,
} from './provider-governance-action-model';

describe('provider governance action authority', () => {
  it('requires exact permission and a different actor for resource changes', () => {
    expect(canDecideResourceChange({ canApprove: true, operatorId: 10, requestedBy: 10 })).toBe(
      false
    );
    expect(canDecideResourceChange({ canApprove: true, operatorId: 11, requestedBy: 10 })).toBe(
      true
    );
    expect(canDecideResourceChange({ canApprove: false, operatorId: 11, requestedBy: 10 })).toBe(
      false
    );
  });

  it('blocks both lifecycle requester and submitter from deciding', () => {
    expect(
      canDecideTenantLifecycle({
        canApprove: true,
        operatorId: 10,
        requestedBy: 10,
        submittedBy: 11,
      })
    ).toBe(false);
    expect(
      canDecideTenantLifecycle({
        canApprove: true,
        operatorId: 11,
        requestedBy: 10,
        submittedBy: 11,
      })
    ).toBe(false);
    expect(
      canDecideTenantLifecycle({
        canApprove: true,
        operatorId: 12,
        requestedBy: 10,
        submittedBy: 11,
      })
    ).toBe(true);
  });

  it('allows only the request owner to cancel current pre-decision lifecycle states', () => {
    for (const lifecycleState of ['DRAFT', 'BLOCKED_BY_HOLD', 'PENDING_APPROVAL']) {
      expect(
        canCancelTenantLifecycle({
          canWrite: true,
          operatorId: 10,
          requestedBy: 10,
          lifecycleState,
        })
      ).toBe(true);
    }
    expect(
      canCancelTenantLifecycle({
        canWrite: true,
        operatorId: 11,
        requestedBy: 10,
        lifecycleState: 'DRAFT',
      })
    ).toBe(false);
    expect(
      canCancelTenantLifecycle({
        canWrite: false,
        operatorId: 10,
        requestedBy: 10,
        lifecycleState: 'DRAFT',
      })
    ).toBe(false);
    expect(
      canCancelTenantLifecycle({
        canWrite: true,
        operatorId: 10,
        requestedBy: 10,
        lifecycleState: 'APPROVED_FOR_HANDOFF',
      })
    ).toBe(false);
  });

  it('fails closed when an execution state is unknown', () => {
    expect(tenantExecutionPresentationState('COMPLETED')).toBe('COMPLETED');
    expect(tenantExecutionPresentationState('FUTURE_EXECUTOR')).toBe('UNAVAILABLE');
  });
});
