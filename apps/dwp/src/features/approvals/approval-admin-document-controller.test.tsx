// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { ApprovalAdminDocumentController } from './approval-admin-document-controller';
import { ProductSurfaceMutationAuthorityError } from '../../components/use-product-surface-governed-mutation';
import type { ApprovalAdminDocumentPolicy } from './approval-admin-document-policy';
import type { ApprovalAdminDocumentHold } from './approval-admin-document-hold';
import type { ApprovalHighRiskCommandDescriptor } from './approval-high-risk-command-model';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as DocumentApi from '@dwp-frontend/shared-utils/api/approval-document-api';
import type * as ScopeHooks from './approval-management-scope';
import type * as CommandHooks from './approval-management-command-scope';
import type {
  ApprovalDocumentHold,
  ApprovalDocumentPolicy,
} from '@dwp-frontend/shared-utils/api/approval-document-contract';

type PolicyProps = Parameters<typeof ApprovalAdminDocumentPolicy>[0];
type HoldProps = Parameters<typeof ApprovalAdminDocumentHold>[0];
type HighRisk = {
  operation: string;
  execute: (
    command: ApprovalHighRiskCommandDescriptor,
    execution: ApprovalMutationExecution
  ) => Promise<unknown>;
};
const state = vi.hoisted(() => ({
  installed: true,
  ready: true,
  scope: {
    contextScopeKey: 'scope',
    cacheKey: ['1', '13', 'NORMAL', 'approvals.admin', 'scope', 'revision-a'],
  },
  experience: { canViewPolicies: true, canEditPolicies: true, canPublishPolicies: true },
  policyProps: null as PolicyProps | null,
  holdProps: null as HoldProps | null,
  high: new Map<string, HighRisk>(),
  begin: vi.fn<(command: ApprovalHighRiskCommandDescriptor) => void>(),
  close: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  readPolicy: vi.fn<(...args: unknown[]) => Promise<ApprovalDocumentPolicy>>(),
  readHold: vi.fn<(...args: unknown[]) => Promise<ApprovalDocumentHold>>(),
  save: vi.fn<(...args: unknown[]) => Promise<ApprovalDocumentPolicy>>(),
  propose: vi.fn<(...args: unknown[]) => Promise<ApprovalDocumentHold>>(),
  publishPolicy: vi.fn<(...args: unknown[]) => Promise<ApprovalDocumentPolicy>>(),
  publishHold: vi.fn<(...args: unknown[]) => Promise<ApprovalDocumentHold>>(),
  run: vi.fn<
    (execute: (execution: ApprovalMutationExecution) => Promise<unknown>) => Promise<unknown>
  >(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useToast: () => ({ success: state.success, error: state.error }),
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-document-api', async (original) => ({
  ...(await original<typeof DocumentApi>()),
  getApprovalDocumentPolicy: (...args: unknown[]) => state.readPolicy(...args),
  getApprovalDocumentHold: (...args: unknown[]) => state.readHold(...args),
  saveApprovalDocumentPolicy: (...args: unknown[]) => state.save(...args),
  proposeApprovalDocumentHold: (...args: unknown[]) => state.propose(...args),
  publishApprovalDocumentPolicy: (...args: unknown[]) => state.publishPolicy(...args),
  publishApprovalDocumentHold: (...args: unknown[]) => state.publishHold(...args),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => state.experience,
  useApprovalManagementRequestScope: () => state.scope,
}));
vi.mock('./approval-management-scope', async (original) => ({
  ...(await original<typeof ScopeHooks>()),
  useApprovalManagementScopeReady: () => state.ready,
}));
vi.mock('./use-approval-document-mutation', () => ({
  approvalDocumentActionInstalled: () => state.installed,
  useApprovalDocumentMutation: () => ({ available: state.installed, run: state.run }),
}));
vi.mock('./approval-management-command-scope', async (original) => ({
  ...(await original<typeof CommandHooks>()),
  useApprovalManagementHighRiskCommand: (options: HighRisk) => {
    state.high.set(options.operation, options);
    return { begin: state.begin, controller: { busy: false, close: state.close } };
  },
}));
vi.mock('./approval-high-risk-command-dialog', () => ({
  ApprovalHighRiskCommandDialog: () => null,
}));
vi.mock('./approval-admin-document-policy', () => ({
  ApprovalAdminDocumentPolicy: (props: PolicyProps) => {
    state.policyProps = props;
    return <div />;
  },
}));
vi.mock('./approval-admin-document-hold', () => ({
  ApprovalAdminDocumentHold: (props: HoldProps) => {
    state.holdProps = props;
    return <div />;
  },
}));

const policy: ApprovalDocumentPolicy = {
  policyId: '11111111-1111-1111-1111-111111111111',
  resourceSetKey: 'ALL',
  version: 2,
  published: {
    revision: 0,
    rules: {
      allowComments: true,
      allowPrint: false,
      allowJsonExport: false,
      allowArchiveExport: false,
      includeComments: false,
      includeEvidence: false,
      allowedClassifications: [],
      fields: [],
      maxBatchItems: 20,
      maxBytes: 1048576,
      snapshotTtlSeconds: 300,
      evidenceRetentionDays: 365,
    },
    sha256: 'a'.repeat(64),
    makerUserId: null,
    createdAt: '2026-09-14T00:00:00Z',
  },
  pending: null,
};
const hold: ApprovalDocumentHold = {
  requestId: '22222222-2222-2222-2222-222222222222',
  version: 3,
  active: false,
  pending: null,
  journal: [],
  purgeState: 'PURGE_WORKER_NOT_IMPLEMENTED',
  retainUntil: '2027-09-14T00:00:00Z',
  preservationPending: false,
  purgeEligible: false,
};
const execution: ApprovalMutationExecution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' };
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const render = () =>
  root.render(
    <QueryClientProvider client={client}>
      <ApprovalAdminDocumentController />
    </QueryClientProvider>
  );
const settle = async (callback: () => void = () => {}) => {
  await act(async () => {
    callback();
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
};
const loadHold = async () => {
  await settle(() => state.holdProps!.onInput(hold.requestId));
  await settle(() => state.holdProps!.onLookup());
  await settle();
};
const policyKey = () => ['approvals', 'admin', 'document-policy', ...state.scope.cacheKey];

describe('document admin controller source fencing', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.high.clear();
    state.installed = true;
    state.ready = true;
    state.scope.cacheKey = ['1', '13', 'NORMAL', 'approvals.admin', 'scope', 'revision-a'];
    state.scope.contextScopeKey = 'scope';
    state.experience = { canViewPolicies: true, canEditPolicies: true, canPublishPolicies: true };
    state.policyProps = null;
    state.holdProps = null;
    state.readPolicy.mockResolvedValue(policy);
    state.readHold.mockResolvedValue(hold);
    state.save.mockResolvedValue({ ...policy, version: 3 });
    state.publishPolicy.mockResolvedValue({ ...policy, version: 3 });
    state.publishHold.mockResolvedValue({ ...hold, version: 4, active: true });
    state.propose.mockResolvedValue({
      ...hold,
      version: 4,
      preservationPending: true,
      pending: {
        proposalId: '33333333-3333-3333-3333-333333333333',
        operation: 'PLACE',
        reason: 'Preserve this approval evidence',
        makerUserId: 13,
        createdAt: '2026-09-14T00:00:00Z',
      },
    });
    state.run.mockImplementation((execute) => execute(execution));
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await settle(render);
    await settle();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });

  it('missing exact installation leaves all handlers read-only and sends HTTP 0', async () => {
    state.installed = false;
    await settle(render);
    expect(state.policyProps!.canEdit).toBe(false);
    await settle(() => {
      state.policyProps!.onEdit();
      state.policyProps!.onSave();
    });
    await loadHold();
    expect(state.holdProps!.canEdit).toBe(false);
    expect(state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3)).toBe(false);
    expect(state.run).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
    expect(state.propose).not.toHaveBeenCalled();
  });
  it('pins version and original key, and coalesces same-tick duplicate save', async () => {
    await settle(() => state.policyProps!.onEdit());
    const draft = state.policyProps!.draft!;
    await settle(() => {
      state.policyProps!.onSave();
      state.policyProps!.onSave();
    });
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(state.save).toHaveBeenCalledWith(
      policy.policyId,
      { expectedVersion: 2, idempotencyKey: draft.idempotencyKey, rules: draft.rules },
      execution
    );
    expect(state.success).toHaveBeenCalledWith('admin.document.saved');
  });
  it('preserves editor inputs but rejects old base version without running authority', async () => {
    await settle(() => state.policyProps!.onEdit());
    const draft = state.policyProps!.draft!;
    await settle(() => client.setQueryData(policyKey(), { ...policy, version: 3 }));
    expect(state.policyProps!.draft).toEqual(draft);
    expect(state.policyProps!.draftReady).toBe(false);
    await settle(() => {
      state.policyProps!.onChange({ ...draft.rules, allowComments: false });
      state.policyProps!.onSave();
    });
    expect(state.policyProps!.draft).toEqual(draft);
    expect(state.run).not.toHaveBeenCalled();
    expect(state.save).not.toHaveBeenCalled();
  });
  it('rechecks the latest version after asynchronous authority resolution before HTTP', async () => {
    let release: (() => void) | undefined;
    state.run.mockImplementation(async (execute) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return execute(execution);
    });
    await settle(() => state.policyProps!.onEdit());
    await settle(() => state.policyProps!.onSave());
    await settle(() => client.setQueryData(policyKey(), { ...policy, version: 9 }));
    await settle(() => release!());
    expect(state.save).not.toHaveBeenCalled();
    expect(state.success).not.toHaveBeenCalled();
  });
  it('does not retry an uncertain result, keeps the draft and forbids a new save', async () => {
    state.save.mockRejectedValue(new HttpError('Unknown result', 503));
    await settle(() => state.policyProps!.onEdit());
    const draft = state.policyProps!.draft!;
    await settle(() => state.policyProps!.onSave());
    expect(state.policyProps!.draft).toEqual(draft);
    expect(state.policyProps!.draftReady).toBe(false);
    await settle(() => state.policyProps!.onSave());
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(state.success).not.toHaveBeenCalled();
  });
  it('pre-dispatch policy authority denial is HTTP 0, not an uncertain command result', async () => {
    state.run.mockRejectedValue(new ProductSurfaceMutationAuthorityError());
    await settle(() => state.policyProps!.onEdit());
    const draft = state.policyProps!.draft!;
    await settle(() => state.policyProps!.onSave());
    expect(state.save).not.toHaveBeenCalled();
    expect(state.policyProps!.draft).toEqual(draft);
    expect(state.policyProps!.canEdit).toBe(false);
    expect(container.textContent).not.toContain('admin.document.commandUnknown');
    await settle(() => state.policyProps!.onSave());
    expect(state.run).toHaveBeenCalledTimes(1);
    await settle(() => state.policyProps!.onRefresh());
    await settle();
    expect(state.policyProps!.canEdit).toBe(true);
    expect(state.save).not.toHaveBeenCalled();
  });
  it('pre-dispatch hold authority denial preserves the proposal without claiming dispatch', async () => {
    state.run.mockRejectedValue(new ProductSurfaceMutationAuthorityError());
    await loadHold();
    await settle(() => state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3));
    expect(state.propose).not.toHaveBeenCalled();
    expect(state.holdProps!.completedProposals).toBe(0);
    expect(state.holdProps!.canEdit).toBe(false);
    expect(container.textContent).not.toContain('admin.document.commandUnknown');
    expect(state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3)).toBe(false);
    expect(state.run).toHaveBeenCalledTimes(1);
    await settle(() => state.holdProps!.onRefresh());
    await settle();
    expect(state.holdProps!.canEdit).toBe(true);
    expect(state.propose).not.toHaveBeenCalled();
  });
  it.each([403, 409])(
    'a first %s write failure closes cached actions until an explicit valid source read',
    async (status) => {
      state.save.mockRejectedValue(new HttpError('Source changed', status));
      await settle(() => state.policyProps!.onEdit());
      const draft = state.policyProps!.draft!;
      await settle(() => state.policyProps!.onSave());
      expect(state.policyProps!.draft).toEqual(draft);
      expect(state.policyProps!.canEdit).toBe(false);
      await settle(() => state.policyProps!.onSave());
      expect(state.save).toHaveBeenCalledTimes(1);
      state.readPolicy.mockResolvedValue({ ...policy, version: 3 });
      await settle(() => state.policyProps!.onRefresh());
      await settle();
      expect(state.policyProps!.canEdit).toBe(true);
      expect(state.policyProps!.draftReady).toBe(false);
      expect(state.policyProps!.draft).toEqual(draft);
      await settle(() => state.policyProps!.onSave());
      expect(state.save).toHaveBeenCalledTimes(1);
    }
  );
  it('deduplicates proposal, closes only after valid success, and refreshes identical request lookup', async () => {
    await loadHold();
    await settle(() => {
      state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3);
      state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3);
    });
    expect(state.propose).toHaveBeenCalledTimes(1);
    expect(state.holdProps!.completedProposals).toBe(1);
    const reads = state.readHold.mock.calls.length;
    await settle(() => state.holdProps!.onLookup());
    expect(state.readHold.mock.calls.length).toBe(reads + 1);
  });
  it('rejects malformed or uncertain hold results without completion or a second proposal', async () => {
    state.propose.mockRejectedValue(new HttpError('Unknown result', 503));
    await loadHold();
    await settle(() => state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3));
    expect(state.holdProps!.completedProposals).toBe(0);
    expect(state.holdProps!.canEdit).toBe(false);
    expect(state.holdProps!.onPropose('PLACE', 'Preserve this approval evidence', 3)).toBe(false);
    expect(state.propose).toHaveBeenCalledTimes(1);
    expect(state.success).not.toHaveBeenCalled();
  });
  it('uses exact HIGH policy target and flat payload, and blocks maker self-publish', async () => {
    const pending = { ...policy.published, revision: 1, makerUserId: 12, sha256: 'b'.repeat(64) };
    await settle(() => client.setQueryData(policyKey(), { ...policy, pending }));
    expect(state.policyProps!.onPublish('Independently reviewed policy', 2, pending.sha256)).toBe(
      true
    );
    const descriptor = state.begin.mock.calls[0][0];
    expect(descriptor).toMatchObject({
      operation: 'DOCUMENT_POLICY_PUBLISH',
      targetType: 'DOCUMENT_POLICY',
      targetId: policy.policyId,
      commandPath: `/api/approvals/v1/admin/document-tools/policies/${policy.policyId}/publish`,
      expectedObjectVersion: 2,
      idempotencyPayloadPath: 'ROOT',
    });
    expect(descriptor.payload).toEqual({
      expectedVersion: 2,
      reviewComment: 'Independently reviewed policy',
      idempotencyKey: descriptor.idempotencyKey,
    });
    const high = state.high.get('DOCUMENT_POLICY_PUBLISH')!;
    await expect(high.execute(descriptor, execution)).rejects.toThrow();
    expect(state.publishPolicy).not.toHaveBeenCalled();
    await settle(() =>
      client.setQueryData(policyKey(), { ...policy, pending: { ...pending, makerUserId: 13 } })
    );
    expect(state.policyProps!.makerBlocked).toBe(true);
    expect(state.policyProps!.onPublish('Independently reviewed policy', 2, pending.sha256)).toBe(
      false
    );
  });
  it('denied read and changed identity never retain a writable document source', async () => {
    state.readHold.mockRejectedValue(new HttpError('Forbidden', 403));
    await loadHold();
    expect(state.holdProps!.hold).toBeUndefined();
    expect(state.holdProps!.canEdit).toBe(false);
    expect(state.readHold).toHaveBeenCalledTimes(1);
    await settle(() => state.policyProps!.onEdit());
    state.scope.cacheKey = ['1', '14', 'NORMAL', 'approvals.admin', 'new-scope', 'revision-b'];
    state.scope.contextScopeKey = 'new-scope';
    await settle(render);
    await settle();
    expect(state.policyProps!.draft).toBeNull();
    expect(state.holdProps!.selectedId).toBeNull();
  });
  it('secure policy publication pins the private proposal hash without adding counterfeit body fields', async () => {
    const pending = { ...policy.published, revision: 1, makerUserId: 12, sha256: 'b'.repeat(64) };
    await settle(() => client.setQueryData(policyKey(), { ...policy, pending }));
    state.policyProps!.onPublish('Independently reviewed policy', 2, pending.sha256);
    const command = state.begin.mock.calls[0][0];
    const secure: ApprovalMutationExecution = {
      mode: 'SECURE',
      rolloutState: '111',
      expectedDecisionRevision: 'revision-a',
      contextKey: 'admin',
      contextScopeKey: 'scope',
      objectVersion: 2,
      idempotencyKey: command.idempotencyKey,
      stepUp: {
        challenge: 'signed-proof',
        challengeId: 'jti',
        decisionRevision: 'revision-a',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
    await state.high.get('DOCUMENT_POLICY_PUBLISH')!.execute(command, secure);
    expect(state.publishPolicy).toHaveBeenCalledWith(policy.policyId, command.payload, secure);
    await settle(() =>
      client.setQueryData(policyKey(), {
        ...policy,
        pending: { ...pending, sha256: 'c'.repeat(64) },
      })
    );
    await expect(
      state.high.get('DOCUMENT_POLICY_PUBLISH')!.execute(command, secure)
    ).rejects.toThrow();
    expect(state.publishPolicy).toHaveBeenCalledTimes(1);
  });
  it('hold publication uses its own exact HIGH target and pins proposal identity independently', async () => {
    const pending = {
      proposalId: '33333333-3333-3333-3333-333333333333',
      operation: 'PLACE' as const,
      reason: 'Preserve this approval evidence',
      makerUserId: 12,
      createdAt: '2026-09-14T00:00:00Z',
    };
    state.readHold.mockResolvedValue({ ...hold, pending, preservationPending: true });
    await loadHold();
    expect(
      state.holdProps!.onPublish('Independent preservation review', 3, pending.proposalId)
    ).toBe(true);
    const command = state.begin.mock.calls[0][0];
    expect(command).toMatchObject({
      operation: 'DOCUMENT_HOLD_PUBLISH',
      targetType: 'DOCUMENT_HOLD',
      targetId: hold.requestId,
      expectedObjectVersion: 3,
      idempotencyPayloadPath: 'ROOT',
    });
    expect(command.payload).toEqual({
      expectedVersion: 3,
      proposalId: pending.proposalId,
      reviewComment: 'Independent preservation review',
      idempotencyKey: command.idempotencyKey,
    });
    const high = state.high.get('DOCUMENT_HOLD_PUBLISH')!;
    await expect(high.execute(command, execution)).rejects.toThrow();
    expect(state.publishHold).not.toHaveBeenCalled();
    await settle(() =>
      client.setQueryData(
        ['approvals', 'admin', 'document-hold', hold.requestId, ...state.scope.cacheKey],
        { ...hold, pending: { ...pending, makerUserId: 13 }, preservationPending: true }
      )
    );
    expect(
      state.holdProps!.onPublish('Independent preservation review', 3, pending.proposalId)
    ).toBe(false);
  });
});
