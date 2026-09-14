// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';
import { getApprovalAttachmentPolicy } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-api';
import { ApprovalAdminAttachmentPolicyInitialize } from './approval-admin-attachment-policy-initialize';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as ManagementScope from './approval-management-scope';
import type { ApprovalAttachmentPolicy } from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import type { ProductSurfaceAuthoritySnapshot } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import type { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';

type Decision = NonNullable<ReturnType<typeof useOptionalAllowedProductSurface>>;
const state = vi.hoisted(() => ({
  decision: null as Decision | null,
  snapshot: undefined as ProductSurfaceAuthoritySnapshot | undefined,
  installed: true,
  ready: true,
  canRead: true,
  actor: '13',
  success: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ko' } }),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useToast: () => ({ success: state.success }),
  useProductSurfaceAuthority: () => ({ snapshot: state.snapshot }),
}));
vi.mock('../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedProductSurface: () => state.decision,
}));
vi.mock('../../components/use-product-surface-governed-mutation', () => ({
  useProductSurfaceGovernedMutation:
    () => (execute: (execution: Shared.ApprovalMutationExecution) => Promise<unknown>) =>
      execute({
        mode: 'SECURE',
        rolloutState: '111',
        contextKey: 'ctx-admin',
        contextScopeKey: 'opaque-owner-scope',
        expectedDecisionRevision: state.decision!.decisionRevision,
      }),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canViewPolicies: state.canRead }),
  useApprovalManagementRequestScope: () => ({
    contextScopeKey: 'opaque-owner-scope',
    cacheKey: [
      '1',
      state.actor,
      'NORMAL',
      'approvals.admin',
      'opaque-owner-scope',
      state.decision?.decisionRevision ?? '',
    ],
  }),
}));
vi.mock('./approval-management-scope', async (original) => ({
  ...(await original<typeof ManagementScope>()),
  useApprovalManagementScopeReady: () => state.ready,
}));

function authority() {
  const until = new Date(Date.now() + 600_000).toISOString();
  const scope = {
    key: 'opaque-owner-scope',
    kind: 'RESOURCE_SET' as const,
    displayName: 'Management scope',
    isDefault: true,
    readOnly: false,
    validUntil: until,
  };
  const grant = {
    grantKind: 'CAPABILITY' as const,
    capabilityContractKey: 'approvals.policy.update',
    resolvedCapabilityCode: 'APPROVAL_POLICY_UPDATE',
    authorityMode: 'PERMISSION_AND_RELATIONSHIP' as const,
    predicatePolicyKeys: [],
    responsibilityRequirement: 'REQUIRED' as const,
    responsibility: { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_APPROVAL_FINANCE' },
    scopeKeys: [scope.key],
    requiresProductEntitlement: false,
    readOnly: false,
    activationState: 'ACTIVE',
    validUntil: until,
  };
  const context = {
    contextKey: 'ctx-admin',
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    plane: 'management' as const,
    accessMode: 'NORMAL' as const,
    accessSource: 'MANAGEMENT' as const,
    appResourceKey: 'APP.APPROVALS',
    effectiveGrants: [grant],
    scopes: [scope],
    revalidateAt: until,
  };
  const revision = `psr-${'a'.repeat(64)}`;
  state.decision = {
    state: 'allowed',
    context,
    routeGrantRef: 'verified-admin-route',
    scope,
    effectiveReadOnly: false,
    revalidateAt: until,
    decisionRevision: revision,
  };
  state.snapshot = {
    envelope: {
      contractVersion: '1',
      decisionRevision: revision,
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: new Date().toISOString(),
      contexts: [context],
      rollouts: [],
    },
    receivedAtMs: Date.now(),
    clockOffsetMs: 0,
    earliestRevalidateAtMs: Date.parse(until),
  };
}
function policy(): ApprovalAttachmentPolicy {
  return {
    policyId: '11111111-1111-4111-8111-111111111111',
    resourceSetKey: 'RS_APPROVAL_FINANCE',
    version: 1,
    published: {
      allowUpload: false,
      allowDownload: false,
      maxFileBytes: 10_485_760,
      maxFiles: 5,
      maxRequestBytes: 52_428_800,
      maxConcurrentUploads: 1,
      allowedMediaTypes: ['application/pdf'],
      grantTtlSeconds: 300,
      retentionDays: 365,
    },
    pending: null,
    providerReadiness: 'NOT_CONFIGURED',
    publishedRevision: 1,
    pendingRevision: null,
    pendingMakerUserId: null,
    publishedRulesSha256: 'b'.repeat(64),
    pendingRulesSha256: null,
    downloadReadiness: 'NOT_CONFIGURED',
    publishEligible: false,
    publishReason: 'PENDING_POLICY_REQUIRED',
  };
}
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const missing = () =>
  new Response(JSON.stringify({ errorCode: 'RESOURCE_NOT_AVAILABLE' }), { status: 404 });
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let csrf: ((value: Response) => void) | undefined;
let postReply: Response | Error;
let initialized: boolean;
let reads: number;
let posts: Array<{ url: string; config: RequestInit }>;
const key = () => [
  'approvals',
  'admin',
  'attachment-policy',
  '1',
  state.actor,
  'NORMAL',
  'approvals.admin',
  'opaque-owner-scope',
  state.decision!.decisionRevision,
];
function Harness() {
  const query = useQuery({
    queryKey: key(),
    queryFn: ({ signal }) => getApprovalAttachmentPolicy('opaque-owner-scope', signal),
    retry: false,
    staleTime: 30_000,
  });
  return (
    <ApprovalAdminAttachmentPolicyInitialize
      installed={state.installed}
      queryKey={key()}
      query={query}
      onRefresh={() => void query.refetch()}
    />
  );
}
const render = () =>
  root.render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
async function settle(callback: () => void = () => {}) {
  await act(async () => {
    callback();
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
const button = (suffix = 'initializeAction') =>
  Array.from(container.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === `admin.attachmentPolicy.${suffix}`
  )!;
async function load() {
  await settle(render);
  await settle();
}
async function begin() {
  await settle(() => button().click());
  await vi.waitFor(() => expect(csrf).toBeTypeOf('function'));
}
async function releaseCsrf() {
  await settle(() => csrf!(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' })));
  await settle();
}
function failCache(status: number, code: string) {
  const query = client.getQueryCache().find({ queryKey: key(), exact: true })!;
  query.setState({
    status: 'error',
    fetchStatus: 'idle',
    data: undefined,
    error: new HttpError('source changed', status, { errorCode: code }),
    errorUpdatedAt: Date.now(),
    errorUpdateCount: query.state.errorUpdateCount + 1,
  });
}

describe('explicit first attachment configuration with actual CSRF transport', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    resetCsrfToken();
    authority();
    state.installed = true;
    state.ready = true;
    state.canRead = true;
    state.actor = '13';
    csrf = undefined;
    initialized = false;
    reads = 0;
    posts = [];
    postReply = response(policy());
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, config: RequestInit = {}) => {
        if (url.includes('/csrf'))
          return new Promise<Response>((resolve) => {
            csrf = resolve;
          });
        if (config.method === 'POST') {
          posts.push({ url, config });
          if (postReply instanceof Error) throw postReply;
          initialized = postReply.ok;
          return postReply.clone();
        }
        reads += 1;
        return initialized ? response({ ...policy(), version: 2 }) : missing();
      })
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('does not provision on GET and explicitly initializes once with disabled defaults and current GET recovery', async () => {
    await load();
    expect(reads).toBe(1);
    expect(posts).toEqual([]);
    expect(button().disabled).toBe(false);
    await begin();
    await settle(() => button().click());
    await releaseCsrf();
    expect(posts).toHaveLength(1);
    const { url, config } = posts[0]!;
    expect(url).toBe(
      '/api/approvals/v1/admin/attachments/policies?contextScopeKey=opaque-owner-scope'
    );
    const body = JSON.parse(config.body as string);
    expect(body).toEqual({ expectedAbsent: true, idempotencyKey: expect.any(String) });
    expect(config.headers).toMatchObject({
      'Idempotency-Key': body.idempotencyKey,
      'X-DWP-Expected-Decision-Revision': state.decision!.decisionRevision,
    });
    expect(config.headers).not.toHaveProperty('X-DWP-Expected-Object-Version');
    expect(config.headers).not.toHaveProperty('X-DWP-Step-Up-Challenge');
    expect(state.success).toHaveBeenCalledWith('admin.attachmentPolicy.initialized');
    expect(reads).toBe(2);
    expect(client.getQueryData<ApprovalAttachmentPolicy>(key())?.version).toBe(2);
  });

  it.each([
    'uninstalled',
    'read-only',
    'no update',
    'missing RS',
    'ambiguous RS',
    'missing source',
    'unready',
  ])('does not initialize with %s authority', async (scenario) => {
    const context = state.snapshot!.envelope.contexts[0]!;
    const grant = context.effectiveGrants[0]!;
    if (scenario === 'uninstalled') state.installed = false;
    if (scenario === 'read-only') state.decision!.effectiveReadOnly = true;
    if (scenario === 'no update') context.effectiveGrants = [];
    if (scenario === 'missing RS' && grant.grantKind === 'CAPABILITY') grant.responsibility = null;
    if (scenario === 'ambiguous RS') context.effectiveGrants.push({ ...grant });
    if (scenario === 'missing source') state.snapshot = undefined;
    if (scenario === 'unready') state.ready = false;
    await load();
    expect(button().disabled).toBe(true);
    await settle(() => button().click());
    expect(posts).toEqual([]);
    expect(csrf).toBeUndefined();
  });

  it.each([403, 503, 404])(
    'masks first-config on %s without owner NOT_CONFIGURED proof',
    async (status) => {
      await load();
      await settle(() => failCache(status, 'FORBIDDEN'));
      expect(button()).toBeUndefined();
      expect(posts).toEqual([]);
    }
  );

  it.each(['403', '503', 'fetching', 'configured', 'RS swap', 'revision', 'actor ABA', 'unmount'])(
    'closes POST after deferred CSRF when %s invalidates the original source',
    async (scenario) => {
      await load();
      await begin();
      await settle(() => {
        const query = client.getQueryCache().find({ queryKey: key(), exact: true })!;
        if (scenario === '403' || scenario === '503')
          failCache(Number(scenario), 'SOURCE_UNAVAILABLE');
        if (scenario === 'fetching') query.setState({ fetchStatus: 'fetching' });
        if (scenario === 'configured') client.setQueryData(key(), policy());
        if (scenario === 'RS swap') {
          const grant = state.snapshot!.envelope.contexts[0]!.effectiveGrants[0]!;
          if (grant.grantKind === 'CAPABILITY')
            grant.responsibility = { code: 'APP_CONFIG_ADMIN', resourceSetKey: 'RS_OTHER' };
          render();
        }
        if (scenario === 'revision') {
          state.decision!.decisionRevision = `psr-${'c'.repeat(64)}`;
          render();
        }
        if (scenario === 'actor ABA') {
          state.actor = '31';
          render();
        }
        if (scenario === 'unmount') root.render(null);
      });
      if (scenario === 'actor ABA')
        await settle(() => {
          state.actor = '13';
          render();
        });
      await releaseCsrf();
      expect(posts).toEqual([]);
      expect(state.success).not.toHaveBeenCalled();
    }
  );

  it('preserves UNKNOWN original private body/key, never retries automatically and retries only after a fresh absence read', async () => {
    postReply = new Error('connection lost after request');
    await load();
    await begin();
    await releaseCsrf();
    expect(posts).toHaveLength(1);
    expect(button('initializeRetry').disabled).toBe(false);
    const original = posts[0]!;
    await settle();
    expect(posts).toHaveLength(1);
    await settle(() => failCache(503, 'SOURCE_UNAVAILABLE'));
    expect(button('initializeRetry')).toBeUndefined();
    await settle(() => {
      const retry = Array.from(container.querySelectorAll('button')).find(
        (item) => item.textContent === 'actions.retry'
      )!;
      retry.click();
    });
    await settle();
    expect(button('initializeRetry').disabled).toBe(false);
    postReply = response(policy());
    await settle(() => button('initializeRetry').click());
    await settle();
    expect(posts).toHaveLength(2);
    expect(posts[1]!.config.body).toBe(original.config.body);
    expect(posts[1]!.config.headers).toEqual(original.config.headers);
    expect(state.success).toHaveBeenCalledTimes(1);
  });

  it('keeps a committed but wrong-RS response UNKNOWN without adopting its policy', async () => {
    postReply = response({ ...policy(), resourceSetKey: 'RS_OTHER' });
    await load();
    await begin();
    await releaseCsrf();
    expect(posts).toHaveLength(1);
    expect(button('initializeRetry')).toBeDefined();
    expect(client.getQueryData(key())).toBeUndefined();
    expect(state.success).not.toHaveBeenCalled();
  });

  it('requires manual new GET after absence proof expires', async () => {
    await load();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 30_001);
    await settle(render);
    expect(button()).toBeUndefined();
    expect(posts).toEqual([]);
    clock.mockRestore();
  });
});
