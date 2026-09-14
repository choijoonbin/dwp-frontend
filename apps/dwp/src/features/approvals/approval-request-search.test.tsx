// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApprovalRequestSearch } from './use-approval-request-search';

import type { ApprovalPage, ApprovalRequest } from '@dwp-frontend/shared-utils';
import type { ApprovalRequestView } from './approval-request-model';
import type { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

const dependencies = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils', async (load) => ({
  ...(await load<Record<string, unknown>>()),
  searchApprovalRequests: dependencies.search,
}));
const row = (identity: string): ApprovalRequest => ({
  requestId: identity,
  requestNumber: identity,
  title: identity,
  summary: '',
  status: 'IN_REVIEW',
  priority: 'NORMAL',
  version: 3,
  workflowNameKo: '결재',
  workflowNameEn: 'Approval',
  totalSteps: 2,
  dataClassification: 'INTERNAL',
});
function result(identity: string): ApprovalPage<ApprovalRequest> {
  return {
    items: [row(identity)],
    totalElements: 21,
    totalPages: 2,
    page: 0,
    size: 20,
    hasNext: true,
    evaluatedAt: '2026-09-14T00:00:00Z',
  };
}
let search: ReturnType<typeof useApprovalRequestSearch>;
function Harness({ identity, view }: { identity: string; view: ApprovalRequestView }) {
  const scope: ReturnType<typeof useProductSurfaceRequestScope> = {
    cacheKey: ['tenant', identity, 'NORMAL', 'approvals.work', identity, 'revision'],
    contextScopeKey: identity,
    ready: true,
    governed: false,
    queryMeta: {
      accessSensitive: true,
      tenantId: 'tenant',
      actorId: identity,
      accessMode: 'NORMAL',
      productId: 'approvals',
      surfaceId: 'approvals.work',
      contextScopeKey: identity,
      decisionRevision: 'revision',
    },
  };
  search = useApprovalRequestSearch(view, scope);
  return <output>{search.requests.data?.[0]?.requestId}</output>;
}
let client: QueryClient;
let container: HTMLDivElement;
let root: Root;
function render(identity = 'actor-a', view: ApprovalRequestView = 'submitted') {
  root.render(
    <QueryClientProvider client={client}>
      <Harness identity={identity} view={view} />
    </QueryClientProvider>
  );
}
describe('Approval request server search', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetAllMocks();
    dependencies.search.mockImplementation((_view: string, _filter: unknown, identity: string) =>
      Promise.resolve(result(identity))
    );
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => render());
    await vi.waitFor(() => expect(search.requests.data?.[0]?.requestId).toBe('actor-a'));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('passes supported status, priority, sort and page to the actual request search adapter', async () => {
    await act(async () => {
      search.setStatus('NEEDS_INFO');
      search.setPriority('HIGH');
      search.setSort('OLDEST');
    });
    await vi.waitFor(() =>
      expect(dependencies.search).toHaveBeenLastCalledWith(
        'SUBMITTED',
        expect.objectContaining({
          status: 'NEEDS_INFO',
          priority: 'HIGH',
          sort: 'OLDEST',
          page: 0,
          size: 20,
        }),
        'actor-a',
        expect.any(AbortSignal)
      )
    );
    await act(async () => search.setPage(1));
    await vi.waitFor(() =>
      expect(dependencies.search).toHaveBeenLastCalledWith(
        'SUBMITTED',
        expect.objectContaining({ page: 1 }),
        'actor-a',
        expect.any(AbortSignal)
      )
    );
  });

  it('does not keep another identity as placeholder during a pending scope read', async () => {
    let resolve!: (page: ApprovalPage<ApprovalRequest>) => void;
    dependencies.search.mockReturnValue(
      new Promise<ApprovalPage<ApprovalRequest>>((done) => {
        resolve = done;
      })
    );
    await act(async () => render('actor-b'));
    expect(search.requests.data).toBeUndefined();
    expect(container.textContent).not.toContain('actor-a');
    await act(async () => resolve(result('actor-b')));
    await vi.waitFor(() => expect(search.requests.data?.[0]?.requestId).toBe('actor-b'));
  });

  it('does not reset a selected page when the initial unchanged empty-search debounce elapses', async () => {
    await act(async () => search.setPage(1));
    await vi.waitFor(() => expect(search.page).toBe(1));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(search.page).toBe(1);
    expect(dependencies.search).toHaveBeenLastCalledWith(
      'SUBMITTED',
      expect.objectContaining({ page: 1 }),
      'actor-a',
      expect.any(AbortSignal)
    );
  });

  it('retains cached data only as inaccessible query state after the first refetch error', async () => {
    dependencies.search.mockRejectedValue(new Error('First authority 503'));
    await act(async () => {
      await search.requests.refetch();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(search.requests.isError).toBe(true);
    expect(search.requests.isFetching).toBe(false);
    expect(search.requests.data).toBeUndefined();
    expect(dependencies.search).toHaveBeenCalledTimes(2);
  });

  it('keeps request archive and needs-info query identities separate', async () => {
    await act(async () => render('actor-a', 'archive'));
    await vi.waitFor(() =>
      expect(dependencies.search).toHaveBeenLastCalledWith(
        'ARCHIVE',
        expect.anything(),
        'actor-a',
        expect.any(AbortSignal)
      )
    );
    await act(async () => render('actor-a', 'needs-info'));
    await vi.waitFor(() =>
      expect(dependencies.search).toHaveBeenLastCalledWith(
        'NEEDS_INFO',
        expect.anything(),
        'actor-a',
        expect.any(AbortSignal)
      )
    );
  });
});
