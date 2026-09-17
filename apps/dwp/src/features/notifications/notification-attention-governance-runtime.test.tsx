// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationAttentionGovernanceStudioProps } from './notification-attention-governance-studio';
import type {
  NotificationAttentionGovernanceRevision,
  NotificationAttentionGovernanceWorkspace,
} from '@dwp-frontend/shared-utils/api/notification-attention-governance-api';

const runtime = vi.hoisted(() => ({
  actorUserId: 100,
  authenticated: true,
  permissionsLoaded: true,
  permissions: new Set(['VIEW', 'MANAGE', 'APPROVE']),
  studioProps: null as NotificationAttentionGovernanceStudioProps | null,
  get: vi.fn(),
  create: vi.fn(),
  publish: vi.fn(),
  reject: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  useAuth: () => ({
    isAuthenticated: runtime.authenticated,
    isLoading: false,
    user: runtime.authenticated ? { userId: runtime.actorUserId } : null,
  }),
  usePermissions: () => ({
    isLoaded: runtime.permissionsLoaded,
    hasPermission: (resourceKey: string, permissionCode: string) =>
      resourceKey === 'ADMIN.NOTIFICATION_POLICY' && runtime.permissions.has(permissionCode),
  }),
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-api', () => ({
  createNotificationIdempotencyKey: (scope: string) => `${scope}:test-command`,
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-attention-governance-api', () => ({
  getNotificationAttentionGovernance: runtime.get,
  createNotificationAttentionGovernanceDraft: runtime.create,
  publishNotificationAttentionGovernance: runtime.publish,
  rejectNotificationAttentionGovernance: runtime.reject,
  withdrawNotificationAttentionGovernance: runtime.withdraw,
}));

vi.mock('./notification-attention-governance-studio', () => ({
  NotificationAttentionGovernanceStudio: (props: NotificationAttentionGovernanceStudioProps) => {
    runtime.studioProps = props;
    return createElement('div', {
      'data-testid': 'governance-probe',
      'data-status': props.status,
    });
  },
}));

import { NotificationAttentionGovernanceRuntime } from './notification-attention-governance-runtime';

const revision: NotificationAttentionGovernanceRevision = {
  governanceId: '10000000-0000-4000-8000-000000000001',
  state: 'DRAFT',
  settings: {
    maxActiveUserRules: 30,
    maxVipRules: 8,
    maxFollowRules: 20,
    approvedTopicAllowlist: ['#sec-soc-alert'],
    mandatoryPolicyPrecedence: true,
    minimumAnalyticsCohort: 25,
    independentReviewerRequired: true,
  },
  revisionNumber: 3,
  version: '7',
  changeReason: 'Protect high-signal tenant attention rules',
  createdBy: 200,
  createdAt: '2026-09-17T00:00:00Z',
  updatedBy: 200,
  updatedAt: '2026-09-17T00:00:00Z',
};

const workspace: NotificationAttentionGovernanceWorkspace = {
  activeRevision: null,
  drafts: [revision],
  changeVersion: '7',
  generatedAt: '2026-09-17T00:00:00Z',
};

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function renderRuntime() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(NotificationAttentionGovernanceRuntime)
      )
    );
  });
}

async function readyProps() {
  await vi.waitFor(() => expect(runtime.studioProps?.status).toBe('READY'));
  return runtime.studioProps as NotificationAttentionGovernanceStudioProps;
}

describe('NotificationAttentionGovernanceRuntime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.actorUserId = 100;
    runtime.authenticated = true;
    runtime.permissionsLoaded = true;
    runtime.permissions = new Set(['VIEW', 'MANAGE', 'APPROVE']);
    runtime.studioProps = null;
    runtime.get.mockReset().mockResolvedValue(workspace);
    runtime.create.mockReset().mockResolvedValue(revision);
    runtime.publish.mockReset().mockResolvedValue({ ...revision, state: 'PUBLISHED' });
    runtime.reject.mockReset().mockResolvedValue({ ...revision, state: 'REJECTED' });
    runtime.withdraw.mockReset().mockResolvedValue({ ...revision, state: 'WITHDRAWN' });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('binds the verified actor and exact VIEW, MANAGE, and APPROVE permissions', async () => {
    await renderRuntime();
    const props = await readyProps();

    expect(runtime.get).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(props.actorUserId).toBe(100);
    expect(props.canManage).toBe(true);
    expect(props.canApprove).toBe(true);
    expect(props.workspace).toEqual(workspace);
  });

  it('adds a unique command key and invalidates canonical queries for every mutation', async () => {
    await renderRuntime();
    let props = await readyProps();

    await act(async () => {
      await props.onCreateDraft({
        settings: revision.settings,
        changeReason: revision.changeReason,
        expectedVersion: workspace.changeVersion,
      });
    });
    props = await readyProps();
    await act(async () => {
      await props.onPublish(revision.governanceId, {
        expectedVersion: revision.version,
        reason: 'Independent review completed for publication',
      });
      await props.onReject(revision.governanceId, {
        expectedVersion: revision.version,
        reason: 'Independent review requires policy revision',
      });
      await props.onWithdraw(revision.governanceId, {
        expectedVersion: revision.version,
        reason: 'The author will revise the operating limits',
      });
    });

    expect(runtime.create).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'attention-governance-draft:test-command' })
    );
    expect(runtime.publish).toHaveBeenCalledWith(
      revision.governanceId,
      expect.objectContaining({ idempotencyKey: 'attention-governance-publish:test-command' })
    );
    expect(runtime.reject).toHaveBeenCalledWith(
      revision.governanceId,
      expect.objectContaining({ idempotencyKey: 'attention-governance-reject:test-command' })
    );
    expect(runtime.withdraw).toHaveBeenCalledWith(
      revision.governanceId,
      expect.objectContaining({ idempotencyKey: 'attention-governance-withdraw:test-command' })
    );
    expect(runtime.get.mock.calls.length).toBeGreaterThan(1);
  });

  it('fails closed without read authority and never dispatches the workspace request', async () => {
    runtime.permissions = new Set();
    await renderRuntime();
    await vi.waitFor(() => expect(runtime.studioProps?.status).toBe('ERROR'));

    expect(runtime.get).not.toHaveBeenCalled();
    expect(runtime.studioProps?.canManage).toBe(false);
    expect(runtime.studioProps?.canApprove).toBe(false);
    expect(runtime.studioProps?.errorMessage).toBe(
      'admin.attentionGovernance.viewPermissionBlocked'
    );
  });

  it('classifies a stale command and reloads the server-authoritative workspace', async () => {
    runtime.publish.mockRejectedValueOnce({ status: 409 });
    await renderRuntime();
    const props = await readyProps();

    await expect(
      props.onPublish(revision.governanceId, {
        expectedVersion: revision.version,
        reason: 'Independent review completed for publication',
      })
    ).rejects.toMatchObject({ status: 409 });
    await vi.waitFor(() => expect(runtime.get.mock.calls.length).toBeGreaterThan(1));
    expect(props.resolveMutationError?.({ status: 409 })).toBe(
      'admin.attentionGovernance.staleMutation'
    );
  });
});
