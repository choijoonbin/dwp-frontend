/** Product builds replace this catalog with the exact product projection. */
export const PRODUCT_PAGE_SHORTCUT_TARGET_CATALOG = {
  approvalOperations: {
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.operations.page',
  },
  approvalWorkflows: {
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.workflows.page',
  },
  hcmControlledExport: {
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeContractKey: 'route.hcm.management.controlled-export.page',
  },
  hcmOrganizationDesign: {
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeContractKey: 'route.hcm.management.org-design.page',
  },
  hcmEmployeeServices: {
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeContractKey: 'route.hcm.personal.services.page',
  },
} as const satisfies Readonly<
  Record<string, Readonly<{ productId: string; surfaceId: string; routeContractKey: string }>>
>;
