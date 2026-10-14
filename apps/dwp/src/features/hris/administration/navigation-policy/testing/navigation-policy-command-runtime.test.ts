import { describe, expect, it } from 'vitest';

import { productSurfaceHighRiskOperationBinding } from '../../../../../components/product-surface-high-risk-command-model';
import { createNavigationPolicyDraft } from '../model/navigation-policy-model';
import {
  NAVIGATION_POLICY_ACTION_CONTRACTS,
  navigationPolicyHighRiskCommand,
} from '../navigation-policy-command-runtime';

describe('navigation-policy governed command runtime', () => {
  it('pins every ordinary mutation to its exact generated ACTION contract', () => {
    expect(NAVIGATION_POLICY_ACTION_CONTRACTS).toEqual({
      CREATE_DRAFT: 'route.hcm.configuration.navigation-policy-draft-create.action',
      SAVE_DRAFT: 'route.hcm.configuration.navigation-policy-draft-update.action',
      VALIDATE: 'route.hcm.configuration.navigation-policy-draft-validate.action',
      SUBMIT: 'route.hcm.configuration.navigation-policy-draft-submit.action',
    });
  });

  it('binds approve, publish, and restore to the shared high-risk coordinator catalog', () => {
    expect(productSurfaceHighRiskOperationBinding('HCM_NAVIGATION_POLICY_APPROVE')).toEqual({
      routeContractKey: 'route.hcm.configuration.navigation-policy-revision-approve.action',
      target: { productKey: 'hcm', surfaceKey: 'hcm.management' },
    });
    expect(productSurfaceHighRiskOperationBinding('HCM_NAVIGATION_POLICY_PUBLISH')).toEqual({
      routeContractKey: 'route.hcm.configuration.navigation-policy-revision-publish.action',
      target: { productKey: 'hcm', surfaceKey: 'hcm.management' },
    });
    expect(productSurfaceHighRiskOperationBinding('HCM_NAVIGATION_POLICY_RESTORE')).toEqual({
      routeContractKey: 'route.hcm.configuration.navigation-policy-revision-restore.action',
      target: { productKey: 'hcm', surfaceKey: 'hcm.management' },
    });
  });

  it('uses the historical revision path and current-scope CAS for restore', () => {
    const targetRevisionId = '30000000-0000-4000-8000-000000000003';
    const command = navigationPolicyHighRiskCommand({
      input: {
        action: 'RESTORE',
        draft: createNavigationPolicyDraft({ scopeKind: 'TENANT' }),
        revisionId: targetRevisionId,
        targetRevisionId,
        targetDigest: 'b'.repeat(64),
        expectedVersion: 14,
        reason: 'Restore the approved prior tenant baseline',
      },
      revisionId: targetRevisionId,
      envelope: {
        body: { reason: 'Restore the approved prior tenant baseline' },
        expectedVersion: 14,
        requestDigest: 'a'.repeat(64),
        idempotencyKey: '40000000-0000-4000-8000-000000000004',
        correlationId: '50000000-0000-4000-8000-000000000005',
      },
    });
    expect(command).toMatchObject({
      operation: 'HCM_NAVIGATION_POLICY_RESTORE',
      targetType: 'HRIS_NAVIGATION_POLICY_REVISION',
      targetId: targetRevisionId,
      expectedObjectVersion: 14,
      payload: {
        expectedVersion: 14,
        requestDigest: 'a'.repeat(64),
        reason: 'Restore the approved prior tenant baseline',
      },
    });
    expect(command.commandPath).toBe(
      `/api/platform/v1/admin/hris/navigation-policies/revisions/${targetRevisionId}/restore`
    );
    expect(command.payload).not.toHaveProperty('targetDigest');
  });
});
