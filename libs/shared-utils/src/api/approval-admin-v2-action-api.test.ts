import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  compareApprovalTemplateVersion,
  getApprovalAuditExportReceipt,
  getApprovalAuditExportInput,
  getApprovalConnectorProbeInput,
  getApprovalDeploymentPackageDiff,
  getApprovalDeploymentRollbackFeasibility,
  getApprovalFormStudioDraftInput,
  getApprovalIncidentRecoveryPlan,
  getApprovalIncidentStageInput,
  getApprovalPolicyImpactEvidence,
  getApprovalPolicyVersionHistory,
  getApprovalRoutingGroupDraftInput,
  getApprovalRoutingRetirementInput,
  getApprovalTemplateInstallInput,
  simulateApprovalBusinessDeadline,
  validateApprovalFormStudioV3,
} from './approval-admin-v2-action-api';

const groupId = '11111111-1111-4111-8111-111111111111';
const connectorId = '22222222-2222-4222-8222-222222222222';
const revisionId = '33333333-3333-4333-8333-333333333333';
const incidentId = '44444444-4444-4444-8444-444444444444';
const planId = '55555555-5555-4555-8555-555555555555';
const eventId = '66666666-6666-4666-8666-666666666666';
const requestId = '77777777-7777-4777-8777-777777777777';
const formId = '88888888-8888-4888-8888-888888888888';
const templateId = '99999999-9999-4999-8999-999999999999';
const templateVersionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const policyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const calendarId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const exportId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const promotionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const fromPackageId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const toPackageId = '12121212-1212-4212-8212-121212121212';

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function path(input: string | URL | Request) {
  return new URL(input instanceof Request ? input.url : String(input), 'http://test.invalid')
    .pathname;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Approval admin V2 canonical action reads', () => {
  it('binds template installation and comparison to canonical detail evidence', async () => {
    const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
      const url = new URL(String(input), 'http://test.invalid');
      if (url.pathname.endsWith('/comparison')) {
        return response({
          templateId,
          installedVersion: 3,
          availableVersion: 4,
          updateAvailable: true,
          compatible: true,
        });
      }
      return response({
        templateId,
        templateKey: 'ACCESS_REQUEST',
        version: 7,
        currentVersion: 4,
        ownerGroupRef: 'GROUP.SECURITY',
        categoryKey: 'SECURITY',
        defaultWorkflowKey: 'SECURITY_REVIEW',
        current: {
          templateVersionId,
          nameKo: '접근 요청',
          nameEn: 'Access request',
          descriptionKo: '설명',
          descriptionEn: 'Description',
        },
      });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalTemplateInstallInput(templateId, {})).resolves.toMatchObject({
      templateId,
      templateVersionId,
      currentVersion: 4,
      expectedTemplateVersion: 7,
      metadata: { formKey: 'ACCESS_REQUEST', ownerGroupRef: 'GROUP.SECURITY' },
    });
    await expect(compareApprovalTemplateVersion(templateId, 3, {})).resolves.toEqual({
      templateId,
      installedVersion: 3,
      availableVersion: 4,
      updateAvailable: true,
      compatible: true,
    });
    expect(String(fetch.mock.calls[1]![0])).toContain(
      `/api/approvals/v1/admin/forms/templates/${templateId}/comparison?installedVersion=3`
    );
  });

  it('parses exact Form V3 and routing drafts for version-fenced saves', async () => {
    const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
      const requestPath = path(input);
      if (requestPath.includes('/forms/studio-v3/')) {
        return response({
          formId,
          formKey: 'ACCESS_REQUEST',
          workspaceVersion: 6,
          nameKo: '접근 요청',
          nameEn: 'Access request',
          descriptionKo: '설명',
          descriptionEn: 'Description',
          ownerGroupRef: 'GROUP.SECURITY',
          categoryKey: 'SECURITY',
          defaultWorkflowKey: 'SECURITY_REVIEW',
          current: { schema: { schemaContract: 'DWP_FORM_SCHEMA_V3', pages: [] } },
        });
      }
      return response({
        groupId,
        groupKey: 'FINANCE_APPROVERS',
        displayName: 'Finance approvers',
        description: 'Regional group',
        lifecycle: 'DRAFT',
        effectiveFrom: null,
        effectiveTo: null,
        version: 5,
        members: [
          {
            memberId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            kind: 'SUBJECT',
            userId: 42,
            personPublicId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            nestedGroupId: null,
            resolverId: null,
            priority: 1,
            required: true,
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalFormStudioDraftInput(formId, {})).resolves.toMatchObject({
      formId,
      expectedWorkspaceVersion: 6,
      schema: { schemaContract: 'DWP_FORM_SCHEMA_V3', pages: [] },
    });
    await expect(getApprovalRoutingGroupDraftInput(groupId, {})).resolves.toMatchObject({
      groupId,
      expectedVersion: 5,
      lifecycle: 'DRAFT',
      members: [{ userId: 42, priority: 1, required: true }],
    });
  });

  it('joins an exact routing group and retirement impact version', async () => {
    const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
      const requestPath = path(input);
      return response(
        requestPath.endsWith('/retirement-impact')
          ? {
              groupId,
              groupVersion: 5,
              directUsageCount: 0,
              parentGroupCount: 0,
              totalImpactCount: 0,
            }
          : { groupId, version: 5 }
      );
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalRoutingRetirementInput(groupId, {})).resolves.toEqual({
      groupId,
      expectedVersion: 5,
      acknowledgedImpact: 0,
    });
    expect(fetch.mock.calls.map(([input]) => path(input))).toEqual(
      expect.arrayContaining([
        `/api/approvals/v1/admin/workflows/routing-directory/groups/${groupId}`,
        `/api/approvals/v1/admin/workflows/routing-directory/groups/${groupId}/retirement-impact`,
      ])
    );
  });

  it('uses the selected connector draft and definition digest as immutable probe material', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: FetchInput, _init?: FetchInit) =>
        response({
          connector: {
            connectorId,
            version: 4,
            draftRevisionId: revisionId,
            definitionSha256: 'a'.repeat(64),
          },
          probes: [],
        })
      )
    );

    await expect(getApprovalConnectorProbeInput(connectorId, {})).resolves.toEqual({
      connectorId,
      expectedVersion: 4,
      revisionId,
      requestSha256: 'a'.repeat(64),
    });
  });

  it('selects only the next pending stage from an executable incident plan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: FetchInput, _init?: FetchInit) =>
        response({
          incident: { incidentId },
          recoveryPlans: [
            {
              incidentId,
              planId,
              state: 'DRY_RUN_PASSED',
              version: 7,
              stages: [{ stageNumber: 1, state: 'PENDING', version: 2 }],
            },
          ],
        })
      )
    );

    await expect(getApprovalIncidentStageInput(incidentId, planId, {})).resolves.toEqual({
      incidentId,
      planId,
      stageNumber: 1,
      expectedPlanVersion: 7,
      expectedStageVersion: 2,
    });
  });

  it('reads an exact recovery plan for safe mobile review without dispatching a command', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          incidentId,
          planId,
          planKind: 'REPLAY',
          state: 'VALIDATED',
          version: 8,
          dryRunEvidenceSha256: 'a'.repeat(64),
          stages: [
            {
              stageNumber: 1,
              actionKind: 'REPLAY',
              targetType: 'OUTBOX_EVENT',
              targetId: eventId,
              state: 'PENDING',
              version: 2,
            },
          ],
        })
      )
    );

    await expect(getApprovalIncidentRecoveryPlan(incidentId, planId, {})).resolves.toMatchObject({
      incidentId,
      planId,
      state: 'VALIDATED',
      version: 8,
      stages: [{ stageNumber: 1, targetId: eventId, state: 'PENDING', version: 2 }],
    });
  });

  it('reads policy impact, projected version history, and authoritative deadline simulation', async () => {
    const fetch = vi.fn(async (input: FetchInput) => {
      const requestUrl = new URL(
        input instanceof Request ? input.url : String(input),
        'http://test.invalid'
      );
      if (requestUrl.pathname.endsWith('/impact')) {
        return response({
          policy: { policyId, rowVersion: 7 },
          status: 'REVIEW_REQUIRED',
          observedAt: '2026-09-16T03:00:00Z',
          sourceDigest: 'b'.repeat(64),
          semanticDiff: [{ kind: 'CHANGED', path: '/threshold', current: 10, proposed: 20 }],
        });
      }
      if (requestUrl.pathname.endsWith('/versions')) {
        return response([
          {
            policyVersionId: revisionId,
            versionNumber: 7,
            lifecycleState: 'ACTIVE',
            enforcementMode: 'BLOCK',
            severity: 'HIGH',
            submittedAt: '2026-09-15T03:00:00Z',
            publishedAt: '2026-09-16T03:00:00Z',
          },
        ]);
      }
      return response({
        start: '2026-09-16T00:00:00.000Z',
        businessMinutes: 480,
        dueAt: '2026-09-17T00:00:00Z',
      });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalPolicyImpactEvidence(policyId, 7, {})).resolves.toMatchObject({
      policyId,
      rowVersion: 7,
      status: 'REVIEW_REQUIRED',
      semanticDiff: [{ path: '/threshold', current: 10, proposed: 20 }],
    });
    await expect(getApprovalPolicyVersionHistory(policyId, {})).resolves.toEqual([
      {
        policyVersionId: revisionId,
        versionNumber: 7,
        lifecycleState: 'ACTIVE',
        enforcementMode: 'BLOCK',
        severity: 'HIGH',
        submittedAt: '2026-09-15T03:00:00Z',
        publishedAt: '2026-09-16T03:00:00Z',
        changeReason: null,
        reviewComment: null,
      },
    ]);
    await expect(
      simulateApprovalBusinessDeadline(calendarId, '2026-09-16T00:00:00Z', 480, {})
    ).resolves.toEqual({
      calendarId,
      start: '2026-09-16T00:00:00.000Z',
      businessMinutes: 480,
      dueAt: '2026-09-17T00:00:00Z',
    });
    expect(String(fetch.mock.calls[0]![0])).toContain('expectedVersion=7');
    expect(String(fetch.mock.calls[2]![0])).toContain('businessMinutes=480');
  });

  it('binds an audit export window to the selected canonical event request', async () => {
    const fetch = vi.fn(async (_input: FetchInput, _init?: FetchInit) =>
      response({ eventId, requestId, occurredAt: '2026-09-16T03:00:00Z' })
    );
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalAuditExportInput(eventId, requestId, {})).resolves.toEqual({
      eventId,
      requestId,
      from: '2026-09-16T02:59:00.000Z',
      to: '2026-09-16T03:01:00.000Z',
    });
    expect(String(fetch.mock.calls[0]![0])).toContain(
      `/api/approvals/v1/admin/operations/audit-records/events/${eventId}?accessLevel=METADATA`
    );
  });

  it('rejects an audit export preflight when the selected event request binding changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          eventId,
          requestId: '77777777-7777-4777-8777-777777777799',
          occurredAt: '2026-09-16T03:00:00Z',
        })
      )
    );

    await expect(getApprovalAuditExportInput(eventId, requestId, {})).rejects.toThrow(
      'auditEvent.requestId'
    );
  });

  it('reads exact audit receipts, deployment diffs, and rollback feasibility evidence', async () => {
    const fetch = vi.fn(async (input: FetchInput) => {
      const requestPath = path(input);
      if (requestPath.includes('/audit-records/exports/')) {
        return response({
          exportId,
          version: 3,
          status: 'COMPLETED',
          integrityStatus: 'VERIFIED',
          manifestSha256: 'c'.repeat(64),
          externalAttestationReference: null,
        });
      }
      if (requestPath.endsWith('/package-diff')) {
        return response({
          fromPackageId,
          toPackageId,
          rollbackDisposition: 'CONDITIONAL',
          introducesExternalSideEffects: true,
          addedAssets: ['form:expense-v2'],
          changedAssets: ['policy:expense-limit'],
          removedAssets: [],
          dependencyChanges: ['workflow:expense -> form:expense-v2'],
        });
      }
      return response({
        status: 'CONDITIONAL',
        activePackageId: toPackageId,
        previousPackageId: fromPackageId,
        externalSideEffectsStatus: 'REVERSAL_EVIDENCE_REQUIRED',
        externalSideEffectsUndone: false,
        conditions: ['Attach signed provider reversal evidence.'],
      });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalAuditExportReceipt(exportId, {})).resolves.toMatchObject({
      exportId,
      version: 3,
      status: 'COMPLETED',
      integrityStatus: 'VERIFIED',
    });
    await expect(
      getApprovalDeploymentPackageDiff(fromPackageId, toPackageId, {})
    ).resolves.toMatchObject({
      fromPackageId,
      toPackageId,
      rollbackDisposition: 'CONDITIONAL',
      introducesExternalSideEffects: true,
    });
    await expect(getApprovalDeploymentRollbackFeasibility(promotionId, {})).resolves.toMatchObject({
      promotionId,
      status: 'CONDITIONAL',
      activePackageId: toPackageId,
      previousPackageId: fromPackageId,
      externalSideEffectsUndone: false,
    });
  });

  it('posts the exact live Form V3 schema to the validation endpoint', async () => {
    const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
      const requestPath = path(input);
      if (requestPath.endsWith('/csrf')) {
        return response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' });
      }
      return response(
        requestPath.endsWith('/validate')
          ? { schemaSha256: 'b'.repeat(64) }
          : { current: { schema: { schemaVersion: 3, fields: [] } } }
      );
    });
    vi.stubGlobal('fetch', fetch);

    await expect(validateApprovalFormStudioV3(formId, {})).resolves.toBe('b'.repeat(64));
    const validationCall = fetch.mock.calls.find(([input]) => path(input).endsWith('/validate'));
    expect(JSON.parse(String(validationCall?.[1]?.body))).toEqual({
      schema: { schemaVersion: 3, fields: [] },
    });
  });
});
