import { describe, expect, it } from 'vitest';

import { productSurfaceHighRiskOperationBinding } from '../../../../../components/product-surface-high-risk-command-model';
import {
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  type ProductAuthorizationRouteProjection,
} from '../../../../../routes/product-surface-authorization.generated';
import {
  COMPENSATION_PLANNING_MUTATION_API_CONTRACTS,
  COMPENSATION_PLANNING_READ_API_CONTRACTS,
} from '../compensation-planning-api';
import {
  COMPENSATION_PLAN_APPROVE_HIGH_RISK_OPERATION,
  COMPENSATION_PLANNING_ACTION_CONTRACTS,
  COMPENSATION_SNAPSHOT_PUBLISH_HIGH_RISK_OPERATION,
  compensationPlanApproveHighRiskCommand,
  compensationSnapshotPublishHighRiskCommand,
  createCompensationPlanningCommandIntents,
} from '../compensation-planning-command-bindings';

const CYCLE_ID = '11111111-1111-4111-8111-111111111111';
const RECEIPT_ID = '22222222-2222-4222-8222-222222222222';

function idFactory() {
  let next = 0;
  return () => `command-${++next}`;
}

describe('compensation-planning production command bindings', () => {
  it('matches the PAGE and three read boundaries to the generated v39 registry', () => {
    const projections: readonly ProductAuthorizationRouteProjection[] =
      PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS;
    const keys = new Set<string>(
      COMPENSATION_PLANNING_READ_API_CONTRACTS.map((contract) => contract.routeContractKey)
    );
    const canonical = projections
      .filter((route) => keys.has(route.routeContractKey))
      .flatMap((route) =>
        route.gatewayBindings.map((binding) => ({
          routeContractKey: route.routeContractKey,
          method: binding.method,
          path: binding.path,
        }))
      )
      .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));
    const implemented = COMPENSATION_PLANNING_READ_API_CONTRACTS.map(
      ({ routeContractKey, method, path }) => ({ routeContractKey, method, path })
    ).sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));

    expect(implemented).toEqual(canonical);
  });

  it('matches all eight mutation API boundaries to the generated v39 ACTION registry', () => {
    const projections: readonly ProductAuthorizationRouteProjection[] =
      PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS;
    const keys = new Set<string>(
      COMPENSATION_PLANNING_MUTATION_API_CONTRACTS.map((contract) => contract.routeContractKey)
    );
    const canonical = projections
      .filter((route) => keys.has(route.routeContractKey))
      .flatMap((route) =>
        route.gatewayBindings.map((binding) => ({
          routeContractKey: route.routeContractKey,
          method: binding.method,
          path: binding.path,
        }))
      )
      .sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));
    const implemented = COMPENSATION_PLANNING_MUTATION_API_CONTRACTS.map(
      ({ routeContractKey, method, path }) => ({ routeContractKey, method, path })
    ).sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));

    expect(implemented).toEqual(canonical);
  });

  it('binds all ordinary and HIGH mutations to their exact ACTION contracts', () => {
    expect(COMPENSATION_PLANNING_ACTION_CONTRACTS).toEqual({
      CREATE_CYCLE: 'route.hcm.operations.compensation-cycle-create.action',
      REVISE_CYCLE: 'route.hcm.operations.compensation-cycle-revise.action',
      ALLOCATE_BUDGET: 'route.hcm.operations.compensation-budget-allocate.action',
      UPSERT_PROPOSAL: 'route.hcm.operations.compensation-proposal-upsert.action',
      SUBMIT_PROPOSAL: 'route.hcm.operations.compensation-proposal-submit.action',
      APPROVE_PLAN: 'route.hcm.operations.compensation-plan-approve.action',
      PUBLISH_SNAPSHOT: 'route.hcm.operations.compensation-snapshot-publish.action',
      CANCEL_CYCLE: 'route.hcm.operations.compensation-cycle-cancel.action',
    });
    expect(
      productSurfaceHighRiskOperationBinding(COMPENSATION_PLAN_APPROVE_HIGH_RISK_OPERATION)
    ).toEqual({
      routeContractKey: 'route.hcm.operations.compensation-plan-approve.action',
      target: { productKey: 'hcm', surfaceKey: 'hcm.operations' },
    });
    expect(
      productSurfaceHighRiskOperationBinding(COMPENSATION_SNAPSHOT_PUBLISH_HIGH_RISK_OPERATION)
    ).toEqual({
      routeContractKey: 'route.hcm.operations.compensation-snapshot-publish.action',
      target: { productKey: 'hcm', surfaceKey: 'hcm.operations' },
    });
  });

  it('seals approve and publish descriptors without moving object version into the body', () => {
    const intents = createCompensationPlanningCommandIntents(idFactory());
    const approve = intents.approve!(CYCLE_ID, 7, {
      decision: 'APPROVE',
      reasonCode: 'ANNUAL_REVIEW',
    });
    const publish = intents.publish!(CYCLE_ID, 8, { approvalReceiptId: RECEIPT_ID });

    expect(compensationPlanApproveHighRiskCommand(approve)).toEqual({
      operation: COMPENSATION_PLAN_APPROVE_HIGH_RISK_OPERATION,
      commandMethod: 'POST',
      commandPath: `/api/people/v1/hris/performance/compensation-planning/cycles/${CYCLE_ID}/approve`,
      targetType: 'COMPENSATION_CYCLE',
      targetId: CYCLE_ID,
      expectedObjectVersion: 7,
      payload: { decision: 'APPROVE', reasonCode: 'ANNUAL_REVIEW' },
      idempotencyKey: 'command-2',
    });
    expect(compensationSnapshotPublishHighRiskCommand(publish)).toEqual({
      operation: COMPENSATION_SNAPSHOT_PUBLISH_HIGH_RISK_OPERATION,
      commandMethod: 'POST',
      commandPath: `/api/people/v1/hris/performance/compensation-planning/cycles/${CYCLE_ID}/approved-snapshots`,
      targetType: 'COMPENSATION_CYCLE',
      targetId: CYCLE_ID,
      expectedObjectVersion: 8,
      payload: { approvalReceiptId: RECEIPT_ID },
      idempotencyKey: 'command-4',
    });
    expect(approve.envelope).toMatchObject({
      correlationId: 'command-1',
      idempotencyKey: 'command-2',
    });
    expect(publish.envelope).toMatchObject({
      correlationId: 'command-3',
      idempotencyKey: 'command-4',
    });
  });

  it('retains the exact cycle route and proposal target with a new-proposal version of zero', () => {
    const intents = createCompensationPlanningCommandIntents(idFactory());
    const proposalId = '33333333-3333-4333-8333-333333333333';
    const proposal = intents.draftProposal!(CYCLE_ID, 0, proposalId, {
      content: {
        cyclePublicId: CYCLE_ID,
        workerPublicId: '44444444-4444-4444-8444-444444444444',
        assignmentPublicId: '55555555-5555-4555-8555-555555555555',
        componentCode: 'BASE',
        currency: 'KRW',
        amount: '100000',
        effectiveFrom: '2027-01-01',
        effectiveTo: null,
        exceptionReasonCode: null,
        supersedesProposalPublicId: null,
      },
    });

    expect(proposal).toMatchObject({
      command: 'UPSERT_PROPOSAL',
      targetId: proposalId,
      cycleId: CYCLE_ID,
      envelope: { expectedVersion: 0 },
    });
  });
});
