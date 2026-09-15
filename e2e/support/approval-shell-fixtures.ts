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

const APPROVAL_DOCUMENT_POLICY_FIXTURE = {
  policyId: '11111111-1111-4111-8111-111111111111',
  resourceSetKey: 'ALL',
  version: 2,
  published: {
    revision: 1,
    rules: {
      allowComments: true,
      allowPrint: false,
      allowJsonExport: false,
      allowArchiveExport: false,
      includeComments: false,
      includeEvidence: false,
      allowedClassifications: [],
      fields: [],
      maxBatchItems: 20,
      maxBytes: 1_048_576,
      snapshotTtlSeconds: 300,
      evidenceRetentionDays: 365,
    },
    sha256: 'a'.repeat(64),
    makerUserId: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  pending: null,
} as const;

const APPROVAL_ATTACHMENT_POLICY_FIXTURE = {
  policyId: '22222222-2222-4222-8222-222222222222',
  resourceSetKey: 'RS_APPROVALS',
  version: 1,
  published: {
    allowUpload: false,
    allowDownload: false,
    maxFileBytes: 10_485_760,
    maxFiles: 5,
    maxRequestBytes: 52_428_800,
    maxConcurrentUploads: 1,
    allowedMediaTypes: ['application/pdf'],
    grantTtlSeconds: 300,
    retentionDays: 365,
  },
  pending: null,
  providerReadiness: 'NOT_CONFIGURED',
  publishedRevision: 1,
  pendingRevision: null,
  pendingMakerUserId: null,
  publishedRulesSha256: 'b'.repeat(64),
  pendingRulesSha256: null,
  downloadReadiness: 'NOT_CONFIGURED',
  publishEligible: false,
  publishReason: 'PENDING_POLICY_REQUIRED',
} as const;

const APPROVAL_COMPLETED_TASK_FIXTURE = {
  ...APPROVAL_TASK_FIXTURE,
  taskId: 'approval-task-completed-001',
  status: 'APPROVED',
  version: 4,
} as const;

const APPROVAL_COMPLETED_TASK_DETAIL_FIXTURE = {
  ...APPROVAL_TASK_DETAIL_FIXTURE,
  task: APPROVAL_COMPLETED_TASK_FIXTURE,
  timeline: APPROVAL_TASK_DETAIL_FIXTURE.timeline.map((event) => ({
    ...event,
    actorDisplayName: '박지호',
    stepName: '보안 검토',
    stepSequence: 2,
    delegated: false,
  })),
  canDecide: false,
} as const;

export function resolveApprovalShellFixture(url: URL): unknown {
  const path = url.pathname;
  if (path === '/api/approvals/v1/home') {
    return APPROVAL_HOME_FIXTURE;
  }
  if (path === '/api/approvals/v1/tasks') {
    return [APPROVAL_TASK_FIXTURE];
  }
  if (path === '/api/approvals/v1/tasks/search') {
    return approvalTaskSearchPage(url, [
      url.searchParams.get('view') === 'COMPLETED'
        ? APPROVAL_COMPLETED_TASK_FIXTURE
        : APPROVAL_TASK_FIXTURE,
    ]);
  }
  if (path === `/api/approvals/v1/tasks/${APPROVAL_COMPLETED_TASK_FIXTURE.taskId}`) {
    return APPROVAL_COMPLETED_TASK_DETAIL_FIXTURE;
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
  if (path === '/api/approvals/v1/admin/document-tools/policy') {
    return APPROVAL_DOCUMENT_POLICY_FIXTURE;
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
  if (path === '/api/approvals/v1/admin/attachments/policy') {
    return APPROVAL_ATTACHMENT_POLICY_FIXTURE;
  }
  return undefined;
}
