// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approvalDocumentArtifact,
  approvalDocumentRequestDetail,
  approvalDocumentTools,
} from '../../../../../e2e/support/approval-request-document-fixtures';
import { useApprovalRequestArchiveExport } from './use-approval-request-archive-export';

const deps = vi.hoisted(() => ({
  tools: vi.fn(),
  detail: vi.fn(),
  export: vi.fn(),
  actor: 'a',
}));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<object>()),
  getApprovalRequestDetail: deps.detail,
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-document-api', () => ({
  getApprovalDocumentTools: deps.tools,
  exportApprovalArchive: deps.export,
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canViewRequests: true }),
}));
vi.mock('./use-approval-document-mutation', () => ({
  useApprovalDocumentMutation: () => ({
    available: true,
    run: async (execute: (execution: object) => Promise<unknown>) =>
      execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }),
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

const request = approvalDocumentRequestDetail().request;
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
let state: ReturnType<typeof useApprovalRequestArchiveExport>;
function Harness() {
  state = useApprovalRequestArchiveExport([request]);
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
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
async function select() {
  await act(async () => state.setOpen(true));
  await settle();
  await vi.waitFor(() => expect(state.queryReady).toBe(true));
  await act(async () => {
    state.toggle(request.requestId);
    state.setReason('Original archive purpose');
  });
  await vi.waitFor(() => expect(state.ready).toBe(true));
}

describe('Actual archive document command and delivery fences', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    deps.actor = 'a';
    deps.tools.mockImplementation(async () => approvalDocumentTools());
    deps.detail.mockImplementation(async () => approvalDocumentRequestDetail());
    deps.export.mockImplementation(async () => approvalDocumentArtifact('DOWNLOAD'));
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
  it('single-flights double submit and retries only the original UNKNOWN descriptor after fresh preflight', async () => {
    await select();
    deps.export.mockRejectedValueOnce(new HttpError('Result unknown', 503));
    await act(async () => {
      state.begin();
      state.begin();
      state.setReason('Attempted edit after dispatch');
      state.setOpen(false);
    });
    await vi.waitFor(() => expect(state.recovery).toBe('UNKNOWN'));
    expect(deps.export).toHaveBeenCalledTimes(1);
    expect(state.reason).toBe('Original archive purpose');
    expect(state.open).toBe(true);
    const original = deps.export.mock.calls[0]![0];
    await act(async () => {
      await state.refresh();
    });
    await settle();
    expect(state.unknown).toBe(true);
    await act(async () => state.begin());
    expect(deps.export).toHaveBeenCalledTimes(1);
    await act(async () => state.retryOriginal());
    await vi.waitFor(() => expect(state.unknown).toBe(false));
    expect(deps.export).toHaveBeenCalledTimes(2);
    expect(deps.export.mock.calls[1]![0]).toBe(original);
    expect(Object.isFrozen(original)).toBe(true);
  });
  it.each([403, 503])(
    'fences cached authority on direct preflight %s and preserves selected documents and purpose until explicit recovery',
    async (status) => {
      await select();
      deps.detail.mockRejectedValueOnce(new HttpError('Current owner source unavailable', status));
      await act(async () => state.begin());
      await vi.waitFor(() => expect(state.verificationError).toBeInstanceOf(HttpError));
      expect(state.ready).toBe(false);
      expect(state.unknown).toBe(false);
      expect(state.selected).toEqual([request.requestId]);
      expect(state.reason).toBe('Original archive purpose');
      await act(async () => state.begin());
      expect(deps.export).not.toHaveBeenCalled();
      await act(async () => {
        await state.refresh();
      });
      await settle();
      await vi.waitFor(() => expect(state.ready).toBe(true));
      await act(async () => state.begin());
      await vi.waitFor(() => expect(deps.export).toHaveBeenCalledTimes(1));
    }
  );
  it('invalidates a generated artifact synchronously when its delivery preflight loses authority', async () => {
    await select();
    await act(async () => state.begin());
    await vi.waitFor(() => expect(state.artifact).toBeDefined());
    const isCurrent = state.artifactCurrent;
    deps.tools.mockRejectedValueOnce(new HttpError('Denied', 403));
    await act(async () => {
      await expect(state.verifyArtifact()).rejects.toBeInstanceOf(HttpError);
      expect(isCurrent()).toBe(false);
    });
    expect(state.artifact).toBeUndefined();
    expect(state.ready).toBe(false);
  });
  it('retains UNKNOWN rather than minting a fresh command after changed policy on replay', async () => {
    await select();
    deps.export.mockRejectedValueOnce(new HttpError('Result unknown', 503));
    await act(async () => state.begin());
    await vi.waitFor(() => expect(state.unknown).toBe(true));
    await act(async () => {
      await state.refresh();
    });
    await settle();
    deps.tools.mockResolvedValueOnce({ ...approvalDocumentTools(), policyVersion: 4 });
    await act(async () => state.retryOriginal());
    await vi.waitFor(() => expect(state.pending).toBe(false));
    expect(state.unknown).toBe(true);
    expect(state.ready).toBe(false);
    await act(async () => state.begin());
    expect(deps.export).toHaveBeenCalledTimes(1);
  });
  it('drops a late response across A-to-B-to-A epochs and cannot deliver an old actor artifact', async () => {
    let finish!: (value: unknown) => void;
    deps.export.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await select();
    await act(async () => state.begin());
    await vi.waitFor(() => expect(deps.export).toHaveBeenCalledTimes(1));
    deps.actor = 'b';
    await act(async () => render());
    deps.actor = 'a';
    await act(async () => render());
    await act(async () => finish(await approvalDocumentArtifact('DOWNLOAD')));
    expect(state.artifact).toBeUndefined();
    expect(state.unknown).toBe(false);
    expect(state.selected).toEqual([]);
  });
  it('uses cached capability data rather than an old successful observer projection before dispatch', async () => {
    await select();
    const key = client
      .getQueryCache()
      .findAll()
      .find((query) => query.queryKey.includes('archive-document-tools'))!.queryKey;
    await act(async () => {
      client.setQueryData(key, {
        ...approvalDocumentTools(),
        archiveExport: { allowed: false, reason: 'POLICY_PROHIBITED' },
      });
      state.begin();
    });
    expect(deps.export).not.toHaveBeenCalled();
    expect(deps.detail).not.toHaveBeenCalled();
  });
});
