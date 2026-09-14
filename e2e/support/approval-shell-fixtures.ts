import {
  APPROVAL_HOME_FIXTURE,
  APPROVAL_TASK_FIXTURE,
  APPROVAL_TASK_DETAIL_FIXTURE,
  APPROVAL_REQUEST_FIXTURE,
  APPROVAL_REQUEST_DETAIL_FIXTURE,
  APPROVAL_WORKFLOW_FIXTURE,
  APPROVAL_WORKFLOW_DETAIL_FIXTURE,
  APPROVAL_FORM_DETAIL_FIXTURE,
  APPROVAL_FORM_FIXTURE,
  APPROVAL_DELEGATIONS_FIXTURE,
  APPROVAL_ADMIN_FIXTURE,
  APPROVAL_FORM_CATEGORY_FIXTURES,
  APPROVAL_POLICIES_FIXTURE,
  APPROVAL_OPERATIONS_FIXTURE,
  APPROVAL_SIGNATURE_FIXTURES,
} from './product-area-fixtures';
import { approvalTaskSearchPage, approvalRequestSearchPage } from './approval-search-fixtures';

export function resolveApprovalShellFixture(url: URL): unknown {
  const path = url.pathname;
  if (path === '/api/approvals/v1/home') {
    return APPROVAL_HOME_FIXTURE;
  }
  if (path === '/api/approvals/v1/tasks') {
    return [APPROVAL_TASK_FIXTURE];
  }
  if (path === '/api/approvals/v1/tasks/search') {
    return approvalTaskSearchPage(url, [APPROVAL_TASK_FIXTURE]);
  }
  if (/^\/api\/approvals\/v1\/tasks\/[^/]+$/u.test(path)) {
    return APPROVAL_TASK_DETAIL_FIXTURE;
  }
  if (path === '/api/approvals/v1/requests') {
    return [APPROVAL_REQUEST_FIXTURE];
  }
  if (path === '/api/approvals/v1/requests/search') {
    return approvalRequestSearchPage(url, [APPROVAL_REQUEST_FIXTURE]);
  }
  if (/^\/api\/approvals\/v1\/requests\/[^/]+\/detail$/u.test(path)) {
    return APPROVAL_REQUEST_DETAIL_FIXTURE;
  }
  if (/^\/api\/approvals\/v1\/requests\/[^/]+$/u.test(path)) {
    return APPROVAL_REQUEST_FIXTURE;
  }
  if (path === '/api/approvals/v1/workflows/published') {
    return [APPROVAL_WORKFLOW_FIXTURE];
  }
  if (/^\/api\/approvals\/v1\/workflows\/published\/[^/]+\/template$/u.test(path)) {
    return {
      workflow: APPROVAL_WORKFLOW_FIXTURE,
      routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
      form: APPROVAL_FORM_DETAIL_FIXTURE,
    };
  }
  if (path === '/api/approvals/v1/catalog/forms') {
    return [APPROVAL_FORM_FIXTURE];
  }
  if (/^\/api\/approvals\/v1\/catalog\/forms\/[^/]+\/template$/u.test(path)) {
    return {
      workflow: APPROVAL_WORKFLOW_FIXTURE,
      routeDefinition: APPROVAL_WORKFLOW_DETAIL_FIXTURE.definition,
      form: APPROVAL_FORM_DETAIL_FIXTURE,
    };
  }
  if (path === '/api/approvals/v1/delegations') {
    return APPROVAL_DELEGATIONS_FIXTURE;
  }
  if (path === '/api/approvals/v1/admin/overview') {
    return APPROVAL_ADMIN_FIXTURE;
  }
  if (path === '/api/approvals/v1/admin/workflows') {
    return [APPROVAL_WORKFLOW_FIXTURE];
  }
  if (/^\/api\/approvals\/v1\/admin\/workflows\/[^/]+$/u.test(path)) {
    return APPROVAL_WORKFLOW_DETAIL_FIXTURE;
  }
  if (path === '/api/approvals/v1/admin/forms') {
    return [APPROVAL_FORM_FIXTURE];
  }
  if (path === '/api/approvals/v1/admin/form-categories') {
    return APPROVAL_FORM_CATEGORY_FIXTURES;
  }
  if (/^\/api\/approvals\/v1\/admin\/forms\/[^/]+$/u.test(path)) {
    return APPROVAL_FORM_DETAIL_FIXTURE;
  }
  if (path === '/api/approvals/v1/admin/policies') {
    return APPROVAL_POLICIES_FIXTURE;
  }
  if (/^\/api\/approvals\/v1\/admin\/policies\/[^/]+\/versions$/u.test(path)) {
    return [];
  }
  if (/^\/api\/approvals\/v1\/admin\/operations\/events\/[^/]+\/retry$/u.test(path)) {
    return {
      ...APPROVAL_OPERATIONS_FIXTURE,
      integrationDeliveries: APPROVAL_OPERATIONS_FIXTURE.integrationDeliveries.map((delivery) => ({
        ...delivery,
        status: 'PENDING',
        manualRetryCount: 1,
      })),
    };
  }
  if (path === '/api/approvals/v1/admin/operations') {
    return APPROVAL_OPERATIONS_FIXTURE;
  }
  if (path === '/api/approvals/v1/admin/signatures') {
    return APPROVAL_SIGNATURE_FIXTURES;
  }
  return undefined;
}
