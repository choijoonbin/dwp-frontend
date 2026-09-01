import type {
  ApprovalAdminPulse,
  ApprovalDelegation,
  ApprovalForm,
  ApprovalFormCategory,
  ApprovalFormDetail,
  ApprovalHome,
  ApprovalOperations,
  ApprovalPolicy,
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalSignatureProvider,
  ApprovalTask,
  ApprovalTaskDetail,
  ApprovalWorkflow,
  ApprovalWorkflowDetail,
} from '@dwp-frontend/shared-utils';

export const APPROVAL_TASK_FIXTURE = {
  taskId: 'approval-task-001',
  requestId: 'approval-request-001',
  requestNumber: 'APR-2026-0811-001',
  title: 'Customer data access exception',
  summary: 'Temporary access for a governed production investigation.',
  workflowNameKo: '데이터 접근 예외',
  workflowNameEn: 'Data access exception',
  stepKey: 'SECURITY_REVIEW',
  stepName: 'Security review',
  stepSequence: 2,
  requesterName: 'Minseo Kim',
  requesterOrgName: 'Digital Workplace',
  status: 'PENDING',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  riskScore: 72,
  submittedAt: '2026-08-10T23:30:00Z',
  dueAt: '2026-08-11T08:00:00Z',
  version: 3,
} as const satisfies ApprovalTask;

export const APPROVAL_REQUEST_FIXTURE = {
  requestId: APPROVAL_TASK_FIXTURE.requestId,
  requestNumber: APPROVAL_TASK_FIXTURE.requestNumber,
  title: APPROVAL_TASK_FIXTURE.title,
  summary: APPROVAL_TASK_FIXTURE.summary,
  workflowNameKo: APPROVAL_TASK_FIXTURE.workflowNameKo,
  workflowNameEn: APPROVAL_TASK_FIXTURE.workflowNameEn,
  currentStepKey: APPROVAL_TASK_FIXTURE.stepKey,
  currentStepName: APPROVAL_TASK_FIXTURE.stepName,
  currentStepSequence: 2,
  totalSteps: 3,
  status: 'IN_REVIEW',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  latestInformationRequest: null,
  submittedAt: '2026-08-10T23:30:00Z',
  dueAt: '2026-08-11T08:00:00Z',
  completedAt: null,
  version: 3,
} as const satisfies ApprovalRequest;

export const APPROVAL_WORKFLOW_FIXTURE = {
  workflowId: 'approval-workflow-data-access',
  workflowKey: 'DATA_ACCESS_EXCEPTION',
  nameKo: '데이터 접근 예외',
  nameEn: 'Data access exception',
  descriptionKo: '민감 데이터 접근을 최소 권한과 기한 기준으로 검토합니다.',
  descriptionEn: 'Reviews sensitive-data access with least privilege and expiry controls.',
  category: 'SECURITY',
  dataClassification: 'CONFIDENTIAL',
  lifecycleState: 'PUBLISHED',
  currentVersion: 4,
  slaMinutes: 480,
  allowSelfApproval: false,
  ownerGroupRef: 'SECURITY_GOVERNANCE',
  version: 4,
  updatedAt: '2026-08-10T04:00:00Z',
} as const satisfies ApprovalWorkflow;

export const APPROVAL_WORKFLOW_DETAIL_FIXTURE = {
  workflow: APPROVAL_WORKFLOW_FIXTURE,
  definition: {
    schemaVersion: 2,
    steps: [
      {
        key: 'MANAGER_REVIEW',
        name: 'Manager review',
        mode: 'ANY',
        candidateRole: 'MANAGER',
        slaMinutes: 240,
      },
      {
        key: 'SECURITY_REVIEW',
        name: 'Security review',
        mode: 'ANY',
        candidateRole: 'SECURITY_APPROVER',
        slaMinutes: 480,
      },
    ],
    guardrails: { selfApproval: false, immutableEvidence: true },
  },
  definitionHash: 'fixture-workflow-hash',
} satisfies ApprovalWorkflowDetail;

export const APPROVAL_FORM_FIXTURE = {
  formId: 'approval-form-data-access',
  formKey: 'DATA_ACCESS_EXCEPTION',
  categoryId: 'approval-category-access',
  categoryKey: 'ACCESS',
  categoryNameKo: '접근·보안',
  categoryNameEn: 'Access and security',
  nameKo: '데이터 접근 예외 신청서',
  nameEn: 'Data access exception form',
  descriptionKo: '제한 데이터 접근에 필요한 예외 승인과 만료 조건을 관리합니다.',
  descriptionEn: 'Governs exception approval and expiry conditions for restricted data access.',
  ownerGroupRef: 'SECURITY_APPROVER',
  formKind: 'REQUEST',
  lifecycleState: 'PUBLISHED',
  currentVersion: 3,
  fieldCount: 4,
  routeCount: 1,
  usageCount: 7,
  version: 3,
  updatedAt: '2026-08-10T04:00:00Z',
} as const satisfies ApprovalForm;

export const APPROVAL_FORM_CATEGORY_FIXTURES = [
  {
    categoryId: 'approval-category-access',
    categoryKey: 'ACCESS',
    parentCategoryId: null,
    nameKo: '접근·보안',
    nameEn: 'Access and security',
    descriptionKo: '권한 요청과 보안 예외를 위한 제한 양식입니다.',
    descriptionEn: 'Restricted forms for access requests and security exceptions.',
    iconKey: 'shield-check',
    sortOrder: 50,
    lifecycleState: 'ACTIVE',
    formCount: 1,
    version: 0,
  },
] as const satisfies ApprovalFormCategory[];

export const APPROVAL_FORM_DETAIL_FIXTURE = {
  form: APPROVAL_FORM_FIXTURE,
  schema: {
    schemaVersion: 2,
    fields: [
      {
        key: 'businessReason',
        labelKo: '업무 사유',
        labelEn: 'Business reason',
        type: 'TEXTAREA',
        required: true,
      },
      { key: 'expiresOn', labelKo: '만료일', labelEn: 'Expiry date', type: 'DATE', required: true },
      {
        key: 'dataScope',
        labelKo: '데이터 범위',
        labelEn: 'Data scope',
        type: 'TEXT',
        required: true,
      },
      {
        key: 'riskLevel',
        labelKo: '위험 수준',
        labelEn: 'Risk level',
        type: 'SELECT',
        required: true,
        options: ['LOW', 'MEDIUM', 'HIGH'],
      },
    ],
  },
  schemaHash: 'fixture-form-hash',
  routes: [
    {
      bindingId: 'approval-binding-data-access',
      workflowId: 'approval-workflow-data-access',
      workflowKey: 'DATA_ACCESS_EXCEPTION',
      workflowNameKo: '데이터 접근 예외',
      workflowNameEn: 'Data access exception',
      workflowLifecycleState: 'PUBLISHED',
      workflowVersion: 4,
      slaMinutes: 480,
      bindingType: 'DEFAULT',
      priority: 100,
    },
  ],
} satisfies ApprovalFormDetail;

export const APPROVAL_HOME_FIXTURE = {
  generatedAt: '2026-08-11T00:20:00Z',
  metrics: {
    pending: 6,
    dueToday: 2,
    overdue: 1,
    needsInformation: 1,
    myRequestsInFlight: 4,
    averageCycleHours: 5.8,
    slaCompliancePercent: 94,
  },
  focusQueue: [APPROVAL_TASK_FIXTURE],
  recentRequests: [APPROVAL_REQUEST_FIXTURE],
  flow: [
    { stage: 'SUBMITTED', count: 8, atRisk: 0 },
    { stage: 'IN_REVIEW', count: 12, atRisk: 2 },
    { stage: 'COMPLETED', count: 31, atRisk: 0 },
  ],
  insights: [
    {
      key: 'approval-sla-risk',
      tone: 'WARNING',
      titleKo: '오늘 만료되는 결재 2건',
      titleEn: 'Two decisions are due today',
      detailKo: '위험도가 높은 항목부터 검토하세요.',
      detailEn: 'Review the highest-risk item first.',
      route: '/approvals/inbox',
    },
  ],
  administrator: true,
  adminPulse: {
    publishedWorkflows: 12,
    draftWorkflows: 3,
    activeRequests: 24,
    overdueTasks: 1,
    failedIntegrations: 0,
  },
} satisfies ApprovalHome;

export const APPROVAL_ADMIN_FIXTURE = {
  publishedWorkflows: 12,
  draftWorkflows: 3,
  activeRequests: 24,
  overdueTasks: 1,
  failedIntegrations: 0,
} satisfies ApprovalAdminPulse;

export const APPROVAL_TASK_DETAIL_FIXTURE = {
  task: APPROVAL_TASK_FIXTURE,
  payload: {
    businessReason: 'Restore a customer-facing integration within the approved support window.',
    expiresOn: '2026-08-12',
    dataScope: 'Tenant-scoped diagnostic events',
  },
  formSchema: APPROVAL_FORM_DETAIL_FIXTURE.schema,
  timeline: [
    {
      eventId: 'approval-event-001',
      eventType: 'REQUEST_SUBMITTED',
      actorType: 'USER',
      actorId: '2',
      outcome: 'SUBMITTED',
      message: 'Submitted with an eight-hour support window.',
      occurredAt: '2026-08-10T23:30:00Z',
    },
  ],
  canClaim: false,
  canDecide: true,
  selfApprovalBlocked: false,
} satisfies ApprovalTaskDetail;

export const APPROVAL_REQUEST_DETAIL_FIXTURE = {
  request: APPROVAL_REQUEST_FIXTURE,
  workflowId: APPROVAL_WORKFLOW_FIXTURE.workflowId,
  formId: APPROVAL_FORM_FIXTURE.formId,
  payload: APPROVAL_TASK_DETAIL_FIXTURE.payload,
  formSchema: APPROVAL_FORM_DETAIL_FIXTURE.schema,
  timeline: APPROVAL_TASK_DETAIL_FIXTURE.timeline,
} satisfies ApprovalRequestDetail;

export const APPROVAL_POLICIES_FIXTURE = [
  {
    policyId: 'approval-policy-separation',
    policyKey: 'SEGREGATION_OF_DUTIES',
    nameKo: '요청자와 승인자 분리',
    nameEn: 'Requester and approver separation',
    policyType: 'SEGREGATION_OF_DUTIES',
    enforcementMode: 'BLOCK',
    severity: 'HIGH',
    lifecycleState: 'ACTIVE',
    rule: { requesterCannotApprove: true },
    version: 2,
  },
] satisfies ApprovalPolicy[];

export const APPROVAL_OPERATIONS_FIXTURE = {
  generatedAt: '2026-08-11T00:20:00Z',
  signals: [
    {
      key: 'delivery',
      state: 'HEALTHY',
      titleKo: '결재 전달',
      titleEn: 'Decision delivery',
      detailKo: '모든 전달 채널이 정상입니다.',
      detailEn: 'All delivery channels are healthy.',
      count: 0,
    },
    {
      key: 'sla',
      state: 'ATTENTION',
      titleKo: 'SLA 위험',
      titleEn: 'SLA at risk',
      detailKo: '1건이 운영자 확인을 기다립니다.',
      detailEn: 'One item is waiting for operator review.',
      count: 1,
    },
  ],
  breachedTasks: [APPROVAL_TASK_FIXTURE],
  integrationDeliveries: [
    {
      outboxId: 'approval-outbox-failed-001',
      eventId: 'approval-integration-event-001',
      requestId: APPROVAL_REQUEST_FIXTURE.requestId,
      eventType: 'approval.request.approved',
      status: 'FAILED',
      attemptCount: 3,
      manualRetryCount: 0,
      availableAt: '2026-08-11T00:15:00Z',
      publishedAt: null,
      lastError: 'Downstream endpoint returned 503',
      createdAt: '2026-08-11T00:10:00Z',
      lastRetriedAt: null,
      version: 7,
    },
  ],
} satisfies ApprovalOperations;

export const APPROVAL_SIGNATURE_FIXTURES = [
  {
    providerId: 'signature-provider-enterprise',
    providerKey: 'ENTERPRISE_SIGNATURE',
    displayName: 'Enterprise e-signature',
    providerType: 'REST',
    lifecycleState: 'PILOT',
    capabilities: { embeddedSigning: true, qualifiedCertificate: false },
    credentialConfigured: false,
    lastHealthCheckedAt: null,
    version: 1,
  },
] satisfies ApprovalSignatureProvider[];

export const APPROVAL_DELEGATIONS_FIXTURE = [
  {
    delegationId: 'approval-delegation-001',
    delegatorUserId: 1,
    delegateUserId: 2,
    delegateDisplayName: '김민준',
    delegateEmail: 'minjun.kim@skax.example',
    scopeType: 'WORKFLOW',
    workflowId: APPROVAL_WORKFLOW_FIXTURE.workflowId,
    workflowKey: APPROVAL_WORKFLOW_FIXTURE.workflowKey,
    startsAt: '2026-08-17T00:00:00Z',
    endsAt: '2026-08-21T09:00:00Z',
    lifecycleState: 'SCHEDULED',
    reason: 'Planned leave coverage',
    version: 1,
    direction: 'OUTGOING',
  },
] satisfies ApprovalDelegation[];
