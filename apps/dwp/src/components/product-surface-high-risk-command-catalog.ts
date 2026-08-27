export type ProductSurfaceHighRiskOperation =
  | 'WORKFLOW_PUBLISH'
  | 'FORM_PUBLISH'
  | 'POLICY_PUBLISH'
  | 'DELIVERY_RETRY'
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
      operation: 'HCM_ORG_PUBLISH',
      productKey: 'hcm',
      surfaceKey: 'hcm.management',
      routeContractKey: 'route.hcm.management.org-publish.action',
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
