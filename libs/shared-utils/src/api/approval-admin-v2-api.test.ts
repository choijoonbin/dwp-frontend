import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  APPROVAL_ADMIN_V2_READ_PATHS,
  getApprovalAdminV2AuditEventDetail,
  getApprovalAdminV2IncidentDetail,
  getApprovalAdminV2Workspace,
} from './approval-admin-v2-api';
import { ApprovalAdminV2ContractError } from './approval-admin-v2-contract-core';
import {
  APPROVAL_ADMIN_V2_ENDPOINTS,
  APPROVAL_ADMIN_V2_UNSUPPORTED_CONTROLS,
} from './approval-admin-v2-endpoints';
import { parseLiveAnalyticsDashboard } from './approval-admin-v2-live-insights-contract';
import { APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX } from './approval-admin-v2-command-api';

const gatewayOpenApi = JSON.parse(
  readFileSync(resolve(process.cwd(), 'libs/api-contracts/openapi/gateway-public.json'), 'utf8')
) as { paths: Record<string, Record<string, unknown>> };

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function generatedOperationsMatrix(): string[] {
  return Object.entries(gatewayOpenApi.paths)
    .filter(([path]) =>
      /^\/api\/approvals\/v1\/admin\/operations\/(audit-records|analytics|deployments)(?:\/|$)/u.test(
        path
      )
    )
    .flatMap(([path, operations]) =>
      Object.keys(operations)
        .filter((method) => HTTP_METHODS.has(method))
        .map((method) => `${method.toUpperCase()} ${path}`)
    )
    .sort();
}

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function analyticsDashboard() {
  return {
    generatedAt: '2026-09-16T01:00:00Z',
    query: {
      from: '2026-08-16T01:00:00Z',
      to: '2026-09-16T01:00:00Z',
      cohortDimension: 'WORKFLOW',
      minimumCohortSize: 5,
    },
    definitions: [],
    coverage: {
      candidateRequests: 0,
      includedRequests: 0,
      includedPercent: 0,
      excludedData: {},
      sourceThrough: '2026-09-16T00:59:00Z',
      projectedAt: '2026-09-16T01:00:00Z',
    },
    overall: { suppressed: false, sampleBand: '0' },
    cohorts: [],
    stageWaits: [],
  };
}

const incidentB = '66666666-6666-4666-8666-666666666671';
const incidentA = '66666666-6666-4666-8666-666666666661';
const planB = '66666666-6666-4666-8666-666666666672';
const eventB = '77777777-7777-4777-8777-777777777781';
const eventA = '77777777-7777-4777-8777-777777777771';
const requestB = '77777777-7777-4777-8777-777777777782';

function incidentDetail(incidentId = incidentB, planIncidentId = incidentId) {
  return {
    incident: {
      incidentId,
      incidentKey: 'approval-provider-lag',
      title: 'Approval provider lag',
      severity: 'HIGH',
      status: 'OPEN',
      sourceKind: 'DELIVERY',
      sourceReference: 'provider:secondary',
      version: 8,
      openedAt: '2026-09-16T02:00:00Z',
      updatedAt: '2026-09-16T03:00:00Z',
    },
    timeline: [
      {
        sequence: 1,
        eventType: 'INCIDENT_OPENED',
        summary: 'Secondary provider lag exceeded its threshold.',
        occurredAt: '2026-09-16T02:00:00Z',
        statusAfter: 'OPEN',
      },
    ],
    recoveryPlans: [
      {
        incidentId: planIncidentId,
        planId: planB,
        state: 'DRY_RUN_PASSED',
        version: 9,
        completedAt: null,
        dryRunEvidenceSha256: 'a'.repeat(64),
        targetSha256: 'b'.repeat(64),
        targetSnapshot: { provider: 'secondary' },
        stages: [
          {
            stageNumber: 1,
            actionKind: 'REPROCESS',
            targetType: 'DELIVERY_QUEUE',
            targetId: '66666666-6666-4666-8666-666666666673',
            state: 'PENDING',
            evidenceSha256: 'a'.repeat(64),
            version: 3,
          },
        ],
      },
    ],
  };
}

function auditEvent(eventId = eventB) {
  return {
    eventId,
    requestId: requestB,
    requestNumber: 'APR-2026-00018',
    eventType: 'REQUEST_REJECTED',
    outcome: 'SUCCESS',
    occurredAt: '2026-09-16T03:00:00Z',
    message: 'The selected request decision was recorded.',
    actor: { type: 'USER', identifier: 'reviewer.two', pseudonymized: false },
    evidence: { source: 'approval-service', revision: '18' },
    retention: {
      retainUntil: '2033-09-16T03:00:00Z',
      legalHoldActive: false,
      legalHoldPending: false,
      status: 'RETAINED',
    },
  };
}

function retentionLinkage() {
  return {
    requestId: requestB,
    legalHoldAuthority: 'Approval retention owner service',
    canonicalLegalHoldPath: '/api/approvals/v1/admin/retention/records',
    evaluatedAt: '2026-09-16T03:00:00Z',
    retention: {
      retainUntil: '2033-09-16T03:00:00Z',
      legalHoldActive: false,
      legalHoldPending: false,
      status: 'RETAINED',
    },
  };
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Approval admin V2 API', () => {
  it('keeps the APR-23/24 adapter exactly equal to generated OpenAPI and draft adapters present', () => {
    expect(
      APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX.map(([method, path]) => `${method} ${path}`).sort()
    ).toEqual(generatedOperationsMatrix());

    const governedRoutes = [
      ['GET', '/api/approvals/v1/admin/forms/templates/{templateId}'],
      ['GET', '/api/approvals/v1/admin/forms/templates/{templateId}/comparison'],
      ['POST', '/api/approvals/v1/admin/forms/templates/versions/{templateVersionId}/install'],
      ['GET', '/api/approvals/v1/admin/forms/studio-v3/{formId}'],
      ['PUT', '/api/approvals/v1/admin/forms/studio-v3/{formId}/draft'],
      ['GET', '/api/approvals/v1/admin/workflows/routing-directory/groups/{groupId}'],
      ['PUT', '/api/approvals/v1/admin/workflows/routing-directory/groups/{groupId}'],
      ['POST', '/api/approvals/v1/admin/workflows/routing-directory/groups/{groupId}/publish'],
    ] as const;
    for (const [method, path] of [
      ...APPROVAL_ADMIN_V2_OPERATIONS_ROUTE_MATRIX,
      ...governedRoutes,
    ]) {
      expect(gatewayOpenApi.paths[path]?.[method.toLowerCase()], `${method} ${path}`).toBeDefined();
    }
  });

  it('binds every workspace read to concrete controller endpoints, never aggregate roots', () => {
    expect(APPROVAL_ADMIN_V2_READ_PATHS).toEqual({
      templates: ['/api/approvals/v1/admin/forms/templates'],
      formStudio: ['/api/approvals/v1/admin/forms/studio-v3'],
      routing: [
        '/api/approvals/v1/admin/workflows/routing-directory/groups',
        '/api/approvals/v1/admin/workflows/routing-directory/resolvers',
      ],
      policies: [
        '/api/approvals/v1/admin/policies/automation/calendars',
        '/api/approvals/v1/admin/policies/automation/channels',
        '/api/approvals/v1/admin/policies/automation/rules',
        '/api/approvals/v1/admin/policies/automation/delegations',
      ],
      connectors: ['/api/approvals/v1/admin/operations/connectors'],
      incidents: ['/api/approvals/v1/admin/operations/incidents'],
      audit: [
        '/api/approvals/v1/admin/operations/audit-records/events',
        '/api/approvals/v1/admin/operations/audit-records/saved-views',
      ],
      analytics: [
        '/api/approvals/v1/admin/operations/analytics/metric-definitions',
        '/api/approvals/v1/admin/operations/analytics/dashboard',
      ],
      deployments: [
        '/api/approvals/v1/admin/operations/deployments/dashboard',
        '/api/approvals/v1/admin/operations/deployments/packages',
        '/api/approvals/v1/admin/operations/deployments/promotions',
      ],
    });
  });

  it('matches the finalized connector, incident, and deployment nested command paths', () => {
    expect(APPROVAL_ADMIN_V2_ENDPOINTS.connectors.probes('connector-1')).toBe(
      '/api/approvals/v1/admin/operations/connectors/connector-1/probes'
    );
    expect(APPROVAL_ADMIN_V2_ENDPOINTS.connectors.completeProbe('connector-1', 'probe-1')).toBe(
      '/api/approvals/v1/admin/operations/connectors/connector-1/probes/probe-1/complete'
    );
    expect(APPROVAL_ADMIN_V2_ENDPOINTS.incidents.dryRun('incident-1', 'plan-1')).toBe(
      '/api/approvals/v1/admin/operations/incidents/incident-1/recovery-plans/plan-1/dry-run'
    );
    expect(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.approval('promotion-1')).toBe(
      '/api/approvals/v1/admin/operations/deployments/promotions/promotion-1/approval'
    );
    expect(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.activationEvidence('promotion-1')).toBe(
      '/api/approvals/v1/admin/operations/deployments/promotions/promotion-1/activation-evidence'
    );
    expect(APPROVAL_ADMIN_V2_ENDPOINTS.deployments.rollbackEvidence('promotion-1')).toBe(
      '/api/approvals/v1/admin/operations/deployments/promotions/promotion-1/rollback-evidence'
    );
    expect(APPROVAL_ADMIN_V2_UNSUPPORTED_CONTROLS).toContain('deployments.pauseCanary');
    expect(APPROVAL_ADMIN_V2_UNSUPPORTED_CONTROLS).not.toContain('deployments.activation');
  });

  it('composes analytics from definitions and dashboard with the selected scope', async () => {
    const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
      const url = new URL(String(input), 'http://test.invalid');
      if (url.pathname.endsWith('/metric-definitions')) return response([]);
      if (url.pathname.endsWith('/dashboard')) return response(analyticsDashboard());
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);

    await expect(
      getApprovalAdminV2Workspace('analytics', 'opaque-management-scope')
    ).resolves.toMatchObject({ meta: { generatedAt: '2026-09-16T01:00:00Z' } });

    const urls = fetch.mock.calls.map(([input]) => new URL(String(input), 'http://test.invalid'));
    expect(urls.map((url) => url.pathname).sort()).toEqual([
      '/api/approvals/v1/admin/operations/analytics/dashboard',
      '/api/approvals/v1/admin/operations/analytics/metric-definitions',
    ]);
    const dashboard = urls.find((url) => url.pathname.endsWith('/dashboard'));
    expect(dashboard?.searchParams.get('cohortDimension')).toBe('WORKFLOW');
    expect(dashboard?.searchParams.get('minimumCohortSize')).toBe('5');
    expect(dashboard?.searchParams.get('from')).toBeTruthy();
    expect(dashboard?.searchParams.get('to')).toBeTruthy();
    expect(
      urls.every((url) => url.searchParams.get('contextScopeKey') === 'opaque-management-scope')
    ).toBe(true);
  });

  it('uses only the finalized audit read endpoints when the event page is empty', async () => {
    const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
      const url = new URL(String(input), 'http://test.invalid');
      if (url.pathname.endsWith('/events')) {
        return response({
          generatedAt: '2026-09-16T01:00:00Z',
          accessLevel: 'METADATA',
          events: [],
          nextCursor: null,
        });
      }
      if (url.pathname.endsWith('/saved-views')) return response([]);
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalAdminV2Workspace('audit')).resolves.toMatchObject({ events: [] });
    expect(
      fetch.mock.calls
        .map(([input]) => new URL(String(input), 'http://test.invalid').pathname)
        .sort()
    ).toEqual([
      '/api/approvals/v1/admin/operations/audit-records/events',
      '/api/approvals/v1/admin/operations/audit-records/saved-views',
    ]);
  });

  it('uses dashboard, packages, and promotions without a nonexistent deployment aggregate', async () => {
    const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
      const url = new URL(String(input), 'http://test.invalid');
      if (url.pathname.endsWith('/dashboard')) {
        return response({
          generatedAt: '2026-09-16T01:00:00Z',
          environmentHeads: [],
          recentPromotions: [],
        });
      }
      if (url.pathname.endsWith('/packages') || url.pathname.endsWith('/promotions')) {
        return response([]);
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalAdminV2Workspace('deployments')).resolves.toMatchObject({
      packages: [],
      promotionPlan: null,
    });
    expect(
      fetch.mock.calls
        .map(([input]) => new URL(String(input), 'http://test.invalid').pathname)
        .sort()
    ).toEqual([
      '/api/approvals/v1/admin/operations/deployments/dashboard',
      '/api/approvals/v1/admin/operations/deployments/packages',
      '/api/approvals/v1/admin/operations/deployments/promotions',
    ]);
  });

  it('loads only the selected incident detail and binds every recovery plan to that incident', async () => {
    const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
      const url = new URL(String(input), 'http://test.invalid');
      expect(url.pathname).toBe(`/api/approvals/v1/admin/operations/incidents/${incidentB}`);
      return response(incidentDetail());
    });
    vi.stubGlobal('fetch', fetch);

    await expect(
      getApprovalAdminV2IncidentDetail(incidentB, 'opaque-management-scope')
    ).resolves.toMatchObject({
      incidents: [{ id: incidentB }],
      recoveryPlan: { incidentId: incidentB, planId: planB },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      new URL(String(fetch.mock.calls[0]![0]), 'http://test.invalid').searchParams.get(
        'contextScopeKey'
      )
    ).toBe('opaque-management-scope');
  });

  it('rejects a selected incident detail or recovery plan bound to another incident', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(incidentDetail(incidentA)))
    );
    await expect(getApprovalAdminV2IncidentDetail(incidentB)).rejects.toThrow(
      ApprovalAdminV2ContractError
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(incidentDetail(incidentB, incidentA)))
    );
    await expect(getApprovalAdminV2IncidentDetail(incidentB)).rejects.toThrow(
      ApprovalAdminV2ContractError
    );
  });

  it('loads evidence and retention only for the selected audit event', async () => {
    const fetch = vi.fn(async (input: Parameters<typeof globalThis.fetch>[0]) => {
      const url = new URL(String(input), 'http://test.invalid');
      if (url.pathname.endsWith(`/events/${eventB}`)) return response(auditEvent());
      if (url.pathname.endsWith(`/requests/${requestB}/retention-linkage`)) {
        return response(retentionLinkage());
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetch);

    await expect(
      getApprovalAdminV2AuditEventDetail(eventB, 'opaque-management-scope')
    ).resolves.toMatchObject({
      events: [{ id: eventB }],
      evidenceBundle: { eventId: eventB, requestId: requestB, bundleId: eventB },
      retentionRecords: [{ id: eventB }],
    });
    expect(
      fetch.mock.calls.map(([input]) => new URL(String(input), 'http://test.invalid').pathname)
    ).toEqual([
      `/api/approvals/v1/admin/operations/audit-records/events/${eventB}`,
      `/api/approvals/v1/admin/operations/audit-records/requests/${requestB}/retention-linkage`,
    ]);
  });

  it('rejects an audit detail response for a different selected event before retention lookup', async () => {
    const fetch = vi.fn(async () => response(auditEvent(eventA)));
    vi.stubGlobal('fetch', fetch);

    await expect(getApprovalAdminV2AuditEventDetail(eventB)).rejects.toThrow(
      ApprovalAdminV2ContractError
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed and control-character server content', () => {
    expect(() =>
      parseLiveAnalyticsDashboard({ ...analyticsDashboard(), generatedAt: 'bad\u0000instant' }, [])
    ).toThrow(ApprovalAdminV2ContractError);
  });
});
