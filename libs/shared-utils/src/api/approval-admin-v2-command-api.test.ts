import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX,
  approvalAuditExternalAttestationCommand,
  approvalAuditExportCommand,
  approvalAuditSavedViewCreateCommand,
  approvalAutomationPolicyPublishCommand,
  approvalConnectorProbeCommand,
  approvalDeploymentActivationCommand,
  approvalDeploymentActivationEvidenceCommand,
  approvalDeploymentPackageCreateCommand,
  approvalDeploymentPromotionCreateCommand,
  approvalDeploymentReviewCommand,
  approvalDeploymentRollbackEvidenceCommand,
  approvalIncidentDiagnosticCommand,
  approvalIncidentPlanCreateCommand,
  approvalIncidentPlanDryRunCommand,
  approvalIncidentPlanReconcileCommand,
  approvalIncidentPostmortemCommand,
  approvalIncidentStageCompleteCommand,
  approvalPolicyPublishCommand,
  approvalPolicyUpdateCommand,
  approvalRoutingPublishCommand,
  approvalRoutingRetireCommand,
  executeApprovalAdminV2HighRiskCommand,
} from './approval-admin-v2-command-api';

const groupId = '11111111-1111-4111-8111-111111111111';
const connectorId = '22222222-2222-4222-8222-222222222222';
const probeId = '33333333-3333-4333-8333-333333333333';
const revisionId = '44444444-4444-4444-8444-444444444444';
const exportId = '55555555-5555-4555-8555-555555555555';
const requestId = '66666666-6666-4666-8666-666666666666';
const promotionId = '77777777-7777-4777-8777-777777777777';
const policyId = '99999999-9999-4999-8999-999999999999';
const incidentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const planId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const diagnosticId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const postmortemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const savedViewId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const packageId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const assetId = '12121212-1212-4212-8212-121212121212';
const evidenceId = '13131313-1313-4313-8313-131313131313';
const decisionRevision = `psr-${'a'.repeat(64)}`;

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function secure(expectedVersion: number) {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: decisionRevision,
    contextKey: 'approval-admin',
    contextScopeKey: 'opaque-approval-management-scope',
    objectVersion: expectedVersion,
    idempotencyKey: 'approval-admin-v2-command',
    stepUp: {
      challenge: 'signed-command-bound-proof',
      challengeId: '88888888-8888-4888-8888-888888888888',
      decisionRevision,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  } as const;
}

function transport(result: unknown) {
  const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes('/csrf')
      ? response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
      : response(result);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function mutationCall(fetch: ReturnType<typeof transport>, method: 'POST' | 'PUT' = 'POST') {
  const call = fetch.mock.calls.find(([, init]) => init?.method === method);
  if (!call) throw new Error('Expected a command request.');
  return call as [string | URL | Request, RequestInit];
}

function commandCall(fetch: ReturnType<typeof transport>) {
  return mutationCall(fetch);
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Approval administration V2 commands', () => {
  it('matches the finalized APR-23/24 27-route operations matrix', () => {
    expect(APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX).toHaveLength(27);
    expect(APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX).toContainEqual([
      'GET',
      '/api/approvals/v1/admin/operations/audit-records/events',
    ]);
    expect(APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX).toContainEqual([
      'POST',
      '/api/approvals/v1/admin/operations/deployments/promotions/{promotionId}/activation-evidence',
    ]);
    expect(APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX).not.toContainEqual([
      'POST',
      '/api/approvals/v1/admin/operations/deployments/plans/validate',
    ]);
  });

  it('retires a routing group with exact path, body and all command-bound headers', async () => {
    const command = approvalRoutingRetireCommand(groupId, 7, 3);
    const fetch = transport({ groupId, version: 8 });
    const guard = vi.fn();

    await expect(
      executeApprovalAdminV2HighRiskCommand(command, secure(7), { beforeDispatch: guard })
    ).resolves.toEqual({ targetId: groupId, version: 8 });

    const [input, init] = commandCall(fetch);
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/workflows/routing-directory/groups/${groupId}/retire`
    );
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 7, acknowledgedImpact: 3 });
    const headers = new Headers(init.headers);
    expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(decisionRevision);
    expect(headers.get('X-DWP-Expected-Object-Version')).toBe('7');
    expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-command-bound-proof');
    expect(headers.get('Idempotency-Key')).toBe('approval-admin-v2-command');
    expect(guard.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('publishes a draft routing group through the exact high-risk route and body', async () => {
    const command = approvalRoutingPublishCommand(groupId, 7);
    const fetch = transport({ groupId, version: 8 });
    await executeApprovalAdminV2HighRiskCommand(command, secure(7), {
      beforeDispatch: vi.fn(),
    });
    const [input, init] = commandCall(fetch);
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/workflows/routing-directory/groups/${groupId}/publish`
    );
    expect(JSON.parse(String(init.body))).toEqual({ expectedVersion: 7 });
    {
      const headers = new Headers(init.headers);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(decisionRevision);
      expect(headers.get('X-DWP-Expected-Object-Version')).toBe('7');
      expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-command-bound-proof');
      expect(headers.get('Idempotency-Key')).toBe('approval-admin-v2-command');
    }
  });

  it('starts a connector probe at the controller nested route with immutable request material', async () => {
    const command = approvalConnectorProbeCommand({
      connectorId,
      expectedVersion: 4,
      probeId,
      revisionId,
      requestSha256: 'b'.repeat(64),
    });
    expect(command).toMatchObject({
      targetType: 'CONNECTOR',
      targetId: connectorId,
      responseTargetId: probeId,
      expectedObjectVersion: 4,
    });
    const fetch = transport({ probeId, version: 1 });

    await executeApprovalAdminV2HighRiskCommand(command, secure(4), {
      beforeDispatch: vi.fn(),
    });

    const [input, init] = commandCall(fetch);
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/operations/connectors/${connectorId}/probes`
    );
    expect(JSON.parse(String(init.body))).toEqual({
      probeId,
      revisionId,
      probeKind: 'READINESS',
      requestSha256: 'b'.repeat(64),
      expectedConnectorVersion: 4,
    });
  });

  it('binds policy edit and publish commands to exact server versions and review evidence', async () => {
    const update = approvalPolicyUpdateCommand({
      policyId,
      expectedVersion: 3,
      changeReason: 'Raise the governed approval threshold after independent review.',
      enforcementMode: 'BLOCK',
      lifecycleState: 'ACTIVE',
      severity: 'HIGH',
      rule: { threshold: 5_000_000, currency: 'KRW' },
    });
    const fetch = transport([{ policyId, version: 4, status: 'PENDING_REVIEW' }]);

    await expect(
      executeApprovalAdminV2HighRiskCommand(update, secure(3), { beforeDispatch: vi.fn() })
    ).resolves.toEqual({ targetId: policyId, version: 4, status: 'PENDING_REVIEW' });

    const [input, init] = mutationCall(fetch, 'PUT');
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/policies/${policyId}`
    );
    expect(JSON.parse(String(init.body))).toEqual({
      expectedVersion: 3,
      changeReason: 'Raise the governed approval threshold after independent review.',
      enforcementMode: 'BLOCK',
      lifecycleState: 'ACTIVE',
      severity: 'HIGH',
      rule: { threshold: 5_000_000, currency: 'KRW' },
    });

    expect(
      approvalPolicyPublishCommand({
        policyId,
        expectedVersion: 4,
        reviewComment: 'Independent checker approved the exact pending policy digest.',
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/policies/${policyId}/publish`,
      expectedObjectVersion: 4,
      response: 'POLICY_LIST',
    });
    expect(
      approvalAutomationPolicyPublishCommand({
        policyId,
        revisionId,
        expectedVersion: 4,
        reviewEvidenceSha256: 'c'.repeat(64),
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/policies/automation/rules/${policyId}/publish`,
      expectedObjectVersion: 4,
      response: 'POLICY_AUTOMATION',
    });
  });

  it('binds diagnostics and authored recovery plans without confusing parent and child versions', async () => {
    const diagnostic = approvalIncidentDiagnosticCommand({
      incidentId,
      expectedIncidentVersion: 9,
      diagnosticId,
      diagnosticKind: 'DLQ_SNAPSHOT',
      observedAt: '2026-09-16T01:00:00Z',
      payload: { depth: 17, oldestAgeSeconds: 240 },
      sourceRevision: 'dlq-revision-17',
    });
    transport({
      diagnosticId,
      diagnosticKind: 'DLQ_SNAPSHOT',
      observedAt: '2026-09-16T01:00:00Z',
    });
    await expect(
      executeApprovalAdminV2HighRiskCommand(diagnostic, secure(9), {
        beforeDispatch: vi.fn(),
      })
    ).resolves.toEqual({ targetId: diagnosticId });

    resetCsrfToken();
    vi.unstubAllGlobals();
    const plan = approvalIncidentPlanCreateCommand({
      incidentId,
      expectedIncidentVersion: 9,
      planId,
      planKind: 'MIXED',
      stages: [
        {
          stageNumber: 2,
          actionKind: 'VERIFY',
          targetType: 'POLICY',
          targetId: policyId,
          expectedTargetVersion: 4,
        },
        {
          stageNumber: 1,
          actionKind: 'REPLAY',
          targetType: 'OUTBOX_EVENT',
          targetId: requestId,
          expectedTargetVersion: 2,
        },
      ],
      targetSnapshot: { incidentVersion: 9, sourceRevision: 'incident-revision-9' },
    });
    const fetch = transport({ incidentId, planId, state: 'DRAFT', version: 1 });
    await expect(
      executeApprovalAdminV2HighRiskCommand(plan, secure(9), { beforeDispatch: vi.fn() })
    ).resolves.toEqual({ targetId: planId, version: 1, status: 'DRAFT' });
    const [, init] = commandCall(fetch);
    expect(
      JSON.parse(String(init.body)).stages.map(
        (stage: { stageNumber: number }) => stage.stageNumber
      )
    ).toEqual([1, 2]);
  });

  it('constructs the dry-run, completion, reconciliation, and postmortem recovery chain', () => {
    expect(
      approvalIncidentPlanDryRunCommand({
        incidentId,
        planId,
        expectedPlanVersion: 2,
        executable: true,
        evidenceSha256: 'd'.repeat(64),
        result: { eligible: true, stageCount: 2 },
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/incidents/${incidentId}/recovery-plans/${planId}/dry-run`,
      expectedObjectVersion: 2,
    });
    expect(
      approvalIncidentStageCompleteCommand({
        incidentId,
        planId,
        stageNumber: 1,
        expectedPlanVersion: 3,
        expectedStageVersion: 1,
        evidencePayloadBase64Url: 'signed_payload',
        evidenceSignatureBase64Url: 'signed_signature',
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/incidents/${incidentId}/recovery-plans/${planId}/stages/1/complete`,
      expectedObjectVersion: 3,
    });
    expect(
      approvalIncidentPlanReconcileCommand({ incidentId, planId, expectedPlanVersion: 4 })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/incidents/${incidentId}/recovery-plans/${planId}/reconcile`,
      expectedObjectVersion: 4,
    });
    expect(
      approvalIncidentPostmortemCommand({
        incidentId,
        expectedIncidentVersion: 10,
        postmortemId,
        summary: 'Recovery completed after replaying the fenced outbox sequence.',
        contributingFactors: ['Provider delivery was unavailable during the evidence window.'],
        correctiveActions: ['Add an alert for the bounded delivery backlog threshold.'],
        evidenceSha256: 'e'.repeat(64),
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/incidents/${incidentId}/postmortem`,
      responseTargetId: postmortemId,
    });
  });

  it('creates an audit export with version zero and an exact scoped filter', async () => {
    const command = approvalAuditExportCommand({
      exportId,
      requestId,
      from: '2026-08-16T01:00:00Z',
      to: '2026-09-16T01:00:00Z',
    });
    const fetch = transport({ exportId, status: 'COMPLETED', version: 1 });

    await executeApprovalAdminV2HighRiskCommand(command, secure(0), {
      beforeDispatch: vi.fn(),
    });

    const [input, init] = commandCall(fetch);
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      '/api/approvals/v1/admin/operations/audit-records/exports'
    );
    expect(JSON.parse(String(init.body))).toEqual({
      exportId,
      accessLevel: 'METADATA',
      filter: {
        from: '2026-08-16T01:00:00Z',
        to: '2026-09-16T01:00:00Z',
        eventTypes: [],
        outcomes: [],
        requestId,
        limit: 100,
      },
    });
    expect(new Headers(init.headers).get('X-DWP-Expected-Object-Version')).toBe('0');
  });

  it('creates bound audit views and external attestations without claiming local legal hold', async () => {
    const savedView = approvalAuditSavedViewCreateCommand({
      savedViewId,
      name: 'High risk policy decisions',
      visibility: 'SHARED',
      filter: {
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-16T00:00:00Z',
        eventTypes: ['POLICY_PUBLISHED'],
        outcomes: ['SUCCESS'],
        limit: 100,
      },
    });
    transport({ savedViewId, version: 1 });
    await expect(
      executeApprovalAdminV2HighRiskCommand(savedView, secure(0), {
        beforeDispatch: vi.fn(),
      })
    ).resolves.toEqual({ targetId: savedViewId, version: 1 });

    const attestation = approvalAuditExternalAttestationCommand({
      exportId,
      expectedExportVersion: 2,
      type: 'EXTERNAL_AUDITOR',
      reference: 'auditor://engagement/APR-23-2026-09',
      attestedAt: '2026-09-16T02:00:00Z',
      evidencePayloadBase64Url: 'external_payload',
      evidenceSignatureBase64Url: 'external_signature',
    });
    expect(attestation).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/audit-records/exports/${exportId}/external-attestations`,
      expectedObjectVersion: 2,
      response: 'AUDIT_EXPORT',
    });
  });

  it('creates immutable deployment packages, promotions, and signed external evidence', async () => {
    const packageCommand = approvalDeploymentPackageCreateCommand({
      packageId,
      packageKey: 'APR.FINANCE.PRODUCTION',
      packageVersion: 12,
      displayName: 'Finance approval production package',
      assets: [
        {
          assetId,
          assetKey: 'form:finance-expense',
          assetType: 'FORM',
          assetVersion: '12',
          contentSha256: 'f'.repeat(64),
          rollbackDisposition: 'REVERSIBLE',
        },
      ],
      dependencies: [],
    });
    transport({ packageId, packageVersion: 12, manifestSha256: 'a'.repeat(64) });
    await expect(
      executeApprovalAdminV2HighRiskCommand(packageCommand, secure(0), {
        beforeDispatch: vi.fn(),
      })
    ).resolves.toEqual({ targetId: packageId, version: 12 });

    expect(
      approvalDeploymentPromotionCreateCommand({
        promotionId,
        packageId,
        sourceEnvironment: 'TEST',
        targetEnvironment: 'PRODUCTION',
      })
    ).toMatchObject({
      commandPath: '/api/approvals/v1/admin/operations/deployments/promotions',
      response: 'DEPLOYMENT_PROMOTION',
    });

    const evidence = {
      evidenceId,
      evidenceType: 'CANARY_HEALTH',
      externalReference: 'observability://approval/canary/17',
      outcome: 'HEALTHY' as const,
      payloadSha256: '1'.repeat(64),
      sourceGeneratedAt: '2026-09-16T03:00:00Z',
      evidencePayloadBase64Url: 'canary_payload',
      evidenceSignatureBase64Url: 's'.repeat(86),
    };
    expect(
      approvalDeploymentActivationEvidenceCommand({
        promotionId,
        expectedVersion: 8,
        evidence,
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/deployments/promotions/${promotionId}/activation-evidence`,
      expectedObjectVersion: 8,
    });
    expect(
      approvalDeploymentRollbackEvidenceCommand({
        promotionId,
        expectedVersion: 9,
        evidence: { ...evidence, outcome: 'DEGRADED' },
      })
    ).toMatchObject({
      commandPath: `/api/approvals/v1/admin/operations/deployments/promotions/${promotionId}/rollback-evidence`,
      expectedObjectVersion: 9,
    });
  });

  it('uses distinct HTTP and proof payloads for deployment review and activation', async () => {
    const review = approvalDeploymentReviewCommand(
      promotionId,
      7,
      'Reviewed against the current immutable package evidence.'
    );
    expect(review.proofPayload).toBe('Reviewed against the current immutable package evidence.');
    expect(review.requestBody).toEqual({
      reviewComment: 'Reviewed against the current immutable package evidence.',
    });

    const activation = approvalDeploymentActivationCommand(promotionId, 7);
    const fetch = transport({ promotionId, status: 'ACTIVATING', version: 8 });
    await executeApprovalAdminV2HighRiskCommand(activation, secure(7), {
      beforeDispatch: vi.fn(),
    });
    const [input, init] = commandCall(fetch);
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/operations/deployments/promotions/${promotionId}/activation`
    );
    expect(init.body).toBeUndefined();
    expect(activation.proofPayload).toEqual({ operation: 'BEGIN_ACTIVATION' });
  });

  it('fails closed before transport for malformed input or stale execution versions', async () => {
    expect(() => approvalRoutingRetireCommand('not-a-uuid', 7, 0)).toThrow(
      'Invalid Approval administration V2 command contract.'
    );
    expect(() => approvalDeploymentReviewCommand(promotionId, 7, 'short')).toThrow(
      'Invalid Approval administration V2 command contract.'
    );

    const fetch = transport({ groupId, version: 8 });
    await expect(
      executeApprovalAdminV2HighRiskCommand(
        approvalRoutingRetireCommand(groupId, 7, 0),
        secure(6),
        { beforeDispatch: vi.fn() }
      )
    ).rejects.toThrow('Invalid Approval administration V2 command contract.');
    expect(fetch).not.toHaveBeenCalled();
  });
});
