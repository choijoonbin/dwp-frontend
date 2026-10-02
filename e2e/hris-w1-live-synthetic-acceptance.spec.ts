import { createHash } from 'node:crypto';
import { chmod, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import type * as PW from '@playwright/test';

import {
  HRIS_W1_HIGH_RISK_EVALUATION_PATH,
  loadHrisW1LiveEnvironment,
  type HrisW1RouteCase,
  type HrisW1Tenant,
} from './support/hris-w1-live-environment';
import { sanitizeHrisW1Har } from './support/hris-w1-live-artifact-sanitizer';

const runtime = loadHrisW1LiveEnvironment();
const baseOrigin = new URL(runtime.baseURL).origin;
const SAFE_READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ACCESS_STATE_SELECTOR = '[data-testid="product-surface-access-state"]';
const REQUIRED_HIGH_ASSURANCE = 'urn:dwp:assurance:high';
const baseURL = new URL(runtime.baseURL);

type JsonRecord = Record<string, unknown>;

type NetworkRecord = Readonly<{
  method: string;
  path: string;
  contextScopeKey: string | null;
  status?: number;
  bodyByteLength?: number;
  responseBodySha256?: string;
  payrollConfigurationIds?: readonly string[];
  fromServiceWorker?: boolean;
}>;

type EvaluationRequestObservation = Readonly<{
  routeContractKey: string | null;
  contextScopeKey: string | null;
  subjectType: string | null;
  subjectProductKey: string | null;
  subjectSurfaceKey: string | null;
  action: 'CONTINUED' | 'BLOCKED';
  reason: 'EXACT_PAGE_CONTRACT' | 'EXACT_HIGH_CONTRACT' | 'OTHER_AUTHORITY_EVALUATION';
}>;

type BlockedRequestObservation = Readonly<{
  method: string;
  path: string;
  reason: 'OWNER_MUTATION' | 'AUTHORITY_CONTRACT_MISMATCH';
}>;

type FirewallObservation = {
  interceptedHttpRequests: number;
  continuedHttpRequests: number;
  continuedMutations: Array<Readonly<{ method: string; path: string }>>;
  evaluationRequests: EvaluationRequestObservation[];
  blockedMutations: BlockedRequestObservation[];
  blockedExternalHttp: Array<Readonly<{ method: string; url: string }>>;
  blockedExternalWebSockets: string[];
};

type StepUpEvidence = Readonly<{
  status: 200;
  routeContractKey: string;
  operation: string;
  decision: 'STEP_UP_REQUIRED';
  reasonCode: 'STEP_UP_REQUIRED';
  requiredAssurance: typeof REQUIRED_HIGH_ASSURANCE;
  decisionRevision: string;
  requestPolicyRef?: string;
  validUntil?: string;
  revalidateAt: string;
  observedAt: string;
}>;

function exactKeys(value: JsonRecord | null, expected: readonly string[]): boolean {
  return value !== null && Object.keys(value).sort().join('\n') === [...expected].sort().join('\n');
}

function exactEvaluationShape(
  body: JsonRecord | null,
  subject: JsonRecord | null,
  contextScopeKey: string | null
): boolean {
  const bodyKeys =
    contextScopeKey === null
      ? ['routeContractKey', 'subject']
      : ['contextScopeKey', 'routeContractKey', 'subject'];
  return (
    exactKeys(body, bodyKeys) &&
    exactKeys(subject, ['productKey', 'surfaceKey', 'type']) &&
    body?.contextKey === undefined
  );
}

type RouteEvidence = Readonly<{
  id: string;
  module: HrisW1RouteCase['module'];
  requestedPath: string;
  finalPath: string;
  outcome: HrisW1RouteCase['outcome'];
  accessState?: string | null;
  screenshot: string;
  highRiskScreenshot?: string;
  highRiskEvaluation?: StepUpEvidence;
  network: readonly NetworkRecord[];
}>;

type TenantEvidence = Readonly<{
  label: HrisW1Tenant['label'];
  tenantId: string;
  loginStatus: number;
  verifiedSubjectId: string;
  crossTenantMe: Readonly<{
    requestedTenantId: string;
    status: 401 | 403;
    outcome: 'DENIED';
  }>;
  rolloutState: string;
  authorityStatus: string;
  rolloutFlags: Readonly<{
    contextShadow: boolean;
    capabilityEnforcement: boolean;
    surfaceUi: boolean;
  }>;
  routes: readonly RouteEvidence[];
  har: string;
  trace: 'NOT_CAPTURED_SECURITY_POLICY';
}>;

type TenantRuntimeObservation = Readonly<{
  label: HrisW1Tenant['label'];
  firewall: Readonly<FirewallObservation>;
}>;

function jsonRecord(value: unknown, location: string): JsonRecord {
  expect(value, `${location} must be an object`).toBeTruthy();
  expect(Array.isArray(value), `${location} must not be an array`).toBe(false);
  expect(typeof value, `${location} must be an object`).toBe('object');
  return value as JsonRecord;
}

function envelopeData(value: unknown, location: string): JsonRecord {
  return jsonRecord(jsonRecord(value, location).data, `${location}.data`);
}

async function responseJson(response: PW.APIResponse, location: string): Promise<JsonRecord> {
  const contentType = response.headers()['content-type'] ?? '';
  expect(contentType, `${location} must return JSON`).toContain('application/json');
  return jsonRecord(await response.json(), location);
}

function newFirewallObservation(): FirewallObservation {
  return {
    interceptedHttpRequests: 0,
    continuedHttpRequests: 0,
    continuedMutations: [],
    evaluationRequests: [],
    blockedMutations: [],
    blockedExternalHttp: [],
    blockedExternalWebSockets: [],
  };
}

function valueRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

async function installBrowserFirewall(
  context: PW.BrowserContext,
  tenant: HrisW1Tenant,
  observation: FirewallObservation
) {
  const expectedEvaluationContracts =
    tenant.label === 'tenant-a'
      ? tenant.routes.flatMap((route) => {
          const pageContract =
            route.outcome === 'redirected'
              ? []
              : [
                  {
                    kind: 'PAGE' as const,
                    routeContractKey: route.pageRouteContractKey,
                    productKey: 'hcm',
                    surfaceKey: `hcm.${route.pageRouteContractKey.split('.')[2]}`,
                    contextScopeKey: route.expectedScopeKey ?? null,
                  },
                ];
          const actionContract = route.highRiskPreview
            ? [
                {
                  kind: 'HIGH' as const,
                  routeContractKey: route.highRiskPreview.expectedRouteContractKey,
                  productKey: route.highRiskPreview.expectedProductKey,
                  surfaceKey: route.highRiskPreview.expectedSurfaceKey,
                  contextScopeKey: route.expectedScopeKey ?? null,
                },
              ]
            : [];
          return [...pageContract, ...actionContract];
        })
      : [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    observation.interceptedHttpRequests += 1;

    if (['http:', 'https:'].includes(url.protocol) && url.origin !== baseOrigin) {
      observation.blockedExternalHttp.push({ method, url: redactURL(url.toString()) });
      await route.abort('blockedbyclient');
      return;
    }

    if (url.origin === baseOrigin && !SAFE_READ_METHODS.has(method)) {
      if (method === 'POST' && url.pathname === HRIS_W1_HIGH_RISK_EVALUATION_PATH) {
        let body: JsonRecord | null = null;
        try {
          body = valueRecord(request.postDataJSON());
        } catch {
          body = null;
        }
        const routeContractKey =
          typeof body?.routeContractKey === 'string' ? body.routeContractKey : null;
        const contextScopeKey =
          typeof body?.contextScopeKey === 'string' ? body.contextScopeKey : null;
        const subject = valueRecord(body?.subject);
        const subjectType = typeof subject?.type === 'string' ? subject.type : null;
        const subjectProductKey =
          typeof subject?.productKey === 'string' ? subject.productKey : null;
        const subjectSurfaceKey =
          typeof subject?.surfaceKey === 'string' ? subject.surfaceKey : null;
        const expectedContract =
          url.search === '' && exactEvaluationShape(body, subject, contextScopeKey)
            ? expectedEvaluationContracts.find(
                (expected) =>
                  expected.routeContractKey === routeContractKey &&
                  expected.contextScopeKey === contextScopeKey &&
                  subjectType === 'PRODUCT' &&
                  expected.productKey === subjectProductKey &&
                  expected.surfaceKey === subjectSurfaceKey
              )
            : undefined;
        observation.evaluationRequests.push({
          routeContractKey,
          contextScopeKey,
          subjectType,
          subjectProductKey,
          subjectSurfaceKey,
          action: expectedContract ? 'CONTINUED' : 'BLOCKED',
          reason:
            expectedContract?.kind === 'PAGE'
              ? 'EXACT_PAGE_CONTRACT'
              : expectedContract?.kind === 'HIGH'
                ? 'EXACT_HIGH_CONTRACT'
                : 'OTHER_AUTHORITY_EVALUATION',
        });
        if (expectedContract) {
          observation.continuedHttpRequests += 1;
          observation.continuedMutations.push({ method, path: url.pathname });
          await route.continue();
          return;
        }
        observation.blockedMutations.push({
          method,
          path: url.pathname,
          reason: 'AUTHORITY_CONTRACT_MISMATCH',
        });
        await route.abort('blockedbyclient');
        return;
      }

      observation.blockedMutations.push({
        method,
        path: url.pathname,
        reason: 'OWNER_MUTATION',
      });
      await route.abort('blockedbyclient');
      return;
    }

    observation.continuedHttpRequests += 1;
    await route.continue();
  });

  await context.routeWebSocket(
    (url) =>
      ['ws:', 'wss:'].includes(url.protocol) &&
      !(url.protocol === 'ws:' && url.host === baseURL.host),
    async (webSocket) => {
      observation.blockedExternalWebSockets.push(redactURL(webSocket.url()));
      await webSocket.close({ code: 1008, reason: 'HRIS W1 live localhost-only boundary' });
    }
  );
}

function assertApiBoundary(response: PW.APIResponse, expectedPath: string, location: string) {
  const url = new URL(response.url());
  expect(url.origin, `${location} response must remain on the owned frontend origin`).toBe(
    baseOrigin
  );
  expect(url.pathname, `${location} response must retain its exact API path`).toBe(expectedPath);
}

function requiredResponseString(data: JsonRecord, key: string, location: string): string {
  const value = data[key];
  expect(typeof value, `${location}.${key} must be a string`).toBe('string');
  expect(String(value).trim().length, `${location}.${key} must be non-blank`).toBeGreaterThan(0);
  return String(value);
}

function optionalResponseString(data: JsonRecord, key: string, location: string) {
  if (data[key] === undefined || data[key] === null) return undefined;
  return requiredResponseString(data, key, location);
}

async function validateStepUpResponse(
  response: PW.Response,
  route: HrisW1RouteCase
): Promise<StepUpEvidence> {
  const location = `${route.id} HIGH evaluation`;
  const url = new URL(response.url());
  expect(url.origin, `${location} must remain on the owned frontend origin`).toBe(baseOrigin);
  expect(url.pathname, `${location} must use the exact authority endpoint`).toBe(
    HRIS_W1_HIGH_RISK_EVALUATION_PATH
  );
  expect(response.status(), `${location} must return HTTP 200`).toBe(200);
  expect(response.fromServiceWorker(), `${location} cannot come from a service worker`).toBe(false);
  const contentType = (await response.headerValue('content-type')) ?? '';
  expect(contentType, `${location} must return JSON`).toContain('application/json');
  const data = envelopeData(await response.json(), location);
  const observedAt = new Date().toISOString();
  expect(data.decision, `${location}.data.decision`).toBe('STEP_UP_REQUIRED');
  expect(data.reasonCode, `${location}.data.reasonCode`).toBe('STEP_UP_REQUIRED');
  expect(data.requiredAssurance, `${location}.data.requiredAssurance`).toBe(
    REQUIRED_HIGH_ASSURANCE
  );
  expect(data.context, `${location}.data.context must stay redacted`).toBeUndefined();
  expect(data.scope, `${location}.data.scope must stay redacted`).toBeUndefined();
  const decisionRevision = requiredResponseString(data, 'decisionRevision', `${location}.data`);
  const requestPolicyRef = optionalResponseString(data, 'requestPolicyRef', `${location}.data`);
  const validUntil = optionalResponseString(data, 'validUntil', `${location}.data`);
  const revalidateAt = requiredResponseString(data, 'revalidateAt', `${location}.data`);
  for (const [key, value] of [['validUntil', validUntil]] as const) {
    if (value !== undefined) {
      expect(
        Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.parse(observedAt),
        `${location}.data.${key} must be a future instant`
      ).toBe(true);
    }
  }
  expect(
    Number.isFinite(Date.parse(revalidateAt)) && Date.parse(revalidateAt) > Date.parse(observedAt),
    `${location}.data.revalidateAt must be a future instant`
  ).toBe(true);
  return {
    status: 200,
    routeContractKey: route.highRiskPreview!.expectedRouteContractKey,
    operation: route.highRiskPreview!.expectedOperation,
    decision: 'STEP_UP_REQUIRED',
    reasonCode: 'STEP_UP_REQUIRED',
    requiredAssurance: REQUIRED_HIGH_ASSURANCE,
    decisionRevision,
    ...(requestPolicyRef ? { requestPolicyRef } : {}),
    ...(validUntil ? { validUntil } : {}),
    revalidateAt,
    observedAt,
  };
}

function browserPath(value: string): string {
  const url = new URL(value);
  return `${url.pathname}${url.search}`;
}

function exactQueryValue(url: URL, key: string): string | null {
  const values = url.searchParams.getAll(key);
  return values.length === 1 ? values[0]! : null;
}

async function capture(page: PW.Page, info: PW.TestInfo, tenant: HrisW1Tenant, routeId: string) {
  const screenshot = info.outputPath(`${tenant.label}-${routeId}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await chmod(screenshot, 0o600);
  await info.attach(`${tenant.label}-${routeId}`, { path: screenshot, contentType: 'image/png' });
  return screenshot;
}

async function waitForRouteAPIs(
  records: readonly NetworkRecord[],
  offset: number,
  route: HrisW1RouteCase
) {
  for (const api of route.api) {
    await expect
      .poll(
        () =>
          records
            .slice(offset)
            .some(
              (record) =>
                record.method === api.method &&
                record.path === api.path &&
                record.status !== undefined &&
                (api.method !== 'GET' ||
                  (record.contextScopeKey === route.expectedScopeKey &&
                    (record.bodyByteLength ?? 0) > 0)) &&
                api.statuses.includes(record.status)
            ),
        {
          timeout: runtime.assertionTimeoutMs,
          message: `${route.id} did not observe ${api.method} ${api.path} with ${api.statuses.join('/')}`,
        }
      )
      .toBe(true);
  }
}

async function exerciseRoute(
  page: PW.Page,
  tenant: HrisW1Tenant,
  route: HrisW1RouteCase,
  records: NetworkRecord[],
  firewall: FirewallObservation,
  info: PW.TestInfo
): Promise<RouteEvidence> {
  const offset = records.length;
  const blockedMutationOffset = firewall.blockedMutations.length;
  const blockedExternalHttpOffset = firewall.blockedExternalHttp.length;
  const blockedExternalWebSocketOffset = firewall.blockedExternalWebSockets.length;
  const evaluationOffset = firewall.evaluationRequests.length;
  await page.goto(route.path, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('product-surface-loading-shell')).toHaveCount(0, {
    timeout: runtime.assertionTimeoutMs,
  });
  await expect(page.locator('#dwp-main-content').first()).toBeVisible({
    timeout: runtime.assertionTimeoutMs,
  });

  let accessState: string | null | undefined;
  if (route.outcome === 'allowed') {
    const requested = new URL(route.path, runtime.baseURL);
    await expect
      .poll(() => {
        const current = new URL(page.url());
        return {
          origin: current.origin,
          pathname: current.pathname,
          scope: current.searchParams.getAll('scope'),
        };
      })
      .toEqual({
        origin: baseOrigin,
        pathname: requested.pathname,
        scope: [route.expectedScopeKey],
      });
    await expect(page.locator(ACCESS_STATE_SELECTOR)).toHaveCount(0);
    await expect(page.locator(route.marker!).first()).toBeVisible();
    const pageSurfaceKey = `hcm.${route.pageRouteContractKey.split('.')[2]}`;
    await expect
      .poll(
        () =>
          firewall.evaluationRequests
            .slice(evaluationOffset)
            .some(
              (observation) =>
                observation.subjectType === 'PRODUCT' &&
                observation.subjectProductKey === 'hcm' &&
                observation.subjectSurfaceKey === pageSurfaceKey &&
                observation.routeContractKey === route.pageRouteContractKey &&
                observation.contextScopeKey === route.expectedScopeKey &&
                observation.action === 'CONTINUED' &&
                observation.reason === 'EXACT_PAGE_CONTRACT'
            ),
        {
          timeout: runtime.assertionTimeoutMs,
          message: `${route.id} did not evaluate its exact HCM PAGE contract`,
        }
      )
      .toBe(true);
  } else if (route.outcome === 'redirected') {
    await expect.poll(() => browserPath(page.url())).toBe(route.redirectPath);
  } else {
    const access = page.locator(ACCESS_STATE_SELECTOR).first();
    await expect(access).toBeVisible();
    accessState = await access.getAttribute('data-product-access-state');
    expect(route.accessStates).toContain(accessState);
  }

  let highRiskScreenshot: string | undefined;
  let highRiskEvaluation: StepUpEvidence | undefined;
  if (route.highRiskPreview) {
    const highRisk = route.highRiskPreview;
    const responsePromise = page
      .waitForResponse(
        (response) => {
          const url = new URL(response.url());
          if (
            url.origin !== baseOrigin ||
            url.pathname !== HRIS_W1_HIGH_RISK_EVALUATION_PATH ||
            response.request().method() !== 'POST'
          ) {
            return false;
          }
          try {
            const body = valueRecord(response.request().postDataJSON());
            const subject = valueRecord(body?.subject);
            return (
              exactEvaluationShape(body, subject, String(body?.contextScopeKey ?? '')) &&
              body?.routeContractKey === highRisk.expectedRouteContractKey &&
              body?.contextScopeKey === route.expectedScopeKey &&
              subject?.type === 'PRODUCT' &&
              subject?.productKey === highRisk.expectedProductKey &&
              subject?.surfaceKey === highRisk.expectedSurfaceKey
            );
          } catch {
            return false;
          }
        },
        { timeout: runtime.assertionTimeoutMs }
      )
      .catch(() => null);
    for (const selector of highRisk.clickSelectors) {
      await expect(page.locator(selector).first()).toBeVisible();
      await page.locator(selector).first().click();
    }
    await expect
      .poll(
        () =>
          firewall.evaluationRequests
            .slice(evaluationOffset)
            .some(
              (observation) =>
                observation.routeContractKey === highRisk.expectedRouteContractKey &&
                observation.contextScopeKey === route.expectedScopeKey &&
                observation.subjectType === 'PRODUCT' &&
                observation.subjectProductKey === highRisk.expectedProductKey &&
                observation.subjectSurfaceKey === highRisk.expectedSurfaceKey &&
                observation.reason === 'EXACT_HIGH_CONTRACT'
            ),
        {
          timeout: runtime.assertionTimeoutMs,
          message: `${route.id} did not send the exact HIGH subject/routeContractKey contract`,
        }
      )
      .toBe(true);
    const response = await responsePromise;
    expect(response, `${route.id} did not receive the live HIGH authority response`).not.toBeNull();
    if (!response) throw new Error(`${route.id} live HIGH authority response was not observed`);
    highRiskEvaluation = await validateStepUpResponse(response, route);
    const dialog = page.locator(highRisk.dialogSelector).last();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(highRisk.dialogText);
    highRiskScreenshot = await capture(page, info, tenant, `${route.id}-high-risk-preview`);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }

  await waitForRouteAPIs(records, offset, route);
  const screenshot = await capture(page, info, tenant, route.id);
  expect(
    firewall.blockedMutations.slice(blockedMutationOffset),
    `${route.id} attempted an owner mutation that the safety firewall blocked.`
  ).toEqual([]);
  expect(
    firewall.blockedExternalHttp.slice(blockedExternalHttpOffset),
    `${route.id} attempted non-local HTTP traffic that the safety firewall blocked.`
  ).toEqual([]);
  expect(
    firewall.blockedExternalWebSockets.slice(blockedExternalWebSocketOffset),
    `${route.id} attempted a non-local WebSocket that the safety firewall blocked.`
  ).toEqual([]);
  const workerResponses = records
    .slice(offset)
    .filter((record) => record.fromServiceWorker === true);
  expect(workerResponses, 'Live API evidence cannot come from a service worker.').toEqual([]);
  return {
    id: route.id,
    module: route.module,
    requestedPath: route.path,
    finalPath: browserPath(page.url()),
    outcome: route.outcome,
    ...(route.outcome === 'denied' || route.outcome === 'authority-unavailable'
      ? { accessState }
      : {}),
    screenshot,
    ...(highRiskScreenshot ? { highRiskScreenshot } : {}),
    ...(highRiskEvaluation ? { highRiskEvaluation } : {}),
    network: records.slice(offset),
  };
}

async function authenticate(context: PW.BrowserContext, tenant: HrisW1Tenant) {
  const initialCsrf = await context.request.get('/api/auth/csrf', {
    headers: { 'X-Tenant-ID': tenant.tenantId },
    maxRedirects: 0,
  });
  assertApiBoundary(initialCsrf, '/api/auth/csrf', `${tenant.label} pre-login CSRF`);
  expect(initialCsrf.status(), `${tenant.label} pre-login CSRF must succeed`).toBe(200);
  const initialCsrfData = envelopeData(
    await responseJson(initialCsrf, `${tenant.label} pre-login CSRF`),
    'pre-login CSRF'
  );
  expect(initialCsrfData.headerName, `${tenant.label} CSRF header name`).toBe('X-XSRF-TOKEN');
  const initialCsrfToken = requiredResponseString(
    initialCsrfData,
    'token',
    `${tenant.label} pre-login CSRF.data`
  );
  expect(
    initialCsrfToken.length,
    `${tenant.label} pre-login CSRF token length`
  ).toBeGreaterThanOrEqual(16);
  const login = await context.request.post('/api/auth/login', {
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenant.tenantId,
      'X-XSRF-TOKEN': initialCsrfToken,
    },
    data: { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
    maxRedirects: 0,
  });
  assertApiBoundary(login, '/api/auth/login', `${tenant.label} login`);
  expect(login.status(), `${tenant.label} login must succeed through the live Gateway`).toBe(200);
  const loginData = envelopeData(await responseJson(login, `${tenant.label} login`), 'login');
  if (loginData.tenantId !== undefined) {
    expect(String(loginData.tenantId)).toBe(tenant.tenantId);
  }

  const refreshedCsrf = await context.request.get('/api/auth/csrf', {
    headers: { 'X-Tenant-ID': tenant.tenantId },
    maxRedirects: 0,
  });
  assertApiBoundary(refreshedCsrf, '/api/auth/csrf', `${tenant.label} authenticated CSRF`);
  expect(refreshedCsrf.status(), `${tenant.label} authenticated CSRF must succeed`).toBe(200);
  const refreshedCsrfData = envelopeData(
    await responseJson(refreshedCsrf, `${tenant.label} authenticated CSRF`),
    'authenticated CSRF'
  );
  expect(refreshedCsrfData.headerName, `${tenant.label} refreshed CSRF header name`).toBe(
    'X-XSRF-TOKEN'
  );
  const refreshedCsrfToken = requiredResponseString(
    refreshedCsrfData,
    'token',
    `${tenant.label} authenticated CSRF.data`
  );
  expect(
    refreshedCsrfToken.length,
    `${tenant.label} authenticated CSRF token length`
  ).toBeGreaterThanOrEqual(16);

  const meResponse = await context.request.get('/api/auth/me', {
    headers: { 'X-Tenant-ID': tenant.tenantId },
    maxRedirects: 0,
  });
  assertApiBoundary(meResponse, '/api/auth/me', `${tenant.label} me`);
  expect(meResponse.status(), `${tenant.label} /api/auth/me must succeed`).toBe(200);
  const me = envelopeData(await responseJson(meResponse, `${tenant.label} me`), 'me');
  expect(String(me.tenantId)).toBe(tenant.tenantId);
  expect(String(me.identityPlane)).toBe('TENANT');
  expect(Number.isSafeInteger(Number(me.userId)) && Number(me.userId) > 0).toBe(true);
  return { loginStatus: login.status(), subjectId: String(me.userId) };
}

async function verifyCrossTenantFence(context: PW.BrowserContext, otherTenantId: string) {
  const response = await context.request.get('/api/auth/me', {
    headers: { 'X-Tenant-ID': otherTenantId },
    maxRedirects: 0,
  });
  assertApiBoundary(response, '/api/auth/me', 'cross-tenant me');
  expect(
    [401, 403],
    'An authenticated browser session must fail closed when it presents the other tenant id.'
  ).toContain(response.status());
  return {
    requestedTenantId: otherTenantId,
    status: response.status() as 401 | 403,
    outcome: 'DENIED' as const,
  };
}

async function verifyRollout(context: PW.BrowserContext, tenant: HrisW1Tenant) {
  const response = await context.request.get('/api/auth/product-surface-contexts', {
    headers: { 'X-Tenant-ID': tenant.tenantId },
    maxRedirects: 0,
  });
  assertApiBoundary(response, '/api/auth/product-surface-contexts', `${tenant.label} authority`);
  expect(response.status(), `${tenant.label} product authority snapshot must succeed`).toBe(200);
  const data = envelopeData(await responseJson(response, `${tenant.label} authority`), 'authority');
  expect(Array.isArray(data.rollouts), 'authority.data.rollouts must be an array').toBe(true);
  const rollouts = data.rollouts as JsonRecord[];
  const hcm = rollouts.find((candidate) => String(candidate.productKey).toLowerCase() === 'hcm');
  expect(hcm, `${tenant.label} must receive an HCM rollout record`).toBeTruthy();
  expect(String(hcm?.state)).toBe(tenant.expectedRolloutState);
  expect(String(hcm?.authorityStatus)).toBe(tenant.expectedAuthorityStatus);
  const flags = jsonRecord(hcm?.flags, `${tenant.label} HCM rollout.flags`);
  const expectedFlag = tenant.label === 'tenant-a';
  expect(flags.contextShadow).toBe(expectedFlag);
  expect(flags.capabilityEnforcement).toBe(expectedFlag);
  expect(flags.surfaceUi).toBe(expectedFlag);
  return {
    rolloutState: String(hcm?.state),
    authorityStatus: String(hcm?.authorityStatus),
    rolloutFlags: {
      contextShadow: Boolean(flags.contextShadow),
      capabilityEnforcement: Boolean(flags.capabilityEnforcement),
      surfaceUi: Boolean(flags.surfaceUi),
    },
  };
}

async function prepareAuthenticatedTenant(
  browser: PW.Browser,
  tenant: HrisW1Tenant,
  otherTenantId: string
) {
  const authContext = await browser.newContext({
    baseURL: runtime.baseURL,
    serviceWorkers: 'block',
    extraHTTPHeaders: { 'X-Tenant-ID': tenant.tenantId },
  });
  try {
    const authentication = await authenticate(authContext, tenant);
    const crossTenantMe = await verifyCrossTenantFence(authContext, otherTenantId);
    const rollout = await verifyRollout(authContext, tenant);
    const storageState = await authContext.storageState();
    return { authentication, crossTenantMe, rollout, storageState };
  } finally {
    await authContext.close();
  }
}

async function runTenant(
  browser: PW.Browser,
  tenant: HrisW1Tenant,
  otherTenantId: string,
  info: PW.TestInfo,
  runtimeObservations: TenantRuntimeObservation[]
): Promise<TenantEvidence> {
  const rawHar = info.outputPath(`${tenant.label}-raw.har`);
  const har = info.outputPath(`${tenant.label}.sanitized.har.json`);
  const firewall = newFirewallObservation();
  const records: NetworkRecord[] = [];
  const pageErrors: string[] = [];
  let result: Omit<TenantEvidence, 'har' | 'trace'> | undefined;
  let context: PW.BrowserContext | undefined;
  let page: PW.Page | undefined;
  try {
    const authenticated = await prepareAuthenticatedTenant(browser, tenant, otherTenantId);
    await rm(rawHar, { force: true });
    context = await browser.newContext({
      baseURL: runtime.baseURL,
      viewport: { width: 1440, height: 960 },
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      extraHTTPHeaders: { 'X-Tenant-ID': tenant.tenantId },
      storageState: authenticated.storageState,
      recordHar: { path: rawHar, mode: 'full', content: 'omit' },
    });
    await installBrowserFirewall(context, tenant, firewall);
    const tenantPage = await context.newPage();
    page = tenantPage;
    tenantPage.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        records.push({
          method: request.method(),
          path: url.pathname,
          contextScopeKey: exactQueryValue(url, 'contextScopeKey'),
        });
      }
    });
    tenantPage.on('response', async (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith('/api/')) return;
      let bytes = Buffer.alloc(0);
      try {
        bytes = await response.body();
      } catch {
        bytes = Buffer.alloc(0);
      }
      let payrollConfigurationIds: string[] | undefined;
      if (
        response.status() === 200 &&
        response.request().method() === 'GET' &&
        url.pathname === '/api/payroll/v1/hris/payroll/foundation/configurations'
      ) {
        try {
          const payload = jsonRecord(JSON.parse(bytes.toString('utf8')), 'PAY list response');
          const data = jsonRecord(payload.data, 'PAY list response.data');
          const configurations = Array.isArray(data.configurations) ? data.configurations : [];
          payrollConfigurationIds = configurations.map((value, index) =>
            String(jsonRecord(value, `PAY list configuration[${index}]`).configurationId)
          );
          expect(
            payrollConfigurationIds.filter(
              (configurationId) => configurationId === runtime.expectedPayrollConfigurationId
            ),
            'Browser PAY response must contain exactly one runner-attested configuration.'
          ).toHaveLength(1);
        } catch {
          payrollConfigurationIds = [];
        }
      }
      records.push({
        method: response.request().method(),
        path: url.pathname,
        contextScopeKey: exactQueryValue(url, 'contextScopeKey'),
        status: response.status(),
        bodyByteLength: bytes.byteLength,
        responseBodySha256: createHash('sha256').update(bytes).digest('hex'),
        ...(payrollConfigurationIds ? { payrollConfigurationIds } : {}),
        fromServiceWorker: response.fromServiceWorker(),
      });
    });
    tenantPage.on('pageerror', (error) => pageErrors.push(error.message));

    const routes: RouteEvidence[] = [];
    for (const route of tenant.routes) {
      routes.push(
        await test.step(`${tenant.label}: ${route.id}`, () =>
          exerciseRoute(tenantPage, tenant, route, records, firewall, info))
      );
    }
    if (tenant.label === 'tenant-b') {
      expect(
        firewall.evaluationRequests,
        'Rollout-off tenant B must stay on the seeded legacy-denied boundary without product evaluation.'
      ).toEqual([]);
    }
    const storedSecrets = await tenantPage.evaluate(() =>
      Object.entries(window.localStorage).map(([key, value]) => `${key}=${value}`)
    );
    expect(storedSecrets.some((value) => value.includes(tenant.password))).toBe(false);
    expect(storedSecrets.some((value) => /accessToken|refreshToken/iu.test(value))).toBe(false);
    expect(pageErrors, 'The live HRIS journey emitted unhandled page errors.').toEqual([]);
    result = {
      label: tenant.label,
      tenantId: tenant.tenantId,
      loginStatus: authenticated.authentication.loginStatus,
      verifiedSubjectId: authenticated.authentication.subjectId,
      crossTenantMe: authenticated.crossTenantMe,
      rolloutState: authenticated.rollout.rolloutState,
      authorityStatus: authenticated.rollout.authorityStatus,
      rolloutFlags: authenticated.rollout.rolloutFlags,
      routes,
    };
  } catch (caught) {
    if (page && !page.isClosed()) {
      try {
        await capture(page, info, tenant, 'failure');
      } catch {
        // Preserve the acceptance failure; a missing diagnostic screenshot must not replace it.
      }
    }
    throw caught;
  } finally {
    try {
      if (context) {
        try {
          await context.close();
        } finally {
          await sanitizeHrisW1Har(rawHar, har, [tenant.email, tenant.password]);
        }
        await info.attach(`${tenant.label}-sanitized-har`, {
          path: har,
          contentType: 'application/json',
        });
      }
    } finally {
      runtimeObservations.push({ label: tenant.label, firewall });
    }
  }
  if (!result) throw new Error(`${tenant.label} live journey completed without evidence`);
  return {
    ...result,
    har,
    trace: 'NOT_CAPTURED_SECURITY_POLICY',
  };
}

test('W1 uses live Gateway authority for isolated tenant A and keeps tenant B off', async ({
  browser,
}, info) => {
  const evidence: TenantEvidence[] = [];
  const runtimeObservations: TenantRuntimeObservation[] = [];
  const failures: Error[] = [];
  for (const tenant of runtime.tenants) {
    const otherTenant = runtime.tenants.find(
      (candidate) => candidate.tenantId !== tenant.tenantId
    )!;
    try {
      evidence.push(
        await runTenant(browser, tenant, otherTenant.tenantId, info, runtimeObservations)
      );
    } catch (caught) {
      failures.push(caught instanceof Error ? caught : new Error(String(caught)));
    }
  }

  const firewalls = runtimeObservations.map((observation) => observation.firewall);
  const continuedMutations = firewalls.flatMap((firewall) => firewall.continuedMutations);
  const blockedMutations = firewalls.flatMap((firewall) => firewall.blockedMutations);
  const blockedExternalHttp = firewalls.flatMap((firewall) => firewall.blockedExternalHttp);
  const blockedExternalWebSockets = firewalls.flatMap(
    (firewall) => firewall.blockedExternalWebSockets
  );
  const unexpectedEvaluations = firewalls.flatMap((firewall) =>
    firewall.evaluationRequests.filter(
      (request) => request.action !== 'CONTINUED' || request.reason === 'OTHER_AUTHORITY_EVALUATION'
    )
  );
  const requestBoundaryEvidence = {
    interceptionPolicy:
      'CONTINUE_READS_AND_EXACT_AUTHORITY_EVALUATIONS_ABORT_OTHER_SAME_ORIGIN_NON_READS',
    interceptedHttpRequestCount: firewalls.reduce(
      (total, firewall) => total + firewall.interceptedHttpRequests,
      0
    ),
    continuedHttpRequestCount: firewalls.reduce(
      (total, firewall) => total + firewall.continuedHttpRequests,
      0
    ),
    forwardedAuthorityEvaluationCount: continuedMutations.filter(
      (request) => request.path === HRIS_W1_HIGH_RISK_EVALUATION_PATH
    ).length,
    forwardedOwnerMutationCount: continuedMutations.filter(
      (request) => request.path !== HRIS_W1_HIGH_RISK_EVALUATION_PATH
    ).length,
    blockedOwnerMutationAttempts: blockedMutations,
    blockedExternalHttp,
    blockedExternalWebSockets,
    unexpectedAuthorityEvaluations: unexpectedEvaluations,
  };
  const boundaryPassed =
    requestBoundaryEvidence.forwardedOwnerMutationCount === 0 &&
    blockedMutations.length === 0 &&
    blockedExternalHttp.length === 0 &&
    blockedExternalWebSockets.length === 0 &&
    unexpectedEvaluations.length === 0;
  const acceptancePassed = failures.length === 0 && evidence.length === 2 && boundaryPassed;

  const manifestPath = path.join(runtime.artifactRoot, 'synthetic-acceptance-manifest.json');
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 'hris-w1-live-browser/v2',
        runId: runtime.runId,
        generatedAt: new Date().toISOString(),
        status: acceptancePassed ? 'PASS' : 'FAIL',
        boundary: {
          frontendOrigin: baseOrigin,
          gatewayOrigin: runtime.gatewayURL,
          serviceWorkers: 'blocked',
          requestBoundaryEvidence,
          trace: 'NOT_CAPTURED_SECURITY_POLICY',
          traceReason:
            'Playwright trace archives can retain session cookies and have no supported safe-redaction path.',
          rawHarPolicy:
            'Login is completed in a separate no-HAR context; raw route HAR is sanitized and deleted on orderly teardown.',
        },
        tenants: evidence,
        runtimeObservations,
        failures: failures.map((failure) => ({ name: failure.name, message: failure.message })),
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  await chmod(manifestPath, 0o600);
  await info.attach('hris-w1-live-manifest', {
    path: manifestPath,
    contentType: 'application/json',
  });

  expect(failures.map((failure) => failure.message)).toEqual([]);
  expect(evidence).toHaveLength(2);
  expect(requestBoundaryEvidence.forwardedOwnerMutationCount).toBe(0);
  expect(blockedMutations, 'No owner or mismatched authority mutation may be attempted.').toEqual(
    []
  );
  expect(blockedExternalHttp, 'No non-local HTTP attempt is allowed.').toEqual([]);
  expect(blockedExternalWebSockets, 'No non-local WebSocket attempt is allowed.').toEqual([]);
  expect(
    unexpectedEvaluations,
    'Every authority evaluation must match an exact allowlist tuple.'
  ).toEqual([]);
});
