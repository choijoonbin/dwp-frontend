import type { Page, Request, Route } from '@playwright/test';

export type ApprovalHighRiskNetworkObservation = Readonly<{
  issuerRequests: Array<
    Readonly<{ body: Record<string, unknown>; headers: Record<string, string> }>
  >;
  commandRequests: Array<Readonly<{ body: unknown; headers: Record<string, string>; url: string }>>;
}>;

export type ApprovalHighRiskCommandOutcome =
  | Readonly<{ type: 'SUCCESS' }>
  | Readonly<{ type: 'ABORT' }>
  | Readonly<{ type: 'ERROR'; status: number; errorCode?: string }>;

const FLOW_REF = '8f879f98-2476-4c33-a228-2984567ab889';
const DECISION_REVISION = 'e2e-approval-authority-1';

function requestRecord(request: Request) {
  return {
    body: (request.postDataJSON() ?? null) as unknown,
    headers: request.headers(),
    url: request.url(),
  };
}

function success(route: Route, data: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers,
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

export async function mockApprovalHighRiskNetwork(
  page: Page,
  {
    commandPath,
    commandResult,
    issuerContinuation = true,
    commandOutcomes = [{ type: 'SUCCESS' }],
    issuedExpiresAt = ['2026-08-25T00:00:00Z'],
    oidcAuthorizationPath = '/auth/oidc/callback?code=e2e-code&state=e2e-state',
    continuationExpiresAt = '2026-08-25T00:00:00Z',
    providerSelectionKeys,
  }: {
    commandPath: string;
    commandResult: unknown;
    issuerContinuation?: boolean;
    commandOutcomes?: readonly ApprovalHighRiskCommandOutcome[];
    issuedExpiresAt?: readonly string[];
    oidcAuthorizationPath?: string;
    continuationExpiresAt?: string;
    providerSelectionKeys?: readonly string[];
  }
): Promise<ApprovalHighRiskNetworkObservation> {
  const issuerRequests: Array<{
    body: Record<string, unknown>;
    headers: Record<string, string>;
  }> = [];
  const commandRequests: Array<{ body: unknown; headers: Record<string, string>; url: string }> =
    [];
  const baseUrl = (process.env.E2E_BASE_URL || 'http://localhost:4200').replace(/\/$/u, '');

  await page.route('**/api/auth/product-surface-step-up-challenges', (route) => {
    const recorded = requestRecord(route.request());
    issuerRequests.push({
      body: recorded.body as Record<string, unknown>,
      headers: recorded.headers,
    });
    if (providerSelectionKeys && issuerRequests.length === 1) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: 'Provider selection required',
          errorCode: 'STEP_UP_REQUIRED',
          data: {
            state: 'CONTINUATION_REQUIRED',
            continuation: {
              type: 'OIDC_PROVIDER_SELECTION',
              authorizationUrl: null,
              expiresAt: null,
              providerKeys: providerSelectionKeys,
            },
          },
        }),
      });
    }
    if (issuerContinuation && issuerRequests.length === 1) {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ERROR',
          message: 'Step-up required',
          errorCode: 'STEP_UP_REQUIRED',
          data: {
            state: 'CONTINUATION_REQUIRED',
            continuation: {
              type: 'OIDC',
              authorizationUrl: `${baseUrl}${oidcAuthorizationPath}`,
              expiresAt: continuationExpiresAt,
              flowRef: FLOW_REF,
            },
          },
        }),
      });
    }
    return success(route, {
      state: 'ISSUED',
      challenge: issuerContinuation
        ? 'e2e-signed-step-up-challenge'
        : `e2e-signed-step-up-challenge-${issuerRequests.length}`,
      challengeId: `e2e-challenge-jti-${issuerRequests.length}`,
      decisionRevision: DECISION_REVISION,
      expiresAt:
        issuedExpiresAt[Math.min(issuerRequests.length - 1, issuedExpiresAt.length - 1)] ??
        '2026-08-25T00:00:00Z',
    });
  });

  await page.route(
    (url) => url.pathname === commandPath,
    (route) => {
      commandRequests.push(requestRecord(route.request()));
      const outcome = commandOutcomes[commandRequests.length - 1] ?? { type: 'SUCCESS' };
      if (outcome.type === 'ABORT') return route.abort('connectionreset');
      if (outcome.type === 'ERROR') {
        return route.fulfill({
          status: outcome.status,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'ERROR',
            message: outcome.errorCode ?? 'Command rejected',
            ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
          }),
        });
      }
      return success(route, commandResult);
    }
  );

  const context = page.context();
  await context.route('**/api/auth/oidc/callback?*', (route) =>
    success(
      route,
      { userId: '1', tenantId: '1' },
      {
        'X-DWP-Step-Up-Flow-ID': FLOW_REF,
        'X-DWP-Step-Up-Return-To': '/approvals/admin/overview',
      }
    )
  );
  await context.route('**/api/auth/me', (route) =>
    success(route, {
      userId: 1,
      personPublicId: 'person-session-user',
      displayName: 'Approval administrator',
      tenantId: 1,
      tenantCode: 'default',
      tenantName: 'SKAX',
      preferredLocale: 'ko',
      tenantDefaultLocale: 'ko',
      roles: ['WORKSPACE_MEMBER'],
      groups: [],
      resourceRoles: [],
    })
  );
  await context.route('**/api/auth/permissions', (route) => success(route, []));
  await context.route('**/api/platform/v1/tenant-branding', (route) =>
    success(route, {
      organizationName: 'SKAX',
      accentColor: '#2457D6',
      logoUrl: null,
      version: 1,
      updatedAt: '2026-08-24T00:00:00Z',
    })
  );
  await context.route('**/api/platform/v1/personal-preferences', (route) =>
    success(route, {
      schemaVersion: 2,
      customized: false,
      preferences: {
        appearance: { mode: 'system', density: 'standard' },
        accessibility: {
          highContrast: false,
          reduceMotion: true,
          underlineLinks: false,
          reduceTransparency: false,
        },
        regional: {
          timeZone: 'Asia/Seoul',
          dateFormat: 'LOCALE',
          timeFormat: '24_HOUR',
          firstDayOfWeek: 'MONDAY',
          numberFormat: 'LOCALE',
        },
      },
      managedPolicy: { rules: [] },
      version: 1,
      updatedAt: '2026-08-24T00:00:00Z',
    })
  );
  await context.route('**/api/auth/product-surface-contexts', (route) =>
    success(route, {
      contractVersion: 'product-surfaces/v2',
      decisionRevision: DECISION_REVISION,
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-08-24T00:00:00Z',
      contexts: [],
      rollouts: ['approvals', 'communications', 'services'].map((productKey) => ({
        productKey,
        state: '000',
        flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
        cohort: 'popup-callback',
        opaqueRevision: `popup-${productKey}`,
        surfaceUiEvaluation: 'RESOLVED',
      })),
    })
  );

  return { issuerRequests, commandRequests };
}
