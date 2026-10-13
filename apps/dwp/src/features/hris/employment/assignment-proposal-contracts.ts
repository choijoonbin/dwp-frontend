export const ASSIGNMENT_PROPOSAL_ROUTE_BINDINGS = {
  create: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-proposal-create.action',
    taskKind: 'OPERATIONS',
  },
  validate: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-proposal-validate.action',
    taskKind: 'OPERATIONS',
  },
  cancel: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-proposal-cancel.action',
    taskKind: 'OPERATIONS',
  },
} as const;

export const EMPLOYMENT_EVENT_ROUTE_BINDINGS = {
  create: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-create.action',
    taskKind: 'OPERATIONS',
  },
  validate: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-validate.action',
    taskKind: 'OPERATIONS',
  },
  submit: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-submit.action',
    taskKind: 'OPERATIONS',
  },
  publish: {
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
    routeContractKey: 'route.hcm.operations.assignment-event-publish.action',
    taskKind: 'OPERATIONS',
  },
} as const;

export const EMPLOYMENT_EVENT_BASE_PATH = '/api/people/v1/hris/assignment-events' as const;
export const EMPLOYMENT_EVENT_RECEIPT_PATH = '/api/people/v1/hris/command-receipts' as const;
export const EMPLOYMENT_EVENT_PURPOSE = 'HR_LIFECYCLE' as const;
export const EMPLOYMENT_EVENT_API_CONTRACTS = [
  {
    bindingId: 'PEP-HRM-006',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.create.routeContractKey,
    method: 'POST',
    path: EMPLOYMENT_EVENT_BASE_PATH,
  },
  {
    bindingId: 'PEP-HRM-007',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.validate.routeContractKey,
    method: 'POST',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}/validate`,
  },
  {
    bindingId: 'PEP-HRM-008',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.submit.routeContractKey,
    method: 'POST',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}/submit`,
  },
  {
    bindingId: 'PEP-HRM-009',
    routeContractKey: EMPLOYMENT_EVENT_ROUTE_BINDINGS.publish.routeContractKey,
    method: 'POST',
    path: `${EMPLOYMENT_EVENT_BASE_PATH}/{eventPublicId}/publish`,
  },
] as const;
