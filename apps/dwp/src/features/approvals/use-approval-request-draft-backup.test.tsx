// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import { useApprovalRequestDraftBackup } from './use-approval-request-draft-backup';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalDraftBackupDocument } from './approval-request-draft-backup';

const dependencies = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<Record<string, unknown>>()),
  getApprovalRequestDetail: dependencies.detail,
}));

const detail = (version = 7, payload: Record<string, unknown> = { note: '보존할 입력' }) =>
  ({
    request: {
      requestId: '00000000-0000-0000-0000-000000000007',
      requestNumber: 'APR-2026-007',
      title: 'Owner draft',
      summary: 'Draft input',
      workflowNameKo: '결재',
      workflowNameEn: 'Approval',
      totalSteps: 1,
      status: 'DRAFT',
      priority: 'NORMAL',
      dataClassification: 'INTERNAL',
      version,
    },
    workflowId: '00000000-0000-0000-0000-000000000101',
    formId: '00000000-0000-0000-0000-000000000102',
    formVersionId: '00000000-0000-0000-0000-000000000103',
    formSchemaSha256: 'b'.repeat(64),
    payload,
    timeline: [],
  }) satisfies ApprovalRequestDetail;

let identity = 'owner-a';
let currentDetail = detail();
let state: ReturnType<typeof useApprovalRequestDraftBackup>;
function Harness() {
  state = useApprovalRequestDraftBackup({
    cacheKey: ['tenant', identity, 'NORMAL', 'approvals.work', identity, 'decision'],
    contextScopeKey: identity,
    ready: true,
    request: currentDetail.request,
    detail: currentDetail,
  });
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('approval draft backup authority fencing', () => {
  let root: Root;
  let container: HTMLDivElement;
  let client: QueryClient;
  let clicked: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;

  const render = () =>
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    identity = 'owner-a';
    currentDetail = detail();
    dependencies.detail.mockResolvedValue(currentDetail);
    vi.stubGlobal('crypto', webcrypto);
    createObjectURL = vi.fn().mockReturnValue('blob:draft-backup');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    client = new QueryClient({ defaultOptions: { mutations: { retry: 3 } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => render());
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('single-flights a fresh owner read and downloads only its exact snapshot', async () => {
    await act(async () => {
      state.download();
      state.download();
    });
    await vi.waitFor(() => expect(clicked).toHaveBeenCalledOnce());
    expect(dependencies.detail).toHaveBeenCalledOnce();
    expect(dependencies.detail).toHaveBeenCalledWith(currentDetail.request.requestId, 'owner-a');
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json;charset=utf-8');
    const backup = JSON.parse(await blob.text()) as ApprovalDraftBackupDocument;
    expect(backup.source).toMatchObject({ expectedVersion: 7, status: 'DRAFT' });
    expect(backup.inputSnapshot.payload).toEqual({ note: '보존할 입력' });
  });

  it.each([
    ['stale version', detail(8)],
    ['changed binding', { ...detail(), formVersionId: 'other-form-version' }],
    ['changed input', detail(7, { note: 'changed remotely' })],
  ] as const)('blocks %s before creating a file', async (_, fresh) => {
    dependencies.detail.mockResolvedValueOnce(fresh);
    await act(async () => state.download());
    await vi.waitFor(() => expect(state.problem).toBe('STALE'));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clicked).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'DENIED'],
    [409, 'STALE'],
    [503, 'UNAVAILABLE'],
  ] as const)('fails closed on HTTP %s without retry or download', async (status, problem) => {
    dependencies.detail.mockRejectedValueOnce(new HttpError('fresh owner read failed', status));
    await act(async () => state.download());
    await vi.waitFor(() => expect(state.problem).toBe(problem));
    expect(dependencies.detail).toHaveBeenCalledOnce();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('drops a delayed A-to-B-to-A response and never delivers the old owner file', async () => {
    const pending = deferred<ApprovalRequestDetail>();
    dependencies.detail.mockReturnValueOnce(pending.promise);
    await act(async () => state.download());
    identity = 'owner-b';
    await act(async () => render());
    identity = 'owner-a';
    await act(async () => render());
    await act(async () => pending.resolve(detail()));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(clicked).not.toHaveBeenCalled();
  });
});
