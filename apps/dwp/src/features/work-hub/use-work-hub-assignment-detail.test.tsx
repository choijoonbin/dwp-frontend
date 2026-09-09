// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type {
  WorkAssignmentMutationResult,
  WorkAssignmentTask,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import { workAssignmentToHub } from './work-hub-assignment-model';
import { useWorkHubAssignmentDetail } from './use-work-hub-assignment-detail';

const mocks = vi.hoisted(() => ({
  owner: 'tenant-a:user-11:allow' as string | null,
  get: vi.fn(),
  receipt: vi.fn(),
  transition: vi.fn(),
}));

vi.mock('./use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => mocks.owner,
}));
vi.mock('@dwp-frontend/shared-utils/api/work-assignment-api', () => ({
  getWorkAssignment: mocks.get,
  getWorkAssignmentCommand: mocks.receipt,
  transitionWorkAssignment: mocks.transition,
}));

const ids = {
  first: '11111111-1111-4111-8111-111111111111',
  second: '22222222-2222-4222-8222-222222222222',
  meeting: '33333333-3333-4333-8333-333333333333',
  report: '44444444-4444-4444-8444-444444444444',
  candidate: '55555555-5555-4555-8555-555555555555',
  command: '66666666-6666-4666-8666-666666666666',
};

function source(available = true): WorkAssignmentTask['source'] {
  return available
    ? {
        availability: 'AVAILABLE',
        reference: {
          sourceSystem: 'MEETING_FOLLOWUP',
          meetingId: ids.meeting,
          reportId: ids.report,
          candidateId: ids.candidate,
        },
        sourceVersion: 3,
        sourceRoute: `/meetings/history?meeting=${ids.meeting}&reportId=${ids.report}&candidateId=${ids.candidate}`,
      }
    : { availability: 'UNAVAILABLE', reference: null, sourceVersion: null, sourceRoute: null };
}

function detail(
  overrides: Partial<WorkAssignmentTask> = {},
  sourceAvailable = true
): WorkAssignmentTask {
  return {
    assignmentId: ids.first,
    createdByUserId: 7,
    assignedByUserId: 7,
    assigneeUserId: 11,
    title: 'Review the confirmed follow-up',
    description: 'Complete the confirmed work without source inference.',
    priority: 'HIGH',
    dueAt: '2026-09-10T09:00:00Z',
    assignmentState: 'PENDING',
    workState: 'OPEN',
    assignmentRevision: 2,
    version: 4,
    source: source(sourceAvailable),
    capabilities: {
      canAccept: true,
      canDecline: true,
      canStart: false,
      canWait: false,
      canComplete: false,
      canReassign: false,
      canCancel: false,
    },
    createdAt: '2026-09-04T09:00:00Z',
    updatedAt: '2026-09-08T09:00:00Z',
    acceptedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function listed(task: WorkAssignmentTask) {
  return workAssignmentToHub(
    {
      ...task,
      source: {
        availability: 'NOT_REQUESTED',
        reference: null,
        sourceVersion: null,
        sourceRoute: null,
      },
      capabilities: { ...task.capabilities, canReassign: false },
    },
    11
  );
}

function accepted(reviewed: WorkAssignmentTask, sourceAvailable = true): WorkAssignmentTask {
  const result = detail(
    {
      ...reviewed,
      assignmentState: 'ACCEPTED',
      version: reviewed.version + 1,
      updatedAt: '2026-09-08T10:00:00Z',
      acceptedAt: '2026-09-08T10:00:00Z',
      capabilities: {
        canAccept: false,
        canDecline: false,
        canStart: true,
        canWait: true,
        canComplete: true,
        canReassign: false,
        canCancel: false,
      },
    },
    sourceAvailable
  );
  return { ...result, source: source(sourceAvailable) };
}

function mutation(
  reviewed: WorkAssignmentTask,
  commandId: string,
  sourceAvailable = true
): WorkAssignmentMutationResult {
  return {
    assignment: accepted(reviewed, sourceAvailable),
    receipt: {
      commandId,
      assignmentId: reviewed.assignmentId,
      operation: 'ACCEPT',
      appliedVersion: reviewed.version + 1,
      appliedAssignmentRevision: reviewed.assignmentRevision,
      appliedAt: '2026-09-08T10:00:00Z',
      replayed: false,
    },
  };
}

type HookState = ReturnType<typeof useWorkHubAssignmentDetail>;
let state!: HookState;
let client: QueryClient;
let root: Root;
let host: HTMLDivElement;
let currentItem = listed(detail());
let commandsEnabled = true;
let onAccessDenied = vi.fn<() => void>();
let onChanged = vi.fn<() => void>();

function Harness() {
  state = useWorkHubAssignmentDetail({
    item: currentItem,
    actorId: 11,
    commandsEnabled,
    onAccessDenied,
    onChanged,
  });
  return <span>{state.task?.title ?? 'hidden'}</span>;
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

describe('useWorkHubAssignmentDetail', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.owner = 'tenant-a:user-11:allow';
    mocks.get.mockReset();
    mocks.receipt.mockReset();
    mocks.transition.mockReset();
    onAccessDenied = vi.fn();
    onChanged = vi.fn();
    currentItem = listed(detail());
    commandsEnabled = true;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      ids.command as `${string}-${string}-${string}-${string}-${string}`
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('preflights and binds an accepted mutation to one command key and reviewed body', async () => {
    const reviewed = detail();
    mocks.get.mockResolvedValue(reviewed);
    mocks.transition.mockResolvedValue(mutation(reviewed, ids.command));
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);

    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => state.outcome !== null && !state.busy);

    expect(mocks.transition).toHaveBeenCalledWith(
      ids.first,
      'accept',
      { version: 4, assignmentRevision: 2 },
      ids.command,
      expect.any(AbortSignal)
    );
    expect(state.task?.assignmentState).toBe('ACCEPTED');
    expect(state.task?.workState).toBe('OPEN');
    expect(onChanged).toHaveBeenCalledOnce();
    expect(onAccessDenied).not.toHaveBeenCalled();
  });

  it('does not POST when a fresh preflight differs from what the user reviewed', async () => {
    const reviewed = detail();
    mocks.get
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(detail({ version: 5, updatedAt: '2026-09-08T10:00:00Z' }));
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);

    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => state.conflict && !state.busy);

    expect(mocks.transition).not.toHaveBeenCalled();
    expect(state.uncertain).toBe(false);
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('recovers a lost response by receipt GET after write permission is removed', async () => {
    const reviewed = detail();
    mocks.get.mockResolvedValue(reviewed);
    mocks.transition.mockRejectedValue(new Error('response lost'));
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);
    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => state.uncertain && !state.busy);
    const commandId = mocks.transition.mock.calls[0]?.[3] as string;

    commandsEnabled = false;
    mocks.receipt.mockResolvedValue(mutation(reviewed, commandId));
    await render();
    expect(state.canRecover).toBe(true);
    expect(state.canRetry).toBe(false);
    await act(async () => state.recover());
    await waitFor(() => state.outcome !== null && !state.busy);

    expect(mocks.receipt).toHaveBeenCalledWith(commandId, expect.any(AbortSignal));
    expect(mocks.transition).toHaveBeenCalledOnce();
    expect(state.uncertain).toBe(false);
    expect(state.task?.assignmentState).toBe('ACCEPTED');
  });

  it('keeps recovery visible and hides source metadata after a transport refetch failure', async () => {
    const reviewed = detail();
    mocks.get.mockResolvedValueOnce(reviewed).mockResolvedValueOnce(reviewed);
    mocks.transition.mockRejectedValue(new Error('response lost'));
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);
    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => state.uncertain && !state.busy);

    mocks.get.mockRejectedValueOnce(new HttpError('source unavailable', 503));
    await act(async () => {
      await state.query.refetch();
    });
    await waitFor(() => !state.query.isFetching);

    expect(state.uncertain).toBe(true);
    expect(state.task).toBeDefined();
    expect(state.task?.source).toEqual(source(false));
    expect(state.canRecover).toBe(true);
  });

  it('purges the task when receipt recovery and the fresh detail both deny access', async () => {
    const reviewed = detail();
    mocks.get
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(reviewed)
      .mockRejectedValueOnce(new HttpError('revoked', 404));
    mocks.transition.mockRejectedValue(new Error('response lost'));
    mocks.receipt.mockRejectedValue(new HttpError('missing', 404));
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);
    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => state.uncertain && !state.busy);
    await act(async () => state.recover());
    await waitFor(() => onAccessDenied.mock.calls.length > 0);

    expect(state.outcome).toBeNull();
    expect(state.uncertain).toBe(false);
    expect(
      client
        .getQueriesData({
          queryKey: ['work-hub', 'work-assignment-detail', mocks.owner, ids.first],
        })
        .every(([, value]) => value === undefined)
    ).toBe(true);
  });

  it('refreshes a 409 conflict and publishes only the current server view', async () => {
    const reviewed = detail();
    const current = accepted(reviewed);
    mocks.get
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(current);
    mocks.transition.mockRejectedValue(new HttpError('changed', 409));
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);
    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => state.conflict && !state.busy && state.task?.version === 5);

    expect(state.task).toEqual(current);
    expect(state.uncertain).toBe(false);
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it('aborts an old command and discards its late result after owner and task change', async () => {
    const reviewed = detail();
    const next = detail({ assignmentId: ids.second, title: 'Current task', version: 0 });
    let resolveOld!: (value: WorkAssignmentMutationResult) => void;
    let commandSignal!: AbortSignal;
    mocks.get
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(next);
    mocks.transition.mockImplementation(
      (_id, _action, _input, _commandId, signal: AbortSignal) =>
        new Promise((resolve) => {
          commandSignal = signal;
          resolveOld = resolve;
        })
    );
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);
    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => mocks.transition.mock.calls.length === 1);

    mocks.owner = 'tenant-b:user-11:allow';
    currentItem = listed(next);
    await render();
    await waitFor(() => state.task?.assignmentId === ids.second && !state.query.isFetching);
    expect(commandSignal.aborted).toBe(true);
    await act(async () => resolveOld(mutation(reviewed, ids.command)));

    expect(state.task?.assignmentId).toBe(ids.second);
    expect(state.task?.title).toBe('Current task');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('lets a later source ACL read beat source metadata returned by a delayed mutation', async () => {
    const reviewed = detail();
    const unavailable = detail({}, false);
    let resolveMutation!: (value: WorkAssignmentMutationResult) => void;
    mocks.get
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(reviewed)
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(accepted(reviewed, false));
    mocks.transition.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        })
    );
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);
    await act(async () => expect(state.execute('accept')).toBe(true));
    await waitFor(() => mocks.transition.mock.calls.length === 1);
    await act(async () => {
      await state.query.refetch();
    });
    await waitFor(() => state.task?.source.availability === 'UNAVAILABLE');
    expect(state.task?.source).toEqual(source(false));

    await act(async () => resolveMutation(mutation(reviewed, ids.command, true)));
    await waitFor(() => state.outcome !== null && !state.busy);

    expect(mocks.get).toHaveBeenCalledTimes(4);
    expect(state.task?.source).toEqual(source(false));
    expect(state.task?.assignmentState).toBe('ACCEPTED');
  });

  it('requires a policy reason before decline or cancel can start', async () => {
    mocks.get.mockResolvedValue(detail());
    await render();
    await waitFor(() => state.query.isSuccess && !state.query.isFetching);

    expect(state.execute('decline')).toBe(false);
    expect(state.execute('decline', 'FREE_TEXT')).toBe(false);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
