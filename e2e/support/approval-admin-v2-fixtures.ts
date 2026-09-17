import { type Page, type Route } from '@playwright/test';

import {
  canonicalData,
  DECISION_REVISION,
  evaluatedManagementContext,
  GOVERNED_MUTATION_ROUTE_KEYS,
  HIGH_RISK_ROUTE_KEYS,
  IDS,
  LATER,
  MANAGEMENT_CONTEXT,
  MANAGEMENT_SCOPE,
  type FixtureState,
} from './approval-admin-v2-fixture-data';
import { mockShellSession } from './shell-session';

export {
  DECISION_REVISION,
  IDS,
  MANAGEMENT_CONTEXT,
  MANAGEMENT_SCOPE,
  type CommandRecord,
  type FixtureState,
} from './approval-admin-v2-fixture-data';

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
