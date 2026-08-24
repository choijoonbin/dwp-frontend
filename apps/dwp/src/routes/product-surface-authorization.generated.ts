/** @generated from architecture/product-surface-authorization.v1.json. Do not edit manually. */

export type ProductAuthorizationRouteProjection = Readonly<{
  routeContractKey: string;
  routeKind: 'PAGE' | 'DATA' | 'ACTION';
  navigationContextId: string;
  subjectType: 'PRODUCT' | 'GOVERNED_CONTEXT';
  productId: string | null;
  surfaceId: string | null;
  routeId: string | null;
  pattern: string | null;
  gatewayBindings: readonly Readonly<{ method: string; path: string }>[];
}>;

export const PRODUCT_AUTHORIZATION_REGISTRY_REVISION = {
  bundleKey: 'product-surfaces',
  version: 3,
  checksum: 'f90c4e3a734204a4619ae77d3476ebc7cc802c43ed8574fcf4f3fc85def67a8e',
  indexChecksum: 'dbe810156eabb2e81d21a70d1d1746f2566a8ef2ed6b9331ce334a25d2f2617f',
} as const;

export const PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS = [
  {
    routeContractKey: 'route.approvals.admin.form-category-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/form-categories',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.form-category-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/approvals/v1/admin/form-categories/{categoryId}',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.form-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/forms',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.form-publish.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/forms/{formId}/publish',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.form-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/approvals/v1/admin/forms/{formId}/draft',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.forms-workflow-reference.data',
    routeKind: 'DATA',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/workflows',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/workflows/{workflowId}',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.forms.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: 'approvals.admin.forms',
    pattern: '/approvals/admin/forms',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/forms',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/forms/{formId}',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/form-categories',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.operations.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: 'approvals.admin.operations',
    pattern: '/approvals/admin/operations',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/operations',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.operations.retry.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/operations/events/{outboxId}/retry',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.overview.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: 'approvals.admin.overview',
    pattern: '/approvals/admin/overview',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/overview',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.policies.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: 'approvals.admin.policies',
    pattern: '/approvals/admin/policies',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/policies',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/policies/{policyId}/versions',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.policy-publish.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/policies/{policyId}/publish',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.policy-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/approvals/v1/admin/policies/{policyId}',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.signatures.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: 'approvals.admin.signatures',
    pattern: '/approvals/admin/signatures',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/signatures',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.workflow-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/workflows',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.workflow-publish.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/admin/workflows/{workflowId}/publish',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.workflow-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/approvals/v1/admin/workflows/{workflowId}/draft',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.admin.workflows.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.admin',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.admin',
    routeId: 'approvals.admin.workflows',
    pattern: '/approvals/admin/workflows',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/workflows',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/admin/workflows/{workflowId}',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.completed.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.completed',
    pattern: '/approvals/completed',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/tasks',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.delegation-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/delegations',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.delegation-revoke.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/delegations/{delegationId}/revoke',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.delegations.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.delegations',
    pattern: '/approvals/delegations',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/delegations',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/delegations/candidates',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/workflows/published',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.form-template.data',
    routeKind: 'DATA',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/catalog/forms/{formId}/template',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.home-preference-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/home-preferences/surfaces/{surfaceKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.home-preference.data',
    routeKind: 'DATA',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/home-preferences/surfaces/{surfaceKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.home.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.home',
    pattern: '/approvals/home',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/home',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.inbox.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.inbox',
    pattern: '/approvals/inbox',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/tasks',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-archive.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.request-archive',
    pattern: '/approvals/requests/archive',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-detail.data',
    routeKind: 'DATA',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/requests/{requestId}',
      },
      {
        method: 'GET',
        path: '/api/approvals/v1/requests/{requestId}/detail',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-draft-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/approvals/v1/requests/{requestId}/draft',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-drafts.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.request-drafts',
    pattern: '/approvals/requests/drafts',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-information-response.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/requests/{requestId}/information-response',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-needs-info.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.request-needs-info',
    pattern: '/approvals/requests/needs-info',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-new.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.request-new',
    pattern: '/approvals/requests/new',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/catalog/forms',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-submit.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/requests/{requestId}/submit',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-submitted.page',
    routeKind: 'PAGE',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: 'approvals.work.request-submitted',
    pattern: '/approvals/requests/submitted',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.request-withdraw.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/requests/{requestId}/withdraw',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.task-claim.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/tasks/{taskId}/claim',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.task-decision.action',
    routeKind: 'ACTION',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/approvals/v1/tasks/{taskId}/decisions',
      },
    ],
  },
  {
    routeContractKey: 'route.approvals.work.task-detail.data',
    routeKind: 'DATA',
    navigationContextId: 'approvals.work',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/approvals/v1/tasks/{taskId}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.management.content-archive.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.management',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/admin/announcements/{announcementId}/archive',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.management.content-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.management',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/admin/announcements',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.management.content-publish.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.management',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/admin/announcements/{announcementId}/publish',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.management.content-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.management',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/admin/announcements/{announcementId}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.management.content.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.management',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.management',
    routeId: 'communications.management.content',
    pattern: '/communications/admin/content',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/admin/announcements',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.acknowledgement.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/communications/{communicationId}/acknowledgement',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.all-story.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.all-story',
    pattern: '/communications/all/:storyId',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications/{communicationId}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.all.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.all',
    pattern: '/communications/all',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.event.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/communications/{communicationId}/events/{eventType}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.for-you-story.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.for-you-story',
    pattern: '/communications/for-you/:storyId',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications/{communicationId}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.for-you.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.for-you',
    pattern: '/communications/for-you',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.home.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.home',
    pattern: '/communications/home',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.reaction.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/communications/{communicationId}/reaction',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.reader-state.action',
    routeKind: 'ACTION',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/communications/{communicationId}/reader-state',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.required-story.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.required-story',
    pattern: '/communications/required/:storyId',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications/{communicationId}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.required.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.required',
    pattern: '/communications/required',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.saved-story.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.saved-story',
    pattern: '/communications/saved/:storyId',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications/{communicationId}',
      },
    ],
  },
  {
    routeContractKey: 'route.communications.work.saved.page',
    routeKind: 'PAGE',
    navigationContextId: 'communications.work',
    subjectType: 'PRODUCT',
    productId: 'communications',
    surfaceId: 'communications.work',
    routeId: 'communications.work.saved',
    pattern: '/communications/saved',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/communications',
      },
    ],
  },
  {
    routeContractKey: 'route.context.work__work.review-decision.action',
    routeKind: 'ACTION',
    navigationContextId: 'work.work',
    subjectType: 'GOVERNED_CONTEXT',
    productId: null,
    surfaceId: null,
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/auth/work/access-review-items/{workItemRef}/decision',
      },
    ],
  },
  {
    routeContractKey: 'route.context.work__work.review-detail.data',
    routeKind: 'DATA',
    navigationContextId: 'work.work',
    subjectType: 'GOVERNED_CONTEXT',
    productId: null,
    surfaceId: null,
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/auth/work/access-review-items/{workItemRef}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.controlled-export-cancel.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PATCH',
        path: '/api/people/v1/workforce/exports/{requestId}/cancel',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.controlled-export-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/exports',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.controlled-export-preview.data',
    routeKind: 'DATA',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/exports/preview',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.controlled-export-retry.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PATCH',
        path: '/api/people/v1/workforce/exports/{requestId}/retry',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.controlled-export.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: 'hcm.management.controlled-export',
    pattern: '/hr/data/exports',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/exports/datasets',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/exports',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/exports/{requestId}/attempts',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.integration-code-sets.data',
    routeKind: 'DATA',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/catalog/code-sets/{codeSetKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.integration-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/connectors',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/mapping-profiles',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.integration-execute.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}/configuration-check',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}/executions',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/sync-runs/{syncRunId}/retry',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}/reconciliations',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.integration-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/people/v1/workforce/data-operations/hris/connectors/{connectorId}',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/data-operations/hris/mapping-profiles/{mappingId}/activate',
      },
      {
        method: 'PUT',
        path: '/api/people/v1/workforce/data-operations/hris/reconciliation-issues/{issueId}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.integration.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: 'hcm.management.integration',
    pattern: '/hr/data/integrations',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/data-operations/hris/sources',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/data-operations/hris/connectors',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/data-operations/hris/mapping-profiles',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/data-operations/hris/sync-runs',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/data-operations/hris/reconciliations',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/data-operations/hris/reconciliation-issues',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-approval.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/approval',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-clone.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/clone',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-code-sets.data',
    routeKind: 'DATA',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/catalog/code-sets/{codeSetKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-design.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: 'hcm.management.org-design',
    pattern: '/hr/design/organization',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/chart',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/intelligence',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/scenarios',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/decision-pack',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/decision-pack/history',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/candidates',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-publish.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/publish',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.org-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/moves',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/position-moves',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/positions',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/positions/{positionId}/close',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/decision-pack/validate',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/submit',
      },
      {
        method: 'POST',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/cancel',
      },
      {
        method: 'DELETE',
        path: '/api/people/v1/workforce/organization/scenarios/{scenarioId}/changes/{changeId}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.reference-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/people/v1/workforce/reference-data/{catalogKey}/{code}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.management.reference.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.management',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.management',
    routeId: 'hcm.management.reference',
    pattern: '/hr/data/reference',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/reference-data',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.absence-approve.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/absence/requests/{requestId}/decision',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.absence.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.absence',
    pattern: '/hr/operations/absence',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/operations/{domain}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.assignments.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.assignments',
    pattern: '/hr/operations/assignments',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/people',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.benefits.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.benefits',
    pattern: '/hr/operations/benefits',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/operations/{domain}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.overview.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.overview',
    pattern: '/hr/operations',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/operations/overview',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.pay.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.pay',
    pattern: '/hr/operations/pay',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/operations/{domain}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.people.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.people',
    pattern: '/hr/operations/people',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/people',
      },
      {
        method: 'GET',
        path: '/api/people/v1/workforce/organization/chart',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.person-detail.data',
    routeKind: 'DATA',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/workforce/people/{publicId}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.talent.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.talent',
    pattern: '/hr/operations/talent',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/operations/{domain}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.time-approve.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/time/{cardId}/decision',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.operations.time.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.operations',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    routeId: 'hcm.operations.time',
    pattern: '/hr/operations/time',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/operations/{domain}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.absence-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/absence/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.absence-withdraw.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/absence/requests/{requestId}/withdraw',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.absence.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.absence',
    pattern: '/hr/absence',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/absence',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.benefits.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.benefits',
    pattern: '/hr/benefits',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/benefits',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.directory-person-detail.data',
    routeKind: 'DATA',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/people/{publicId}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.directory.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.directory',
    pattern: '/hr/directory',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/people',
      },
      {
        method: 'GET',
        path: '/api/people/v1/org-chart',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.home-preference-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/home-preferences/surfaces/{surfaceKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.home-preference.data',
    routeKind: 'DATA',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/home-preferences/surfaces/{surfaceKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.home.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.home',
    pattern: '/hr/home',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/home',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.me.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.me',
    pattern: '/hr/me',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/people/{publicId}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.organization.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.organization',
    pattern: '/hr/organization',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/org-chart',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.pay.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.pay',
    pattern: '/hr/pay',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/pay',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.services.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.services',
    pattern: '/hr/services',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/catalog',
      },
      {
        method: 'GET',
        path: '/api/platform/v1/services/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.talent-goal-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/people/v1/hr/talent/goals/{goalId}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.talent.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.talent',
    pattern: '/hr/talent',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/talent',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.time-entry-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/people/v1/hr/time/{cardId}/entries/{workDate}',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.time-submit.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/time/{cardId}/submit',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.personal.time.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.personal',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
    routeId: 'hcm.personal.time',
    pattern: '/hr/time',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/time',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.team.absence-decision.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.team',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.team',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/team/absence/{requestId}/decision',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.team.absence.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.team',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.team',
    routeId: 'hcm.team.absence',
    pattern: '/hr/team/absence',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/team/absence',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.team.home.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.team',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.team',
    routeId: 'hcm.team.home',
    pattern: '/hr/team',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/team',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.team.time-decision.action',
    routeKind: 'ACTION',
    navigationContextId: 'hcm.team',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.team',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/people/v1/hr/team/time/{cardId}/decision',
      },
    ],
  },
  {
    routeContractKey: 'route.hcm.team.time.page',
    routeKind: 'PAGE',
    navigationContextId: 'hcm.team',
    subjectType: 'PRODUCT',
    productId: 'hcm',
    surfaceId: 'hcm.team',
    routeId: 'hcm.team.time',
    pattern: '/hr/team/time',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/people/v1/hr/team/time',
      },
    ],
  },
  {
    routeContractKey: 'route.services.management.catalog-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.management',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/admin/services/catalog',
      },
    ],
  },
  {
    routeContractKey: 'route.services.management.catalog-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.management',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/admin/services/catalog/{serviceKey}',
      },
    ],
  },
  {
    routeContractKey: 'route.services.management.catalog.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.management',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.management',
    routeId: 'services.management.catalog',
    pattern: '/services/admin/catalog',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/admin/services/catalog',
      },
      {
        method: 'GET',
        path: '/api/platform/v1/services/catalog',
      },
    ],
  },
  {
    routeContractKey: 'route.services.management.operations.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.management',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.management',
    routeId: 'services.management.operations',
    pattern: '/services/admin/operations',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/admin/services/requests',
      },
      {
        method: 'GET',
        path: '/api/platform/v1/admin/services/requests/{requestId}',
      },
    ],
  },
  {
    routeContractKey: 'route.services.management.request-transition.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.management',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.management',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/admin/services/requests/{requestId}/transition',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.discover.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: 'services.work.discover',
    pattern: '/services/discover',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/catalog',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.draft-detail.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: 'services.work.draft-detail',
    pattern: '/services/drafts/:requestId',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/requests/{requestId}',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.draft-submit.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/services/requests/{requestId}/submit',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.draft-update.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'PUT',
        path: '/api/platform/v1/services/requests/{requestId}/draft',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.drafts.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: 'services.work.drafts',
    pattern: '/services/drafts',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.home.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: 'services.work.home',
    pattern: '/services/home',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/catalog',
      },
      {
        method: 'GET',
        path: '/api/platform/v1/services/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.my-detail.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: 'services.work.my-detail',
    pattern: '/services/my/:requestId',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/requests/{requestId}',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.my.page',
    routeKind: 'PAGE',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: 'services.work.my',
    pattern: '/services/my',
    gatewayBindings: [
      {
        method: 'GET',
        path: '/api/platform/v1/services/requests',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.request-cancel.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/services/requests/{requestId}/cancel',
      },
    ],
  },
  {
    routeContractKey: 'route.services.work.request-create.action',
    routeKind: 'ACTION',
    navigationContextId: 'services.work',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
    routeId: null,
    pattern: null,
    gatewayBindings: [
      {
        method: 'POST',
        path: '/api/platform/v1/services/requests',
      },
    ],
  },
] as const satisfies readonly ProductAuthorizationRouteProjection[];

export const PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS =
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
    (
      route
    ): route is (typeof PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS)[number] & {
      routeKind: 'PAGE';
      productId: string;
      surfaceId: string;
      routeId: string;
      pattern: string;
    } => route.routeKind === 'PAGE'
  );
