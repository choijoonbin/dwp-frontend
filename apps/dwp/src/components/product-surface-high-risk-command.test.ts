import { describe, expect, it } from 'vitest';

import {
  buildApprovalStepUpIssuerRequest,
  createApprovalHighRiskAttempt,
  productSurfaceHighRiskCommand,
  restartApprovalHighRiskAttempt,
} from '../features/approvals/approval-high-risk-command-model';
import { buildApprovalHighRiskActionEvaluationRequest } from '../features/approvals/use-approval-high-risk-command';
import {
  payrollFoundationPublishCommand,
  payrollFoundationReverseCommand,
} from '../features/hris/payroll/hooks/use-payroll-foundation-command-executors';
import { performanceCyclePublishCommand } from '../features/hris/performance/hooks/use-performance-cycle-command-executors';

const authority = {
  rolloutState: '111',
  expectedDecisionRevision: 'revision-1',
  contextKey: 'hcm-management',
  contextScopeKey: 'population-team-a',
} as const;

describe('Shared product-surface HIGH command contract', () => {
  it('recalculates HCM exact ACTION context from the selected scope instead of the aggregate key', () => {
    expect(
      buildApprovalHighRiskActionEvaluationRequest('HCM_ORG_PUBLISH', {
        contextKey: authority.contextKey,
        contextScopeKey: authority.contextScopeKey,
      })
    ).toEqual({
      subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: 'hcm.management' },
      routeContractKey: 'route.hcm.management.org-publish.action',
      contextScopeKey: 'population-team-a',
    });

    const attempt = createApprovalHighRiskAttempt(
      productSurfaceHighRiskCommand({
        operation: 'HCM_ORG_PUBLISH',
        commandMethod: 'POST',
        commandPath: '/api/people/v1/workforce/organization/scenarios/scenario-1/publish',
        targetType: 'ORG_SCENARIO',
        targetId: 'scenario-1',
        expectedObjectVersion: 3,
        payload: { expectedVersion: 3 },
      }),
      { ...authority, contextKey: 'hcm-aggregate-multi-scope-context' },
      'hcm-org-publish-attempt'
    );
    const issuer = buildApprovalStepUpIssuerRequest(attempt);
    expect(issuer.request).not.toHaveProperty('contextKey');
    expect(issuer.request.contextScopeKey).toBe('population-team-a');
    expect(issuer.expectedDecisionRevision).toBe('revision-1');
  });

  it('rotates the export replay key in both proof material and the actual create command', () => {
    const descriptor = productSurfaceHighRiskCommand({
      operation: 'HCM_EXPORT_CREATE',
      commandMethod: 'POST',
      commandPath: '/api/people/v1/workforce/exports',
      targetType: 'EXPORT_DATASET',
      targetId: 'WORKFORCE_DIRECTORY@v4:population-team-a',
      expectedObjectVersion: 4,
      idempotencyKey: 'export-attempt-1',
      rotateIdempotencyInCommandPayload: true,
      payload: {
        dataset: 'WORKFORCE_DIRECTORY@v4',
        population: 'population-team-a',
        command: { idempotencyKey: 'export-attempt-1', datasetKey: 'WORKFORCE_DIRECTORY' },
      },
    });
    const attempt = createApprovalHighRiskAttempt(descriptor, authority);
    const restarted = restartApprovalHighRiskAttempt(attempt, authority, 'export-attempt-2');

    expect(attempt.idempotencyKey).toBe('export-attempt-1');
    expect(restarted.idempotencyKey).toBe('export-attempt-2');
    expect(restarted.descriptor.payload).toMatchObject({
      dataset: 'WORKFORCE_DIRECTORY@v4',
      population: 'population-team-a',
      command: { idempotencyKey: 'export-attempt-2' },
    });
  });

  it('rejects query-bearing or fragment-bearing issuer command paths', () => {
    expect(() =>
      productSurfaceHighRiskCommand({
        operation: 'HCM_INTEGRATION_RECONCILE',
        commandMethod: 'POST',
        commandPath:
          '/api/people/v1/workforce/data-operations/hris/connectors/c-1/reconciliations?syncRunId=r-1',
        targetType: 'HCM_CONNECTOR',
        targetId: 'c-1',
        expectedObjectVersion: 1,
        payload: { syncRunId: 'r-1' },
      })
    ).toThrowError('HIGH command binding is invalid.');
  });

  it('binds PER publication proof to its exact target, payload, version and command id', () => {
    const descriptor = performanceCyclePublishCommand({
      cycleId: 'cycle/2027',
      request: {
        commandId: '11111111-1111-4111-8111-111111111111',
        expectedRevision: 7,
        populationPreviewId: '22222222-2222-4222-8222-222222222222',
        expectedWorkforceOwnerRevision: 5,
        publicationApprovalRef: '33333333-3333-4333-8333-333333333333',
        reason: 'Approved publication evidence.',
      },
    });

    expect(descriptor).toMatchObject({
      operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH',
      commandPath: '/api/people/v1/hris/performance/cycles/cycle%2F2027/publish',
      targetType: 'PERFORMANCE_CYCLE',
      targetId: 'cycle/2027',
      expectedObjectVersion: 7,
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      idempotencyPayloadPath: 'ROOT_COMMAND_ID',
    });
    const restarted = restartApprovalHighRiskAttempt(
      createApprovalHighRiskAttempt(descriptor, authority),
      authority,
      '44444444-4444-4444-8444-444444444444'
    );
    expect(restarted.descriptor.payload.commandId).toBe('44444444-4444-4444-8444-444444444444');
    expect(restarted.idempotencyKey).toBe('44444444-4444-4444-8444-444444444444');
  });

  it('binds PAY publication proof without widening the configuration identity', () => {
    const publish = payrollFoundationPublishCommand({
      configurationId: 'configuration/kr',
      commandId: '55555555-5555-4555-8555-555555555555',
      request: { expectedVersion: 11 },
    });
    expect(publish).toMatchObject({
      operation: 'HCM_PAYROLL_FOUNDATION_PUBLISH',
      commandPath:
        '/api/payroll/v1/hris/payroll/foundation/configurations/configuration%2Fkr/publish',
      targetType: 'PAYROLL_CONFIGURATION',
      targetId: 'configuration/kr',
      expectedObjectVersion: 11,
      payload: { expectedVersion: 11 },
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
    });
    const restarted = restartApprovalHighRiskAttempt(
      createApprovalHighRiskAttempt(publish, authority),
      authority,
      '77777777-7777-4777-8777-777777777777'
    );
    expect(restarted.idempotencyKey).toBe('77777777-7777-4777-8777-777777777777');
    expect(restarted.descriptor.idempotencyKey).toBe('77777777-7777-4777-8777-777777777777');
    expect(restarted.descriptor.payload).toEqual({ expectedVersion: 11 });

    expect(
      payrollFoundationReverseCommand({
        configurationId: 'configuration/kr',
        commandId: '66666666-6666-4666-8666-666666666666',
        request: {
          expectedVersion: 12,
          publishCommandId: '55555555-5555-4555-8555-555555555555',
        },
      })
    ).toMatchObject({
      operation: 'HCM_PAYROLL_FOUNDATION_REVERSE',
      commandPath:
        '/api/payroll/v1/hris/payroll/foundation/configurations/configuration%2Fkr/reversals',
      targetId: 'configuration/kr',
      expectedObjectVersion: 12,
      payload: {
        expectedVersion: 12,
        publishCommandId: '55555555-5555-4555-8555-555555555555',
      },
      idempotencyKey: '66666666-6666-4666-8666-666666666666',
    });
  });
});
