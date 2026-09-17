import type { Page, Route } from '@playwright/test';
import type { DwaionGovernedCommand } from '@dwp-frontend/shared-utils';

import { DWAION_GOVERNED_COMMAND_KINDS } from '../../libs/shared-utils/src/api/dwaion-control-plane-parser';

const STAMP = '2026-09-08T03:00:00Z';
const CAPABILITY = { status: 'AVAILABLE', configured: true } as const;

type RequestRecord = {
  path: string;
  method: string;
  search: string;
  body: Record<string, unknown> | null;
};

const AUTHORITY_SCOPE = {
  key: 'scope:dwaion:tenant',
  kind: 'RESOURCE_SET',
  displayName: 'DWAI·ON tenant operations',
  isDefault: true,
  readOnly: false,
  validUntil: null,
} as const;

const AUTHORITY_GRANT = {
  grantKind: 'CAPABILITY',
  capabilityContractKey: 'dwaion.control-plane.command',
  resolvedCapabilityCode: 'ADMIN.DWAION_OPERATIONS:MANAGE',
  authorityMode: 'PERMISSION',
  predicatePolicyKeys: [],
  responsibilityRequirement: 'NOT_REQUIRED',
  scopeKeys: [AUTHORITY_SCOPE.key],
  requiresProductEntitlement: false,
  readOnly: false,
  activationState: 'ACTIVE',
  validUntil: null,
} as const;

const AUTHORITY_CONTEXT = {
  contextKey: 'ctx:dwaion:management',
  productKey: 'dwaion',
  surfaceKey: 'dwaion.management',
  plane: 'management',
  accessMode: 'NORMAL',
  accessSource: 'MANAGEMENT',
  appResourceKey: 'APP.ASK',
  effectiveGrants: [AUTHORITY_GRANT],
  scopes: [AUTHORITY_SCOPE],
  revalidateAt: '2030-01-01T00:00:00Z',
} as const;

export const ADMIN_MODELS_ROUTING = {
  generatedAt: STAMP,
  capability: CAPABILITY,
  providers: [
    {
      providerId: 'provider-managed',
      name: 'Managed enterprise provider',
      kind: 'MANAGED',
      region: 'ap-northeast-2',
      health: 'HEALTHY',
      latencyP95Ms: 420,
      successRate: 99.88,
      activeModelCount: 2,
      updatedAt: STAMP,
    },
    {
      providerId: 'provider-private',
      name: 'Private inference cluster',
      kind: 'PRIVATE',
      region: 'kr-private-1',
      health: 'DEGRADED',
      latencyP95Ms: 1_420,
      successRate: 98.4,
      activeModelCount: 1,
      updatedAt: STAMP,
    },
  ],
  models: [
    {
      modelId: 'model-primary',
      providerId: 'provider-managed',
      displayName: 'Enterprise multimodal model',
      modalities: ['TEXT', 'VISION'],
      contextWindow: 128_000,
      lifecycle: 'ACTIVE',
      qualityScore: 98.6,
      costPerMillionInputTokens: 2.5,
      costPerMillionOutputTokens: 8,
      allowedDataClassifications: ['TIER_1', 'TIER_2_MASKED'],
      governancePolicy: 'No training · DLP masking required',
      region: 'ap-northeast-2',
      credentialState: 'BOUND',
      credentialRef: 'kms:key:9021',
    },
    {
      modelId: 'model-fallback',
      providerId: 'provider-private',
      displayName: 'Private safe fallback',
      modalities: ['TEXT'],
      contextWindow: 64_000,
      lifecycle: 'CANARY',
      qualityScore: 94.2,
      costPerMillionInputTokens: 0,
      costPerMillionOutputTokens: 0,
      allowedDataClassifications: ['TIER_1', 'TIER_2_MASKED', 'TIER_3'],
      governancePolicy: 'Zero egress · private mTLS',
      region: 'kr-private-1',
      credentialState: 'BOUND',
      credentialRef: 'mtls:cluster-a3',
    },
  ],
  routingPolicies: [
    {
      policyId: 'policy-default',
      name: 'General work routing',
      scope: 'tenant:fixture',
      primaryModelId: 'model-primary',
      fallbackModelIds: ['model-fallback'],
      budgetMode: 'THROTTLE',
      dailyBudget: 4_000_000,
      version: 7,
      state: 'ACTIVE',
      updatedAt: STAMP,
    },
  ],
  routingRules: [
    {
      ruleId: 'rule-standard',
      name: 'General questions and daily briefings',
      taskType: 'STANDARD_QUERY',
      conditions: ['Latency < 1.2s', 'Cost optimized'],
      allowedDataClassifications: ['TIER_1', 'TIER_2_MASKED'],
      primaryModelId: 'model-primary',
      fallbackModelIds: ['model-fallback'],
      failClosed: false,
      version: 4,
    },
    {
      ruleId: 'rule-confidential',
      name: 'Finance and HR confidential review',
      taskType: 'STRICT_ZERO_EGRESS',
      conditions: ['External providers prohibited', 'DLP hard block'],
      allowedDataClassifications: ['TIER_3'],
      primaryModelId: 'model-fallback',
      fallbackModelIds: [],
      failClosed: true,
      version: 3,
    },
  ],
  latestSimulation: {
    simulationId: 'simulation-42',
    decision: 'ROUTED',
    matchedRuleId: 'rule-standard',
    targetModelId: 'model-primary',
    estimatedCost: 38.4,
    currency: 'KRW',
    estimatedLatencyMs: 420,
    fallbackModelIds: ['model-fallback'],
    generatedAt: STAMP,
  },
  pendingApprovalCount: 1,
  activeCanaryCount: 1,
  emergencyStopActive: false,
  monthlySpend: 82_000_000,
  monthlyBudget: 120_000_000,
} as const;

export const ADMIN_CONNECTORS = {
  generatedAt: STAMP,
  capability: CAPABILITY,
  connectors: [
    {
      connectorId: 'connector-knowledge',
      name: 'Enterprise knowledge',
      providerType: 'SHAREPOINT',
      ownerRef: 'team:knowledge-platform',
      tenantScope: 'tenant:fixture',
      region: 'ap-northeast-2',
      repositories: ['policies', 'handbooks'],
      health: 'HEALTHY',
      syncState: 'IDLE',
      aclCoverage: 99.4,
      lastSuccessfulSyncAt: STAMP,
      secretExpiresAt: '2026-12-31T00:00:00Z',
      version: 4,
    },
  ],
  blockedRepositoryCount: 1,
  aclMismatchCount: 2,
} as const;

export const ADMIN_EVALUATION_SAFETY = {
  generatedAt: STAMP,
  capability: CAPABILITY,
  datasets: [
    {
      datasetId: 'dataset-release',
      name: 'Enterprise release evidence',
      version: 3,
      ownerRef: 'team:ai-safety',
      caseCount: 2_400,
      piiState: 'PASS',
      checksumSha256: 'a'.repeat(64),
      updatedAt: STAMP,
    },
  ],
  comparisons: [
    {
      comparisonId: 'comparison-release-42',
      baselineLabel: 'model-v3',
      candidateLabel: 'model-v4',
      state: 'COMPLETED',
      passRate: 98.6,
      regressionCount: 2,
      evaluatorFailureCount: 1,
      createdAt: STAMP,
    },
  ],
  driftSignals: [
    {
      signalId: 'drift-completion',
      label: 'Task completion drift',
      severity: 'WARNING',
      currentValue: 2.1,
      threshold: 1.5,
      affectedScope: 'agent:research',
      detectedAt: STAMP,
      anonymizedSample: 'Research completion fell below the verified baseline.',
      feedbackEvidenceRef: 'feedback:cluster:42',
      approvedRawAccess: false,
      rollbackRecommendation: 'Hold canary promotion until the regression is resolved.',
    },
  ],
  releaseGateState: 'REVIEW',
} as const;

export const ADMIN_INCIDENTS = {
  generatedAt: STAMP,
  capability: CAPABILITY,
  incidents: [
    {
      incidentId: 'incident-ai-42',
      title: 'External route error spike',
      severity: 'SEV2',
      state: 'CONTAINED',
      affectedRunCount: 18,
      affectedUserCount: 7,
      scope: 'route:external-primary',
      ownerRef: 'team:ai-operations',
      correlationId: 'corr-ai-incident-42',
      openedAt: '2026-09-08T02:40:00Z',
      updatedAt: STAMP,
      version: 5,
      timeline: [
        {
          eventId: 'incident-event-42',
          type: 'CONTAINMENT_COMPLETED',
          summary: 'External traffic moved to the verified private fallback.',
          actorRef: 'operator:fixture',
          occurredAt: STAMP,
          evidenceRefs: ['audit:event:42'],
        },
      ],
    },
  ],
  quarantinedRunCount: 18,
  recoveryApprovalCount: 1,
} as const;

export const ADMIN_OUTCOMES = {
  generatedAt: STAMP,
  periodDays: 30,
  capability: CAPABILITY,
  privacyThreshold: 5,
  suppressedCohortCount: 2,
  metrics: [
    {
      metricKey: 'completion-rate',
      label: 'Verified completion rate',
      value: 94.2,
      unit: 'PERCENT',
      denominator: 1_840,
      previousValue: 88.4,
      freshnessAt: STAMP,
    },
    {
      metricKey: 'cycle-time',
      label: 'Cycle time',
      value: 2_760,
      unit: 'MILLISECONDS',
      denominator: 1_733,
      previousValue: 4_800,
      freshnessAt: STAMP,
    },
  ],
  cohorts: [
    {
      cohortKey: 'research',
      label: 'Deep research',
      completedWorkCount: 189,
      completionRate: 88.4,
      reworkRate: 4.2,
      rollbackRate: 0.4,
      costPerCompletedWork: 62,
    },
  ],
  backlog: [
    {
      itemId: 'backlog-research',
      title: 'Improve research knowledge freshness',
      ownerTeam: 'Search platform',
      priority: 'P1',
      metricEvidence: 'completion-rate',
      problemCluster: 'Knowledge coverage gap',
      targetValue: 'Completion >= 94%',
      linkedRelease: 'release:2026.10',
      state: 'APPROVED',
      version: 2,
    },
  ],
  tokenBudgets: [
    {
      scope: 'agent:research',
      consumedTokens: 820_000,
      budgetTokens: 1_200_000,
      projectedTokens: 1_080_000,
      spikeDetected: true,
      policyMode: 'THROTTLE',
      enforcementActivationState: 'ENABLED',
      version: 4,
    },
  ],
  currency: 'KRW',
} as const;

export async function mockDwaionAdminAdvancement(page: Page, requests: RequestRecord[]) {
  const commands = new Map<string, DwaionGovernedCommand>();
  const checkerCommand = pendingCheckerCommand();
  commands.set(checkerCommand.commandId, checkerCommand);
  await page.route('**/api/agent/v1/admin/control-plane/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const body = request.postDataJSON() as Record<string, unknown> | null;
    requests.push({ path, method: request.method(), search: url.search, body });
    const success = (data: unknown) => route.fulfill({ json: { success: true, data } });

    if (path.endsWith('/command-capabilities')) {
      return success({
        generatedAt: STAMP,
        workerAvailable: true,
        commands: [...DWAION_GOVERNED_COMMAND_KINDS].map((kind) => ({
          kind,
          family: 'A01',
          executionMode: 'INTERNAL',
          status: 'AVAILABLE',
          configured: true,
          reason: null,
          recoveryHint: null,
        })),
      });
    }
    if (path.endsWith('/models-routing')) return success(ADMIN_MODELS_ROUTING);
    if (path.endsWith('/connectors')) return success(ADMIN_CONNECTORS);
    if (path.endsWith('/evaluation-safety')) return success(ADMIN_EVALUATION_SAFETY);
    if (path.endsWith('/incidents')) return success(ADMIN_INCIDENTS);
    if (path.endsWith('/outcomes')) {
      return success({
        ...ADMIN_OUTCOMES,
        periodDays: Number(url.searchParams.get('period_days') ?? 30),
      });
    }
    if (path.endsWith('/commands') && request.method() === 'GET') {
      const state = url.searchParams.get('state');
      const limit = Number(url.searchParams.get('limit') ?? 20);
      return success({
        generatedAt: STAMP,
        commands: [...commands.values()]
          .filter((command) => !state || command.state === state)
          .slice(0, limit),
      });
    }
    if (path.endsWith('/commands') && request.method() === 'POST') {
      const command = commandFromRequest(body);
      commands.set(command.commandId, command);
      return success(command);
    }
    if (path.includes('/commands/')) {
      const segments = path.split('/');
      const commandId = decodeURIComponent(segments[segments.indexOf('commands') + 1] ?? '');
      const current = commands.get(commandId);
      if (!current) return route.fulfill({ status: 404, json: { detail: 'Command not found' } });
      if (request.method() === 'GET') return success(current);
      const next = transitionCommand(current, segments.at(-1), body);
      commands.set(commandId, next);
      return success(next);
    }
    return route.fulfill({
      status: 404,
      json: { detail: `Unmocked control-plane endpoint: ${path}` },
    });
  });
  return { commands };
}

export async function mockDwaionControlPlaneAuthority(page: Page) {
  const success = (route: Route, data: unknown) =>
    route.fulfill({
      json: { status: 'SUCCESS', message: 'OK', data },
    });
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'e2e-dwaion-control-plane-r1',
      sourceRevisions: {
        auth: 'auth-dwaion-r1',
        policy: 'policy-dwaion-r1',
        productRelationship: 'relationship-dwaion-r1',
      },
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-09-17T00:00:00Z',
      contexts: [AUTHORITY_CONTEXT],
      rollouts: [
        {
          productKey: 'dwaion',
          state: '110',
          flags: { contextShadow: true, capabilityEnforcement: true, surfaceUi: false },
          cohort: 'e2e-control-plane',
          opaqueRevision: 'rollout-dwaion-r1',
          authorityStatus: 'AVAILABLE',
        },
      ],
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    return success(route, {
      decision: 'ALLOWED',
      reasonCode: null,
      decisionRevision: 'e2e-dwaion-control-plane-r1',
      context: AUTHORITY_CONTEXT,
      routeGrantRef: 'grant:dwaion:control-plane-command',
      scope: AUTHORITY_SCOPE,
      effectiveReadOnly: false,
      validUntil: null,
      revalidateAt: '2030-01-01T00:00:00Z',
    });
  });
}

function commandFromRequest(body: Record<string, unknown> | null): DwaionGovernedCommand {
  const evidenceRefs = Array.isArray(body?.evidenceRefs) ? (body.evidenceRefs as string[]) : [];
  return {
    commandId: String(body?.commandId ?? crypto.randomUUID()),
    kind: body?.kind as DwaionGovernedCommand['kind'],
    state: 'AWAITING_APPROVAL',
    target: body?.target as DwaionGovernedCommand['target'],
    expectedVersion: Number(body?.expectedVersion ?? 0),
    makerUserId: 'fixture-maker',
    checkerUserId: null,
    approvalRequired: true,
    canApprove: false,
    review: {
      reason: String(body?.reason ?? ''),
      ticketRef: String(body?.ticketRef ?? ''),
      evidenceRefs,
      preflight: body?.preflight as DwaionGovernedCommand['review']['preflight'],
    },
    allowedTransitions: ['CANCEL'],
    transitionBlockReason:
      'The maker cannot approve or reject this command. An independent checker is required.',
    progressPercent: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    receipt: null,
    problem: null,
    decision: null,
    version: 1,
  };
}

function pendingCheckerCommand(): DwaionGovernedCommand {
  return {
    commandId: '0df00b1f-22ac-40d1-b555-bcc78ba91587',
    kind: 'MODEL_ROUTING_UPDATE',
    state: 'AWAITING_APPROVAL',
    target: { type: 'ROUTING_POLICY', id: 'route-enterprise' },
    expectedVersion: 7,
    makerUserId: 'fixture-maker',
    checkerUserId: null,
    approvalRequired: true,
    canApprove: true,
    review: {
      reason: 'Move enterprise research traffic to the evaluated routing policy.',
      ticketRef: 'AI-OPS-41',
      evidenceRefs: ['evaluation:run:41', 'audit:event:41'],
      preflight: {
        changes: [
          { field: 'Primary model', before: 'model-primary', after: 'model-canary' },
          { field: 'Canary traffic', before: '0%', after: '5%' },
        ],
        impactScopes: ['tenant:fixture', 'agent:research'],
        recoveryPlan: 'Restore model-primary and drain the canary route if validation fails.',
        recoveryPlanHash: 'a'.repeat(64),
      },
    },
    allowedTransitions: ['APPROVE', 'REJECT'],
    transitionBlockReason: null,
    progressPercent: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    receipt: null,
    problem: null,
    decision: null,
    version: 1,
  };
}

function transitionCommand(
  current: DwaionGovernedCommand,
  transition: string | undefined,
  body: Record<string, unknown> | null
): DwaionGovernedCommand {
  if (transition === 'decision') {
    const rejected = body?.decision === 'REJECT';
    return {
      ...current,
      state: rejected ? 'REJECTED' : 'QUEUED',
      checkerUserId: 'fixture-checker',
      canApprove: false,
      allowedTransitions: rejected ? [] : ['CANCEL'],
      transitionBlockReason: null,
      decision: {
        decision: rejected ? 'REJECT' : 'APPROVE',
        actorUserId: 'fixture-checker',
        reason: String(body?.reason ?? ''),
        evidenceRefs: Array.isArray(body?.evidenceRefs) ? (body.evidenceRefs as string[]) : [],
        decidedAt: STAMP,
      },
      version: current.version + 1,
    };
  }
  if (transition === 'cancel') {
    return {
      ...current,
      state: 'CANCELLED',
      allowedTransitions: [],
      transitionBlockReason: null,
      version: current.version + 1,
    };
  }
  return {
    ...current,
    state: 'QUEUED',
    allowedTransitions: ['CANCEL'],
    transitionBlockReason: null,
    version: current.version + 1,
  };
}
