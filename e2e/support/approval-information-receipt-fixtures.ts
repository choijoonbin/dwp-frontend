import { parseProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { APPROVAL_INFORMATION_RECEIPT_ROUTE } from '@dwp-frontend/shared-utils/api/approval-information-receipt-api';

import type {
  ProductSurfaceEffectiveContext,
  ProductSurfaceEvaluationData,
} from '@dwp-frontend/shared-utils';
import type { ApprovalInformationReceiptSource } from '../../apps/dwp/src/features/approvals/approval-request-information-receipt-authority';

export function approvalInformationReceiptFixture(state: '110' | '111' = '110') {
  const revalidateAt = new Date(Date.now() + 60000).toISOString();
  const context: ProductSurfaceEffectiveContext = {
    contextKey: 'current-context',
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
    appResourceKey: 'APP.APPROVALS',
    accessMode: 'NORMAL',
    accessSource: 'ENTITLEMENT',
    plane: 'work',
    revalidateAt,
    scopes: [
      { key: 'opaque-self', kind: 'SELF', displayName: 'Self', isDefault: true, readOnly: false },
    ],
    effectiveGrants: [
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey: 'approvals.work.information-command-receipt.read',
        resolvedCapabilityCode: 'ACTION.APPROVAL_REQUEST:VIEW',
        authorityMode: 'PERMISSION',
        predicatePolicyKeys: ['predicate.approval.original-information-command-receipt.v1'],
        responsibilityRequirement: 'NOT_REQUIRED',
        scopeKeys: ['opaque-self'],
        requiresProductEntitlement: true,
        readOnly: true,
        activationState: 'ACTIVE',
      },
    ],
  };
  const snapshot = parseProductSurfaceAuthoritySnapshot({
    contractVersion: 'product-surfaces.v1',
    decisionRevision: `psr-${'a'.repeat(64)}`,
    sourceRevisions: {},
    activeAccessMode: 'NORMAL',
    generatedAt: new Date().toISOString(),
    contexts: [context],
    rollouts: [
      {
        productKey: 'approvals',
        state,
        flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: state === '111' },
        cohort: 'unit-only',
        opaqueRevision: 'unit-only-revision',
        authorityStatus: 'AVAILABLE',
      },
    ],
  });
  const source: ApprovalInformationReceiptSource = {
    ready: true,
    tenantId: '1',
    actorId: '2',
    epoch: 0,
    snapshot,
    contextKey: context.contextKey,
    contextScopeKey: context.scopes[0]!.key,
    projections: [
      {
        routeContractKey: APPROVAL_INFORMATION_RECEIPT_ROUTE,
        routeKind: 'DATA',
        subjectType: 'PRODUCT',
        navigationContextId: 'approvals.work',
        productId: 'approvals',
        surfaceId: 'approvals.work',
        routeId: null,
        pattern: null,
        gatewayBindings: [
          {
            method: 'POST',
            path: '/api/approvals/v1/requests/{requestId}/information-commands/{originalKey}/receipt',
          },
        ],
      },
    ],
  };
  const evaluation: ProductSurfaceEvaluationData = {
    decision: 'ALLOWED',
    decisionRevision: `psr-${'b'.repeat(64)}`,
    context: structuredClone(context),
    scope: structuredClone(context.scopes[0]!),
    routeGrantRef: 'opaque-new-data-grant',
    effectiveReadOnly: true,
    revalidateAt,
  };
  return { source, evaluation };
}
