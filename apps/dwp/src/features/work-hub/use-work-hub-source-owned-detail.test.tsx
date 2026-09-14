// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { approvalTaskToHub, approvalRequestToHub } from './work-hub-source-adapters';
import { useWorkHubSourceOwnedDetail } from './use-work-hub-source-owned-detail';

import type {
  ApprovalTask,
  ApprovalTaskDetail,
  ApprovalRequestDetail,
} from '@dwp-frontend/shared-utils/api/approval-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { Root } from 'react-dom/client';

const mocks = vi.hoisted(() => ({
  owner: 'owner-a' as string | null,
  getApprovalTask: vi.fn(),
  getApprovalRequestDetail: vi.fn(),
  getServiceMyRequest: vi.fn(),
}));

vi.mock('./use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => mocks.owner,
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-api', () => ({
  getApprovalTask: mocks.getApprovalTask,
  getApprovalRequestDetail: mocks.getApprovalRequestDetail,
  resolveApprovalContentAccess: (approval: ApprovalTaskDetail) => ({
    full: approval.contentAccess.state === 'FULL',
    reason: approval.contentAccess.reason,
    evaluatedAt: approval.contentAccess.evaluatedAt,
  }),
}));
vi.mock('@dwp-frontend/shared-utils/api/service-center-api', () => ({
  getServiceMyRequest: mocks.getServiceMyRequest,
}));

const task: ApprovalTask = {
  taskId: 'task-1',
  requestId: 'request-1',
  requestNumber: 'APR-031',
  title: 'Review purchase',
  summary: 'Review the evidence',
  workflowNameKo: '구매 승인',
  workflowNameEn: 'Purchase approval',
  stepKey: 'MANAGER_REVIEW',
  stepName: 'Manager review',
  stepSequence: 2,
  requesterName: 'Mina Kim',
  requesterOrgName: 'Operations',
  status: 'PENDING',
  priority: 'HIGH',
  dataClassification: 'CONFIDENTIAL',
  riskScore: 35,
  submittedAt: '2026-09-04T00:00:00Z',
  dueAt: null,
  version: 2,
};

function detail(version = task.version, value = 'Current evidence'): ApprovalTaskDetail {
  return {
    task: { ...task, version },
    contentAccess: {
      state: 'FULL',
      reason: 'CURRENT_AUTHORITY_VERIFIED',
      evaluatedAt: '2026-09-04T00:01:00Z',
    },
    payload: { purpose: value },
    formSchema: {
      schemaVersion: 1,
      fields: [
        {
          key: 'purpose',
          labelKo: '목적',
          labelEn: 'Purpose',
          type: 'TEXT',
          required: true,
        },
      ],
    },
    timeline: [],
    canClaim: false,
    canDecide: true,
    selfApprovalBlocked: false,
  };
}

function requestDetail(
  version = 3,
  value = 'Current requester evidence',
  requestId = 'request-1'
): ApprovalRequestDetail {
  return {
    request: {
      requestId,
      requestNumber: 'APR-042',
      title: 'My approval',
      summary: 'Requester context',
      workflowNameKo: '구매 승인',
      workflowNameEn: 'Purchase approval',
      currentStepKey: 'MANAGER_REVIEW',
      currentStepName: 'Manager review',
      currentStepSequence: 2,
      totalSteps: 3,
      status: 'NEEDS_INFO',
      priority: 'HIGH',
      dataClassification: 'CONFIDENTIAL',
      latestInformationRequest: value,
      submittedAt: '2026-09-04T00:00:00Z',
      version,
    },
    workflowId: 'workflow-1',
    formId: 'form-1',
    payload: { purpose: value },
    formSchema: {
      schemaVersion: 1,
      fields: [
        { key: 'purpose', labelKo: '목적', labelEn: 'Purpose', type: 'TEXT', required: true },
      ],
    },
    timeline: [],
  };
}

function Probe({
  version = task.version,
  requester = false,
  requestId = 'request-1',
}: {
  version?: number;
  requester?: boolean;
  requestId?: string;
}) {
  const item = requester
    ? approvalRequestToHub(requestDetail(version, undefined, requestId).request)
    : approvalTaskToHub({ ...task, version }, 'approval-inbox');
  const query = useWorkHubSourceOwnedDetail(item);
  const ready = query.isSuccess && !query.isFetching && !query.isError && !query.isRefetchError;
  return (
    <div>
      <span data-testid="state">
        {query.isFetching
          ? 'fetching'
          : query.isError || query.isRefetchError
            ? 'error'
            : 'settled'}
      </span>
      {ready && <span data-testid="value">{query.data.fields[0]?.value}</span>}
    </div>
  );
}

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function render(version = task.version, requester = false, requestId = 'request-1') {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe version={version} requester={requester} requestId={requestId} />
      </QueryClientProvider>
    );
  });
}

async function waitFor(check: () => boolean) {
  await vi.waitFor(() => expect(check()).toBe(true));
}

describe('useWorkHubSourceOwnedDetail', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.owner = 'owner-a';
    mocks.getApprovalTask.mockReset();
    mocks.getApprovalRequestDetail.mockReset();
    mocks.getServiceMyRequest.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    document.body.replaceChildren();
  });

  it('aborts old reads across owner and version changes and renders only the exact snapshot', async () => {
    const signals: AbortSignal[] = [];
    mocks.getApprovalTask
      .mockImplementationOnce((_id, _scope, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => undefined);
      })
      .mockImplementationOnce((_id, _scope, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => undefined);
      })
      .mockImplementationOnce((_id, _scope, signal: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve(detail(3, 'Version three evidence'));
      });

    await render(2);
    await waitFor(() => mocks.getApprovalTask.mock.calls.length === 1);
    mocks.owner = 'owner-b';
    await render(2);
    await waitFor(() => mocks.getApprovalTask.mock.calls.length === 2);
    expect(signals[0]?.aborted).toBe(true);
    await render(3);
    await waitFor(() => mocks.getApprovalTask.mock.calls.length === 3);
    await waitFor(() => host.textContent?.includes('Version three evidence') === true);

    expect(signals[1]?.aborted).toBe(true);
    expect(signals[2]?.aborted).toBe(false);
    expect(host.textContent).not.toContain('Current evidence');
  });

  it('hides cached detail during refetch and keeps it hidden after a read error', async () => {
    let rejectRefetch: ((reason: Error) => void) | undefined;
    mocks.getApprovalTask
      .mockResolvedValueOnce(detail(2, 'Previously authorized evidence'))
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRefetch = reject;
          })
      );
    await render();
    await waitFor(() => host.textContent?.includes('Previously authorized evidence') === true);

    let refetch: Promise<unknown> | undefined;
    await act(async () => {
      refetch = client.refetchQueries({ queryKey: ['work-hub', 'source-owned-detail'] });
      await Promise.resolve();
    });
    await waitFor(() => host.textContent?.includes('fetching') === true);
    expect(host.textContent).not.toContain('Previously authorized evidence');
    rejectRefetch?.(new Error('403'));
    await act(async () => {
      await refetch;
    });
    await waitFor(() => host.textContent?.includes('error') === true);

    expect(host.textContent).not.toContain('Previously authorized evidence');
  });

  it('discards a late requester response after the owner and selected request change', async () => {
    let resolvePrevious!: (detail: ApprovalRequestDetail) => void;
    mocks.getApprovalRequestDetail
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePrevious = resolve;
          })
      )
      .mockResolvedValueOnce(requestDetail(4, 'New owner evidence', 'request-2'));
    await render(3, true);
    await waitFor(() => mocks.getApprovalRequestDetail.mock.calls.length === 1);
    mocks.owner = 'owner-b';
    await render(4, true, 'request-2');
    await waitFor(() => host.textContent?.includes('New owner evidence') === true);
    await act(async () => resolvePrevious(requestDetail(3, 'Private old requester evidence')));
    expect(host.textContent).not.toContain('Private old requester evidence');
    expect(mocks.getApprovalRequestDetail).toHaveBeenNthCalledWith(
      1,
      'request-1',
      undefined,
      expect.any(AbortSignal)
    );
    expect(mocks.getApprovalRequestDetail).toHaveBeenNthCalledWith(
      2,
      'request-2',
      undefined,
      expect.any(AbortSignal)
    );
    expect((mocks.getApprovalRequestDetail.mock.calls[0][2] as AbortSignal).aborted).toBe(true);
    expect((mocks.getApprovalRequestDetail.mock.calls[1][2] as AbortSignal).aborted).toBe(false);
    expect(mocks.getApprovalTask).not.toHaveBeenCalled();
  });

  it.each([403, 503])(
    'hides cached requester evidence while refetching and after a %s error',
    async (status) => {
      let rejectRefetch!: (error: Error) => void;
      mocks.getApprovalRequestDetail.mockResolvedValueOnce(requestDetail()).mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRefetch = reject;
          })
      );
      await render(3, true);
      await waitFor(() => host.textContent?.includes('Current requester evidence') === true);
      let refetch!: Promise<void>;
      await act(async () => {
        refetch = client.refetchQueries({ queryKey: ['work-hub', 'source-owned-detail'] });
      });
      await waitFor(() => host.textContent?.includes('fetching') === true);
      expect(host.textContent).not.toContain('Current requester evidence');
      await act(async () => {
        rejectRefetch(new HttpError('Read failed', status));
        await refetch;
      });
      await waitFor(() => host.textContent?.includes('error') === true);
      expect(host.textContent).not.toContain('Current requester evidence');
    }
  );
});
