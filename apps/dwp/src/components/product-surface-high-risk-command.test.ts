import { describe, expect, it } from 'vitest';

import {
  createApprovalHighRiskAttempt,
  productSurfaceHighRiskCommand,
  restartApprovalHighRiskAttempt,
} from '../features/approvals/approval-high-risk-command-model';
import { buildApprovalHighRiskActionEvaluationRequest } from '../features/approvals/use-approval-high-risk-command';

const authority = {
  rolloutState: '111',
  expectedDecisionRevision: 'revision-1',
  contextKey: 'hcm-management',
  contextScopeKey: 'population-team-a',
} as const;

describe('Shared product-surface HIGH command contract', () => {
  it('evaluates HCM commands against the exact management route and selected scope', () => {
    expect(
      buildApprovalHighRiskActionEvaluationRequest('HCM_ORG_PUBLISH', {
        contextKey: authority.contextKey,
        contextScopeKey: authority.contextScopeKey,
      })
    ).toEqual({
      subject: { type: 'PRODUCT', productKey: 'hcm', surfaceKey: 'hcm.management' },
      routeContractKey: 'route.hcm.management.org-publish.action',
      contextKey: 'hcm-management',
      contextScopeKey: 'population-team-a',
    });
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
});
