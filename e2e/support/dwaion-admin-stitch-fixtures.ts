import type { Page } from '@playwright/test';
import type {
  DwaionActionPolicy,
  DwaionDataSourcePolicy,
  DwaionEvaluationRun,
  DwaionEvaluationSetDetail,
  DwaionGovernanceAuditEvent,
  DwaionOperationsOverview,
  DwaionOperationalGate,
  DwaionOperationalGateDetail,
  DwaionOperationalGatePortfolio,
  DwaionRetentionPolicy,
  DwaionSafetyPolicy,
  RegistryEntry,
} from '@dwp-frontend/shared-utils';
import { FULL_PRODUCT_PERMISSIONS, mockShellSession } from './shell-session';

export const ADMIN_STAMP = '2026-09-08T03:00:00Z';
export const ADMIN_AGENT: RegistryEntry = {
  registryType: 'AGENT',
  entryKey: 'DWP_ASSISTANT',
  revision: 3,
  name: 'DWP work assistant — governed reference review',
  description: 'Review authorized work sources and prepare a user-confirmed handoff.',
  ownerRef: 'Work operations',
  riskTier: 'MEDIUM',
  artifactVersion: '1.3.0',
  lifecycleState: 'DRAFT',
  version: 7,
  updatedAt: ADMIN_STAMP,
};
const ADMIN_AGENTS: RegistryEntry[] = [
  ADMIN_AGENT,
  {
    ...ADMIN_AGENT,
    entryKey: 'DWP_APPROVAL_EXPERT',
    revision: 4,
    name: 'Approval evidence specialist',
    description: 'Summarize permitted approval evidence without making the decision.',
    ownerRef: 'Approval operations',
    riskTier: 'HIGH',
    artifactVersion: '2.4.1',
    lifecycleState: 'ACTIVE',
    version: 9,
  },
  {
    ...ADMIN_AGENT,
    entryKey: 'DWP_GENERAL_ASSIST',
    revision: 8,
    name: 'General work assistant',
    description: 'Answer general workplace questions from the current governed source scope.',
    ownerRef: 'Workplace AI',
    riskTier: 'LOW',
    artifactVersion: '1.8.0',
    lifecycleState: 'ACTIVE',
    version: 13,
  },
  {
    ...ADMIN_AGENT,
    entryKey: 'DWP_LEGACY_SEARCH',
    revision: 2,
    name: 'Legacy document search',
    description: 'Retained registry history for a superseded search configuration.',
    ownerRef: 'Infrastructure operations',
    riskTier: 'LOW',
    artifactVersion: '0.9.4',
    lifecycleState: 'RETIRED',
    version: 6,
  },
  {
    ...ADMIN_AGENT,
    entryKey: 'DWP_FIN_EVIDENCE',
    revision: 2,
    name: 'Finance evidence analyst',
    description: 'Prepare source-grounded finance summaries for an authorized reviewer.',
    ownerRef: 'Finance operations',
    riskTier: 'HIGH',
    artifactVersion: '0.8.0',
    lifecycleState: 'DRAFT',
    version: 4,
  },
  {
    ...ADMIN_AGENT,
    entryKey: 'DWP_IT_HELPDESK',
    revision: 5,
    name: 'IT service support',
    description: 'Guide employees through permitted service-catalog and support content.',
    ownerRef: 'IT operations',
    riskTier: 'MEDIUM',
    artifactVersion: '2.1.0',
    lifecycleState: 'ACTIVE',
    version: 11,
  },
];
export const ADMIN_SOURCE: DwaionDataSourcePolicy = {
  sourceKey: 'CALENDAR',
  displayName: 'Calendar',
  description: 'Read permitted calendar events for meeting preparation.',
  providerType: 'DWP_CALENDAR',
  classification: 'CONFIDENTIAL',
  accessMode: 'SOURCE_PERMISSIONS',
  enabled: true,
  connectionState: 'CONNECTED',
  connectorRef: 'calendar-service-reference',
  policyVersion: 4,
  updatedAt: ADMIN_STAMP,
};
export const ADMIN_ACTION: DwaionActionPolicy = {
  actionKey: 'CALENDAR.EVENT.CREATE',
  title: 'Create calendar event',
  description: 'Prepare event details and hand them to Calendar for final review.',
  riskTier: 'L1',
  requiredPermission: 'APP.CALENDAR:CREATE',
  enabled: true,
  confirmationRequired: true,
  executionPolicy: 'USER_HANDOFF',
  policyVersion: 5,
  updatedAt: ADMIN_STAMP,
};
export const ADMIN_ACTIONS: DwaionActionPolicy[] = [
  { ...ADMIN_ACTION },
  {
    ...ADMIN_ACTION,
    actionKey: 'MAIL.DRAFT.CREATE',
    title: 'Draft an email',
    description: 'Open Mail compose so the user can review recipients and content before sending.',
    requiredPermission: 'APP.MAIL:CREATE',
    policyVersion: 6,
  },
  {
    ...ADMIN_ACTION,
    actionKey: 'SERVICE.REQUEST.CREATE',
    title: 'Start a service request',
    description: 'Open the employee service catalog and keep submission under user control.',
    requiredPermission: 'APP.EMPLOYEE_SERVICES:VIEW',
    enabled: false,
    executionPolicy: 'BLOCKED',
    policyVersion: 3,
  },
  {
    ...ADMIN_ACTION,
    actionKey: 'APPROVAL.REQUEST.CREATE',
    title: 'Prepare an approval request',
    description: 'Hand off a reviewed draft to the governed approval authoring workflow.',
    riskTier: 'L2',
    requiredPermission: 'ACTION.APPROVAL_REQUEST:CREATE',
    executionPolicy: 'APPROVAL_HANDOFF',
    policyVersion: 8,
  },
  {
    ...ADMIN_ACTION,
    actionKey: 'IDENTITY.GOVERNANCE.REVIEW',
    title: 'Review account access',
    description: 'Prepare an access-review handoff for an independent identity approver.',
    riskTier: 'L3',
    requiredPermission: 'ACTION.ACCESS_REVIEW:CREATE',
    executionPolicy: 'APPROVAL_HANDOFF',
    policyVersion: 4,
  },
  {
    ...ADMIN_ACTION,
    actionKey: 'PORTAL.BROADCAST.PREPARE',
    title: 'Prepare employee broadcast',
    description: 'Keep bulk employee communication disabled until its owning app enables review.',
    riskTier: 'L3',
    requiredPermission: 'APP.PORTAL:BROADCAST',
    enabled: false,
    executionPolicy: 'BLOCKED',
    policyVersion: 2,
  },
];
export const ADMIN_RETENTION: DwaionRetentionPolicy = {
  retentionDays: 180,
  legalHold: false,
  policyVersion: 6,
  updatedAt: ADMIN_STAMP,
};
export const ADMIN_SAFETY: DwaionSafetyPolicy = {
  promptInjectionOutcome: 'DENY',
  privilegedDataOutcome: 'HANDOFF',
  mutationOutcome: 'HANDOFF',
  requireCitations: true,
  publicWebEnabled: false,
  maxSourceScopes: 5,
  maxToolCalls: 3,
  policyVersion: 8,
  updatedAt: ADMIN_STAMP,
};
export const ADMIN_OVERVIEW: DwaionOperationsOverview = {
  periodDays: 30,
  runCount: 24,
  completedRunCount: 18,
  failedRunCount: 2,
  allowedRunCount: 18,
  handedOffRunCount: 4,
  deniedRunCount: 2,
  groundedAnswerCount: 15,
  abstainedAnswerCount: 3,
  configurationRequiredCount: 4,
  averageLatencyMs: 850,
  totalTokens: 6200,
  activeUserCount: 6,
  conversationCount: 9,
  feedbackUpCount: 7,
  feedbackDownCount: 2,
  retention: ADMIN_RETENTION,
  generatedAt: ADMIN_STAMP,
};
export const ADMIN_EVALUATION: DwaionEvaluationSetDetail = {
  summary: {
    evaluationSetId: '00000000-0000-4000-8000-000000000101',
    name: 'Safe calendar handoff checks',
    description:
      'Synthetic fixture cases verify evidence and expected terms; they do not measure AI accuracy.',
    locale: 'en',
    lifecycleState: 'ACTIVE',
    caseCount: 2,
    latestRunState: 'COMPLETED',
    latestPassRate: 50,
    version: 3,
    updatedAt: ADMIN_STAMP,
  },
  cases: ['Meeting evidence', 'Restricted calendar'].map((name, i) => ({
    evaluationCaseId: `00000000-0000-4000-8000-00000000020${i}`,
    evaluationSetId: '00000000-0000-4000-8000-000000000101',
    name,
    prompt: i
      ? 'Explain the policy boundary for restricted calendar entries.'
      : 'Find permitted calendar evidence for a synthetic meeting.',
    expectedTerms: ['calendar', 'review'],
    sourceScopes: ['CALENDAR'],
    version: 1,
    createdAt: ADMIN_STAMP,
  })),
};
const ADMIN_EVALUATION_SUMMARIES = [
  ADMIN_EVALUATION.summary,
  {
    ...ADMIN_EVALUATION.summary,
    evaluationSetId: '00000000-0000-4000-8000-000000000102',
    name: 'Approval evidence boundary checks',
    description: 'Verify that decision authority remains with the approval application.',
    caseCount: 3,
    latestPassRate: 100,
    version: 2,
  },
  {
    ...ADMIN_EVALUATION.summary,
    evaluationSetId: '00000000-0000-4000-8000-000000000103',
    name: 'Restricted source refusal checks',
    description: 'Verify safe refusal when a synthetic source scope is not authorized.',
    caseCount: 2,
    latestRunState: 'CONFIGURATION_REQUIRED' as const,
    latestPassRate: null,
    version: 1,
  },
  {
    ...ADMIN_EVALUATION.summary,
    evaluationSetId: '00000000-0000-4000-8000-000000000104',
    name: 'Citation evidence checks',
    description: 'Verify source-grounding and expected-term rules for synthetic answers.',
    caseCount: 1,
    latestPassRate: 100,
    version: 4,
  },
  {
    ...ADMIN_EVALUATION.summary,
    evaluationSetId: '00000000-0000-4000-8000-000000000105',
    name: 'Identity governance decision checks',
    description: 'Verify identity review handoffs using only registered rule-check evidence.',
    caseCount: 2,
    latestPassRate: 100,
    version: 2,
  },
  {
    ...ADMIN_EVALUATION.summary,
    evaluationSetId: '00000000-0000-4000-8000-000000000106',
    name: 'Employee service handoff checks',
    description: 'Draft rule checks for employee-service handoff boundaries.',
    lifecycleState: 'DRAFT' as const,
    caseCount: 3,
    latestRunState: null,
    latestPassRate: null,
    version: 1,
  },
];
export const ADMIN_EVALUATION_RUN: DwaionEvaluationRun = {
  evaluationRunId: '00000000-0000-4000-8000-000000000301',
  evaluationSetId: ADMIN_EVALUATION.summary.evaluationSetId,
  runState: 'COMPLETED',
  caseCount: 2,
  passedCount: 1,
  failedCount: 1,
  configurationRequiredCount: 0,
  modelRef: 'evaluation-fixture-model',
  createdAt: ADMIN_STAMP,
  completedAt: '2026-09-08T03:00:03Z',
  results: ADMIN_EVALUATION.cases.map((item, i) => ({
    evaluationCaseId: item.evaluationCaseId,
    caseName: item.name,
    outcome: i ? 'FAIL' : 'PASS',
    statusCode: i ? 'EXPECTED_TERMS_MISSING' : 'GROUNDED',
    grounded: true,
    expectedTermsMatched: i ? 1 : 2,
    expectedTermsTotal: 2,
    latencyMs: 800 + i * 100,
  })),
};
const GATE_KEYS: DwaionOperationalGate['gateKey'][] = [
  'MODEL_CREDENTIALS',
  'MODEL_LIFECYCLE_CAPACITY',
  'NETWORK_ISOLATION',
  'DATA_PROCESSING_LOCATION',
  'SOURCE_CONNECTORS',
  'SOURCE_ACL',
  'DATA_CLASSIFICATION_DLP',
  'EVALUATION_DATASET',
  'RELEASE_APPROVAL',
  'ACTION_APPROVAL',
  'TENANT_KMS',
  'RETENTION_LEGAL_HOLD',
  'AUDIT_RESILIENCE',
];
export const ADMIN_GATES: DwaionOperationalGate[] = GATE_KEYS.map((gateKey, index) => ({
  gateKey,
  category:
    index < 2
      ? 'AI_RUNTIME'
      : index < 4
        ? 'CONNECTIVITY'
        : index < 7
          ? 'ACCESS_CONTROL'
          : index < 10
            ? 'ASSURANCE'
            : index < 12
              ? 'DATA_PROTECTION'
              : 'OPERATIONS',
  configurationRevision: 2,
  deliveryCritical: true,
  evidenceCount: index === 0 ? 1 : 0,
  externalOwner: 'Tenant operations',
  options: gateKey === 'MODEL_CREDENTIALS' ? [{ code: 'MANAGED_IDENTITY', recommended: true }] : [],
  policyVersion: 4,
  requiredEvidenceTypes: ['TEST_RESULT'],
  selectedOption: index === 0 ? 'MANAGED_IDENTITY' : null,
  ownerUserId: 'fixture-operator',
  status: index === 0 ? 'READY_FOR_APPROVAL' : 'NOT_CONFIGURED',
  updatedAt: ADMIN_STAMP,
  lastConfiguredBy: 'fixture-operator',
  lastValidatedBy: 'fixture-operator',
}));
export const ADMIN_GATE_DETAIL: DwaionOperationalGateDetail = {
  gate: ADMIN_GATES[0],
  missingEvidenceTypes: [],
  approvalEligibility: {
    eligible: false,
    reason: 'SEPARATION_OF_DUTY',
    conflictingRole: 'CONFIGURATOR',
  },
  evidence: [
    {
      evidenceId: '00000000-0000-4000-8000-000000000401',
      evidenceType: 'TEST_RESULT',
      title: 'Synthetic managed identity boundary check',
      reference: 'evidence/test-identity-20260908',
      createdAt: ADMIN_STAMP,
      createdBy: 'fixture-operator',
    },
  ],
  events: [
    {
      eventId: '00000000-0000-4000-8000-000000000402',
      eventType: 'validated',
      actorUserId: 'fixture-operator',
      correlationId: 'fixture-correlation-01',
      createdAt: ADMIN_STAMP,
      currentStatus: 'READY_FOR_APPROVAL',
      previousStatus: 'CONFIGURING',
      outcome: 'SUCCESS',
      changeReason: 'Recorded a synthetic external validation result.',
    },
  ],
};
export const ADMIN_AUDIT: DwaionGovernanceAuditEvent = {
  eventId: '00000000-0000-4000-8000-000000000501',
  category: 'SOURCE',
  eventType: 'source-policy.updated',
  targetType: 'SOURCE_POLICY',
  targetKey: 'CALENDAR',
  actorUserId: 'fixture-operator',
  correlationId: 'fixture-correlation-01',
  changeReason: 'Restrict calendar reading to source permission checks.',
  createdAt: ADMIN_STAMP,
};
const ADMIN_AUDITS: DwaionGovernanceAuditEvent[] = [
  ADMIN_AUDIT,
  {
    ...ADMIN_AUDIT,
    eventId: '00000000-0000-4000-8000-000000000502',
    category: 'ACTION',
    eventType: 'action-policy.updated',
    targetType: 'ACTION_POLICY',
    targetKey: 'CALENDAR.EVENT.CREATE',
    actorUserId: 'policy-reviewer',
    correlationId: 'fixture-correlation-02',
    changeReason: 'Require a final user confirmation before the calendar handoff.',
    createdAt: '2026-09-08T02:42:00Z',
  },
  {
    ...ADMIN_AUDIT,
    eventId: '00000000-0000-4000-8000-000000000503',
    category: 'SAFETY',
    eventType: 'safety-policy.updated',
    targetType: 'SAFETY_POLICY',
    targetKey: 'TENANT_DEFAULT',
    actorUserId: 'security-operator',
    correlationId: 'fixture-correlation-03',
    changeReason: 'Reduce the maximum number of tool calls for the reviewed tenant policy.',
    createdAt: '2026-09-08T02:18:00Z',
  },
  {
    ...ADMIN_AUDIT,
    eventId: '00000000-0000-4000-8000-000000000504',
    category: 'EVALUATION',
    eventType: 'evaluation-run.completed',
    targetType: 'EVALUATION_SET',
    targetKey: ADMIN_EVALUATION.summary.evaluationSetId,
    actorUserId: 'evaluation-operator',
    correlationId: 'fixture-correlation-04',
    changeReason: 'Record the completed synthetic rule-check run.',
    createdAt: '2026-09-08T01:51:00Z',
  },
  {
    ...ADMIN_AUDIT,
    eventId: '00000000-0000-4000-8000-000000000505',
    category: 'RETENTION',
    eventType: 'retention-policy.updated',
    targetType: 'RETENTION_POLICY',
    targetKey: 'TENANT_DEFAULT',
    actorUserId: 'retention-manager',
    correlationId: 'fixture-correlation-05',
    changeReason: 'Apply the reviewed tenant retention period.',
    createdAt: '2026-09-08T01:22:00Z',
  },
];

export type AdminFixtureOptions = {
  locale?: 'ko' | 'en';
  dark?: boolean;
  readOnly?: boolean;
  noAccess?: boolean;
  empty?: boolean;
  failedPath?: string;
  failureStatus?: number;
  agentPermissionCodes?: readonly ('VIEW' | 'CREATE' | 'UPDATE' | 'APPROVE' | 'MANAGE')[];
  sourcePermissionCodes?: readonly ('VIEW' | 'UPDATE' | 'MANAGE')[];
  actionPermissionCodes?: readonly ('VIEW' | 'UPDATE' | 'MANAGE')[];
  safetyPermissionCodes?: readonly ('VIEW' | 'UPDATE' | 'MANAGE')[];
  auditPermissionCodes?: readonly ('VIEW' | 'EXPORT' | 'MANAGE')[];
  retentionPermissionCodes?: readonly ('VIEW' | 'UPDATE' | 'MANAGE')[];
  evaluationPermissionCodes?: readonly (
    'VIEW' | 'CREATE' | 'UPDATE' | 'MANAGE' | 'EXECUTE' | 'EXPORT'
  )[];
  gatePermissionCodes?: readonly ('VIEW' | 'CREATE' | 'UPDATE' | 'APPROVE' | 'MANAGE')[];
};
export async function mockDwaionAdminStitch(page: Page, options: AdminFixtureOptions = {}) {
  const requests: Array<{
    path: string;
    method: string;
    search: string;
    body: Record<string, unknown> | null;
  }> = [];
  const state = {
    sourcesInitialized: !options.empty,
    actionsInitialized: !options.empty,
    safetyInitialized: !options.empty,
    retentionInitialized: !options.empty,
    gatesInitialized: !options.empty,
    agents: ADMIN_AGENTS.map((entry) => ({ ...entry })),
    sources: [
      { ...ADMIN_SOURCE },
      ...(
        [
          'WORK_ITEM',
          'MAIL',
          'APPROVAL_TASK',
          'APPROVAL_REQUEST',
          'APPROVAL_FORM',
          'APPROVAL_OPERATION',
        ] as const
      ).map((sourceKey) => {
        const enabled = sourceKey === 'WORK_ITEM';
        return {
          ...ADMIN_SOURCE,
          sourceKey,
          displayName: sourceKey,
          description: 'Read only source records permitted for the current user.',
          providerType:
            sourceKey === 'WORK_ITEM'
              ? 'DWP_PLATFORM'
              : sourceKey === 'MAIL'
                ? 'DWP_MAIL'
                : 'DWP_APPROVAL',
          classification:
            sourceKey === 'WORK_ITEM' || sourceKey === 'APPROVAL_FORM'
              ? ('INTERNAL' as const)
              : sourceKey === 'APPROVAL_OPERATION'
                ? ('RESTRICTED' as const)
                : ('CONFIDENTIAL' as const),
          accessMode: enabled ? ('SOURCE_PERMISSIONS' as const) : ('BLOCKED' as const),
          connectionState: enabled ? ('CONNECTED' as const) : ('BLOCKED' as const),
          connectorRef: null,
          enabled,
        };
      }),
    ],
    actions: ADMIN_ACTIONS.map((entry) => ({ ...entry })),
    safety: { ...ADMIN_SAFETY },
    retention: { ...ADMIN_RETENTION },
  };
  const permissions = FULL_PRODUCT_PERMISSIONS.filter((permission) => {
    if (!permission.resourceKey.startsWith('ADMIN.DWAION_')) return true;
    if (options.noAccess) return false;
    if (
      [
        'ADMIN.DWAION_AGENTS',
        'ADMIN.DWAION_SOURCES',
        'ADMIN.DWAION_ACTIONS',
        'ADMIN.DWAION_SAFETY',
        'ADMIN.DWAION_AUDIT',
        'ADMIN.DWAION_RETENTION',
        'ADMIN.DWAION_EVALUATION',
        'ADMIN.DWAION_GATES',
      ].includes(permission.resourceKey)
    )
      return false;
    return !options.readOnly || permission.permissionCode === 'VIEW';
  });
  if (!options.noAccess) {
    const agentPermissionCodes =
      options.agentPermissionCodes ??
      (options.readOnly
        ? (['VIEW'] as const)
        : (['VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'MANAGE'] as const));
    permissions.push(
      ...agentPermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_AGENTS',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const sourcePermissionCodes =
      options.sourcePermissionCodes ??
      (options.readOnly ? (['VIEW'] as const) : (['VIEW', 'UPDATE', 'MANAGE'] as const));
    permissions.push(
      ...sourcePermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_SOURCES',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const actionPermissionCodes =
      options.actionPermissionCodes ??
      (options.readOnly ? (['VIEW'] as const) : (['VIEW', 'UPDATE', 'MANAGE'] as const));
    permissions.push(
      ...actionPermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_ACTIONS',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const safetyPermissionCodes =
      options.safetyPermissionCodes ??
      (options.readOnly ? (['VIEW'] as const) : (['VIEW', 'UPDATE', 'MANAGE'] as const));
    permissions.push(
      ...safetyPermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_SAFETY',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const auditPermissionCodes =
      options.auditPermissionCodes ??
      (options.readOnly ? (['VIEW'] as const) : (['VIEW', 'EXPORT', 'MANAGE'] as const));
    permissions.push(
      ...auditPermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_AUDIT',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const retentionPermissionCodes =
      options.retentionPermissionCodes ??
      (options.readOnly ? (['VIEW'] as const) : (['VIEW', 'UPDATE', 'MANAGE'] as const));
    permissions.push(
      ...retentionPermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_RETENTION',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const evaluationPermissionCodes =
      options.evaluationPermissionCodes ??
      (options.readOnly
        ? (['VIEW'] as const)
        : (['VIEW', 'CREATE', 'UPDATE', 'MANAGE', 'EXECUTE', 'EXPORT'] as const));
    permissions.push(
      ...evaluationPermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_EVALUATION',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
    const gatePermissionCodes =
      options.gatePermissionCodes ??
      (options.readOnly
        ? (['VIEW'] as const)
        : (['VIEW', 'CREATE', 'UPDATE', 'APPROVE', 'MANAGE'] as const));
    permissions.push(
      ...gatePermissionCodes.map((permissionCode) => ({
        resourceType: 'ADMIN',
        resourceKey: 'ADMIN.DWAION_GATES',
        permissionCode,
        effect: 'ALLOW' as const,
      }))
    );
  }
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: options.locale ?? 'en',
    userId: 1,
    permissions,
    appearance: {
      mode: options.dark ? 'dark' : 'light',
      density: 'standard',
      highContrast: false,
      reduceMotion: true,
    },
  });
  await page.emulateMedia({
    colorScheme: options.dark ? 'dark' : 'light',
    reducedMotion: 'reduce',
  });
  await page.route(
    /\/api\/(agent\/v1\/admin|platform\/v1\/admin\/dwaion\/agents)/,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const body = request.postDataJSON() as Record<string, unknown> | null;
      requests.push({
        path,
        method: request.method(),
        search: url.search,
        body,
      });
      const success = (data: unknown) => route.fulfill({ json: { success: true, data } });
      if (options.failedPath && path.includes(options.failedPath))
        return route.fulfill({
          status: options.failureStatus ?? 503,
          json: { detail: 'Governance service unavailable' },
        });
      if (path.includes('/dwaion/agents')) {
        if (path.endsWith('/agents'))
          return success({
            content: options.empty ? [] : state.agents,
            totalElements: options.empty ? 0 : state.agents.length,
            totalPages: 1,
            number: 0,
            size: 100,
          });
        if (request.method() === 'GET')
          return success({
            current: state.agents[0],
            history: [
              state.agents[0],
              {
                ...ADMIN_AGENT,
                revision: 2,
                lifecycleState: 'RETIRED',
                artifactVersion: '1.2.0',
              },
            ],
          });
        state.agents[0] = {
          ...state.agents[0],
          ...body,
          version: state.agents[0].version + 1,
          lifecycleState: path.endsWith('/activate')
            ? 'ACTIVE'
            : path.endsWith('/retire')
              ? 'RETIRED'
              : state.agents[0].lifecycleState,
        } as RegistryEntry;
        return success(state.agents[0]);
      }
      if (path.endsWith('/overview'))
        return success({
          ...ADMIN_OVERVIEW,
          periodDays: Number(url.searchParams.get('period_days') ?? 30),
          ...(options.empty
            ? {
                runCount: 0,
                completedRunCount: 0,
                failedRunCount: 0,
                allowedRunCount: 0,
                handedOffRunCount: 0,
                deniedRunCount: 0,
                groundedAnswerCount: 0,
                abstainedAnswerCount: 0,
                configurationRequiredCount: 0,
                averageLatencyMs: 0,
                totalTokens: 0,
                activeUserCount: 0,
                conversationCount: 0,
                feedbackUpCount: 0,
                feedbackDownCount: 0,
              }
            : {}),
        });
      if (path.endsWith('/sources/bootstrap')) {
        state.sourcesInitialized = true;
        return success(state.sources);
      }
      if (path.endsWith('/sources')) return success(state.sourcesInitialized ? state.sources : []);
      if (path.includes('/sources/')) {
        state.sources[0] = {
          ...state.sources[0],
          ...body,
          policyVersion: state.sources[0].policyVersion + 1,
          connectionState:
            body?.enabled === false || body?.accessMode === 'BLOCKED' ? 'BLOCKED' : 'CONNECTED',
        } as DwaionDataSourcePolicy;
        return success(state.sources[0]);
      }
      if (path.endsWith('/actions/bootstrap')) {
        state.actionsInitialized = true;
        return success(state.actions);
      }
      if (path.endsWith('/actions')) return success(state.actionsInitialized ? state.actions : []);
      if (path.includes('/actions/')) {
        state.actions[0] = {
          ...state.actions[0],
          ...body,
          policyVersion: state.actions[0].policyVersion + 1,
        } as DwaionActionPolicy;
        return success(state.actions[0]);
      }
      if (path.endsWith('/safety/bootstrap')) {
        state.safetyInitialized = true;
        return success(state.safety);
      }
      if (path.endsWith('/safety')) {
        if (!state.safetyInitialized)
          return route.fulfill({
            status: 404,
            json: { detail: 'Safety policy not initialized' },
          });
        if (body)
          state.safety = {
            ...state.safety,
            ...body,
            policyVersion: 9,
          } as DwaionSafetyPolicy;
        return success(state.safety);
      }
      if (path.endsWith('/retention/bootstrap')) {
        state.retentionInitialized = true;
        state.retention = {
          ...state.retention,
          retentionDays: Number(body?.retentionDays ?? 90),
          legalHold: Boolean(body?.legalHold ?? false),
          policyVersion: 1,
        };
        return success(state.retention);
      }
      if (path.endsWith('/retention')) {
        if (!state.retentionInitialized)
          return route.fulfill({
            status: 409,
            json: { detail: 'Retention policy not configured' },
          });
        if (body)
          state.retention = {
            ...state.retention,
            ...body,
            policyVersion: 7,
          } as DwaionRetentionPolicy;
        return success(state.retention);
      }
      if (path.endsWith('/export'))
        return route.fulfill({
          contentType: 'text/csv',
          headers: {
            'X-DWP-Export-Limit': '10000',
            'X-DWP-Export-Truncated': 'true',
          },
          body: 'category,target\nSOURCE,CALENDAR\n',
        });
      if (path.endsWith('/evaluations'))
        return success(options.empty ? [] : ADMIN_EVALUATION_SUMMARIES);
      if (path.endsWith('/runs'))
        return success(
          request.method() === 'POST'
            ? ADMIN_EVALUATION_RUN
            : [{ ...ADMIN_EVALUATION_RUN, passRate: 50 }]
        );
      if (path.includes('/runs/')) return success(ADMIN_EVALUATION_RUN);
      if (path.includes('/evaluations/')) {
        const evaluationSetId = path.split('/evaluations/')[1]?.split('/')[0];
        const summary = ADMIN_EVALUATION_SUMMARIES.find(
          (item) => item.evaluationSetId === evaluationSetId
        );
        return success(
          summary && summary.evaluationSetId !== ADMIN_EVALUATION.summary.evaluationSetId
            ? { summary, cases: [] }
            : ADMIN_EVALUATION
        );
      }
      if (path.endsWith('/gates/bootstrap')) {
        state.gatesInitialized = true;
        return success({
          environment: url.searchParams.get('environment') ?? 'PRODUCTION',
          gates: ADMIN_GATES,
          approvedCount: 0,
          blockedCount: 0,
          completionPercent: 0,
          deliveryReady: false,
          expiredCount: 0,
          readyForApprovalCount: 1,
          requiredCount: 13,
          totalCount: 13,
        } satisfies DwaionOperationalGatePortfolio);
      }
      if (path.endsWith('/gates'))
        return success({
          environment: url.searchParams.get('environment') ?? 'PRODUCTION',
          gates: state.gatesInitialized ? ADMIN_GATES : [],
          approvedCount: 0,
          blockedCount: 0,
          completionPercent: 0,
          deliveryReady: false,
          expiredCount: 0,
          readyForApprovalCount: state.gatesInitialized ? 1 : 0,
          requiredCount: state.gatesInitialized ? 13 : 0,
          totalCount: state.gatesInitialized ? 13 : 0,
        } satisfies DwaionOperationalGatePortfolio);
      if (path.includes('/gates/')) {
        const gateKey = decodeURIComponent(path.split('/gates/')[1]?.split('/')[0] ?? '');
        const gate = ADMIN_GATES.find((item) => item.gateKey === gateKey) ?? ADMIN_GATES[0];
        return success(
          gate.gateKey === ADMIN_GATE_DETAIL.gate.gateKey
            ? ADMIN_GATE_DETAIL
            : {
                gate,
                missingEvidenceTypes: gate.requiredEvidenceTypes,
                approvalEligibility: {
                  eligible: false,
                  reason: 'MISSING_EVIDENCE',
                },
                evidence: [],
                events: [],
              }
        );
      }
      if (path.endsWith('/audit')) {
        const requestedCategory = url.searchParams.get('category');
        const requestedQuery = url.searchParams.get('query')?.toLocaleLowerCase();
        const auditRows = options.empty
          ? []
          : ADMIN_AUDITS.filter(
              (item) =>
                (!requestedCategory || item.category === requestedCategory) &&
                (!requestedQuery ||
                  [
                    item.eventType,
                    item.targetType,
                    item.targetKey,
                    item.actorUserId,
                    item.correlationId,
                    item.changeReason,
                  ]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(requestedQuery))
            );
        return success({
          content: auditRows,
          page: 0,
          size: 25,
          totalElements: auditRows.length,
          totalPages: auditRows.length ? 1 : 0,
        });
      }
      return route.fulfill({
        status: 404,
        json: { detail: `Unmocked governance endpoint: ${path}` },
      });
    }
  );
  return { requests, state };
}
