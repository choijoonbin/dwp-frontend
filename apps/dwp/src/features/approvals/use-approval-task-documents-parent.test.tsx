// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { HttpError, type ApprovalTaskDetail } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_TASK_DETAIL_FIXTURE } from '../../../../../e2e/support/product-area-fixtures';
import { approvalDocumentTools } from '../../../../../e2e/support/approval-request-document-fixtures';
import { ApprovalDecisionDetail } from './approval-decision-detail';
import { useApprovalTaskDocuments } from './use-approval-task-documents';

const deps = vi.hoisted(() => ({
  task: vi.fn(),
  tools: vi.fn(),
  comments: vi.fn(),
  append: vi.fn(),
  export: vi.fn(),
  actor: 'a',
  taskId: '22222222-2222-4222-8222-222222222222',
  child: true,
}));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<object>()),
  getApprovalTask: deps.task,
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-document-api', () => ({
  getApprovalDocumentTools: deps.tools,
  getApprovalDocumentComments: deps.comments,
  appendApprovalTaskComment: deps.append,
  exportApprovalTaskDocument: deps.export,
}));
vi.mock('./use-approval-document-mutation', () => ({
  useApprovalDocumentMutation: () => ({
    available: true,
    run: (execute: (execution: object) => Promise<unknown>) =>
      execute({ mode: 'LEGACY_COMPATIBILITY' }),
  }),
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    contextScopeKey: deps.actor,
    cacheKey: ['tenant', deps.actor],
    queryMeta: { accessSensitive: true },
  }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', async (load) => ({
  ...(await load<object>()),
  useDisplayDictionary: () => (_key: string, value: string) => value,
}));
vi.mock('./approval-decision-utilities', () => ({ ApprovalDecisionUtilities: () => null }));
vi.mock('./approval-decision-metadata', () => ({ ApprovalDecisionMetadata: () => null }));
vi.mock('./approval-document-print-preview', () => ({
  ApprovalDocumentPrintPreview: ({ document }: { document: unknown }) =>
    document ? <div>private artifact</div> : null,
}));
vi.mock('./approval-document-download-dialog', () => ({
  ApprovalDocumentDownloadDialog: () => null,
}));
vi.mock('./approval-payload-data', () => ({
  ApprovalPayloadData: ({ payload }: { payload: unknown }) => <pre>{JSON.stringify(payload)}</pre>,
}));
vi.mock('./approval-ui', () => ({
  StatusChip: ({ status }: { status: string }) => <span>{status}</span>,
  PriorityChip: () => null,
}));
vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  ActionIconButton: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ),
  LoadingState: () => <div>parent pending</div>,
  ErrorState: () => <div>parent error</div>,
  InlineFeedback: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FormField: ({
    label,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  }) => (
    <label>
      {label}
      <textarea value={value} disabled={disabled} onChange={onChange} />
    </label>
  ),
  FormDialog: ({
    open,
    children,
    secondaryActions,
    submitLabel,
    onSubmit,
    submitDisabled,
  }: {
    open: boolean;
    children: ReactNode;
    secondaryActions?: ReactNode;
    submitLabel: string;
    onSubmit: () => void;
    submitDisabled?: boolean;
  }) =>
    open ? (
      <div role="dialog">
        {children}
        {secondaryActions}
        <button onClick={onSubmit} disabled={submitDisabled}>
          {submitLabel}
        </button>
      </div>
    ) : null,
}));

const originalTaskId = deps.taskId;
const detail: ApprovalTaskDetail = {
  ...APPROVAL_TASK_DETAIL_FIXTURE,
  task: {
    ...APPROVAL_TASK_DETAIL_FIXTURE.task,
    taskId: originalTaskId,
    requestId: approvalDocumentTools().requestId,
    version: 3,
    title: 'Private selected document',
    summary: 'Private selected summary',
  },
};
let source = { ...approvalDocumentTools(), taskId: originalTaskId, taskVersion: 3 };
let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
let state: ReturnType<typeof useApprovalTaskDocuments>;
let parent: ReturnType<typeof useQuery<ApprovalTaskDetail>>;
function Harness() {
  const actor = deps.actor;
  const taskId = deps.taskId;
  const queryKey = ['actual-task-parent', taskId, actor];
  parent = useQuery({
    queryKey,
    queryFn: () => deps.task(taskId, actor),
    retry: false,
    staleTime: Infinity,
  });
  const cached = parent.data?.task.taskId === taskId ? parent.data : undefined;
  const assertCurrent = () => {
    const current = client.getQueryState<ApprovalTaskDetail>(queryKey);
    if (
      deps.actor !== actor ||
      deps.taskId !== taskId ||
      current?.status !== 'success' ||
      current.fetchStatus !== 'idle' ||
      current.error ||
      current.fetchFailureCount > 0 ||
      current.data?.task.taskId !== taskId ||
      current.data.task.version !== cached?.task.version
    )
      throw new HttpError('Actual parent unavailable', 409);
  };
  state = useApprovalTaskDocuments(cached, assertCurrent, {
    taskId,
    ready: parent.isSuccess && !parent.isFetching && !parent.error,
    error: parent.failureReason ?? parent.error,
    refreshOwner: async () => {
      const result = await parent.refetch();
      if (!result.isSuccess || result.error || !result.data)
        throw result.error ?? new HttpError('Parent recovery failed', 503);
      return result.data;
    },
  });
  return deps.child ? (
    <ApprovalDecisionDetail
      detail={parent.isSuccess && !parent.isFetching ? cached : undefined}
      loading={parent.isFetching}
      error={parent.isError}
      mobile={false}
      decisionBusy={false}
      claimBusy={false}
      onBack={vi.fn()}
      onRetry={vi.fn()}
      onClaim={vi.fn()}
      onDecision={vi.fn()}
      onRevalidateDocument={deps.task}
      documents={state}
    />
  ) : null;
}
const render = () =>
  root.render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    </StrictMode>
  );
async function settled() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}
async function ready() {
  await settled();
  await vi.waitFor(() => expect(state.ready).toBe(true));
}
async function unknown() {
  await act(async () => {
    state.openDialog('COMMENT');
  });
  await act(async () => {
    state.setText('Original private comment');
  });
  deps.append.mockRejectedValueOnce(new HttpError('Committed but result unknown', 503));
  await act(async () => {
    await state.start('COMMENT', state.text);
  });
  expect(state.failure).toBe('UNKNOWN');
  return deps.append.mock.calls[0]![1];
}
describe('Stable task controller with actual conditional detail and parent query', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    deps.actor = 'a';
    deps.taskId = originalTaskId;
    deps.child = true;
    source = { ...approvalDocumentTools(), taskId: originalTaskId, taskVersion: 3 };
    deps.task.mockResolvedValue(detail);
    deps.tools.mockImplementation(async () => source);
    deps.comments.mockImplementation(async (_owner, page, size) => ({
      items: [
        {
          commentId: 'existing',
          authorUserId: 'author',
          createdAt: new Date().toISOString(),
          text: 'Private existing comment',
        },
      ],
      page,
      size,
      totalElements: 1,
      commentsVersion: source.commentsVersion,
      evaluatedAt: new Date().toISOString(),
    }));
    deps.append.mockResolvedValue({ text: 'Original private comment' });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => render());
    await ready();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.resetAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('orders decision identity, brief, request data, evidence, and audit history', () => {
    const text = container.textContent ?? '';
    const identity = text.indexOf('Private selected document');
    const brief = text.indexOf('home.commandCenter.decisionBrief');
    const requestData = text.indexOf('inbox.requestData');
    const payload = text.indexOf('Restore a customer-facing integration');
    const evidence = text.indexOf('inbox.supportingEvidence');
    const timeline = text.indexOf('inbox.timeline');

    expect(identity).toBeGreaterThanOrEqual(0);
    expect(brief).toBeGreaterThan(identity);
    expect(requestData).toBeGreaterThan(brief);
    expect(payload).toBeGreaterThan(requestData);
    expect(evidence).toBeGreaterThan(payload);
    expect(timeline).toBeGreaterThan(evidence);
  });
  it('retains the original descriptor and input through pending detail and actual child unmount', async () => {
    const original = await unknown();
    let finish!: (value: ApprovalTaskDetail) => void;
    deps.task.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    let refresh!: ReturnType<typeof parent.refetch>;
    await act(async () => {
      refresh = parent.refetch();
    });
    await settled();
    expect(container.textContent).toContain('parent pending');
    expect(state.ready).toBe(false);
    expect(state.pending?.key).toBe(original.idempotencyKey);
    deps.child = false;
    await act(async () => render());
    expect(container.textContent).toBe('');
    expect(state.pending?.text).toBe('Original private comment');
    deps.child = true;
    await act(async () => {
      finish(detail);
      await refresh;
      render();
    });
    await ready();
    expect(state.text).toBe('Original private comment');
    expect(deps.append).toHaveBeenCalledTimes(1);
  });
  it.each([403, 503])(
    'keeps UNKNOWN on first parent %s and requires explicit qualified recovery',
    async (status) => {
      const original = await unknown();
      source = { ...source, commentsVersion: 1 };
      deps.task.mockRejectedValueOnce(new HttpError('Parent source failure', status));
      const callsBefore = deps.task.mock.calls.length;
      await act(async () => {
        await parent.refetch();
      });
      await settled();
      expect(deps.task).toHaveBeenCalledTimes(callsBefore + 1);
      expect(state.pending?.key).toBe(original.idempotencyKey);
      expect(state.ready).toBe(false);
      expect(state.sourceDenied).toBe(status === 403);
      expect(state.text).toBe(status === 403 ? '' : 'Original private comment');
      expect(container.textContent).not.toContain('Private existing comment');
      await act(async () => {
        await state.retryOriginal();
      });
      expect(deps.append).toHaveBeenCalledTimes(1);
      await act(async () => {
        await parent.refetch();
      });
      await settled();
      expect(state.ready).toBe(false);
      if (status === 403) expect(container.textContent).not.toContain(detail.task.title);
      await act(async () => {
        await state.refreshSource();
      });
      await ready();
      expect(state.pending?.key).toBe(original.idempotencyKey);
      expect(state.text).toBe('Original private comment');
      await act(async () => {
        await state.retryOriginal();
      });
      expect(deps.append).toHaveBeenCalledTimes(2);
      expect(deps.append.mock.calls[1]![1]).toEqual(original);
    }
  );
  it('checks the actual parent cache before observer delivery and sends no POST', async () => {
    const query = client.getQueryCache().find({ queryKey: ['actual-task-parent'], exact: false });
    expect(query).toBeDefined();
    await act(async () => {
      query!.setState({ error: new HttpError('Access revoked', 403), status: 'error' });
      await state.start('COMMENT', 'Never dispatched');
    });
    expect(deps.append).not.toHaveBeenCalled();
    expect(deps.export).not.toHaveBeenCalled();
    await settled();
    expect(state.sourceDenied).toBe(true);
    expect(container.textContent).not.toContain(detail.task.title);
  });
  it('retains failed delivery privately and never triggers an automatic parent refetch', async () => {
    deps.task.mockRejectedValueOnce(new HttpError('Fresh owner access revoked', 403));
    const callsBefore = deps.task.mock.calls.length;
    await act(async () => {
      await state.start('PRINT', 'Approved reason');
    });
    await settled();
    expect(deps.task).toHaveBeenCalledTimes(callsBefore + 1);
    expect(state.sourceDenied).toBe(true);
    expect(deps.export).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain(detail.task.title);
  });
  it('requires successful owner, tools, and comments recovery before unmasking an UNKNOWN', async () => {
    const original = await unknown();
    deps.tools.mockRejectedValueOnce(new HttpError('Tools revoked', 403));
    await act(async () => {
      await expect(state.refreshSource()).rejects.toMatchObject({ status: 403 });
    });
    await settled();
    expect(state.ready).toBe(false);
    expect(state.sourceDenied).toBe(true);
    expect(state.pending?.key).toBe(original.idempotencyKey);
    expect(state.text).toBe('');
    await act(async () => {
      await state.retryOriginal();
    });
    expect(deps.append).toHaveBeenCalledTimes(1);
    deps.comments.mockRejectedValueOnce(new HttpError('Comments unavailable', 503));
    await act(async () => {
      await expect(state.refreshSource()).rejects.toMatchObject({ status: 503 });
    });
    await settled();
    expect(state.sourceDenied).toBe(true);
    expect(state.ready).toBe(false);
    await act(async () => {
      await state.refreshSource();
    });
    await ready();
    expect(state.pending?.key).toBe(original.idempotencyKey);
    expect(state.text).toBe('Original private comment');
  });
  it('keeps an acknowledged command private if its independent post-dispatch owner GET is denied', async () => {
    deps.task
      .mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(new HttpError('Post-dispatch denied', 403));
    await act(async () => {
      await state.start('COMMENT', 'Original private comment');
    });
    await settled();
    expect(deps.append).toHaveBeenCalledTimes(1);
    expect(state.failure).toBe('UNKNOWN');
    expect(state.sourceDenied).toBe(true);
    expect(state.pending?.key).toBe(deps.append.mock.calls[0]![1].idempotencyKey);
    expect(container.textContent).not.toContain(detail.task.title);
    await act(async () => {
      await state.refreshSource();
    });
    await ready();
    await act(async () => {
      await state.retryOriginal();
    });
    expect(deps.append.mock.calls[1]![1]).toEqual(deps.append.mock.calls[0]![1]);
  });
  it('purges UNKNOWN and local input on actual actor epoch change', async () => {
    await unknown();
    deps.actor = 'b';
    await act(async () => render());
    await ready();
    expect(state.pending).toBeNull();
    expect(state.text).toBe('');
    expect(state.dialog).toBeNull();
    await act(async () => {
      await state.retryOriginal();
    });
    expect(deps.append).toHaveBeenCalledTimes(1);
  });
  it('quarantines the old command when the same task advances version', async () => {
    await unknown();
    const next = { ...detail, task: { ...detail.task, version: 4 } };
    source = { ...source, taskVersion: 4 };
    deps.task.mockResolvedValue(next);
    await act(async () => {
      await parent.refetch();
    });
    await ready();
    expect(state.pending).toBeNull();
    expect(state.text).toBe('');
    expect(deps.append).toHaveBeenCalledTimes(1);
  });
  it('keeps the dialog text in the stable controller when the conditional tools remount', async () => {
    await act(async () => {
      fireEvent.click(getByRole(container, 'button', { name: 'requests.documents.comments' }));
    });
    await act(async () => {
      fireEvent.change(getByRole(container, 'textbox'), {
        target: { value: 'Unsent retained input' },
      });
    });
    deps.child = false;
    await act(async () => render());
    deps.child = true;
    await act(async () => render());
    expect((getByRole(container, 'textbox') as HTMLTextAreaElement).value).toBe(
      'Unsent retained input'
    );
  });
});
vi.mock('./use-approval-attachment-mutation', () => ({
  approvalAttachmentRouteInstalled: () => false,
  useApprovalAttachmentMutation: () => ({ available: false, run: vi.fn() }),
}));
