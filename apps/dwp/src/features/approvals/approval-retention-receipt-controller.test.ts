import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planningAuthorityFixture } from '@dwp-frontend/shared-utils/test-utils/approval-workflow-planning-fixtures';
import { APPROVAL_RETENTION_RECEIPT_BINDINGS } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-api';
import {
  APPROVAL_RETENTION_RECEIPT_PROFILE,
  prepareApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { ApprovalRetentionReceiptController } from './approval-retention-receipt-controller';
import {
  approvalRetentionReceiptAuthority,
  approvalRetentionReceiptEntry,
  approvalRetentionReceiptRouteInstalled,
} from './approval-retention-receipt-authority';

import type { ProductSurfaceEvaluationData } from '@dwp-frontend/shared-utils';
import type {
  ApprovalRetentionReceiptCommand,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import type { ApprovalRetentionReceiptSource } from './approval-retention-receipt-authority';

const target = '11111111-1111-4111-8111-111111111111';
const policy = '22222222-2222-4222-8222-222222222222';
const result = '33333333-3333-4333-8333-333333333333';
const commandId = '44444444-4444-4444-8444-444444444444';
const resourceSetKey = 'RS_APPROVAL_FINANCE';

const command = (
  operation: ApprovalRetentionReceiptCommand['operation']
): ApprovalRetentionReceiptCommand => {
  if (operation === 'INITIALIZE_POLICY')
    return {
      operation,
      originalTargetId: null,
      body: { expectedAbsent: true, idempotencyKey: 'initialize:original' },
    };
  if (operation === 'SAVE_POLICY')
    return {
      operation,
      originalTargetId: target,
      body: {
        expectedVersion: 7,
        idempotencyKey: 'save:original',
        rules: {
          allowPurge: false,
          allowedClassifications: ['INTERNAL', 'CONFIDENTIAL'],
          recordRetentionDays: 365,
          deletedDraftRecoveryDays: 30,
          receiptRetentionDays: 365,
          holdEvidenceRetentionDays: 365,
          auditEvidenceRetentionDays: 365,
          maxInventoryRows: 50000,
          maxObjectsPerRecord: 1000,
        },
      },
    };
  if (operation === 'PUBLISH_POLICY')
    return {
      operation,
      originalTargetId: target,
      body: {
        expectedVersion: 7,
        idempotencyKey: 'publish:original',
        reviewComment: 'Independent retention review',
      },
    };
  return {
    operation,
    originalTargetId: target,
    body: {
      expectedVersion: 9,
      policyId: policy,
      expectedPolicyVersion: 7,
      expectedHoldVersion: 4,
      inventorySha256: 'a'.repeat(64),
      idempotencyKey: 'claim:original',
    },
  };
};

const operationAuthority = {
  INITIALIZE_POLICY: ['approvals.policy.update', 'ADMIN.APPROVAL_POLICY:UPDATE'],
  SAVE_POLICY: ['approvals.policy.update', 'ADMIN.APPROVAL_POLICY:UPDATE'],
  PUBLISH_POLICY: ['approvals.policy.publish', 'ADMIN.APPROVAL_POLICY:PUBLISH'],
  CLAIM_RECORD: ['approvals.operations.execute', 'ADMIN.APPROVAL_OPERATIONS:EXECUTE'],
} as const;

async function fixture(operation: ApprovalRetentionReceiptCommand['operation']) {
  const original = await prepareApprovalRetentionReceiptOriginal(
    command(operation),
    99,
    resourceSetKey
  );
  const base = planningAuthorityFixture();
  const binding = APPROVAL_RETENTION_RECEIPT_BINDINGS[operation];
  const source: ApprovalRetentionReceiptSource = {
    ...base.source,
    projections: [
      {
        routeContractKey: binding.routeContractKey,
        routeKind: 'DATA',
        navigationContextId: 'approvals.admin',
        subjectType: 'PRODUCT',
        productId: 'approvals',
        surfaceId: 'approvals.admin',
        routeId: null,
        pattern: null,
        gatewayBindings: [{ method: 'GET', path: `/api/approvals${binding.path}` }],
      },
    ],
  };
  const [capabilityContractKey, resolvedCapabilityCode] = operationAuthority[operation];
  const evaluation: ProductSurfaceEvaluationData = {
    ...base.evaluation,
    context: {
      ...base.evaluation.context!,
      effectiveGrants: [
        {
          grantKind: 'CAPABILITY',
          capabilityContractKey,
          resolvedCapabilityCode,
          authorityMode: 'PERMISSION',
          predicatePolicyKeys: ['predicate.approval.retention-command-original-authority.v1'],
          responsibilityRequirement: 'REQUIRED',
          responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey },
          scopeKeys: [base.source.contextScopeKey],
          requiresProductEntitlement: false,
          readOnly: true,
          activationState: 'ACTIVE',
        },
      ],
    },
  };
  return { original, source, evaluation };
}

function receipt(original: ApprovalRetentionReceiptOriginal) {
  const operation = original.command.operation;
  return {
    commandId,
    operation,
    idempotencyKey: original.command.body.idempotencyKey,
    actorUserId: original.actorUserId,
    resourceSetKey: original.resourceSetKey,
    originalTargetId: original.command.originalTargetId,
    resultReferenceId: operation === 'CLAIM_RECORD' ? result : target,
    requestBodySha256: original.requestBodySha256,
    originalExpectedVersion: original.originalExpectedVersion,
    resultVersion:
      operation === 'SAVE_POLICY' || operation === 'PUBLISH_POLICY'
        ? original.originalExpectedVersion! + 1
        : 0,
    status: 'COMMITTED',
    committedAt: '2026-09-14T21:00:00.123456789+09:00',
    originAuthorityProfile:
      operation === 'CLAIM_RECORD'
        ? 'RETENTION_RECORD_EXECUTE_SIGNED_HIGH'
        : operation === 'PUBLISH_POLICY'
          ? 'POLICY_PUBLISH_SIGNED_HIGH_INDEPENDENT_CHECKER'
          : 'POLICY_UPDATE_TRUSTED',
    profileVersion: APPROVAL_RETENTION_RECEIPT_PROFILE,
  };
}

describe('retention UNKNOWN owner receipt authority and DATA-only controller', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['INITIALIZE_POLICY', 'SAVE_POLICY', 'PUBLISH_POLICY', 'CLAIM_RECORD'] as const)(
    'consumes the exact installed Source11 %s route',
    (operation) => {
      expect(
        approvalRetentionReceiptRouteInstalled(operation, PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS)
      ).toBe(true);
    }
  );

  it.each(['INITIALIZE_POLICY', 'SAVE_POLICY', 'PUBLISH_POLICY', 'CLAIM_RECORD'] as const)(
    'admits only the original %s capability and matching GET route',
    async (operation) => {
      const { original, source, evaluation } = await fixture(operation);
      expect(approvalRetentionReceiptRouteInstalled(operation, source.projections)).toBe(true);
      const entry = approvalRetentionReceiptEntry(source, original)!;
      expect(entry).toBeDefined();
      expect(approvalRetentionReceiptAuthority(entry, evaluation, original)?.authority).toEqual({
        mode: 'SECURE',
        rolloutState: '110',
        routeContractKey: APPROVAL_RETENTION_RECEIPT_BINDINGS[operation].routeContractKey,
        expectedDecisionRevision: evaluation.decisionRevision,
        contextKey: source.contextKey,
        contextScopeKey: source.contextScopeKey,
      });
    }
  );

  it.each(['actor', 'route', 'method', 'rollout', 'snapshot'])(
    'fails closed before evaluation for changed %s',
    async (change) => {
      const { original, source } = await fixture('PUBLISH_POLICY');
      let changed: ApprovalRetentionReceiptSource = source;
      if (change === 'actor') changed = { ...source, actorId: '100' };
      if (change === 'route') changed = { ...source, projections: [] };
      if (change === 'method')
        changed = {
          ...source,
          projections: [
            {
              ...source.projections[0]!,
              gatewayBindings: [{ ...source.projections[0]!.gatewayBindings[0]!, method: 'POST' }],
            },
          ],
        };
      if (change === 'rollout') changed.snapshot!.envelope.rollouts[0]!.state = '100';
      if (change === 'snapshot') changed = { ...source, ready: false };
      expect(approvalRetentionReceiptEntry(changed, original)).toBeUndefined();
    }
  );

  it.each(['capability', 'permission', 'predicate', 'resourceSet', 'writable', 'eligible'])(
    'rejects borrowed %s receipt authority',
    async (change) => {
      const { original, source, evaluation } = await fixture('PUBLISH_POLICY');
      const entry = approvalRetentionReceiptEntry(source, original)!;
      const grant = evaluation.context!.effectiveGrants[0]!;
      if (grant.grantKind !== 'CAPABILITY') throw new Error('Expected capability');
      if (change === 'capability') grant.capabilityContractKey = 'approvals.policy.read';
      if (change === 'permission') grant.resolvedCapabilityCode = 'ADMIN.APPROVAL_POLICY:VIEW';
      if (change === 'predicate') grant.predicatePolicyKeys = [];
      if (change === 'resourceSet') grant.responsibility!.resourceSetKey = 'RS_OTHER';
      if (change === 'writable') evaluation.effectiveReadOnly = false;
      if (change === 'eligible') grant.activationState = 'ELIGIBLE';
      expect(approvalRetentionReceiptAuthority(entry, evaluation, original)).toBeUndefined();
    }
  );

  it('evaluates and reads only the exact matching GET without replaying the mutation', async () => {
    const { original, source, evaluation } = await fixture('SAVE_POLICY');
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: receipt(original) }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetch);
    const evaluate = vi.fn().mockResolvedValue(evaluation);
    let current = true;
    const controller = new ApprovalRetentionReceiptController();
    const resultValue = await controller.read(original, {
      source: () => source,
      isOriginal: (candidate) => current && candidate === original,
      evaluate,
    });
    expect(resultValue.receipt.status).toBe('COMMITTED');
    expect(evaluate).toHaveBeenCalledWith(
      {
        subject: { type: 'PRODUCT', productKey: 'approvals', surfaceKey: 'approvals.admin' },
        routeContractKey: APPROVAL_RETENTION_RECEIPT_BINDINGS.SAVE_POLICY.routeContractKey,
        contextKey: source.contextKey,
        contextScopeKey: source.contextScopeKey,
      },
      { signal: expect.any(AbortSignal) }
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toContain('/draft-commands/save:original');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    current = false;
    expect(resultValue.original).toBe(original);
  });

  it.each([403, 404, 409, 503])(
    'keeps the exact original UNKNOWN after receipt %s and sends no mutation',
    async (status) => {
      const { original, source, evaluation } = await fixture('CLAIM_RECORD');
      const fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'not conclusive' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      vi.stubGlobal('fetch', fetch);
      const current = true;
      const controller = new ApprovalRetentionReceiptController();
      await expect(
        controller.read(original, {
          source: () => source,
          isOriginal: (candidate) => current && candidate === original,
          evaluate: vi.fn().mockResolvedValue(evaluation),
        })
      ).rejects.toThrow();
      expect(current).toBe(true);
      expect(original.command.body.idempotencyKey).toBe('claim:original');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0]![1].method).toBe('GET');
      expect(fetch.mock.calls.every(([, init]) => !['POST', 'PUT'].includes(init.method))).toBe(
        true
      );
      expect(controller.busy).toBe(false);
    }
  );

  it('rejects source drift after fresh evaluation with receipt HTTP0', async () => {
    const { original, source, evaluation } = await fixture('INITIALIZE_POLICY');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    let live = source;
    const controller = new ApprovalRetentionReceiptController();
    await expect(
      controller.read(original, {
        source: () => live,
        isOriginal: (candidate) => candidate === original,
        evaluate: async () => {
          live = { ...source, epoch: source.epoch + 1 };
          return evaluation;
        },
      })
    ).rejects.toThrow('source changed');
    expect(fetch).not.toHaveBeenCalled();
  });
});
