import { parseProductSurfaceAuthoritySnapshot } from '../auth/product-surface-authority-model';
import {
  APPROVAL_WORKFLOW_PLANNING_ROUTE,
  APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
} from '../api/approval-workflow-planning-contract';
import type { ProductSurfaceEffectiveContext, ProductSurfaceEvaluationData } from '../api/auth-api';

export const planningIds = {
  workflow: '11111111-1111-4111-8111-111111111111',
  version: '22222222-2222-4222-8222-222222222222',
  form: '33333333-3333-4333-8333-333333333333',
  formVersion: '44444444-4444-4444-8444-444444444444',
};
export function planningSelectionFixture() {
  return {
    workflowId: planningIds.workflow,
    workflowVersionId: planningIds.version,
    workflowRevision: 7,
    workflowSha256: 'a'.repeat(64),
    managementResourceSetKey: 'RS_APPROVAL_FINANCE',
    policy: { version: 3, sha256: 'b'.repeat(64) },
    forms: [
      {
        formId: planningIds.form,
        formVersionId: planningIds.formVersion,
        formRevision: 4,
        formVersion: 2,
        formSchemaSha256: 'c'.repeat(64),
      },
    ],
    selectedFormId: planningIds.form,
    generatedAt: new Date().toISOString(),
  };
}
export function planningResultFixture() {
  return {
    mode: 'ROLE_POOL_PREVIEW',
    runtimeEligibility: 'NOT_EVALUATED',
    requesterExclusion: 'NOT_EVALUATED',
    snapshotSha256: 'd'.repeat(64),
    authorityRevision: `awp-${'e'.repeat(64)}`,
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    stages: [
      {
        stepKey: 'FINANCE',
        selected: true,
        predecessors: [],
        roleCode: 'FINANCE_REVIEWER',
        quorumMode: 'PERCENT',
        quorumValue: 67,
        activeMemberCount: 3,
        indicativeThreshold: 3,
        poolWarning: null,
      },
    ],
  };
}
export function planningInputFixture() {
  const selection = planningSelectionFixture();
  return {
    workflowRevision: selection.workflowRevision,
    workflowSha256: selection.workflowSha256,
    formVersionId: planningIds.formVersion,
    formSchemaSha256: selection.forms[0]!.formSchemaSha256,
    policyVersion: selection.policy.version,
    policySha256: selection.policy.sha256,
    managementResourceSetKey: selection.managementResourceSetKey,
    samplePayload: { summary: 'Plan', amount: '20.01' },
  };
}
/** Explicit metadata-only unit fixture, never an installed Source11 or genuine Auth attestation. */
export function planningAuthorityFixture(
  route:
    | typeof APPROVAL_WORKFLOW_PLANNING_ROUTE
    | typeof APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE = APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE
) {
  const revalidateAt = new Date(Date.now() + 60000).toISOString();
  const predicate =
    route === APPROVAL_WORKFLOW_PLANNING_ROUTE
      ? 'predicate.approval.workflow-planning-simulation.v1'
      : 'predicate.approval.workflow-planning-selection.v1';
  const context: ProductSurfaceEffectiveContext = {
    contextKey: 'planning-current',
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    appResourceKey: 'APP.APPROVALS',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    plane: 'management',
    revalidateAt,
    scopes: [
      {
        key: 'opaque-management',
        kind: 'RESOURCE_SET',
        displayName: 'Finance',
        isDefault: true,
        readOnly: false,
      },
    ],
    effectiveGrants: [
      ['approvals.admin.workflow-planning-form.read', 'ACTION.APPROVAL_FORM:VIEW'],
      ['approvals.admin.workflow-planning-simulation.read', 'ADMIN.APPROVAL_WORKFLOW:UPDATE'],
    ].map(([key, permission]) => ({
      grantKind: 'CAPABILITY',
      capabilityContractKey: key!,
      resolvedCapabilityCode: permission!,
      authorityMode: 'PERMISSION',
      predicatePolicyKeys: [predicate],
      responsibilityRequirement: 'REQUIRED',
      responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_APPROVAL_FINANCE' },
      scopeKeys: ['opaque-management'],
      requiresProductEntitlement: true,
      readOnly: true,
      activationState: 'ACTIVE',
    })),
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
        state: '110',
        flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: false },
        cohort: 'unit-only',
        opaqueRevision: 'unit-only',
        authorityStatus: 'AVAILABLE',
      },
    ],
  });
  const projections = [
    [
      APPROVAL_WORKFLOW_PLANNING_SELECTION_ROUTE,
      'GET',
      '/api/approvals/v1/admin/workflows/{workflowId}/planning-selection',
    ],
    [
      APPROVAL_WORKFLOW_PLANNING_ROUTE,
      'POST',
      '/api/approvals/v1/admin/workflows/{workflowId}/versions/{versionId}/simulation',
    ],
  ].map(([key, method, path]) => ({
    routeContractKey: key!,
    routeKind: 'DATA' as const,
    subjectType: 'PRODUCT' as const,
    navigationContextId: 'approvals.admin',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [{ method: method!, path: path! }],
  }));
  const source = {
    ready: true,
    tenantId: '42',
    actorId: '99',
    epoch: 0,
    snapshot,
    contextKey: context.contextKey,
    contextScopeKey: context.scopes[0]!.key,
    projections,
  };
  const evaluation: ProductSurfaceEvaluationData = {
    decision: 'ALLOWED',
    decisionRevision: `psr-${'b'.repeat(64)}`,
    context: structuredClone(context),
    scope: structuredClone(context.scopes[0]!),
    routeGrantRef: 'opaque-data-grant',
    effectiveReadOnly: true,
    revalidateAt,
  };
  return { source, evaluation };
}
