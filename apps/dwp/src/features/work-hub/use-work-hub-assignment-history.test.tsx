// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type { WorkAssignmentEvent } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { WorkAssignmentHistoryChangedError } from './work-hub-assignment-history-model';
import { useWorkHubAssignmentHistory } from './use-work-hub-assignment-history';

const mocks = vi.hoisted(() => ({
  owner: 'tenant-a:user-11:allow' as string | null,
  load: vi.fn(),
}));
vi.mock('./use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => mocks.owner,
}));
vi.mock('./work-hub-assignment-history-model', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  loadWorkAssignmentHistory: mocks.load,
}));

const assignmentId = '11111111-1111-4111-8111-111111111111';
function event(version: number): WorkAssignmentEvent {
  return {
    eventId: `22222222-2222-4222-8222-${String(version + 1).padStart(12, '0')}`,
    assignmentId,
    action: version === 0 ? 'CREATE' : 'ACCEPT',
    actorUserId: 11,
    assigneeUserId: 11,
    assignmentState: version === 0 ? 'PENDING' : 'ACCEPTED',
    workState: 'OPEN',
    assignmentRevision: 0,
    version,
    reasonCode: null,
    occurredAt: '2026-09-08T09:00:00Z',
    auditRecordId: `33333333-3333-4333-8333-${String(version + 1).padStart(12, '0')}`,
  };
}

let query!: ReturnType<typeof useWorkHubAssignmentHistory>;
let taskVersion = 1;
let onAccessDenied = vi.fn<() => void>();
let onTaskChanged = vi.fn<() => void>();
let client: QueryClient;
let host: HTMLDivElement;
let root: Root;

function Harness() {
  query = useWorkHubAssignmentHistory({
    assignmentId,
    taskVersion,
    onAccessDenied,
    onTaskChanged,
  });
  return <span>{query.isError ? 'error' : query.isSuccess ? 'ready' : 'loading'}</span>;
}

async function render() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    );
  });
}

async function waitFor(check: () => boolean) {
  await act(async () => {
    await vi.waitFor(() => expect(check()).toBe(true));
  });
}

describe('useWorkHubAssignmentHistory', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.owner = 'tenant-a:user-11:allow';
    mocks.load.mockReset();
    taskVersion = 1;
    onAccessDenied = vi.fn();
    onTaskChanged = vi.fn();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('refreshes the task once when history is ahead of its detail', async () => {
    mocks.load.mockResolvedValue([event(0), event(1), event(2)]);
    await render();
    await waitFor(() => query.isError && onTaskChanged.mock.calls.length === 1);

    expect(query.error).toBeInstanceOf(WorkAssignmentHistoryChangedError);
    expect((query.error as WorkAssignmentHistoryChangedError).direction).toBe('AHEAD');
    await render();
    expect(onTaskChanged).toHaveBeenCalledOnce();
    expect(onAccessDenied).not.toHaveBeenCalled();
  });

  it('labels lagging history without claiming that the task detail is stale', async () => {
    taskVersion = 2;
    mocks.load.mockResolvedValue([event(0), event(1)]);
    await render();
    await waitFor(() => query.isError);

    expect((query.error as WorkAssignmentHistoryChangedError).direction).toBe('BEHIND');
    expect(onTaskChanged).not.toHaveBeenCalled();
    expect(onAccessDenied).not.toHaveBeenCalled();
  });

  it('hands authorization failures to the page and does not classify them as drift', async () => {
    mocks.load.mockRejectedValue(new HttpError('revoked', 403));
    await render();
    await waitFor(() => onAccessDenied.mock.calls.length === 1);

    expect(query.error).toBeInstanceOf(HttpError);
    expect(onTaskChanged).not.toHaveBeenCalled();
  });

  it('aborts an old owner read and publishes only the replacement result', async () => {
    const signals: AbortSignal[] = [];
    mocks.load
      .mockImplementationOnce((_id: string, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => undefined);
      })
      .mockImplementationOnce((_id: string, signal: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve([event(0), event(1)]);
      });
    await render();
    await waitFor(() => mocks.load.mock.calls.length === 1);
    mocks.owner = 'tenant-b:user-11:allow';
    await render();
    await waitFor(() => query.isSuccess);

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(query.data).toEqual([event(0), event(1)]);
  });
});
