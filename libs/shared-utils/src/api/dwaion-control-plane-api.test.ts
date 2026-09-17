import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createDwaionGovernedCommand,
  decideDwaionGovernedCommand,
  getDwaionCommandCapabilities,
  getDwaionGovernedCommand,
  getDwaionGovernedCommands,
  getDwaionModelsRouting,
  getDwaionOutcomes,
} from './dwaion-control-plane-api';
import {
  DWAION_GOVERNED_COMMAND_KINDS,
  parseDwaionConnectors,
  parseDwaionEvaluationSafety,
  parseDwaionGovernedCommand,
  parseDwaionGovernedCommands,
  parseDwaionIncidents,
  parseDwaionModelsRouting,
  parseDwaionOutcomes,
} from './dwaion-control-plane-parser';
import { parseDwaionCommandCapabilities } from './dwaion-command-capability-parser';

const AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'dwaion-admin-r42',
  contextKey: 'psc-dwaion-management',
  contextScopeKey: 'scope-dwaion-management',
} as const;

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, data }),
    headers: new Headers(),
  } as Response;
}

const capability = { status: 'AVAILABLE', configured: true } as const;
const modelsRouting = {
  generatedAt: '2026-09-17T00:00:00Z',
  capability,
  providers: [],
  models: [],
  routingPolicies: [],
  routingRules: [],
  latestSimulation: null,
  pendingApprovalCount: 0,
  activeCanaryCount: 0,
  emergencyStopActive: false,
  monthlySpend: null,
  monthlyBudget: null,
};
const command = {
  commandId: '64e0998c-987b-4974-9490-ef1383f10dc7',
  kind: 'EMERGENCY_STOP',
  state: 'AWAITING_APPROVAL',
  target: { type: 'ROUTING_SCOPE', id: 'tenant' },
  expectedVersion: 7,
  approvalRequired: true,
  canApprove: true,
  review: {
    reason: 'Stop unsafe traffic while incident INC-42 is investigated.',
    ticketRef: 'INC-42',
    evidenceRefs: ['audit:event:42'],
    preflight: {
      changes: [{ field: 'route', before: 'primary', after: 'safe-mode' }],
      impactScopes: ['tenant'],
      recoveryPlan: 'Restore the last verified routing policy and validate health probes.',
      recoveryPlanHash: 'a'.repeat(64),
    },
  },
  allowedTransitions: ['APPROVE', 'REJECT'],
  progressPercent: null,
  createdAt: '2026-09-17T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
  version: 1,
  receipt: null,
};
const commandCapabilities = {
  generatedAt: '2026-09-17T00:00:00Z',
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
};

describe('DWAI-ON control-plane API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads the exhaustive per-command capability contract from the canonical endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(commandCapabilities));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDwaionCommandCapabilities();

    expect(result.commands).toHaveLength(65);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/admin/control-plane/command-capabilities',
      expect.any(Object)
    );
  });

  it('rejects incomplete, duplicated, and contradictory command capability snapshots', () => {
    expect(() =>
      parseDwaionCommandCapabilities({
        ...commandCapabilities,
        commands: commandCapabilities.commands.slice(1),
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionCommandCapabilities({
        ...commandCapabilities,
        commands: [commandCapabilities.commands[0], ...commandCapabilities.commands.slice(0, 64)],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionCommandCapabilities({
        ...commandCapabilities,
        commands: [
          { ...commandCapabilities.commands[0], status: 'NOT_CONFIGURED', configured: true },
          ...commandCapabilities.commands.slice(1),
        ],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('uses the canonical read endpoints and clamps the outcome range', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(modelsRouting))
      .mockResolvedValueOnce(
        response({
          generatedAt: '2026-09-17T00:00:00Z',
          capability,
          periodDays: 90,
          privacyThreshold: 10,
          suppressedCohortCount: 0,
          metrics: [],
          cohorts: [],
          backlog: [],
          tokenBudgets: [],
          currency: 'KRW',
        })
      )
      .mockResolvedValueOnce(response(command));
    vi.stubGlobal('fetch', fetchMock);

    await getDwaionModelsRouting();
    await getDwaionOutcomes(400, { organization: ' R&D ', workType: 'Deep Research' });
    await getDwaionGovernedCommand('command / 42');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/agent/v1/admin/control-plane/models-routing',
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/admin/control-plane/outcomes?period_days=90&organization=R%26D&work_type=Deep+Research',
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/agent/v1/admin/control-plane/commands/command%20%2F%2042',
      expect.any(Object)
    );
  });

  it('lists checker work through a bounded, fail-closed command queue', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ generatedAt: '2026-09-17T00:00:00Z', commands: [command] })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getDwaionGovernedCommands({ state: 'AWAITING_APPROVAL', limit: 250 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/admin/control-plane/commands?state=AWAITING_APPROVAL&limit=100',
      expect.any(Object)
    );
  });

  it('binds command execution to the trusted product-surface scope and revision', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(command));
    vi.stubGlobal('fetch', fetchMock);

    await createDwaionGovernedCommand(
      {
        commandId: '64e0998c-987b-4974-9490-ef1383f10dc7',
        kind: 'EMERGENCY_STOP',
        target: { type: 'ROUTING_SCOPE', id: 'tenant' },
        expectedVersion: 7,
        reason: 'Stop unsafe traffic while incident INC-42 is investigated.',
        ticketRef: 'INC-42',
        evidenceRefs: ['audit:event:42'],
        impactAcknowledged: true,
        preflight: {
          changes: [{ field: 'route', before: 'primary', after: 'safe-mode' }],
          impactScopes: ['tenant'],
          recoveryPlan: 'Restore the last verified routing policy and validate health probes.',
          recoveryPlanHash: 'a'.repeat(64),
        },
        payload: { fallback: 'SAFE_MODE' },
      },
      AUTHORITY
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/admin/control-plane/commands?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'dwaion-admin-r42',
        }),
      })
    );
  });

  it('requires a command-bound step-up proof for emergency recovery and sends every precondition', async () => {
    const request = {
      commandId: 'b091d33a-97f4-4a89-974d-d6e4281a9aef',
      kind: 'EMERGENCY_RECOVERY' as const,
      target: { type: 'ROUTING_SCOPE', id: 'tenant' },
      expectedVersion: 7,
      reason: 'Recover through the independently reviewed bounded canary.',
      ticketRef: 'INC-42',
      evidenceRefs: ['validation:run:42'],
      impactAcknowledged: true as const,
      preflight: {
        changes: [{ field: 'traffic', before: 'stopped', after: 'canary-5-percent' }],
        impactScopes: ['tenant'],
        recoveryPlan: 'Stop canary traffic and restore isolation if any threshold fails.',
        recoveryPlanHash: 'b'.repeat(64),
      },
      payload: { canaryPercent: 5, requireIndependentSecondFactor: true },
    };

    await expect(createDwaionGovernedCommand(request, AUTHORITY)).rejects.toThrowError(
      'Product surface governed HIGH-risk mutation authority is incomplete.'
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response({ ...command, kind: 'EMERGENCY_RECOVERY' }));
    vi.stubGlobal('fetch', fetchMock);
    await createDwaionGovernedCommand(request, {
      ...AUTHORITY,
      objectVersion: 7,
      idempotencyKey: request.commandId,
      stepUp: {
        challenge: 'signed-command-bound-recovery-proof',
        challengeId: 'e42bfb43-d1a5-4caf-8742-017e159f64de',
        decisionRevision: AUTHORITY.expectedDecisionRevision,
        expiresAt: '2026-09-18T00:00:00Z',
      },
    });

    const headers = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-command-bound-recovery-proof');
    expect(headers.get('X-DWP-Expected-Object-Version')).toBe('7');
    expect(headers.get('Idempotency-Key')).toBe(request.commandId);
    expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe('dwaion-admin-r42');
  });

  it('sends a checker decision through the governed command lifecycle endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        response({
          ...command,
          state: 'QUEUED',
          canApprove: false,
          allowedTransitions: ['CANCEL'],
          version: 2,
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await decideDwaionGovernedCommand(
      'command-42',
      {
        commandId: '0df00b1f-22ac-40d1-b555-bcc78ba91587',
        decision: 'APPROVE',
        expectedVersion: 2,
        reason: 'Independent review verified impact and rollback evidence.',
        evidenceRefs: ['ticket:INC-42'],
      },
      AUTHORITY
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/admin/control-plane/commands/command-42/decision?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('fails closed when a snapshot or premature success receipt is malformed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ ...modelsRouting, pendingApprovalCount: -1 }))
      .mockResolvedValueOnce(
        response({ ...command, state: 'SUCCEEDED', receipt: null, updatedAt: 'not-a-date' })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionModelsRouting()).rejects.toMatchObject({ status: 502 });
    await expect(getDwaionGovernedCommand('command-42')).rejects.toMatchObject({ status: 502 });
  });

  it('rejects malformed model routing enums, ranges, duplicate IDs, and foreign keys', () => {
    const provider = {
      providerId: 'provider-1',
      name: 'Managed provider',
      kind: 'MANAGED',
      health: 'HEALTHY',
      latencyP95Ms: 120,
      successRate: 99.9,
      activeModelCount: 1,
      updatedAt: '2026-09-17T00:00:00Z',
    };
    const model = {
      modelId: 'model-1',
      providerId: 'provider-1',
      displayName: 'Verified model',
      modalities: ['TEXT'],
      contextWindow: 32_000,
      lifecycle: 'ACTIVE',
      qualityScore: 92,
      costPerMillionInputTokens: 1.5,
      costPerMillionOutputTokens: 2.5,
      allowedDataClassifications: ['TIER_1'],
      governancePolicy: 'No training; DLP masking required',
      region: 'ap-northeast-2',
      credentialState: 'BOUND',
      credentialRef: 'kms:key:1',
    };
    const policy = {
      policyId: 'policy-1',
      name: 'Default route',
      scope: 'tenant',
      primaryModelId: 'model-1',
      fallbackModelIds: [],
      budgetMode: 'THROTTLE',
      dailyBudget: 100,
      version: 1,
      state: 'ACTIVE',
      updatedAt: '2026-09-17T00:00:00Z',
    };
    const valid = {
      ...modelsRouting,
      providers: [provider],
      models: [model],
      routingPolicies: [policy],
    };

    expect(() => parseDwaionModelsRouting(valid)).not.toThrow();
    expect(() =>
      parseDwaionModelsRouting({ ...valid, providers: [{ ...provider, successRate: 101 }] })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionModelsRouting({ ...valid, models: [{ ...model, providerId: 'missing' }] })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionModelsRouting({ ...valid, models: [model, { ...model }] })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionModelsRouting({
        ...valid,
        routingPolicies: [{ ...policy, primaryModelId: 'missing' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('rejects malformed connector, evaluation, and incident nested contracts', () => {
    const connectorSnapshot = {
      generatedAt: '2026-09-17T00:00:00Z',
      capability,
      connectors: [
        {
          connectorId: 'connector-1',
          name: 'Knowledge',
          providerType: 'SHAREPOINT',
          ownerRef: 'team:knowledge',
          tenantScope: 'tenant',
          repositories: ['repo-1'],
          health: 'HEALTHY',
          syncState: 'IDLE',
          aclCoverage: 100,
          version: 1,
        },
      ],
      blockedRepositoryCount: 0,
      aclMismatchCount: 0,
    };
    const evaluationSnapshot = {
      generatedAt: '2026-09-17T00:00:00Z',
      capability,
      datasets: [
        {
          datasetId: 'dataset-1',
          name: 'Release set',
          version: 1,
          ownerRef: 'team:safety',
          caseCount: 20,
          piiState: 'PASS',
          checksumSha256: 'a'.repeat(64),
          updatedAt: '2026-09-17T00:00:00Z',
        },
      ],
      comparisons: [
        {
          comparisonId: 'comparison-1',
          baselineLabel: 'v1',
          candidateLabel: 'v2',
          state: 'COMPLETED',
          passRate: 95,
          regressionCount: 0,
          evaluatorFailureCount: 0,
          datasetId: 'dataset-1',
          datasetVersion: 1,
          resultVersion: 1,
          createdAt: '2026-09-17T00:00:00Z',
        },
      ],
      driftSignals: [
        {
          signalId: 'signal-1',
          label: 'Completion drift',
          severity: 'WARNING',
          currentValue: 2,
          threshold: 1,
          affectedScope: 'tenant',
          detectedAt: '2026-09-17T00:00:00Z',
        },
      ],
      releaseGateState: 'REVIEW',
    };
    const incidentSnapshot = {
      generatedAt: '2026-09-17T00:00:00Z',
      capability,
      incidents: [
        {
          incidentId: 'incident-1',
          title: 'Tool error spike',
          severity: 'SEV2',
          state: 'OPEN',
          affectedRunCount: 4,
          affectedUserCount: 2,
          scope: 'tenant',
          ownerRef: 'team:operations',
          correlationId: 'correlation-1',
          openedAt: '2026-09-17T00:00:00Z',
          updatedAt: '2026-09-17T00:00:00Z',
          version: 1,
          timeline: [
            {
              eventId: 'event-1',
              type: 'INCIDENT_OPENED',
              summary: 'Incident created from verified run failures.',
              occurredAt: '2026-09-17T00:00:00Z',
              evidenceRefs: ['run:1'],
            },
          ],
        },
      ],
      quarantinedRunCount: 0,
      recoveryApprovalCount: 0,
    };

    expect(() => parseDwaionConnectors(connectorSnapshot)).not.toThrow();
    expect(() =>
      parseDwaionConnectors({
        ...connectorSnapshot,
        connectors: [{ ...connectorSnapshot.connectors[0], aclCoverage: -1 }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() => parseDwaionEvaluationSafety(evaluationSnapshot)).not.toThrow();
    expect(() =>
      parseDwaionEvaluationSafety({
        ...evaluationSnapshot,
        datasets: [{ ...evaluationSnapshot.datasets[0], checksumSha256: 'not-sha256' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionEvaluationSafety({
        ...evaluationSnapshot,
        comparisons: [{ ...evaluationSnapshot.comparisons[0], passRate: 100.1 }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionEvaluationSafety({
        ...evaluationSnapshot,
        driftSignals: [{ ...evaluationSnapshot.driftSignals[0], approvedRawAccess: 'yes' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() => parseDwaionIncidents(incidentSnapshot)).not.toThrow();
    expect(() =>
      parseDwaionIncidents({
        ...incidentSnapshot,
        incidents: [{ ...incidentSnapshot.incidents[0], severity: 'SEV0' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionIncidents({
        ...incidentSnapshot,
        incidents: [
          {
            ...incidentSnapshot.incidents[0],
            timeline: [
              incidentSnapshot.incidents[0].timeline[0],
              incidentSnapshot.incidents[0].timeline[0],
            ],
          },
        ],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it('rejects invalid outcome ranges and inconsistent governed command evidence', () => {
    const outcome = {
      generatedAt: '2026-09-17T00:00:00Z',
      capability,
      periodDays: 30,
      privacyThreshold: 10,
      suppressedCohortCount: 0,
      metrics: [
        {
          metricKey: 'completion',
          label: 'Completion',
          value: 91,
          unit: 'PERCENT',
          denominator: 100,
          previousValue: 89,
          freshnessAt: '2026-09-17T00:00:00Z',
        },
      ],
      cohorts: [
        {
          cohortKey: 'operations',
          label: 'Operations',
          completedWorkCount: 42,
          completionRate: 91,
          reworkRate: 4,
          rollbackRate: 1,
          costPerCompletedWork: 120,
        },
      ],
      backlog: [
        {
          itemId: 'item-1',
          title: 'Reduce rework',
          ownerTeam: 'Operations',
          priority: 'P1',
          metricEvidence: 'completion',
          problemCluster: 'Repeated correction requests',
          state: 'APPROVED',
          version: 1,
        },
      ],
      tokenBudgets: [
        {
          scope: 'tenant',
          consumedTokens: 900,
          budgetTokens: 1_000,
          projectedTokens: 950,
          spikeDetected: false,
          policyMode: 'WARN',
          enforcementActivationState: 'DISABLED',
          version: 1,
        },
      ],
      currency: 'KRW',
    };

    expect(() => parseDwaionOutcomes(outcome)).not.toThrow();
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        tokenBudgets: [{ ...outcome.tokenBudgets[0], budgetTokens: null }],
      })
    ).not.toThrow();
    expect(() => parseDwaionOutcomes({ ...outcome, periodDays: 91 })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        cohorts: [{ ...outcome.cohorts[0], rollbackRate: -1 }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        tokenBudgets: [{ ...outcome.tokenBudgets[0], enforcementActivationState: 'UNKNOWN' }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        backlog: [{ ...outcome.backlog[0], problemCluster: undefined }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        tokenBudgets: [{ ...outcome.tokenBudgets[0], budgetTokens: 0 }],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionGovernedCommand({
        ...command,
        makerUserId: 'same-user',
        checkerUserId: 'same-user',
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() => parseDwaionGovernedCommand({ ...command, version: 0 })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        tokenBudgets: [
          {
            ...outcome.tokenBudgets[0],
            consumedTokens: 1_001,
            budgetTokens: 1_000,
            policyMode: 'BLOCK',
            enforcementActivationState: 'ENABLED',
          },
        ],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionOutcomes({
        ...outcome,
        tokenBudgets: [
          {
            ...outcome.tokenBudgets[0],
            consumedTokens: 1_001,
            budgetTokens: 1_000,
            policyMode: 'BLOCK',
            enforcementActivationState: 'DISABLED',
          },
        ],
      })
    ).not.toThrow();
    expect(() => parseDwaionGovernedCommand({ ...command, progressPercent: 101 })).toThrowError(
      expect.objectContaining({ status: 502 })
    );
    expect(() =>
      parseDwaionGovernedCommand({
        ...command,
        review: {
          ...command.review,
          preflight: { ...command.review.preflight, recoveryPlanHash: 'not-sha256' },
        },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionGovernedCommands({
        generatedAt: '2026-09-17T00:00:00Z',
        commands: [command, command],
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionGovernedCommands(
        {
          generatedAt: '2026-09-17T00:00:00Z',
          commands: [{ ...command, state: 'QUEUED' }],
        },
        'AWAITING_APPROVAL'
      )
    ).toThrowError(expect.objectContaining({ status: 502 }));
    expect(() =>
      parseDwaionGovernedCommand({
        ...command,
        state: 'REJECTED',
        decision: {
          decision: 'APPROVE',
          actorUserId: 'checker-1',
          reason: 'Incorrect decision for terminal state.',
          evidenceRefs: [],
          decidedAt: '2026-09-17T00:00:00Z',
        },
      })
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });
});
