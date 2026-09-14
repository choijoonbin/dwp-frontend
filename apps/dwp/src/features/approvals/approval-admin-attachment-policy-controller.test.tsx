// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS as actualProjections } from '../../routes/product-surface-authorization.generated';
import {
  APPROVAL_ATTACHMENT_POLICY_ROUTES,
  approvalAttachmentPolicyFingerprint,
  approvalAttachmentPolicyRouteInstalled,
  useApprovalAdminAttachmentPolicyController,
} from './approval-admin-attachment-policy-controller';
import { approvalAttachmentPolicyRulesValid } from './approval-admin-attachment-policy';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as Api from '@dwp-frontend/shared-utils/api/approval-attachment-policy-api';
import type * as ScopeHooks from './approval-management-command-scope';
import type * as ManagementScope from './approval-management-scope';
import type * as Generated from '../../routes/product-surface-authorization.generated';
import type {
  ApprovalAttachmentPolicy,
  ApprovalAttachmentRules,
} from '@dwp-frontend/shared-utils/api/approval-attachment-policy-contract';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type { ApprovalHighRiskCommandDescriptor } from './approval-high-risk-command-model';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';

type High = {
  operation: string;
  execute: (
    command: ApprovalHighRiskCommandDescriptor,
    execution: ApprovalMutationExecution
  ) => Promise<unknown>;
};
const state = vi.hoisted(() => ({
  projections: [] as ProductAuthorizationRouteProjection[],
  ready: true,
  writable: true,
  canRead: true,
  actor: '13',
  revision: 'revision-a',
  high: null as High | null,
  begin: vi.fn<(command: ApprovalHighRiskCommandDescriptor) => void>(),
  read: vi.fn<typeof Api.getApprovalAttachmentPolicy>(),
  save: vi.fn<typeof Api.saveApprovalAttachmentPolicyDraft>(),
  publish: vi.fn<typeof Api.publishApprovalAttachmentPolicy>(),
  run: vi.fn<
    (execute: (execution: ApprovalMutationExecution) => Promise<unknown>) => Promise<unknown>
  >(),
  success: vi.fn(),
  sent: 0,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ko' } }),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useToast: () => ({ success: state.success }),
  useProductSurfaceAuthority: () => ({ snapshot: undefined }),
}));
vi.mock('../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedProductSurface: () => null,
}));
vi.mock('../../components/product-surface-capability-access', () => ({
  resolveCanonicalProductSurfaceContext: () => null,
  hasWritableProductSurfaceCapability: () => state.writable,
}));
vi.mock('../../components/use-product-surface-governed-mutation', () => ({
  useProductSurfaceGovernedMutation: () => state.run,
}));
vi.mock('../../routes/product-surface-authorization.generated', async (original) => {
  const actual = await original<typeof Generated>();
  return {
    ...actual,
    get PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS() {
      return state.projections;
    },
  };
});
vi.mock('@dwp-frontend/shared-utils/api/approval-attachment-policy-api', async (original) => ({
  ...(await original<typeof Api>()),
  getApprovalAttachmentPolicy: (...args: Parameters<typeof Api.getApprovalAttachmentPolicy>) =>
    state.read(...args),
  saveApprovalAttachmentPolicyDraft: (
    ...args: Parameters<typeof Api.saveApprovalAttachmentPolicyDraft>
  ) => state.save(...args),
  publishApprovalAttachmentPolicy: (
    ...args: Parameters<typeof Api.publishApprovalAttachmentPolicy>
  ) => state.publish(...args),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canViewPolicies: state.canRead }),
  useApprovalManagementRequestScope: () => ({
    contextScopeKey: 'opaque-owner-scope',
    cacheKey: ['1', state.actor, 'NORMAL', 'approvals.admin', 'opaque-owner-scope', state.revision],
  }),
}));
vi.mock('./approval-management-scope', async (original) => ({
  ...(await original<typeof ManagementScope>()),
  useApprovalManagementScopeReady: () => state.ready,
}));
vi.mock('./approval-management-command-scope', async (original) => ({
  ...(await original<typeof ScopeHooks>()),
  useApprovalManagementHighRiskCommand: (options: High) => {
    state.high = options;
    return { begin: state.begin, controller: { busy: false } };
  },
}));
const rules = (): ApprovalAttachmentRules => ({
  allowUpload: false,
  allowDownload: false,
  maxFileBytes: 10_485_760,
  maxFiles: 5,
  maxRequestBytes: 52_428_800,
  maxConcurrentUploads: 1,
  allowedMediaTypes: ['application/pdf', 'text/plain'],
  grantTtlSeconds: 300,
  retentionDays: 365,
});
const policy = (): ApprovalAttachmentPolicy => ({
  policyId: '11111111-1111-4111-8111-111111111111',
  resourceSetKey: 'RS_APPROVAL_FINANCE',
  version: 4,
  published: rules(),
  pending: { ...rules(), maxFiles: 6 },
  providerReadiness: 'NOT_CONFIGURED',
  publishedRevision: 1,
  pendingRevision: 2,
  pendingMakerUserId: 31,
  publishedRulesSha256: 'a'.repeat(64),
  pendingRulesSha256: 'b'.repeat(64),
  downloadReadiness: 'VERSIONING_VERIFIED',
  publishEligible: true,
  publishReason: 'ALLOWED',
});
const execution: ApprovalMutationExecution = {
  mode: 'SECURE',
  rolloutState: '111',
  contextKey: 'ctx-admin',
  contextScopeKey: 'opaque-owner-scope',
  expectedDecisionRevision: 'revision-a',
};
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let view: ReturnType<typeof useApprovalAdminAttachmentPolicyController>;
const queryKey = () => [
  'approvals',
  'admin',
  'attachment-policy',
  '1',
  state.actor,
  'NORMAL',
  'approvals.admin',
  'opaque-owner-scope',
  state.revision,
];
function Harness() {
  view = useApprovalAdminAttachmentPolicyController();
  return null;
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
async function load() {
  await settle(render);
  await settle();
}
describe('attachment policy source guards and independent publication', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.ready = true;
    state.writable = true;
    state.canRead = true;
    state.actor = '13';
    state.revision = 'revision-a';
    state.sent = 0;
    // Explicit installed-registry unit model, never a browser/production activation substitute.
    const actual = await vi.importActual<typeof Generated>(
      '../../routes/product-surface-authorization.generated'
    );
    const template = actual.PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS[0]!;
    state.projections = Object.entries(APPROVAL_ATTACHMENT_POLICY_ROUTES).map(
      ([leaf, [method, path]]) => ({
        ...template,
        routeContractKey: `route.approvals.admin.${leaf}`,
        productId: 'approvals',
        surfaceId: 'approvals.admin',
        routeKind: method === 'GET' ? 'DATA' : 'ACTION',
        gatewayBindings: [{ method, path }],
      })
    );
    state.read.mockResolvedValue(policy());
    state.run.mockImplementation((execute) => execute(execution));
    state.save.mockImplementation(async (_id, _input, _execution, options) => {
      options?.beforeDispatch?.();
      options?.beforeDispatch?.();
      state.sent += 1;
      return { ...policy(), version: 5 };
    });
    state.publish.mockImplementation(async (_id, _input, _execution, options) => {
      options?.beforeDispatch?.();
      options?.beforeDispatch?.();
      state.sent += 1;
      return {
        ...policy(),
        version: 5,
        pending: null,
        pendingRevision: null,
        pendingMakerUserId: null,
        pendingRulesSha256: null,
        publishEligible: false,
        publishReason: 'PENDING_POLICY_REQUIRED',
      };
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });
  it('closed current registry has no GET, legacy fallback or mutation dispatch', async () => {
    state.projections = [];
    await load();
    await settle(() => {
      view.openEdit();
      view.openReview();
      view.saveDraft();
      view.publish('review');
    });
    expect(state.read).not.toHaveBeenCalled();
    expect(state.run).not.toHaveBeenCalled();
    expect(state.begin).not.toHaveBeenCalled();
    for (const leaf of Object.keys(APPROVAL_ATTACHMENT_POLICY_ROUTES) as Array<
      keyof typeof APPROVAL_ATTACHMENT_POLICY_ROUTES
    >)
      expect(approvalAttachmentPolicyRouteInstalled(leaf, [])).toBe(false);
    expect(actualProjections).toHaveLength(0);
  });
  it('exact installed binding rejects duplicate/wrong path/method/surface and honors opaque scope separately from RS', async () => {
    const projections = state.projections;
    for (const leaf of Object.keys(APPROVAL_ATTACHMENT_POLICY_ROUTES) as Array<
      keyof typeof APPROVAL_ATTACHMENT_POLICY_ROUTES
    >)
      expect(approvalAttachmentPolicyRouteInstalled(leaf, projections)).toBe(true);
    const route = projections[0]!;
    expect(approvalAttachmentPolicyRouteInstalled('attachment-policy.data', [route, route])).toBe(
      false
    );
    expect(
      approvalAttachmentPolicyRouteInstalled('attachment-policy.data', [
        { ...route, surfaceId: 'approvals.work' },
      ])
    ).toBe(false);
    expect(
      approvalAttachmentPolicyRouteInstalled('attachment-policy.data', [
        { ...route, gatewayBindings: [{ method: 'GET', path: '/wrong' }] },
      ])
    ).toBe(false);
    await load();
    expect(state.read).toHaveBeenCalledWith('opaque-owner-scope', expect.any(AbortSignal));
    expect(view.canEdit).toBe(true);
    expect(view.query.data?.resourceSetKey).toBe('RS_APPROVAL_FINANCE');
  });
  it('opens recorded pending values, preserves original CAS/hash and serializes double save', async () => {
    await load();
    await settle(view.openEdit);
    expect(view.draft?.input.rules.maxFiles).toBe(6);
    const key = view.draft!.input.idempotencyKey;
    await settle(() => view.changeRules({ ...view.draft!.input.rules, retentionDays: 730 }));
    await settle(() => {
      view.saveDraft();
      view.saveDraft();
    });
    await settle();
    expect(state.sent).toBe(1);
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(state.save.mock.calls[0]![1]).toMatchObject({
      expectedVersion: 4,
      idempotencyKey: key,
      rules: { retentionDays: 730 },
    });
    expect(Object.isFrozen(state.save.mock.calls[0]![1].rules.allowedMediaTypes)).toBe(true);
  });
  it.each([403, 503])(
    'first %s source failure closes writes without healing editor pins',
    async (status) => {
      await load();
      await settle(view.openEdit);
      const original = view.draft;
      state.read.mockRejectedValue(new HttpError('Unavailable', status));
      await settle(() => {
        void client.refetchQueries({ queryKey: queryKey(), exact: true });
      });
      await settle();
      expect(view.state).toBe(status === 403 ? 'DENIED' : 'STALE');
      expect(view.draft).toBe(original);
      await settle(view.saveDraft);
      expect(state.sent).toBe(0);
      expect(state.read).toHaveBeenCalledTimes(2);
      state.read.mockResolvedValue({ ...policy(), version: 5 });
      await settle(() => {
        void view.refresh();
      });
      await settle();
      expect(view.draftReady).toBe(false);
      await settle(view.saveDraft);
      expect(state.sent).toBe(0);
    }
  );
  it.each([
    { pendingRevision: 3 },
    { pendingRulesSha256: 'c'.repeat(64) },
    { pendingMakerUserId: 32 },
    { publishedRulesSha256: 'd'.repeat(64) },
    { resourceSetKey: 'RS_OTHER' },
    { version: 5 },
  ])('same-view material source changes never retarget an opened editor: %o', async (change) => {
    await load();
    await settle(view.openEdit);
    await settle(() => client.setQueryData(queryKey(), { ...policy(), ...change }));
    expect(view.draftReady).toBe(false);
    await settle(view.saveDraft);
    expect(state.sent).toBe(0);
  });
  it('scope A-B-A and actor changes invalidate source even after the old query returns', async () => {
    await load();
    await settle(view.openEdit);
    state.revision = 'revision-b';
    await settle(render);
    state.revision = 'revision-a';
    await settle(render);
    expect(view.draftReady).toBe(false);
    await settle(view.saveDraft);
    expect(state.sent).toBe(0);
    state.actor = '31';
    await settle(render);
    expect(view.canPublish).toBe(false);
  });
  it('source or permission revocation during async CSRF results in pre-send HTTP0', async () => {
    await load();
    await settle(view.openEdit);
    state.save.mockImplementation(async (_id, _input, _execution, options) => {
      options?.beforeDispatch?.();
      state.writable = false;
      options?.beforeDispatch?.();
      state.sent += 1;
      return policy();
    });
    await settle(view.saveDraft);
    await settle();
    expect(state.sent).toBe(0);
    expect(view.feedback).toBe('CHANGED');
    expect(view.draft).not.toBeNull();
  });
  it('unknown committed response retains original private body/key through close/reopen and retries', async () => {
    await load();
    await settle(view.openEdit);
    const input = view.draft!.input;
    state.save.mockImplementationOnce(async (_id, _input, _execution, options) => {
      options?.beforeDispatch?.();
      options?.beforeDispatch?.();
      state.sent += 1;
      const { ApprovalAttachmentPolicyResponseError } =
        await import('@dwp-frontend/shared-utils/api/approval-attachment-policy-api');
      throw new ApprovalAttachmentPolicyResponseError(new Error('malformed response'));
    });
    await settle(view.saveDraft);
    await settle();
    expect(view.feedback).toBe('UNKNOWN');
    await settle(() => view.changeRules({ ...input.rules, maxFiles: 7 }));
    expect(view.draft!.input).toBe(input);
    await settle(view.closeEdit);
    expect(view.feedback).toBe('UNKNOWN');
    await settle(view.openEdit);
    expect(view.draft!.input.idempotencyKey).toBe(input.idempotencyKey);
    await settle(view.saveDraft);
    await settle();
    expect(state.save.mock.calls[1]![1]).toEqual(state.save.mock.calls[0]![1]);
    expect(state.save.mock.calls[1]![1].idempotencyKey).toBe(input.idempotencyKey);
  });
  it('pre-CSRF unavailable is not UNKNOWN and unmount before send discards HTTP/callbacks', async () => {
    await load();
    await settle(view.openEdit);
    state.save.mockImplementationOnce(async (_id, _input, _execution, options) => {
      options?.beforeDispatch?.();
      throw new HttpError('CSRF unavailable', 503);
    });
    await settle(view.saveDraft);
    await settle();
    expect(view.feedback).toBe('CHANGED');
    expect(state.sent).toBe(0);
    await settle(view.closeEdit);
    await settle(view.openEdit);
    let send: (() => void) | undefined;
    let resolve: ((value: ApprovalAttachmentPolicy) => void) | undefined;
    state.save.mockImplementationOnce(
      (_id, _input, _execution, options) =>
        new Promise((done) => {
          send = options?.beforeDispatch;
          resolve = done;
        })
    );
    await settle(view.saveDraft);
    await act(async () => root.unmount());
    expect(() => send?.()).toThrow();
    await act(async () => {
      resolve?.(policy());
    });
    expect(state.sent).toBe(0);
    expect(state.success).not.toHaveBeenCalled();
  });
  it('checker source and exact publish capability remain independent and private HIGH body is version pinned', async () => {
    await load();
    state.writable = false;
    await settle(render);
    expect(view.canPublish).toBe(false);
    state.writable = true;
    await settle(render);
    await settle(view.openReview);
    await settle(() => view.publish('independent review'));
    const command = state.begin.mock.calls[0]![0];
    expect(command.operation).toBe('ATTACHMENT_POLICY_PUBLISH');
    expect(command.commandPath).toBe(
      `/api/approvals/v1/admin/attachments/policies/${policy().policyId}/publish`
    );
    expect(command.payload).toEqual({
      expectedVersion: 4,
      idempotencyKey: command.idempotencyKey,
      reviewComment: 'independent review',
    });
    expect(Object.isFrozen(command.payload)).toBe(true);
    const secure = { ...execution, objectVersion: 4, idempotencyKey: command.idempotencyKey };
    await act(async () => {
      await state.high!.execute(command, secure);
    });
    expect(state.sent).toBe(1);
    await settle(() =>
      client.setQueryData(queryKey(), { ...policy(), pendingRulesSha256: 'e'.repeat(64) })
    );
    await expect(state.high!.execute(command, secure)).rejects.toThrow();
    expect(state.sent).toBe(1);
  });
  it('read-only/maker/unconfigured provider source never enables publish or invents READY', async () => {
    state.read.mockResolvedValue({
      ...policy(),
      pendingMakerUserId: 13,
      publishEligible: false,
      publishReason: 'MAKER_CANNOT_PUBLISH',
    });
    await load();
    expect(view.canPublish).toBe(false);
    await settle(view.openReview);
    expect(state.begin).not.toHaveBeenCalled();
    expect(view.query.data?.providerReadiness).toBe('NOT_CONFIGURED');
    expect(view.query.data?.downloadReadiness).toBe('VERSIONING_VERIFIED');
  });
  it('rejects fractional/overflow limits and fingerprints every owner source field', () => {
    expect(approvalAttachmentPolicyRulesValid(rules())).toBe(true);
    for (const change of [
      { maxFiles: 1.5 },
      { maxFileBytes: Number.MAX_SAFE_INTEGER },
      { maxRequestBytes: 1 },
      { allowedMediaTypes: [] },
      { grantTtlSeconds: 901 },
    ])
      expect(approvalAttachmentPolicyRulesValid({ ...rules(), ...change })).toBe(false);
    expect(approvalAttachmentPolicyFingerprint(policy())).not.toBe(
      approvalAttachmentPolicyFingerprint({ ...policy(), downloadReadiness: 'NOT_CONFIGURED' })
    );
  });
});
