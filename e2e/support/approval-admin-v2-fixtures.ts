import { type Page, type Route } from '@playwright/test';

import { mockShellSession } from './shell-session';

export const IDS = {
  template: '11111111-1111-4111-8111-111111111111',
  templateVersion: '11111111-1111-4111-8111-111111111112',
  form: '22222222-2222-4222-8222-222222222222',
  formVersion: '22222222-2222-4222-8222-222222222223',
  group: '33333333-3333-4333-8333-333333333333',
  groupMember: '33333333-3333-4333-8333-333333333334',
  person: '33333333-3333-4333-8333-333333333335',
  resolver: '33333333-3333-4333-8333-333333333336',
  calendar: '44444444-4444-4444-8444-444444444441',
  channel: '44444444-4444-4444-8444-444444444442',
  policy: '44444444-4444-4444-8444-444444444443',
  delegation: '44444444-4444-4444-8444-444444444444',
  connector: '55555555-5555-4555-8555-555555555551',
  connectorRevision: '55555555-5555-4555-8555-555555555552',
  connectorProbe: '55555555-5555-4555-8555-555555555553',
  incident: '66666666-6666-4666-8666-666666666661',
  plan: '66666666-6666-4666-8666-666666666662',
  recoveryTarget: '66666666-6666-4666-8666-666666666663',
  incidentB: '66666666-6666-4666-8666-666666666671',
  planB: '66666666-6666-4666-8666-666666666672',
  recoveryTargetB: '66666666-6666-4666-8666-666666666673',
  event: '77777777-7777-4777-8777-777777777771',
  request: '77777777-7777-4777-8777-777777777772',
  savedView: '77777777-7777-4777-8777-777777777773',
  eventB: '77777777-7777-4777-8777-777777777781',
  requestB: '77777777-7777-4777-8777-777777777782',
  package: '88888888-8888-4888-8888-888888888881',
  promotion: '88888888-8888-4888-8888-888888888882',
  evidence: '88888888-8888-4888-8888-888888888883',
} as const;

const NOW = '2026-09-16T04:00:00Z';
const LATER = '2027-09-16T04:00:00Z';
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
export const DECISION_REVISION = `psr-${'d'.repeat(64)}`;
export const MANAGEMENT_SCOPE = {
  key: 'scope:approvals:tenant',
  kind: 'RESOURCE_SET',
  displayName: 'Approval administration scope',
  isDefault: true,
  readOnly: false,
  validUntil: null,
} as const;
const MANAGEMENT_CAPABILITIES = [
  'approvals.design.read',
  'approvals.design.update',
  'approvals.design.publish',
  'approvals.policy.read',
  'approvals.policy.update',
  'approvals.policy.publish',
  'approvals.operations.read',
  'approvals.operations.execute',
  'approvals.audit.operations.read',
] as const;
export const MANAGEMENT_CONTEXT = {
  contextKey: 'ctx:approvals:admin:v15-e2e',
  productKey: 'approvals',
  surfaceKey: 'approvals.admin',
  plane: 'management',
  accessMode: 'NORMAL',
  accessSource: 'MANAGEMENT',
  appResourceKey: 'APP.APPROVALS',
  effectiveGrants: MANAGEMENT_CAPABILITIES.map((capabilityContractKey) => ({
    grantKind: 'CAPABILITY',
    capabilityContractKey,
    resolvedCapabilityCode: capabilityContractKey,
    authorityMode: 'PERMISSION_AND_RELATIONSHIP',
    predicatePolicyKeys: [],
    responsibilityRequirement: 'REQUIRED',
    responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_APPROVALS' },
    scopeKeys: [MANAGEMENT_SCOPE.key],
    requiresProductEntitlement: false,
    readOnly: false,
    activationState: 'ACTIVE',
    validUntil: null,
  })),
  scopes: [MANAGEMENT_SCOPE],
  revalidateAt: LATER,
} as const;

function evaluatedManagementContext(routeContractKey: string) {
  const capabilityContractKey = routeContractKey.includes('policy')
    ? 'approvals.policy.update'
    : routeContractKey.includes('incident') || routeContractKey.includes('deployment')
      ? 'approvals.operations.execute'
      : 'approvals.design.update';
  return {
    ...MANAGEMENT_CONTEXT,
    effectiveGrants: MANAGEMENT_CONTEXT.effectiveGrants.filter(
      (grant) => grant.capabilityContractKey === capabilityContractKey
    ),
  };
}
const HIGH_RISK_ROUTE_KEYS = new Set([
  'route.approvals.admin.routing-directory-retire.action',
  'route.approvals.admin.routing-directory-publish.action',
  'route.approvals.admin.connector-command.action',
  'route.approvals.admin.incident-command.action',
  'route.approvals.admin.audit-export-create.action',
  'route.approvals.admin.deployment-promotion-review.action',
  'route.approvals.admin.deployment-promotion-schedule.action',
  'route.approvals.admin.deployment-activation.action',
  'route.approvals.admin.deployment-rollback.action',
  'route.approvals.admin.policy-automation-publish.action',
]);
const GOVERNED_MUTATION_ROUTE_KEYS = new Set([
  'route.approvals.admin.template-draft.action',
  'route.approvals.admin.form-studio-draft.action',
  'route.approvals.admin.routing-directory-update.action',
]);

export type CommandRecord = Readonly<{
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}>;

export type FixtureState = {
  readStatus: number | null;
  commandStatus: number | null;
  empty: boolean;
  activationReady: boolean;
  routingDraft: boolean;
  selectedDetailStatus: number | null;
  selectedDetailDelayMs: number;
  mismatchIncidentDetail: boolean;
  mismatchAuditDetail: boolean;
  driftAuditPreflightRequestBinding: boolean;
  multipleSelections: boolean;
  blockAuthorityPreflight: boolean;
  authorityResponses: number;
  releaseAuthority: () => void;
  requests: CommandRecord[];
  writes: CommandRecord[];
  evaluations: Array<Record<string, unknown>>;
  issuerRequests: Array<
    Readonly<{ body: Record<string, unknown>; headers: Record<string, string> }>
  >;
};

const success = (route: Route, data: unknown) =>
  route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });

const failure = (route: Route, status: number, code = 'APPROVAL_ADMIN_V2_TEST_FAILURE') =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ERROR', errorCode: code, message: code }),
  });

const templateCatalog = {
  items: [
    {
      templateId: IDS.template,
      templateKey: 'EXPENSE_APPROVAL_ENTERPRISE',
      categoryKey: 'FINANCE',
      scopeKind: 'GLOBAL',
      lifecycleState: 'RELEASED',
      ownerGroupRef: 'FINANCE_OPERATIONS',
      defaultWorkflowKey: 'EXPENSE_APPROVAL',
      currentVersion: 4,
      version: 4,
      current: {
        templateVersionId: IDS.templateVersion,
        nameKo: '기업 비용 결재 템플릿',
        nameEn: 'Enterprise expense approval template',
        descriptionKo: '재무 통제와 독립 결재 검토를 포함합니다.',
        descriptionEn: 'Finance controls with independent approval review.',
        releasedAt: NOW,
        schemaSha256: SHA_A,
        dependencies: [
          {
            kind: 'POLICY',
            key: 'expense-threshold-policy',
            versionConstraint: '>=2',
            required: true,
          },
        ],
        changeSummaryKo: '정책 의존성과 모바일 검토를 명시했습니다.',
        changeSummaryEn: 'Declares policy dependencies and mobile review.',
      },
    },
  ],
  mayHaveMore: false,
  nextTemplateKey: null,
};

const formSchema = {
  schemaContract: 'DWP_FORM_V3',
  schemaVersion: 3,
  compatibility: { mode: 'BACKWARD_COMPATIBLE' },
  pages: [
    {
      key: 'request',
      title: { ko: '신청 정보', en: 'Request information' },
      sections: [
        {
          key: 'expense',
          title: { ko: '비용', en: 'Expense' },
          fields: [
            {
              key: 'amount',
              type: 'DECIMAL',
              control: 'CURRENCY',
              label: { ko: '금액', en: 'Amount' },
              help: { ko: '결재 요청 금액', en: 'Requested approval amount' },
              required: true,
              span: { desktop: 6, tablet: 6, mobile: 12 },
              retention: { classification: 'INTERNAL' },
              export: { format: 'DECIMAL' },
              viewRoles: ['REQUESTER', 'APPROVER'],
              editRoles: ['REQUESTER'],
            },
          ],
        },
      ],
    },
  ],
  rules: [
    {
      key: 'amount-required',
      target: 'amount',
      effect: 'REQUIRE',
      when: { exists: 'amount' },
      message: { ko: '금액은 필수입니다.', en: 'Amount is required.' },
    },
  ],
};

const formPage = {
  items: [{ formId: IDS.form, workspaceVersion: 4 }],
  mayHaveMore: false,
  nextFormKey: null,
};

const formDetail = {
  formId: IDS.form,
  formKey: 'PRODUCTION_ACCESS_EXTENSION',
  workspaceVersion: 4,
  lifecycleState: 'DRAFT',
  nameKo: '운영 접근 권한 연장 신청서',
  nameEn: 'Production access extension request',
  descriptionKo: '기간과 위험 통제를 검토합니다.',
  descriptionEn: 'Reviews duration and risk controls.',
  ownerGroupRef: 'SECURITY_OPERATIONS',
  categoryKey: 'ACCESS_SECURITY',
  defaultWorkflowKey: 'PRODUCTION_ACCESS_REVIEW',
  updatedAt: NOW,
  current: { versionNumber: 3, schemaSha256: SHA_B, schema: formSchema },
};

const formHistory = {
  versions: [
    {
      formVersionId: IDS.formVersion,
      versionNumber: 3,
      baseSchemaSha256: SHA_A,
      schemaSha256: SHA_B,
      compatibilityMode: 'BACKWARD_COMPATIBLE',
    },
  ],
};

const routingGroup = {
  groupId: IDS.group,
  groupKey: 'FINANCE_RISK_REVIEWERS',
  displayName: 'Finance and risk reviewers',
  description: 'Reusable independent reviewers for financial risk requests.',
  lifecycle: 'ACTIVE',
  effectiveFrom: NOW,
  effectiveTo: LATER,
  version: 5,
  members: [
    {
      memberId: IDS.groupMember,
      kind: 'SUBJECT',
      userId: 42,
      personPublicId: IDS.person,
      nestedGroupId: null,
      resolverId: null,
      priority: 0,
      required: true,
    },
  ],
};

const routingResolver = {
  resolverId: IDS.resolver,
  resolverKey: 'finance-owner',
  displayName: 'Finance owner resolver',
  resolverKind: 'OWNER',
  lifecycle: 'ACTIVE',
  sourceState: 'HEALTHY',
  sourceRevision: 'people-revision-17',
  version: 3,
};

const policyCalendar = {
  calendarId: IDS.calendar,
  displayName: 'Seoul business calendar',
  timeZone: 'Asia/Seoul',
  lifecycle: 'ACTIVE',
  workWeek: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
  holidays: [{ date: '2026-10-03', label: 'National holiday' }],
  exceptions: [{ date: '2026-12-31', reason: 'Year-end close' }],
  version: 2,
};

const notificationChannel = {
  channelId: IDS.channel,
  channelKey: 'approval-email',
  channelType: 'EMAIL',
  readiness: 'NOT_VERIFIED',
  observedAt: NOW,
  version: 3,
};

const policyRule = {
  policyId: IDS.policy,
  policyKey: 'high-risk-expense-sla',
  displayName: 'High-risk expense SLA',
  lifecycle: 'ACTIVE',
  version: 7,
  calendarId: IDS.calendar,
  definitionSha256: SHA_A,
  reminders: [
    {
      reminderKey: 'manager-reminder',
      businessMinutesBefore: 60,
      templateKey: 'approval-reminder',
    },
  ],
  escalations: [
    { escalationKey: 'risk-escalation', businessMinutesAfter: 120, action: 'NOTIFY_OWNER' },
  ],
};

const delegation = {
  delegationId: IDS.delegation,
  delegateDisplayName: 'Alex Delegate',
  reason: 'Planned manager absence with bounded finance-only authority.',
  scopeType: 'FORM_CATEGORY',
  startsAt: NOW,
  endsAt: '2026-09-20T04:00:00Z',
  lifecycleState: 'IN_REVIEW',
  effectiveState: 'EVIDENCE_REQUIRED',
  findings: ['ROLE_SNAPSHOT_NOT_VERIFIED'],
  scopeBindingTruth: 'VERIFIED',
  timeWindowTruth: 'VERIFIED',
  noSubDelegationTruth: 'VERIFIED',
  identitySeparationTruth: 'VERIFIED',
  roleSnapshotTruth: 'NOT_VERIFIED',
  roleSeparationOfDutiesTruth: 'NOT_VERIFIED',
  version: 4,
};

const connector = {
  connectorId: IDS.connector,
  connectorKey: 'erp-expense-export',
  displayName: 'ERP expense export',
  connectorType: 'HTTP',
  lifecycle: 'DRAFT',
  endpointUri: 'https://erp.example.test/approvals',
  timeoutMillis: 3000,
  rateLimitPerMinute: 60,
  idempotencyMode: 'IDEMPOTENCY_KEY',
  signingMode: 'JWS',
  requestMapping: { requestId: '$.request.id' },
  responseMapping: { receiptId: '$.receipt.id' },
  definitionSha256: SHA_A,
  draftRevisionId: IDS.connectorRevision,
  version: 4,
};

const connectorDetail = {
  connector,
  probes: [
    {
      probeId: IDS.connectorProbe,
      probeKind: 'READINESS',
      evidenceRevision: 'provider-evidence-17',
      state: 'NOT_VERIFIED',
      completedAt: NOW,
      validUntil: LATER,
      version: 1,
    },
  ],
};

const incident = {
  incidentId: IDS.incident,
  incidentKey: 'approval-delivery-queue-lag',
  title: 'Approval delivery queue lag',
  severity: 'HIGH',
  status: 'OPEN',
  sourceKind: 'DELIVERY',
  sourceReference: 'delivery-queue:primary',
  version: 6,
  openedAt: NOW,
  updatedAt: NOW,
};

const recoveryPlan = {
  incidentId: IDS.incident,
  planId: IDS.plan,
  state: 'DRY_RUN_PASSED',
  version: 7,
  completedAt: null,
  dryRunEvidenceSha256: SHA_A,
  targetSha256: SHA_B,
  targetSnapshot: { queue: 'primary', redacted: true },
  stages: [
    {
      stageNumber: 1,
      actionKind: 'REPROCESS',
      targetType: 'DELIVERY_QUEUE',
      targetId: IDS.recoveryTarget,
      state: 'PENDING',
      evidenceSha256: SHA_A,
      version: 2,
    },
  ],
};

const incidentDetail = {
  incident,
  timeline: [
    {
      sequence: 1,
      eventType: 'INCIDENT_OPENED',
      summary: 'Delivery lag exceeded the governed threshold.',
      occurredAt: NOW,
      statusAfter: 'OPEN',
    },
  ],
  recoveryPlans: [recoveryPlan],
};

const incidentB = {
  ...incident,
  incidentId: IDS.incidentB,
  incidentKey: 'approval-secondary-provider-lag',
  title: 'Approval secondary provider lag',
  sourceReference: 'delivery-provider:secondary',
  version: 8,
};

const recoveryPlanB = {
  ...recoveryPlan,
  incidentId: IDS.incidentB,
  planId: IDS.planB,
  version: 9,
  targetSnapshot: { queue: 'secondary', redacted: true },
  stages: recoveryPlan.stages.map((stage) => ({
    ...stage,
    targetId: IDS.recoveryTargetB,
    version: 3,
  })),
};

const incidentDetailB = {
  incident: incidentB,
  timeline: [
    {
      sequence: 1,
      eventType: 'INCIDENT_OPENED',
      summary: 'Secondary provider lag exceeded the governed threshold.',
      occurredAt: NOW,
      statusAfter: 'OPEN',
    },
  ],
  recoveryPlans: [recoveryPlanB],
};

const auditEvent = {
  eventId: IDS.event,
  requestId: IDS.request,
  requestNumber: 'APR-2026-00017',
  eventType: 'REQUEST_APPROVED',
  outcome: 'SUCCESS',
  occurredAt: NOW,
  message: 'Approval decision recorded from current authority evidence.',
  actor: { type: 'USER', identifier: 'alex.manager', pseudonymized: false },
  evidence: { source: 'approval-service', revision: '17' },
  retention: {
    retainUntil: '2033-09-16T04:00:00Z',
    legalHoldActive: false,
    legalHoldPending: false,
    status: 'RETAINED',
  },
};

const retentionLinkage = {
  requestId: IDS.request,
  legalHoldAuthority: 'Approval retention owner service',
  canonicalLegalHoldPath: '/api/approvals/v1/admin/retention/records',
  evaluatedAt: NOW,
  retention: {
    retainUntil: '2033-09-16T04:00:00Z',
    legalHoldActive: false,
    legalHoldPending: false,
    status: 'RETAINED',
  },
};

const auditEventB = {
  ...auditEvent,
  eventId: IDS.eventB,
  requestId: IDS.requestB,
  requestNumber: 'APR-2026-00018',
  eventType: 'REQUEST_REJECTED',
  message: 'The second approval decision was recorded from current authority evidence.',
  actor: { type: 'USER', identifier: 'reviewer.two', pseudonymized: false },
  evidence: { source: 'approval-service', revision: '18' },
};

const retentionLinkageB = {
  ...retentionLinkage,
  requestId: IDS.requestB,
};

const metricDefinition = {
  key: 'cycle-time',
  label: 'Cycle time',
  formula: 'completedAt - submittedAt',
  unit: 'SECONDS',
  exclusions: ['INCOMPLETE_REQUEST'],
};

const observedMetrics = {
  suppressed: false,
  sampleBand: '20-49',
  sampleSize: 24,
  cycleP50Seconds: 3600,
  cycleP90Seconds: 7200,
  stageWaitP50Seconds: 1200,
  stageWaitP90Seconds: 2400,
  slaCompliancePercent: 96,
  routeConformancePercent: 100,
};

const analyticsDashboard = {
  generatedAt: NOW,
  definitions: [metricDefinition],
  coverage: {
    candidateRequests: 30,
    includedRequests: 24,
    includedPercent: 80,
    excludedData: { INCOMPLETE_REQUEST: 6 },
    sourceThrough: NOW,
    projectedAt: NOW,
  },
  overall: observedMetrics,
  cohorts: [{ key: 'expense-workflow', metrics: observedMetrics }],
  stageWaits: [{ sequence: 1, stepKey: 'manager-review', metrics: observedMetrics }],
};

const deploymentPackage = {
  packageId: IDS.package,
  packageKey: 'approval-finance-core',
  displayName: 'Approval finance core',
  packageVersion: 3,
  manifestSha256: SHA_A,
  rollbackDisposition: 'REVERSIBLE',
  assets: [
    {
      assetKey: 'expense-form',
      assetType: 'FORM',
      assetVersion: '3',
      contentSha256: SHA_B,
    },
  ],
  dependencies: [],
};

const promotion = {
  promotionId: IDS.promotion,
  packageId: IDS.package,
  sourceEnvironment: 'STAGING',
  targetEnvironment: 'PRODUCTION',
  status: 'SCHEDULED',
  scheduledFor: '2026-09-17T04:00:00Z',
  version: 7,
  updatedAt: NOW,
};

const promotionDetail = {
  promotion,
  deploymentPackage,
  evidence: [
    {
      evidence: {
        evidenceId: IDS.evidence,
        evidenceType: 'CANARY_HEALTH',
        externalReference: 'provider-observation:17',
        sourceGeneratedAt: NOW,
        outcome: 'HEALTHY',
      },
    },
  ],
  rollbackFeasibility: {
    status: 'REVERSIBLE',
    conditions: [],
    externalSideEffectsStatus: 'NOT_ASSERTED',
  },
};

function canonicalData(
  path: string,
  method: string,
  body: unknown,
  state: Pick<
    FixtureState,
    | 'activationReady'
    | 'empty'
    | 'routingDraft'
    | 'mismatchIncidentDetail'
    | 'mismatchAuditDetail'
    | 'driftAuditPreflightRequestBinding'
    | 'multipleSelections'
    | 'requests'
  >
): unknown {
  const { empty } = state;
  const currentPromotion = state.activationReady
    ? { ...promotion, status: 'APPROVED', scheduledFor: null }
    : promotion;
  const currentRoutingGroup = state.routingDraft
    ? { ...routingGroup, lifecycle: 'DRAFT' }
    : routingGroup;
  if (path === '/api/approvals/v1/admin/forms/templates') {
    return empty ? { items: [], mayHaveMore: false, nextTemplateKey: null } : templateCatalog;
  }
  if (path === '/api/approvals/v1/admin/forms/studio-v3') {
    return empty ? { items: [], mayHaveMore: false, nextFormKey: null } : formPage;
  }
  if (path === `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}`) return formDetail;
  if (path === `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}/versions`) return formHistory;
  if (path === `/api/approvals/v1/admin/forms/templates/${IDS.template}`) {
    const template = templateCatalog.items[0]!;
    return { ...template, current: { ...template.current, schema: formSchema } };
  }
  if (path === `/api/approvals/v1/admin/forms/templates/${IDS.template}/comparison`) {
    return {
      templateId: IDS.template,
      installedVersion: 3,
      availableVersion: 4,
      updateAvailable: true,
      compatible: true,
    };
  }
  if (
    path === `/api/approvals/v1/admin/forms/templates/versions/${IDS.templateVersion}/install` &&
    method === 'POST'
  ) {
    return {
      sourceTemplateId: IDS.template,
      sourceTemplateVersionId: IDS.templateVersion,
      draft: { ...formDetail, workspaceVersion: 1 },
    };
  }
  if (path === `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}/draft` && method === 'PUT') {
    return { ...formDetail, workspaceVersion: 5 };
  }
  if (path === '/api/approvals/v1/admin/forms/studio-v3/validate' && method === 'POST') {
    return { schemaSha256: SHA_B };
  }
  if (path === `/api/approvals/v1/admin/forms/studio-v3/${IDS.form}/review` && method === 'POST') {
    return { formId: IDS.form, workspaceVersion: 5 };
  }
  if (path === '/api/approvals/v1/admin/workflows/routing-directory/groups') {
    return empty ? [] : [currentRoutingGroup];
  }
  if (path === '/api/approvals/v1/admin/workflows/routing-directory/resolvers') {
    return empty ? [] : [routingResolver];
  }
  if (path === `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}`) {
    if (method === 'PUT') return { ...currentRoutingGroup, version: 6 };
    return currentRoutingGroup;
  }
  if (
    path === `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}/publish` &&
    method === 'POST'
  ) {
    return { ...currentRoutingGroup, lifecycle: 'ACTIVE', version: 6 };
  }
  if (
    path === `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}/resolution`
  ) {
    return { groupId: IDS.group, groupVersion: 5, evaluatedAt: NOW, candidates: [] };
  }
  if (
    path ===
    `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}/retirement-impact`
  ) {
    return {
      groupId: IDS.group,
      groupVersion: 5,
      directUsageCount: 0,
      parentGroupCount: 0,
      totalImpactCount: 0,
    };
  }
  if (
    path === `/api/approvals/v1/admin/workflows/routing-directory/groups/${IDS.group}/retire` &&
    method === 'POST'
  ) {
    return { groupId: IDS.group, version: 6 };
  }
  if (path === '/api/approvals/v1/admin/policies/automation/calendars') {
    return empty ? [] : [policyCalendar];
  }
  if (path === '/api/approvals/v1/admin/policies/automation/channels') {
    return empty ? [] : [notificationChannel];
  }
  if (path === '/api/approvals/v1/admin/policies/automation/rules') {
    return empty ? [] : [policyRule];
  }
  if (path === '/api/approvals/v1/admin/policies/automation/delegations') {
    return empty ? [] : [delegation];
  }
  if (
    path === `/api/approvals/v1/admin/policies/automation/rules/${IDS.policy}/draft` &&
    method === 'PUT'
  ) {
    return { ...policyRule, version: 8 };
  }
  if (
    path === `/api/approvals/v1/admin/policies/automation/rules/${IDS.policy}/publish` &&
    method === 'POST'
  ) {
    return { ...policyRule, lifecycle: 'ACTIVE', version: 8 };
  }
  if (
    path === `/api/approvals/v1/admin/policies/automation/delegations/${IDS.delegation}/reviews` &&
    method === 'POST'
  ) {
    const payload = body as { reviewId?: string; disposition?: string } | null;
    return {
      reviewId: payload?.reviewId,
      delegationId: IDS.delegation,
      delegationVersion: 5,
      disposition: payload?.disposition ?? 'APPROVE',
      complianceState: 'COMPLIANT',
      scopeBindingTruth: 'VERIFIED',
      timeWindowTruth: 'VERIFIED',
      noSubDelegationTruth: 'VERIFIED',
      identitySeparationTruth: 'VERIFIED',
      roleSnapshotTruth: 'VERIFIED',
      roleSeparationOfDutiesTruth: 'VERIFIED',
      findings: [],
      reviewEvidenceSha256: SHA_B,
      reviewedBy: 42,
      reviewedAt: NOW,
    };
  }
  if (path === '/api/approvals/v1/admin/operations/connectors') return empty ? [] : [connector];
  if (path === `/api/approvals/v1/admin/operations/connectors/${IDS.connector}`) {
    return connectorDetail;
  }
  if (
    path === `/api/approvals/v1/admin/operations/connectors/${IDS.connector}/probes` &&
    method === 'POST'
  ) {
    const payload = body as { probeId?: string } | null;
    return { probeId: payload?.probeId ?? IDS.connectorProbe, version: 1, state: 'PENDING' };
  }
  if (path === '/api/approvals/v1/admin/operations/incidents') {
    return empty ? [] : state.multipleSelections ? [incident, incidentB] : [incident];
  }
  if (path === `/api/approvals/v1/admin/operations/incidents/${IDS.incident}`) {
    return incidentDetail;
  }
  if (path === `/api/approvals/v1/admin/operations/incidents/${IDS.incidentB}`) {
    return state.mismatchIncidentDetail ? incidentDetail : incidentDetailB;
  }
  if (
    path ===
      `/api/approvals/v1/admin/operations/incidents/${IDS.incident}/recovery-plans/${IDS.plan}/stages/1/start` &&
    method === 'POST'
  ) {
    return { planId: IDS.plan, version: 8, status: 'EXECUTING' };
  }
  if (
    path ===
      `/api/approvals/v1/admin/operations/incidents/${IDS.incidentB}/recovery-plans/${IDS.planB}/stages/1/start` &&
    method === 'POST'
  ) {
    return { planId: IDS.planB, version: 10, status: 'EXECUTING' };
  }
  if (path === '/api/approvals/v1/admin/operations/audit-records/events') {
    return empty
      ? { generatedAt: NOW, accessLevel: 'METADATA', events: [], nextCursor: null }
      : {
          generatedAt: NOW,
          accessLevel: 'METADATA',
          events: state.multipleSelections ? [auditEvent, auditEventB] : [auditEvent],
          nextCursor: null,
        };
  }
  if (path === '/api/approvals/v1/admin/operations/audit-records/saved-views') {
    return empty
      ? []
      : [
          {
            savedViewId: IDS.savedView,
            name: 'High-risk decisions',
            visibility: 'PRIVATE',
            version: 1,
            updatedAt: NOW,
          },
        ];
  }
  if (path === `/api/approvals/v1/admin/operations/audit-records/events/${IDS.event}`) {
    return auditEvent;
  }
  if (path === `/api/approvals/v1/admin/operations/audit-records/events/${IDS.eventB}`) {
    if (state.mismatchAuditDetail) return auditEvent;
    const priorReads = state.requests.filter((request) => request.path === path).length;
    return state.driftAuditPreflightRequestBinding && priorReads > 0
      ? { ...auditEventB, requestId: IDS.request }
      : auditEventB;
  }
  if (
    path ===
    `/api/approvals/v1/admin/operations/audit-records/requests/${IDS.request}/retention-linkage`
  ) {
    return retentionLinkage;
  }
  if (
    path ===
    `/api/approvals/v1/admin/operations/audit-records/requests/${IDS.requestB}/retention-linkage`
  ) {
    return retentionLinkageB;
  }
  if (path === '/api/approvals/v1/admin/operations/audit-records/exports' && method === 'POST') {
    const payload = body as { exportId?: string } | null;
    return { exportId: payload?.exportId, status: 'COMPLETED', version: 1 };
  }
  if (path === '/api/approvals/v1/admin/operations/analytics/metric-definitions') {
    return empty ? [] : [metricDefinition];
  }
  if (path === '/api/approvals/v1/admin/operations/analytics/dashboard') {
    return empty
      ? {
          ...analyticsDashboard,
          definitions: [],
          overall: { suppressed: true, sampleBand: '0' },
          cohorts: [],
          stageWaits: [],
          coverage: {
            ...analyticsDashboard.coverage,
            candidateRequests: 0,
            includedRequests: 0,
            includedPercent: 0,
            excludedData: {},
          },
        }
      : analyticsDashboard;
  }
  if (
    path === '/api/approvals/v1/admin/operations/analytics/cohorts/expense-workflow/representatives'
  ) {
    return [
      {
        requestId: IDS.request,
        requestStatus: 'COMPLETED',
        submittedAt: '2026-09-16T02:00:00Z',
        completedAt: NOW,
        cycleSeconds: 7200,
        reworkCount: 0,
        delegationCount: 0,
        escalationCount: 1,
        routeConformant: true,
      },
    ];
  }
  if (path === '/api/approvals/v1/admin/operations/deployments/dashboard') {
    return {
      generatedAt: NOW,
      environmentHeads: [
        { environment: 'PRODUCTION', version: 9, updatedAt: NOW },
        { environment: 'STAGING', version: 12, updatedAt: NOW },
      ],
      recentPromotions: [currentPromotion],
    };
  }
  if (path === '/api/approvals/v1/admin/operations/deployments/packages') {
    return empty ? [] : [deploymentPackage];
  }
  if (path === `/api/approvals/v1/admin/operations/deployments/packages/${IDS.package}`) {
    return deploymentPackage;
  }
  if (path === '/api/approvals/v1/admin/operations/deployments/promotions') {
    return empty ? [] : [currentPromotion];
  }
  if (path === `/api/approvals/v1/admin/operations/deployments/promotions/${IDS.promotion}`) {
    return { ...promotionDetail, promotion: currentPromotion };
  }
  if (
    path ===
    `/api/approvals/v1/admin/operations/deployments/promotions/${IDS.promotion}/rollback-feasibility`
  ) {
    return promotionDetail.rollbackFeasibility;
  }
  if (
    path ===
      `/api/approvals/v1/admin/operations/deployments/promotions/${IDS.promotion}/activation` &&
    method === 'POST'
  ) {
    return { promotionId: IDS.promotion, status: 'ACTIVATING', version: 8 };
  }
  return undefined;
}

export async function mockAdminV2(
  page: Page,
  options: {
    readStatus?: number;
    commandStatus?: number;
    empty?: boolean;
    activationReady?: boolean;
    routingDraft?: boolean;
    appearanceMode?: 'light' | 'dark';
    selectedDetailStatus?: number;
    selectedDetailDelayMs?: number;
    mismatchIncidentDetail?: boolean;
    mismatchAuditDetail?: boolean;
    driftAuditPreflightRequestBinding?: boolean;
    multipleSelections?: boolean;
    blockAuthorityPreflight?: boolean;
  } = {}
) {
  await mockShellSession(page, ['APPROVAL_OPERATOR'], {
    locale: 'en',
    displayName: 'Approval Operator',
    permissions: [
      ...['VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'MANAGE'].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_DESIGN',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
      ...['VIEW', 'UPDATE', 'APPROVE', 'MANAGE'].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_POLICY',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
      ...['VIEW', 'UPDATE', 'MANAGE'].map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.APPROVAL_OPERATIONS',
        permissionCode,
        effect: 'ALLOW' as const,
      })),
    ],
    appearance: {
      mode: options.appearanceMode ?? 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  let releaseAuthority = () => undefined;
  const authorityGate = new Promise<void>((resolve) => {
    releaseAuthority = resolve;
  });
  const state: FixtureState = {
    readStatus: options.readStatus ?? null,
    commandStatus: options.commandStatus ?? null,
    empty: options.empty ?? false,
    activationReady: options.activationReady ?? false,
    routingDraft: options.routingDraft ?? false,
    selectedDetailStatus: options.selectedDetailStatus ?? null,
    selectedDetailDelayMs: options.selectedDetailDelayMs ?? 0,
    mismatchIncidentDetail: options.mismatchIncidentDetail ?? false,
    mismatchAuditDetail: options.mismatchAuditDetail ?? false,
    driftAuditPreflightRequestBinding: options.driftAuditPreflightRequestBinding ?? false,
    multipleSelections: options.multipleSelections ?? false,
    blockAuthorityPreflight: options.blockAuthorityPreflight ?? false,
    authorityResponses: 0,
    releaseAuthority,
    requests: [],
    writes: [],
    evaluations: [],
    issuerRequests: [],
  };

  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v4',
      decisionRevision: DECISION_REVISION,
      sourceRevisions: {
        auth: 'auth-v15-e2e',
        policy: 'policy-v15-e2e',
        productRelationship: 'relationship-v15-e2e',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: new Date().toISOString(),
      contexts: [MANAGEMENT_CONTEXT],
      rollouts: [
        {
          productKey: 'approvals',
          state: '111',
          flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: true },
          cohort: 'apr-17-24-e2e',
          opaqueRevision: 'approval-v15-e2e',
          authorityStatus: 'AVAILABLE',
        },
      ],
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.evaluations.push(body);
    const routeContractKey = String(body.routeContractKey ?? '');
    if (HIGH_RISK_ROUTE_KEYS.has(routeContractKey)) {
      if (state.blockAuthorityPreflight) await authorityGate;
      state.authorityResponses += 1;
      return success(route, {
        decision: 'STEP_UP_REQUIRED',
        reasonCode: 'STEP_UP_REQUIRED',
        decisionRevision: DECISION_REVISION,
        requiredAssurance: 'urn:dwp:assurance:high',
        revalidateAt: LATER,
      });
    }
    return success(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: DECISION_REVISION,
      context: GOVERNED_MUTATION_ROUTE_KEYS.has(routeContractKey)
        ? evaluatedManagementContext(routeContractKey)
        : MANAGEMENT_CONTEXT,
      routeGrantRef: `grant:${routeContractKey}`,
      scope: MANAGEMENT_SCOPE,
      effectiveReadOnly: false,
      validUntil: null,
      revalidateAt: LATER,
    });
  });
  await page.route('**/api/auth/product-surface-step-up-challenges', (route) => {
    state.issuerRequests.push({
      body: route.request().postDataJSON() as Record<string, unknown>,
      headers: route.request().headers(),
    });
    return success(route, {
      state: 'ISSUED',
      challenge: 'signed-apr-17-24-command',
      challengeId: '99999999-9999-4999-8999-999999999999',
      decisionRevision: DECISION_REVISION,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
  });
  await page.route('**/api/approvals/v1/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = request.postData() ? (request.postDataJSON() as unknown) : undefined;
    const data = canonicalData(url.pathname, method, body, state);
    if (data === undefined) return route.fallback();
    const record = {
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body,
      headers: request.headers(),
    };
    state.requests.push(record);
    const selectedDetailRead =
      method === 'GET' &&
      (url.pathname === `/api/approvals/v1/admin/operations/incidents/${IDS.incidentB}` ||
        url.pathname === `/api/approvals/v1/admin/operations/audit-records/events/${IDS.eventB}`);
    if (selectedDetailRead && state.selectedDetailDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.selectedDetailDelayMs));
    }
    if (selectedDetailRead && state.selectedDetailStatus) {
      return failure(route, state.selectedDetailStatus);
    }
    if (method === 'GET' && state.readStatus) return failure(route, state.readStatus);
    if (method !== 'GET') {
      state.writes.push(record);
      if (state.commandStatus)
        return failure(route, state.commandStatus, 'COMMAND_OUTCOME_UNKNOWN');
    }
    return success(route, data);
  });
  return state;
}
