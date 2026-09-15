export type ProductSurfaceHighRiskOperation =
  | 'WORKFLOW_PUBLISH'
  | 'FORM_PUBLISH'
  | 'FORM_REVIEWED_PUBLISH'
  | 'POLICY_PUBLISH'
  | 'DELIVERY_RETRY'
  | 'DELIVERY_DEAD_LETTER'
  | 'DELIVERY_REPLAY'
  | 'DELIVERY_BATCH_RETRY'
  | 'DELIVERY_BATCH_DEAD_LETTER'
  | 'DELIVERY_BATCH_REPLAY'
  | 'DELIVERY_RECONCILE'
  | 'TASK_REASSIGN'
  | 'TASK_BATCH_REASSIGN'
  | 'DOCUMENT_POLICY_PUBLISH'
  | 'ATTACHMENT_POLICY_PUBLISH'
  | 'DOCUMENT_HOLD_PUBLISH'
  | 'RETENTION_POLICY_PUBLISH'
  | 'RETENTION_RECORD_CLAIM'
  | 'SIGNATURE_SIGN'
  | 'SIGNATURE_POLICY_PUBLISH'
  | 'EXTERNAL_SIGNATURE_HANDOVER'
  | 'HCM_ORG_PUBLISH'
  | 'HCM_EXPORT_CREATE'
  | 'HCM_EXPORT_RETRY'
  | 'HCM_INTEGRATION_CONFIGURATION_CHECK'
  | 'HCM_INTEGRATION_EXECUTE'
  | 'HCM_INTEGRATION_RETRY'
  | 'HCM_INTEGRATION_RECONCILE';

export type ProductSurfaceHighRiskCommandCatalogEntry = Readonly<{
  operation: ProductSurfaceHighRiskOperation;
  productKey: string;
  surfaceKey: string;
  routeContractKey: string;
}>;

/** Product builds replace this catalog with their exact product projection. */
export const PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG: readonly ProductSurfaceHighRiskCommandCatalogEntry[] =
  [
    {
      operation: 'WORKFLOW_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.workflow-publish.action',
    },
    {
      operation: 'FORM_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.form-publish.action',
    },
    {
      operation: 'FORM_REVIEWED_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.form-reviewed-publish.action',
    },
    {
      operation: 'POLICY_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.policy-publish.action',
    },
    {
      operation: 'DELIVERY_RETRY',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.retry.action',
    },
    {
      operation: 'DELIVERY_DEAD_LETTER',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.dead-letter.action',
    },
    {
      operation: 'DELIVERY_REPLAY',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.replay.action',
    },
    {
      operation: 'DELIVERY_BATCH_RETRY',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.batch-retry.action',
    },
    {
      operation: 'DELIVERY_BATCH_DEAD_LETTER',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.batch-dead-letter.action',
    },
    {
      operation: 'DELIVERY_BATCH_REPLAY',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.batch-replay.action',
    },
    {
      operation: 'DELIVERY_RECONCILE',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.reconcile.action',
    },
    {
      operation: 'TASK_REASSIGN',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.task-reassign.action',
    },
    {
      operation: 'TASK_BATCH_REASSIGN',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.operations.task-batch-reassign.action',
    },
    {
      operation: 'HCM_ORG_PUBLISH',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.org-publish.action',
    },
    {
      operation: 'DOCUMENT_POLICY_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.document-policy-publish.action',
    },
    {
      operation: 'ATTACHMENT_POLICY_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.attachment-policy-publish.action',
    },
    {
      operation: 'DOCUMENT_HOLD_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.document-hold-publish.action',
    },
    {
      operation: 'RETENTION_POLICY_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.retention-policy-publish.action',
    },
    {
      operation: 'RETENTION_RECORD_CLAIM',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.retention-record-claim.action',
    },
    {
      operation: 'SIGNATURE_SIGN',
      productKey: 'approvals',
      surfaceKey: 'approvals.work',
      routeContractKey: 'route.approvals.work.signature-sign.action',
    },
    {
      operation: 'SIGNATURE_POLICY_PUBLISH',
      productKey: 'approvals',
      surfaceKey: 'approvals.admin',
      routeContractKey: 'route.approvals.admin.signature-policy-publish.action',
    },
    {
      operation: 'EXTERNAL_SIGNATURE_HANDOVER',
      productKey: 'approvals',
      surfaceKey: 'approvals.work',
      routeContractKey: 'route.approvals.work.external-signature-handover.action',
    },
    {
      operation: 'HCM_EXPORT_CREATE',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.controlled-export-create.action',
    },
    {
      operation: 'HCM_EXPORT_RETRY',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.controlled-export-retry.action',
    },
    {
      operation: 'HCM_INTEGRATION_CONFIGURATION_CHECK',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.integration-execute.action',
    },
    {
      operation: 'HCM_INTEGRATION_EXECUTE',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.integration-execute.action',
    },
    {
      operation: 'HCM_INTEGRATION_RETRY',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.integration-execute.action',
    },
    {
      operation: 'HCM_INTEGRATION_RECONCILE',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.integration-execute.action',
    },
  ];
