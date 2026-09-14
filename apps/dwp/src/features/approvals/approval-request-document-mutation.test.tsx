// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approvalDocumentRequestDetail,
  approvalDocumentTools,
} from '../../../../../e2e/support/approval-request-document-fixtures';
import { useApprovalRequestDocuments } from './use-approval-request-documents';

const deps = vi.hoisted(() => ({
  tools: vi.fn(),
  comments: vi.fn(),
  append: vi.fn(),
  export: vi.fn(),
  detail: vi.fn(),
  actor: 'a',
  installed: true,
}));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<object>()),
  getApprovalRequestDetail: deps.detail,
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-document-api', () => ({
  getApprovalDocumentTools: deps.tools,
  getApprovalDocumentComments: deps.comments,
  appendApprovalRequestComment: deps.append,
  exportApprovalRequestDocument: deps.export,
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canViewRequests: true, canUpdateRequests: true }),
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
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let tools = approvalDocumentTools();
let state: ReturnType<typeof useApprovalRequestDocuments>;
function Harness() {
  state = useApprovalRequestDocuments(tools.requestId, approvalDocumentRequestDetail());
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
  await vi.waitFor(() => expect(state.sourceReady).toBe(true));
}
async function input() {
  await ready();
  await act(async () => state.setText('Preserved original comment'));
}

describe('Actual request document query/mutation hook', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    deps.actor = 'a';
    deps.installed = true;
    tools = approvalDocumentTools();
    deps.tools.mockImplementation(async () => tools);
    deps.detail.mockImplementation(async () => approvalDocumentRequestDetail());
    deps.comments.mockImplementation(async () => ({
      items: [],
      totalElements: 0,
      page: 0,
      size: 25,
      commentsVersion: tools.commentsVersion,
      evaluatedAt: new Date().toISOString(),
    }));
    deps.append.mockImplementation(
      async (_id: string, input: { text: string; expectedCommentsVersion: number }) => ({
        requestId: tools.requestId,
        sequence: input.expectedCommentsVersion + 1,
        text: input.text,
      })
    );
    client = new QueryClient({
      defaultOptions: { queries: { retry: 3 }, mutations: { retry: 3 } },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
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
  it('dispatches once under StrictMode and double click, capturing one original input and key', async () => {
    await input();
    await act(async () => {
      state.addComment();
      state.addComment();
      state.setText('Attempted edit after dispatch');
    });
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(1));
    expect(deps.append.mock.calls[0]![1]).toMatchObject({
      text: 'Preserved original comment',
      expectedVersion: 3,
      expectedCommentsVersion: 0,
    });
    expect(Object.isFrozen(deps.append.mock.calls[0]![1])).toBe(true);
  });
  it.each([403, 503])(
    'closes all writes on the first source %s despite cached tools and configured retries',
    async (status) => {
      await input();
      deps.tools.mockRejectedValue(new HttpError('Unavailable', status));
      await act(async () => {
        await state.tools.refetch();
      });
      await act(async () => state.addComment());
      expect(deps.append).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(state.sourceReady).toBe(false));
      expect(state.commentAllowed).toBe(false);
      expect(state.downloadAllowed).toBe(false);
      await act(async () => state.addComment());
      expect(deps.append).not.toHaveBeenCalled();
      expect(state.text).toBe(status === 403 ? '' : 'Preserved original comment');
    }
  );
  it('keeps UNKNOWN after GET and replays only the identical command when its committed comment sequence advances', async () => {
    await input();
    deps.append.mockImplementationOnce(async () => {
      tools = { ...tools, commentsVersion: 1 };
      throw new HttpError('Result unknown', 503);
    });
    await act(async () => state.addComment());
    await vi.waitFor(() => expect(state.unknown).toBe(true));
    expect(deps.append).toHaveBeenCalledTimes(1);
    const original = deps.append.mock.calls[0]![1];
    await act(async () => {
      await state.refresh();
    });
    await ready();
    expect(state.unknown).toBe(true);
    expect(state.text).toBe('Preserved original comment');
    await act(async () => state.addComment());
    expect(deps.append).toHaveBeenCalledTimes(1);
    await act(async () => state.retryOriginal());
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(2));
    expect(deps.append.mock.calls[1]![1]).toBe(original);
    await vi.waitFor(() => expect(state.unknown).toBe(false));
  });
  it('retains original UNKNOWN when replay preflight finds a changed policy instead of opening a fresh command', async () => {
    await input();
    deps.append.mockRejectedValueOnce(new HttpError('Result unknown', 503));
    await act(async () => state.addComment());
    await vi.waitFor(() => expect(state.unknown).toBe(true));
    await act(async () => {
      await state.refresh();
    });
    await ready();
    deps.tools.mockResolvedValueOnce({ ...tools, policyVersion: 3 });
    await act(async () => state.retryOriginal());
    await vi.waitFor(() => expect(state.pending).toBe(false));
    expect(state.unknown).toBe(true);
    expect(state.text).toBe('Preserved original comment');
    await act(async () => state.addComment());
    expect(deps.append).toHaveBeenCalledTimes(1);
  });
  it('rejects changed payload or current capability in preflight before any POST', async () => {
    await input();
    deps.tools.mockResolvedValueOnce({ ...tools, payloadSha256: 'b'.repeat(64) });
    await act(async () => state.addComment());
    await vi.waitFor(() => expect(state.recovery).toBe('CONFLICT'));
    expect(deps.append).not.toHaveBeenCalled();
    expect(state.text).toBe('Preserved original comment');
  });
  it('does not mint a command when canonical ACTION installation is absent', async () => {
    deps.installed = false;
    await act(async () => render());
    await input();
    expect(state.commentAllowed).toBe(false);
    await act(async () => state.addComment());
    expect(deps.append).not.toHaveBeenCalled();
  });
  it('reads actual cached capabilities before the observer rerender and closes the immediate click gap', async () => {
    await input();
    const key = client
      .getQueryCache()
      .findAll()
      .find((query) => query.queryKey.includes('request-document-tools'))!.queryKey;
    await act(async () => {
      client.setQueryData(key, {
        ...tools,
        comment: { allowed: false, reason: 'POLICY_PROHIBITED' },
      });
      state.addComment();
    });
    expect(deps.append).not.toHaveBeenCalled();
    expect(deps.detail).not.toHaveBeenCalled();
  });
  it('discards a late committed comment after A-to-B-to-A identity epochs without clearing a new composer', async () => {
    let finish!: (value: unknown) => void;
    deps.append.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await input();
    await act(async () => state.addComment());
    await vi.waitFor(() => expect(deps.append).toHaveBeenCalledTimes(1));
    deps.actor = 'b';
    await act(async () => render());
    deps.actor = 'a';
    await act(async () => render());
    await input();
    await act(async () => state.setText('New identity comment'));
    await act(async () =>
      finish({ requestId: tools.requestId, sequence: 1, text: 'Preserved original comment' })
    );
    expect(state.text).toBe('New identity comment');
    expect(state.unknown).toBe(false);
  });
});
