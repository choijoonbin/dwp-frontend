// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_TASK_DETAIL_FIXTURE } from '../../../../../e2e/support/product-area-fixtures';
import { approvalDocumentTools } from '../../../../../e2e/support/approval-request-document-fixtures';
import { useApprovalTaskDocuments } from './use-approval-task-documents';

const deps = vi.hoisted(() => ({
  tools: vi.fn(),
  comments: vi.fn(),
  append: vi.fn(),
  export: vi.fn(),
  task: vi.fn(),
  guard: vi.fn(),
  actor: 'a',
  installed: true,
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
    available: deps.installed,
    run: async (execute: (execution: object) => Promise<unknown>) =>
      execute({ mode: 'LEGACY_COMPATIBILITY' }),
  }),
}));
vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    contextScopeKey: deps.actor,
    cacheKey: ['tenant', deps.actor, 'NORMAL', 'approvals.work', deps.actor, 'revision'],
    queryMeta: { accessSensitive: true },
  }),
}));
const taskId = '22222222-2222-4222-8222-222222222222';
const detail = {
  ...APPROVAL_TASK_DETAIL_FIXTURE,
  task: {
    ...APPROVAL_TASK_DETAIL_FIXTURE.task,
    taskId,
    requestId: approvalDocumentTools().requestId,
    version: 3,
  },
};
let source = { ...approvalDocumentTools(), taskId, taskVersion: 3 };
let client: QueryClient;
let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useApprovalTaskDocuments>;
function Harness() {
  state = useApprovalTaskDocuments(detail, deps.guard);
  return null;
}
const render = () =>
  root.render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    </StrictMode>
  );
async function ready() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  await vi.waitFor(() => expect(state.ready).toBe(true));
}
describe('Actual task document command and query fencing', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    deps.actor = 'a';
    deps.installed = true;
    source = { ...approvalDocumentTools(), taskId, taskVersion: 3 };
    deps.tools.mockImplementation(async () => source);
    deps.task.mockResolvedValue(detail);
    deps.comments.mockImplementation(async (_owner, page, size) => ({
      items: [],
      totalElements: 55,
      page,
      size,
      commentsVersion: source.commentsVersion,
      evaluatedAt: new Date().toISOString(),
    }));
    deps.append.mockResolvedValue({
      requestId: source.requestId,
      sequence: 1,
      text: 'Original comment',
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: 3 }, mutations: { retry: 3 } },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => render());
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.resetAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });
  it('dispatches one immutable original command under StrictMode and same-tick double click', async () => {
    await ready();
    await act(async () => {
      void state.start('COMMENT', 'Original comment');
      void state.start('COMMENT', 'Other input');
    });
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(1));
    const input = deps.append.mock.calls[0]![1];
    expect(input).toMatchObject({
      text: 'Original comment',
      expectedVersion: 3,
      expectedCommentsVersion: 0,
    });
    expect(Object.isFrozen(input)).toBe(true);
  });
  it.each([403, 503])(
    'blocks the first tools %s in the cache before async render notifications',
    async (status) => {
      await ready();
      deps.tools.mockRejectedValue(new HttpError('Source failed', status));
      await act(async () => {
        await state.tools.refetch();
        await state.start('COMMENT', 'Original comment');
      });
      expect(deps.append).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(state.ready).toBe(false));
      expect(state.pending).toBeNull();
    }
  );
  it('retains UNKNOWN after a fresh GET and retries the same key/body despite a committed comment head advance', async () => {
    await ready();
    deps.append.mockImplementationOnce(async () => {
      source = { ...source, commentsVersion: 1 };
      throw new HttpError('Unknown result', 503);
    });
    await act(async () => {
      await state.start('COMMENT', 'Original comment');
    });
    const original = deps.append.mock.calls[0]![1];
    expect(state.failure).toBe('UNKNOWN');
    await act(async () => {
      await state.refreshSource();
    });
    await ready();
    expect(state.pending?.key).toBe(original.idempotencyKey);
    await act(async () => {
      await state.start('COMMENT', 'New command');
    });
    expect(deps.append).toHaveBeenCalledTimes(1);
    await act(async () => {
      await state.retryOriginal();
    });
    expect(deps.append).toHaveBeenCalledTimes(2);
    expect(deps.append.mock.calls[1]![1]).toEqual(original);
    expect(state.pending).toBeNull();
  });
  it('does not label a failed preflight UNKNOWN when no mutation was dispatched', async () => {
    await ready();
    deps.task.mockRejectedValueOnce(new HttpError('Authority unavailable', 503));
    await act(async () => {
      await state.start('COMMENT', 'Original comment');
    });
    expect(deps.append).not.toHaveBeenCalled();
    expect(state.failure).toBe('UNAVAILABLE');
    expect(state.pending).toBeNull();
    expect(state.ready).toBe(false);
  });
  it.each(['COMMENT', 'PRINT', 'DOWNLOAD'] as const)(
    'rejects a cached 200 capability revocation for %s before observer notifications',
    async (kind) => {
      await ready();
      const query = client
        .getQueryCache()
        .find({ queryKey: ['approvals', 'task-document-tools'], exact: false });
      expect(query).toBeDefined();
      await act(async () => {
        client.setQueryData(query!.queryKey, {
          ...source,
          comment: { ...source.comment, allowed: false },
          print: { ...source.print, allowed: false },
          jsonExport: { ...source.jsonExport, allowed: false },
        });
        await state.start(kind, 'Original input');
      });
      expect(deps.append).not.toHaveBeenCalled();
      expect(deps.export).not.toHaveBeenCalled();
      expect(state.sourceDenied).toBe(true);
    }
  );
  it('blocks an error in the live comments cache before any comment POST', async () => {
    await ready();
    deps.comments.mockRejectedValueOnce(new HttpError('Comment access revoked', 403));
    await act(async () => {
      await state.comments.refetch();
      await state.start('COMMENT', 'Original input');
    });
    expect(deps.append).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(state.sourceDenied).toBe(true));
  });
  it('retains an original UNKNOWN when retry policy changes, never sending a new command', async () => {
    await ready();
    deps.append.mockRejectedValueOnce(new HttpError('Unknown result', 503));
    await act(async () => {
      await state.start('COMMENT', 'Original comment');
    });
    const original = state.pending;
    deps.tools.mockResolvedValueOnce({ ...source, policyVersion: 4 });
    await act(async () => {
      await state.retryOriginal();
    });
    expect(state.pending).toBe(original);
    expect(state.failure).toBe('UNKNOWN');
    expect(deps.append).toHaveBeenCalledTimes(1);
  });
  it.each(['taskId', 'requestId'])(
    'rejects a wrong %s in the fresh task before any document mutation',
    async (field) => {
      await ready();
      deps.task.mockResolvedValueOnce({
        ...detail,
        task: { ...detail.task, [field]: '99999999-9999-4999-8999-999999999999' },
      });
      await act(async () => {
        await state.start('COMMENT', 'Original comment');
      });
      expect(deps.append).not.toHaveBeenCalled();
      expect(state.failure).toBe('CONFLICT');
    }
  );
  it('queries each comment page without reusing another task or page projection', async () => {
    await ready();
    await act(async () => {
      state.setPage(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await vi.waitFor(() =>
      expect(deps.comments).toHaveBeenCalledWith(
        { type: 'TASK', id: taskId },
        1,
        25,
        'a',
        expect.anything()
      )
    );
    await vi.waitFor(() => expect(state.comments.data?.page).toBe(1));
  });
  it('discards a late A-to-B-to-A callback instead of restoring private task documents', async () => {
    await ready();
    let finish!: (value: unknown) => void;
    deps.append.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await act(async () => {
      void state.start('COMMENT', 'Original comment');
    });
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(1));
    deps.actor = 'b';
    await act(async () => render());
    await ready();
    deps.actor = 'a';
    await act(async () => render());
    await ready();
    await act(async () => {
      finish({ text: 'Late private result' });
    });
    expect(state.pending).toBeNull();
    expect(state.artifact).toBeNull();
  });
});
