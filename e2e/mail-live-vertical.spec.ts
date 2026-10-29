import { expect, request as requestApi, test } from '@playwright/test';

import { loadMailLiveEnvironment } from './support/mail-live-environment';

import type { APIRequestContext, APIResponse } from '@playwright/test';

type JsonRecord = Record<string, unknown>;
type LiveSession = Readonly<{
  context: APIRequestContext;
  csrf: Readonly<{ headerName: string; token: string }>;
}>;

const runtime = loadMailLiveEnvironment();

function record(value: unknown, location: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${location} must be an object.`);
  }
  return value as JsonRecord;
}

async function json(response: APIResponse, location: string): Promise<JsonRecord> {
  return record(await response.json(), location);
}

async function envelopeData(response: APIResponse, location: string): Promise<JsonRecord> {
  return record((await json(response, location)).data, `${location}.data`);
}

async function loadCsrf(context: APIRequestContext) {
  const response = await context.get('/api/auth/csrf');
  expect(response.status(), 'CSRF preflight').toBe(200);
  const data = await envelopeData(response, 'csrf');
  expect(typeof data.headerName).toBe('string');
  expect(typeof data.token).toBe('string');
  return { headerName: String(data.headerName), token: String(data.token) };
}

async function login(credentials: { email: string; password: string }): Promise<LiveSession> {
  const context = await requestApi.newContext({
    baseURL: runtime.gatewayURL,
    extraHTTPHeaders: { 'X-Tenant-ID': runtime.tenantId, Accept: 'application/json' },
    timeout: 45_000,
  });
  try {
    const initialCsrf = await loadCsrf(context);
    const response = await context.post('/api/auth/login', {
      data: { ...credentials, tenantId: runtime.tenantId },
      headers: { [initialCsrf.headerName]: initialCsrf.token },
    });
    expect(response.status(), `login ${credentials.email}`).toBe(200);
    const me = await context.get('/api/auth/me');
    expect(me.status(), `identity ${credentials.email}`).toBe(200);
    expect(String((await envelopeData(me, 'me')).tenantId)).toBe(runtime.tenantId);
    return { context, csrf: await loadCsrf(context) };
  } catch (error) {
    await context.dispose();
    throw error;
  }
}

async function mutate(
  session: LiveSession,
  method: 'post',
  path: string,
  data: unknown,
  headers: Record<string, string> = {}
) {
  return session.context[method](path, {
    data,
    headers: { ...headers, [session.csrf.headerName]: session.csrf.token },
  });
}

type MailAuthority = Readonly<{
  rolloutState: '000' | '100' | '110' | '111';
  contextKey?: string;
  contextScopeKey?: string;
  decisionRevision?: string;
}>;

async function mailAuthority(session: LiveSession): Promise<MailAuthority> {
  const response = await session.context.get('/api/auth/product-surface-contexts');
  expect(response.status(), 'product authority').toBe(200);
  const data = await envelopeData(response, 'product authority');
  const rollouts = Array.isArray(data.rollouts) ? data.rollouts : [];
  const rollout = rollouts
    .map((value) => record(value, 'mail rollout'))
    .find((candidate) => candidate.productKey === 'mail');
  const rolloutState = rollout?.state;
  if (!['000', '100', '110', '111'].includes(String(rolloutState))) {
    throw new Error('Mail product rollout is missing from the live authority envelope.');
  }
  if (rolloutState === '000' || rolloutState === '100') return { rolloutState };

  const contexts = Array.isArray(data.contexts) ? data.contexts : [];
  const context = contexts
    .map((value) => record(value, 'mail context'))
    .find((candidate) => candidate.productKey === 'mail' && candidate.surfaceKey === 'mail.work');
  if (!context || !Array.isArray(context.scopes)) {
    throw new Error('Secure Mail rollout requires a mail.work context and scopes.');
  }
  const scopes = context.scopes.map((value) => record(value, 'mail scope'));
  const selected = runtime.scopeKey
    ? scopes.find((scope) => scope.key === runtime.scopeKey)
    : scopes.length === 1
      ? scopes[0]
      : scopes.find((scope) => scope.isDefault === true);
  if (!selected || typeof selected.key !== 'string') {
    throw new Error(
      'Mail scope is ambiguous; set MAIL_LIVE_SCOPE_KEY to one scope returned by the Gateway.'
    );
  }
  if (typeof context.contextKey !== 'string' || typeof data.decisionRevision !== 'string') {
    throw new Error('Secure Mail authority context or decision revision is invalid.');
  }
  return {
    rolloutState,
    contextKey: context.contextKey,
    contextScopeKey: selected.key,
    decisionRevision: data.decisionRevision,
  };
}

async function evaluatedComposeAuthority(
  session: LiveSession,
  authority: MailAuthority
): Promise<MailAuthority> {
  if (authority.rolloutState === '000' || authority.rolloutState === '100') return authority;
  const response = await mutate(session, 'post', '/api/auth/product-surface-access/evaluate', {
    subject: { type: 'PRODUCT', productKey: 'mail', surfaceKey: 'mail.work' },
    routeContractKey: 'route.mail.work.message-create.action',
    contextKey: authority.contextKey,
    contextScopeKey: authority.contextScopeKey,
  });
  expect(response.status(), 'Mail compose authority evaluation').toBe(200);
  const data = await envelopeData(response, 'Mail compose authority evaluation');
  expect(data.decision).toBe('ALLOWED');
  expect(record(data.scope, 'evaluated scope').key).toBe(authority.contextScopeKey);
  expect(typeof data.decisionRevision).toBe('string');
  return { ...authority, decisionRevision: String(data.decisionRevision) };
}

function governedPath(path: string, authority: MailAuthority): string {
  if (!authority.contextScopeKey) return path;
  const url = new URL(path, runtime.gatewayURL);
  url.searchParams.set('contextScopeKey', authority.contextScopeKey);
  return `${url.pathname}${url.search}`;
}

function governedHeaders(authority: MailAuthority): Record<string, string> {
  return authority.decisionRevision
    ? { 'X-DWP-Expected-Decision-Revision': authority.decisionRevision }
    : {};
}

function composePayload(subject: string) {
  return {
    toEmail: runtime.recipientEmail,
    subject,
    body: `DWP Mail live vertical evidence ${runtime.runId}`,
    classification: 'INTERNAL',
    externalRecipientConfirmed: false,
    deliveryMode: 'SEND',
    idempotencyKey: crypto.randomUUID(),
  };
}

test('Gateway, PostgreSQL, and DWP Sandbox persist compose then expose it through search', async () => {
  const session = await login(runtime.sender);
  try {
    const baseAuthority = await mailAuthority(session);
    const home = await session.context.get(
      governedPath('/api/platform/v1/mail/home', baseAuthority),
      { headers: governedHeaders(baseAuthority) }
    );
    expect(home.status(), 'Mail home preflight').toBe(200);
    const accounts = (await envelopeData(home, 'Mail home')).accounts;
    expect(Array.isArray(accounts)).toBe(true);
    expect(
      (accounts as unknown[]).some((value) => {
        const account = record(value, 'Mail account');
        return account.defaultAccount === true && account.providerType === 'DWP_SANDBOX';
      }),
      'The live sender must have a default DWP_SANDBOX account backed by PostgreSQL.'
    ).toBe(true);

    const authority = await evaluatedComposeAuthority(session, baseAuthority);
    const subject = `[mail-live:${runtime.runId}] compose-send-search`;
    const compose = await mutate(
      session,
      'post',
      governedPath('/api/platform/v1/mail/messages', authority),
      composePayload(subject),
      governedHeaders(authority)
    );
    expect(compose.status(), 'sandbox compose/send').toBe(200);
    const composed = await envelopeData(compose, 'sandbox compose/send');
    expect(record(composed.thread, 'composed thread').subject).toBe(subject);

    await expect
      .poll(
        async () => {
          const query = new URLSearchParams({ query: subject, page: '0', pageSize: '30' });
          if (authority.contextScopeKey) {
            query.set('contextScopeKey', authority.contextScopeKey);
          }
          const search = await session.context.get(`/api/platform/v1/mail/threads?${query}`, {
            headers: governedHeaders(authority),
          });
          if (search.status() !== 200) return false;
          const items = (await envelopeData(search, 'Mail search')).items;
          return (
            Array.isArray(items) &&
            items.some((value) => record(value, 'Mail search item').subject === subject)
          );
        },
        { timeout: 30_000, intervals: [250, 500, 1_000] }
      )
      .toBe(true);
  } finally {
    await session.context.dispose();
  }
});

test('Gateway denies compose for a distinct authenticated user without APP.MAIL:SEND', async () => {
  const session = await login(runtime.deniedSender);
  try {
    const authority = await mailAuthority(session);
    const response = await mutate(
      session,
      'post',
      governedPath('/api/platform/v1/mail/messages', authority),
      composePayload(`[mail-live-denial:${runtime.runId}] must-not-persist`),
      governedHeaders(authority)
    );
    expect(response.status()).toBe(403);
  } finally {
    await session.context.dispose();
  }
});
