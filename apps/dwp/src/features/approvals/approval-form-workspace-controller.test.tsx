// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, ApprovalFormWorkspaceResponseError } from '@dwp-frontend/shared-utils';
import {
  useApprovalFormWorkspaceController,
  approvalFormWorkspaceRouteInstalled,
  APPROVAL_FORM_WORKSPACE_ROUTE_BINDINGS,
} from './approval-form-workspace-controller';
import {
  approvalFormWorkingDraftEditor,
  approvalFormWorkingDraftInput,
} from './approval-form-workspace-model';
import {
  workspaceFixture,
  reviewFixture,
  diffFixture,
  formId,
  publishedId,
} from './approval-form-workspace.test-support';
import type * as Shared from '@dwp-frontend/shared-utils';
import type * as Commands from './approval-management-command-scope';
import type { ProductAuthorizationRouteProjection } from '../../routes/product-surface-authorization.generated';
import type {
  ApprovalMutationExecution,
  ApprovalFormWorkspace,
  ApprovalFormReviewedPublishInput,
  ApprovalFormWorkspaceCommandOptions,
} from '@dwp-frontend/shared-utils';
import type { ApprovalHighRiskCommandDescriptor } from './approval-high-risk-command-model';

type Controller = ReturnType<typeof useApprovalFormWorkspaceController>;
type Props = Parameters<typeof useApprovalFormWorkspaceController>[0];
type High = {
  operation: string;
  execute: (
    command: ApprovalHighRiskCommandDescriptor,
    execution: ApprovalMutationExecution
  ) => Promise<ApprovalFormWorkspace>;
};
const state = vi.hoisted(() => ({
  projections: [] as ProductAuthorizationRouteProjection[],
  read: vi.fn<(...args: unknown[]) => Promise<ApprovalFormWorkspace>>(),
  history: vi.fn(),
  version: vi.fn(),
  diff: vi.fn(),
  review: vi.fn(),
  update: vi.fn(),
  branch: vi.fn(),
  retire: vi.fn(),
  reinstate: vi.fn(),
  rejectReview: vi.fn(),
  publish: vi.fn(),
  success: vi.fn(),
  changed: vi.fn(),
  begin: vi.fn(),
  close: vi.fn(),
  high: null as High | null,
  dispatch:
    vi.fn<
      (
        run: (execution: ApprovalMutationExecution) => Promise<ApprovalFormWorkspace>
      ) => Promise<ApprovalFormWorkspace>
    >(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../routes/product-surface-authorization.generated', () => ({
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS: state.projections,
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useToast: () => ({ success: state.success }),
  useProductSurfaceAuthority: () => ({ snapshot: null }),
  getApprovalFormWorkspace: (...args: unknown[]) => state.read(...args),
  getApprovalFormWorkspaceHistory: (...args: unknown[]) => state.history(...args),
  getApprovalFormWorkspaceVersion: (...args: unknown[]) => state.version(...args),
  getApprovalFormWorkspaceDiff: (...args: unknown[]) => state.diff(...args),
  getApprovalFormWorkspacePublishReview: (...args: unknown[]) => state.review(...args),
  updateApprovalFormWorkingDraft: (...args: unknown[]) => state.update(...args),
  branchApprovalFormWorkspaceVersion: (...args: unknown[]) => state.branch(...args),
  retireApprovalFormWorkspace: (...args: unknown[]) => state.retire(...args),
  reinstateApprovalFormWorkspace: (...args: unknown[]) => state.reinstate(...args),
  rejectApprovalFormPublishReview: (...args: unknown[]) => state.rejectReview(...args),
  publishReviewedApprovalFormWorkspace: (...args: unknown[]) => state.publish(...args),
}));
vi.mock('../../components/use-product-surface-governed-mutation', () => ({
  useProductSurfaceGovernedMutation: () => state.dispatch,
}));
vi.mock('./approval-form-schema-validation', () => ({
  useApprovalFormSchemaValidation: () => ({ compiled: undefined }),
}));
vi.mock('./approval-management-command-scope', async (original) => ({
  ...(await original<typeof Commands>()),
  useApprovalManagementHighRiskCommand: (options: High) => {
    state.high = options;
    return { begin: state.begin, controller: { busy: false, close: state.close } };
  },
}));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let props: Props;
let latest: Controller;
let mounted: boolean;
const execution: ApprovalMutationExecution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' };
const dispatchChecks = (options: ApprovalFormWorkspaceCommandOptions) => {
  options.beforeDispatch?.();
  options.beforeDispatch?.();
};
const parentKey = ['actual-parent', 'source'] as const;
const scope = () => props.requestScope.cacheKey;
const headKey = () => ['approvals', 'admin', 'form-workspace', props.formId, ...scope(), 'head'];
const historyKey = () => [
  'approvals',
  'admin',
  'form-workspace',
  props.formId,
  ...scope(),
  'history',
];
const diffKey = () => [
  'approvals',
  'admin',
  'form-workspace',
  props.formId,
  ...scope(),
  'diff',
  publishedId,
  workspaceFixture().workingDraft!.formVersionId,
];
function Harness() {
  latest = useApprovalFormWorkspaceController(props);
  return null;
}
const render = () =>
  root.render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
const settle = async (callback: () => void = () => {}) => {
  await act(async () => {
    callback();
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
};
const input = () => {
  const original = latest.editorOriginal!;
  const draft = approvalFormWorkingDraftEditor(original.workspace, 'EXPENSE')!;
  return approvalFormWorkingDraftInput(original, { ...draft, nameEn: 'Private edited name' });
};
async function edit() {
  await settle(() => {
    latest.openEditor();
  });
}
async function review() {
  await settle(() => latest.openReview());
  await settle();
  expect(latest.reviewReady).toBe(true);
}
function install() {
  state.projections.splice(0);
  for (const [leaf, [method, path]] of Object.entries(APPROVAL_FORM_WORKSPACE_ROUTE_BINDINGS)) {
    state.projections.push({
      routeContractKey: `route.approvals.admin.${leaf}`,
      routeKind: method === 'GET' ? 'DATA' : 'ACTION',
      navigationContextId: 'approvals.admin',
      subjectType: 'PRODUCT',
      productId: 'approvals',
      surfaceId: 'approvals.admin',
      routeId: null,
      pattern: null,
      gatewayBindings: [{ method, path }],
    });
  }
}
describe('form workspace controller exact installation and source fencing', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    install();
    state.high = null;
    const workspace = workspaceFixture();
    state.read.mockResolvedValue(workspace);
    state.history.mockResolvedValue({
      versions: [workspace.workingDraft, workspace.published],
      mayBeTruncated: false,
    });
    state.version.mockResolvedValue(workspace.published);
    state.diff.mockResolvedValue(diffFixture());
    state.review.mockResolvedValue(reviewFixture());
    const success = { ...workspace, formRevision: 5, workspaceRevision: 3 };
    for (const command of [state.update, state.retire, state.reinstate]) {
      command.mockImplementation(
        async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
          dispatchChecks(options);
          return success;
        }
      );
    }
    state.branch.mockImplementation(
      async (_id, _sourceId, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        dispatchChecks(options);
        return success;
      }
    );
    state.publish.mockImplementation(
      async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        dispatchChecks(options);
        return success;
      }
    );
    state.rejectReview.mockImplementation(
      async (
        _formId,
        _requestId,
        body,
        _execution,
        options: ApprovalFormWorkspaceCommandOptions
      ) => {
        dispatchChecks(options);
        return {
          ...reviewFixture().reviewRequest,
          status: 'REJECTED',
          version: 1,
          decidedAt: '2026-09-14T00:10:00Z',
          decidedBy: 32,
          decisionReason: body.reason,
        };
      }
    );
    state.dispatch.mockImplementation((run) => run(execution));
    props = {
      formId,
      requestScope: {
        contextScopeKey: 'actual-original-scope',
        cacheKey: ['1', '32', 'NORMAL', 'approvals.admin', 'actual-original-scope', 'revision-a'],
      },
      scopeReady: true,
      parentReady: true,
      parentQueryKeys: [parentKey],
      canEdit: true,
      canPublish: true,
      onChanged: state.changed,
    };
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(parentKey, { version: 1, actualSelectedResourceSet: 'ALL' });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = true;
    await settle(render);
    await settle();
    expect(latest.ready).toBe(true);
  });
  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    client.clear();
    container.remove();
  });

  it('absent/wrong/duplicate exact routes default closed without legacy fallback', async () => {
    const route = state.projections.find((item) =>
      item.routeContractKey.endsWith('form-working-draft.data')
    )!;
    expect(approvalFormWorkspaceRouteInstalled('form-working-draft.data', [route, route])).toBe(
      false
    );
    expect(
      approvalFormWorkspaceRouteInstalled('form-working-draft.data', [
        { ...route, gatewayBindings: [{ method: 'GET', path: '/wrong' }] },
      ])
    ).toBe(false);
    state.projections.splice(0);
    await settle(render);
    expect(latest.installed).toBe(false);
    expect(latest.updateReady).toBe(false);
    await settle(() => {
      latest.openEditor();
      latest.openReview();
      latest.openBranch();
      latest.openAvailability();
    });
    expect(state.dispatch).not.toHaveBeenCalled();
    expect(state.begin).not.toHaveBeenCalled();
  });
  it('coalesces rapid save and captures original form/workspace CAS and private schema', async () => {
    await edit();
    const body = input();
    await settle(() => {
      latest.save(body);
      latest.save(body);
    });
    await settle();
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.update.mock.calls[0][1]).toMatchObject({
      expectedFormRevision: 4,
      expectedWorkspaceRevision: 2,
      draftFormVersionId: workspaceFixture().workingDraft!.formVersionId,
    });
    expect(Object.isFrozen(state.update.mock.calls[0][1].schema)).toBe(true);
    expect(state.changed).toHaveBeenCalledWith(formId);
  });
  it.each([403, 503])(
    'first %s masks or makes source read-only, preserving original editor input and POST0',
    async (status) => {
      await edit();
      const body = input();
      state.read.mockRejectedValue(new HttpError('Unavailable', status));
      await settle(() => {
        void latest.workspace.refetch();
      });
      await settle();
      expect(latest.state).toBe(status === 403 ? 'DENIED' : 'STALE');
      expect(latest.editorCurrent).toBe(false);
      expect(latest.editorOriginal!.workspace.workingDraft!.metadata.nameEn).toBe(
        'Working request'
      );
      await settle(() => latest.save(body));
      expect(state.update).not.toHaveBeenCalled();
    }
  );
  it('fresh version/material changes do not heal an editor-start snapshot', async () => {
    await edit();
    const body = input();
    await settle(() => client.setQueryData(headKey(), { ...workspaceFixture(), formRevision: 5 }));
    expect(latest.editorCurrent).toBe(false);
    await settle(() => latest.save(body));
    expect(state.dispatch).not.toHaveBeenCalled();
  });
  it('rechecks live query cache after async authority before HTTP dispatch', async () => {
    await edit();
    const body = input();
    const authority = deferred<void>();
    state.dispatch.mockImplementation(async (run) => {
      await authority.promise;
      return run(execution);
    });
    await settle(() => latest.save(body));
    await settle(() => {
      client.setQueryData(parentKey, { version: 1, actualSelectedResourceSet: 'OTHER' });
      authority.resolve();
    });
    expect(state.update).not.toHaveBeenCalled();
    expect(latest.unknown).toBe(false);
  });
  it('rechecks cache after CSRF without using closure readiness as permission', async () => {
    await edit();
    const body = input();
    const csrf = deferred<void>();
    let sent = 0;
    state.update.mockImplementation(
      async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        options.beforeDispatch?.();
        await csrf.promise;
        options.beforeDispatch?.();
        sent += 1;
        return workspaceFixture();
      }
    );
    await settle(() => latest.save(body));
    await settle(() => {
      client.setQueryData(headKey(), { ...workspaceFixture(), workspaceRevision: 3 });
      csrf.resolve();
    });
    expect(sent).toBe(0);
    expect(latest.unknown).toBe(false);
  });
  it('keeps successful-unverifiable UNKNOWN retries on the same original key and private body', async () => {
    await edit();
    const body = input();
    state.update.mockImplementationOnce(
      async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        dispatchChecks(options);
        throw new ApprovalFormWorkspaceResponseError(new Error('Invalid response'));
      }
    );
    await settle(() => latest.save(body));
    expect(latest.unknown).toBe(true);
    const first = state.update.mock.calls[0];
    await settle(() => latest.retryOriginal());
    await settle();
    expect(state.update).toHaveBeenCalledTimes(2);
    expect(state.update.mock.calls[1][1]).toBe(first[1]);
    expect(state.update.mock.calls[1][3].idempotencyKey).toBe(first[3].idempotencyKey);
  });
  it('does not allow UNKNOWN to mint a replacement key after source changes', async () => {
    await edit();
    const body = input();
    state.update.mockImplementationOnce(
      async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        dispatchChecks(options);
        throw new ApprovalFormWorkspaceResponseError(new Error('Invalid response'));
      }
    );
    await settle(() => latest.save(body));
    await settle(() => client.setQueryData(headKey(), { ...workspaceFixture(), formRevision: 5 }));
    await settle(() => latest.retryOriginal());
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(latest.unknown).toBe(true);
  });
  it('CSRF failure before the second transport check is HTTP0, not an unknown document result', async () => {
    await edit();
    const body = input();
    state.update.mockImplementationOnce(
      async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        options.beforeDispatch?.();
        throw new HttpError('CSRF unavailable', 503);
      }
    );
    await settle(() => latest.save(body));
    expect(latest.unknown).toBe(false);
    expect(latest.editorCurrent).toBe(false);
    await settle(() => latest.save(body));
    expect(state.update).toHaveBeenCalledTimes(1);
  });
  it('known conflict preserves input read-only until a fresh source check without healing changed CAS', async () => {
    await edit();
    const body = input();
    state.update.mockImplementationOnce(
      async (_id, _body, _execution, options: ApprovalFormWorkspaceCommandOptions) => {
        dispatchChecks(options);
        throw new HttpError('Version conflict', 409);
      }
    );
    await settle(() => latest.save(body));
    expect(latest.editorCurrent).toBe(false);
    await settle(() => latest.save(body));
    expect(state.update).toHaveBeenCalledTimes(1);
    await settle(() => {
      void latest.reload();
    });
    await settle();
    expect(latest.editorCurrent).toBe(true);
    expect(latest.editorOriginal!.workspace.formRevision).toBe(4);
    state.read.mockResolvedValue({ ...workspaceFixture(), formRevision: 5 });
    await settle(() => {
      void latest.reload();
    });
    await settle();
    expect(latest.editorCurrent).toBe(false);
    expect(latest.editorOriginal!.workspace.formRevision).toBe(4);
    await settle(() => latest.save(body));
    expect(state.update).toHaveBeenCalledTimes(1);
  });
  it('does not send after resource A-B-A selection or unmount during authority', async () => {
    await edit();
    const body = input();
    const authority = deferred<void>();
    state.dispatch.mockImplementation(async (run) => {
      await authority.promise;
      return run(execution);
    });
    await settle(() => latest.save(body));
    props = { ...props, formId: publishedId };
    await settle(render);
    props = { ...props, formId };
    await settle(render);
    await settle(() => authority.resolve());
    expect(state.update).not.toHaveBeenCalled();
    await edit();
    const next = input();
    const second = deferred<void>();
    state.dispatch.mockImplementation(async (run) => {
      await second.promise;
      return run(execution);
    });
    await settle(() => latest.save(next));
    await act(async () => root.unmount());
    mounted = false;
    await settle(() => second.resolve());
    expect(state.update).not.toHaveBeenCalled();
  });
  it('retire changes catalog only and reinstate is server-validated despite retired eligibility=false', async () => {
    await settle(() => latest.openAvailability());
    await settle(() => latest.confirmAvailability());
    await settle();
    expect(state.retire).toHaveBeenCalledTimes(1);
    await settle(() =>
      client.setQueryData(headKey(), {
        ...workspaceFixture(),
        catalogAvailability: 'RETIRED',
        catalogPolicyEligible: false,
      })
    );
    await settle(() => latest.openAvailability());
    await settle(() => latest.confirmAvailability());
    expect(state.reinstate).toHaveBeenCalledTimes(1);
  });
  it('branches only an actual immutable version lookup without downgrade or invented source UUID', async () => {
    expect(latest.branchReady).toBe(false);
    await settle(() => latest.setSelectedVersionId(publishedId));
    await settle();
    expect(latest.branchReady).toBe(true);
    await settle(() => latest.openBranch());
    await settle(() => latest.confirmBranch());
    expect(state.branch.mock.calls[0][1]).toBe(publishedId);
    expect(state.branch.mock.calls[0][2]).toEqual({
      expectedFormRevision: 4,
      expectedWorkspaceRevision: 2,
    });
  });
  it('review uses exact new HIGH purpose and private nine-field body, never legacy FORM_PUBLISH', async () => {
    await review();
    await settle(() =>
      latest.confirmReview('Independent publisher verified the exact review evidence.')
    );
    const command: ApprovalHighRiskCommandDescriptor = state.begin.mock.calls[0][0];
    expect(command.operation).toBe('FORM_REVIEWED_PUBLISH');
    expect(command.commandPath).toContain('/publish-reviewed');
    expect(state.high!.operation).toBe('FORM_REVIEWED_PUBLISH');
    const secure: ApprovalMutationExecution = {
      mode: 'SECURE',
      rolloutState: '111',
      contextKey: 'actual-admin-context',
      contextScopeKey: 'actual-original-scope',
      expectedDecisionRevision: 'revision-a',
      objectVersion: 4,
      idempotencyKey: command.idempotencyKey,
    };
    await settle(() => {
      void state.high!.execute(command, secure);
    });
    expect(state.publish).toHaveBeenCalledTimes(1);
    const publishBody: ApprovalFormReviewedPublishInput = state.publish.mock.calls[0][1];
    expect(Object.keys(publishBody)).toHaveLength(9);
    expect(Object.isFrozen(publishBody)).toBe(true);
  });
  it('closes the independent review dialog after a durable rejection succeeds', async () => {
    await review();
    await settle(() =>
      latest.rejectReview('The form requires additional compliance controls before publication.')
    );
    await settle();
    expect(state.rejectReview).toHaveBeenCalledTimes(1);
    expect(state.rejectReview.mock.calls[0][1]).toBe(reviewFixture().reviewRequest.reviewRequestId);
    expect(latest.reviewOriginal).toBeNull();
    expect(latest.review).toBeNull();
    expect(state.success).toHaveBeenCalledWith('admin.formWorkspace.reviewRejected');
  });
  it.each(['history', 'diff'] as const)(
    'partial %s remains visible but disables independent publication',
    async (kind) => {
      await review();
      await settle(() =>
        kind === 'history'
          ? client.setQueryData(historyKey(), {
              versions: [workspaceFixture().workingDraft, workspaceFixture().published],
              mayBeTruncated: true,
            })
          : client.setQueryData(diffKey(), { ...diffFixture(), complete: false })
      );
      expect(latest.reviewReady).toBe(false);
      await settle(() => latest.confirmReview('Independent publisher verified this form.'));
      expect(state.begin).not.toHaveBeenCalled();
    }
  );
  it('freezes semantic diff through challenge and does not heal changed review digests', async () => {
    await review();
    await settle(() => latest.confirmReview('Independent publisher verified this form.'));
    const command = state.begin.mock.calls[0][0];
    await settle(() =>
      client.setQueryData(diffKey(), {
        ...diffFixture(),
        changes: [{ path: '/metadata/nameEn', before: null, after: 'Changed during challenge' }],
      })
    );
    expect(() =>
      state.high!.execute(command, {
        mode: 'SECURE',
        rolloutState: '111',
        contextKey: 'actual-admin-context',
        contextScopeKey: 'actual-original-scope',
        expectedDecisionRevision: 'revision-a',
        objectVersion: 4,
        idempotencyKey: command.idempotencyKey,
      })
    ).toThrow();
    expect(state.publish).not.toHaveBeenCalled();
  });
});
