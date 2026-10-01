// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHrisPerformanceCycleRuntime } from '../hooks/use-performance-cycle-studio';
import { performanceCyclePublishCommand } from '../hooks/use-performance-cycle-command-executors';
import {
  createApprovalHighRiskAttempt,
  restartApprovalHighRiskAttempt,
} from '../../../../components/product-surface-high-risk-command-model';
import {
  performanceCycleDetailQueryKey,
  performanceReceiptQueryKey,
} from '../model/performance-cycle-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { PerformanceCycleDataSource } from '../api/performance-cycle-api';
import type {
  HrisPerformanceCycleRuntime,
  PerformanceCommandExecutor,
  PerformanceCommandExecutors,
  PerformancePublishCommandExecutor,
} from '../hooks/use-performance-cycle-studio';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

const ID = {
  cycle: '11111111-1111-4111-8111-111111111111',
  version: '22222222-2222-4222-8222-222222222222',
  retention: '33333333-3333-4333-8333-333333333333',
  policy: '44444444-4444-4444-8444-444444444444',
  rule: '55555555-5555-4555-8555-555555555555',
  stage: '66666666-6666-4666-8666-666666666666',
  command: '88888888-8888-4888-8888-888888888888',
  receipt: '88888888-8888-4888-8888-888888888888',
  otherReceipt: '99999999-9999-4999-8999-999999999999',
} as const;
const HASH = 'a'.repeat(64);

function cycleDetail(
  lifecycleState: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' = 'DRAFT',
  aggregateVersion = 1,
  allowedActions: string[] = ['VIEW', 'UPDATE_DRAFT']
) {
  const published = lifecycleState === 'PUBLISHED';
  return {
    cycleId: ID.cycle,
    cycleKey: 'FY27',
    displayName: 'FY27 performance cycle',
    lifecycleState,
    activeVersionNo: 1,
    aggregateVersion,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: null,
    retentionPolicyId: ID.retention,
    createdAt: '2025-12-01T00:00:00Z',
    createdBy: 41,
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: 41,
    allowedActions,
    version: {
      cycleVersionId: ID.version,
      versionNo: 1,
      versionState: lifecycleState,
      aggregateVersion,
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: null,
      timezoneId: 'UTC',
      policyVersionId: ID.policy,
      populationRuleVersionId: ID.rule,
      contentHash: HASH,
      authoredBy: 41,
      publishedAt: published ? '2026-02-01T00:00:00Z' : null,
      publishedBy: published ? 42 : null,
      stages: [
        {
          stageId: ID.stage,
          stageKey: 'SELF_REVIEW',
          stageType: 'SELF_REVIEW',
          sequenceNo: 1,
          opensAt: '2026-01-01T00:00:00Z',
          closesAt: '2026-03-01T00:00:00Z',
          required: true,
          stageConfig: {},
        },
      ],
    },
  };
}

function collection(detail: ReturnType<typeof cycleDetail>, collectionActions: string[] = []) {
  return {
    cycles: [
      {
        cycleId: detail.cycleId,
        cycleKey: detail.cycleKey,
        displayName: detail.displayName,
        lifecycleState: detail.lifecycleState,
        activeVersionNo: detail.activeVersionNo,
        aggregateVersion: detail.aggregateVersion,
        effectiveFrom: detail.effectiveFrom,
        effectiveTo: detail.effectiveTo,
        allowedActions: detail.allowedActions,
      },
    ],
    allowedActions: collectionActions,
  };
}

function updateReceipt(state: 'RUNNING' | 'SUCCEEDED' | 'RESULT_UNKNOWN') {
  const succeeded = state === 'SUCCEEDED';
  return {
    receiptId: ID.receipt,
    commandType: 'UPDATE_DRAFT',
    originatingAction: 'performance.cycle.update',
    aggregateId: ID.cycle,
    expectedAggregateVersion: 1,
    appliedAggregateVersion: succeeded ? 2 : null,
    state,
    resultRef: succeeded ? ID.cycle : null,
    errorCode: null,
    acceptedAt: '2026-01-01T00:00:00Z',
    completedAt: succeeded ? '2026-01-01T00:00:01Z' : null,
  };
}

function succeededUpdate(detail: ReturnType<typeof cycleDetail>) {
  return { cycle: detail, receipt: updateReceipt('SUCCEEDED') };
}

const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:talent',
  cacheKey: ['tenant-1', 'actor-1', 'NORMAL', 'hcm.operations', 'scope:talent', 'decision-1'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:talent',
    decisionRevision: 'decision-1',
  },
};

function executor(spy = vi.fn()): PerformanceCommandExecutor {
  return async <T,>(
    operation: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
  ) => {
    spy();
    return operation({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' });
  };
}

function commandExecutors(
  author: PerformanceCommandExecutor = executor(),
  publish: PerformancePublishCommandExecutor = executor()
): PerformanceCommandExecutors {
  return {
    create: author,
    update: author,
    validate: author,
    preview: author,
    publish,
  };
}

function rotatedPublishExecutor(commandId: string): PerformancePublishCommandExecutor {
  return async (execute, binding) => {
    const authority = {
      rolloutState: '111',
      expectedDecisionRevision: 'decision-2',
      contextKey: 'hcm-operations',
      contextScopeKey: 'scope:talent',
    } as const;
    const restarted = restartApprovalHighRiskAttempt(
      createApprovalHighRiskAttempt(performanceCyclePublishCommand(binding), authority),
      authority,
      commandId
    );
    return execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' }, restarted.descriptor);
  };
}

let root: Root;
let mount: HTMLDivElement;
let queryClient: QueryClient;
let latest: HrisPerformanceCycleRuntime;

function Harness(props: {
  dataSource: PerformanceCycleDataSource;
  commandExecutors?: PerformanceCommandExecutors;
}) {
  latest = useHrisPerformanceCycleRuntime({ requestScope: scope, ...props });
  return null;
}

async function renderHarness(props: Parameters<typeof Harness>[0]) {
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client: queryClient }, createElement(Harness, props))
    );
  });
}

async function waitForCycleDetail() {
  await act(async () => {
    await vi.waitFor(() => expect(latest.collection).not.toBeNull());
  });
  await act(async () => {
    await vi.waitFor(() => expect(latest.selectedCycleId).toBe(ID.cycle));
  });
  await act(async () => {
    await vi.waitFor(() => expect(latest.detail?.cycleId).toBe(ID.cycle));
  });
}

function dataSource(readDetail: unknown, collectionActions: string[] = []) {
  const detail = readDetail as ReturnType<typeof cycleDetail>;
  return {
    readCollection: vi.fn().mockResolvedValue(collection(detail, collectionActions)),
    readCycle: vi.fn().mockResolvedValue(detail),
    readReceipt: vi.fn(),
    createCycle: vi.fn(),
    updateCycle: vi.fn(),
    validateCycle: vi.fn(),
    previewPopulation: vi.fn(),
    publishCycle: vi.fn(),
  };
}

describe('HRIS performance cycle studio runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    mount.remove();
    vi.restoreAllMocks();
  });

  it('fails closed without injected command executors even when the server advertises actions', async () => {
    const detail = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(detail, ['CREATE_DRAFT']);

    await renderHarness({ dataSource: source as unknown as PerformanceCycleDataSource });
    await waitForCycleDetail();

    expect(latest.canCreate).toBe(false);
    expect(latest.canEdit).toBe(false);
    act(() => latest.openCreate());
    act(() => latest.openEdit());
    expect(latest.draft).toBeNull();
    expect(source.createCycle).not.toHaveBeenCalled();
    expect(source.updateCycle).not.toHaveBeenCalled();
    expect(source.publishCycle).not.toHaveBeenCalled();
  });

  it('allows the author executor to open a successor draft from PUBLISHED only with UPDATE_DRAFT', async () => {
    const allowed = cycleDetail('PUBLISHED', 3, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(allowed);
    const author = executor();

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(author),
    });
    await waitForCycleDetail();
    await act(async () => {
      await vi.waitFor(() => expect(latest.detail?.lifecycleState).toBe('PUBLISHED'));
    });
    expect(latest.canEdit).toBe(true);
    act(() => latest.openEdit());
    expect(latest.draft?.expectedRevision).toBe(3);

    const denied = cycleDetail('PUBLISHED', 3, ['VIEW']);
    (source.readCollection as ReturnType<typeof vi.fn>).mockResolvedValue(collection(denied));
    (source.readCycle as ReturnType<typeof vi.fn>).mockResolvedValue(denied);
    queryClient.clear();
    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(author),
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.detail?.allowedActions).toEqual(['VIEW']));
    });
    expect(latest.canEdit).toBe(false);
  });

  it('dispatches UPDATE only through the exact update executor', async () => {
    const before = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const after = cycleDetail('DRAFT', 2, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(before);
    (source.updateCycle as ReturnType<typeof vi.fn>).mockResolvedValue(succeededUpdate(after));
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ID.command);
    const calls = {
      create: vi.fn(),
      update: vi.fn(),
      validate: vi.fn(),
      preview: vi.fn(),
      publish: vi.fn(),
    };

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: {
        create: executor(calls.create),
        update: executor(calls.update),
        validate: executor(calls.validate),
        preview: executor(calls.preview),
        publish: executor(calls.publish),
      },
    });
    await waitForCycleDetail();
    act(() => latest.openEdit());
    await act(async () => latest.saveDraft());
    await act(async () => {
      await vi.waitFor(() => expect(latest.feedback).toBe('SAVED'));
    });

    expect(calls.update).toHaveBeenCalledOnce();
    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.validate).not.toHaveBeenCalled();
    expect(calls.preview).not.toHaveBeenCalled();
    expect(calls.publish).not.toHaveBeenCalled();
    expect(source.updateCycle).toHaveBeenCalledWith(ID.cycle, expect.any(Object), {
      mode: 'LEGACY_COMPATIBILITY',
      rolloutState: '000',
    });
  });

  it('accepts a PER publish receipt bound to the proof-reissued command id', async () => {
    const previewCommandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    const originalPublishCommandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const rotatedPublishCommandId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
    const validated = cycleDetail('VALIDATED', 7, ['VIEW', 'PREVIEW_PARTICIPANTS', 'PUBLISH']);
    const published = cycleDetail('PUBLISHED', 8, ['VIEW']);
    const preview = {
      populationPreviewId: ID.otherReceipt,
      cycleVersionId: ID.version,
      workforceSnapshotId: ID.retention,
      workforceSnapshotRevision: 31,
      populationRuleVersionId: ID.rule,
      state: 'READY',
      participantCount: 0,
      reviewerAssignmentCount: 0,
      contentHash: HASH,
      aggregateVersion: 1,
      sourceCycleAggregateVersion: 7,
      createdAt: '2026-09-01T00:00:00Z',
      expiresAt: '2099-09-01T00:00:00Z',
      members: [],
    } as const;
    const source = dataSource(validated);
    (source.readCycle as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(validated)
      .mockResolvedValueOnce(published);
    (source.previewPopulation as ReturnType<typeof vi.fn>).mockImplementation(
      (_cycleId: string, request: { commandId: string; expectedRevision: number }) =>
        Promise.resolve({
          preview,
          receipt: {
            receiptId: request.commandId,
            commandType: 'PREVIEW_PARTICIPANTS',
            originatingAction: 'performance.cycle.preview',
            aggregateId: ID.cycle,
            expectedAggregateVersion: request.expectedRevision,
            appliedAggregateVersion: preview.aggregateVersion,
            state: 'SUCCEEDED',
            resultRef: preview.populationPreviewId,
            errorCode: null,
            acceptedAt: '2026-09-01T00:00:00Z',
            completedAt: '2026-09-01T00:00:01Z',
          },
        })
    );
    (source.publishCycle as ReturnType<typeof vi.fn>).mockImplementation(
      (_cycleId: string, request: { commandId: string; expectedRevision: number }) =>
        Promise.resolve({
          cycle: published,
          receipt: {
            receiptId: request.commandId,
            commandType: 'PUBLISH',
            originatingAction: 'performance.cycle.publish',
            aggregateId: ID.cycle,
            expectedAggregateVersion: request.expectedRevision,
            appliedAggregateVersion: published.aggregateVersion,
            state: 'SUCCEEDED',
            resultRef: ID.cycle,
            errorCode: null,
            acceptedAt: '2026-09-01T00:00:02Z',
            completedAt: '2026-09-01T00:00:03Z',
          },
        })
    );
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(previewCommandId)
      .mockReturnValueOnce(originalPublishCommandId);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(
        executor(),
        rotatedPublishExecutor(rotatedPublishCommandId)
      ),
    });
    await waitForCycleDetail();
    await act(async () => latest.previewSelected('2026-09-01T00:00:00Z'));
    await act(async () => {
      await vi.waitFor(() => expect(latest.canPublish).toBe(true));
    });
    await act(async () =>
      latest.publishSelected(ID.policy, 'Approved publication evidence for the frozen population.')
    );
    await act(async () => {
      await vi.waitFor(() => expect(latest.feedback).toBe('PUBLISHED'));
    });

    expect(source.publishCycle).toHaveBeenCalledOnce();
    expect((source.publishCycle as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toMatchObject({
      commandId: rotatedPublishCommandId,
      expectedRevision: 7,
    });
    expect(latest.failure).toBeNull();
    expect(latest.detail?.aggregateVersion).toBe(8);
  });

  it.each([
    ['network failure', () => new HttpTransportError('NETWORK')],
    ['post-dispatch abort', () => new HttpTransportError('ABORT')],
    ['server failure', () => new HttpError('Gateway failed after dispatch.', 503)],
  ])('replays an update after %s with the exact same command id and body', async (_, failure) => {
    const before = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const after = cycleDetail('DRAFT', 2, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(before);
    (source.readCycle as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    (source.updateCycle as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(failure())
      .mockResolvedValueOnce(succeededUpdate(after));
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ID.command);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(),
    });
    await waitForCycleDetail();
    await act(async () => {
      await vi.waitFor(() => expect(latest.detail?.aggregateVersion).toBe(1));
      latest.openEdit();
    });
    await act(async () => latest.saveDraft());
    await act(async () => {
      await vi.waitFor(() => expect(latest.failure?.kind).toBe('RESULT_UNKNOWN'));
    });
    expect(latest.failure?.replayExactCommand).toBe(true);
    const firstRequest = (source.updateCycle as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(firstRequest.commandId).toBe(ID.command);

    await act(async () => latest.retryUnknownCommand());
    await act(async () => {
      await vi.waitFor(() => expect(latest.feedback).toBe('SAVED'));
    });
    const secondRequest = (source.updateCycle as ReturnType<typeof vi.fn>).mock.calls[1]?.[1];
    expect(secondRequest).toBe(firstRequest);
    expect(secondRequest.commandId).toBe(ID.command);
    expect(latest.detail?.aggregateVersion).toBe(2);
  });

  it('rejects a successful command response whose receipt identity does not match the request', async () => {
    const before = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const after = cycleDetail('DRAFT', 2, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(before);
    const mismatched = {
      cycle: after,
      receipt: {
        ...updateReceipt('SUCCEEDED'),
        receiptId: ID.otherReceipt,
      },
    };
    (source.updateCycle as ReturnType<typeof vi.fn>).mockResolvedValue(mismatched);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ID.command);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(),
    });
    await waitForCycleDetail();
    act(() => latest.openEdit());
    await act(async () => latest.saveDraft());
    await act(async () => {
      await vi.waitFor(() => expect(latest.failure?.kind).toBe('RESULT_UNKNOWN'));
    });
    expect(latest.failure?.replayExactCommand).toBe(true);
    expect(latest.feedback).toBeNull();
    const firstRequest = (source.updateCycle as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];

    await act(async () => latest.retryUnknownCommand());
    await act(async () => {
      await vi.waitFor(() => expect(source.updateCycle).toHaveBeenCalledTimes(2));
    });
    expect((source.updateCycle as ReturnType<typeof vi.fn>).mock.calls[1]?.[1]).toBe(firstRequest);
  });

  it('does not replay when receipt polling returns a different receipt identity', async () => {
    const detail = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(detail);
    (source.updateCycle as ReturnType<typeof vi.fn>).mockResolvedValue({
      cycle: null,
      receipt: updateReceipt('RESULT_UNKNOWN'),
    });
    (source.readReceipt as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...updateReceipt('SUCCEEDED'),
      receiptId: ID.otherReceipt,
    });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ID.command);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(),
    });
    await waitForCycleDetail();
    act(() => latest.openEdit());
    await act(async () => latest.saveDraft());
    await act(async () => {
      await vi.waitFor(() => expect(latest.receiptError).toBeTruthy());
    });

    expect(source.readReceipt).toHaveBeenCalledWith(
      ID.command,
      scope.contextScopeKey,
      expect.anything()
    );
    expect(source.updateCycle).toHaveBeenCalledTimes(1);
    expect(latest.failure?.kind).toBe('RESULT_UNKNOWN');
    expect(latest.feedback).toBeNull();
  });

  it('masks cached detail and disables actions when a detail refetch loses authority', async () => {
    const detail = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(detail);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(),
    });
    await waitForCycleDetail();
    act(() => latest.openEdit());
    expect(latest.draft).not.toBeNull();
    (source.readCycle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HttpError('Forbidden.', 403)
    );

    await act(async () => {
      await latest.refetchDetail();
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.failure?.kind).toBe('FORBIDDEN'));
    });
    expect(latest.detail).toBeNull();
    expect(latest.draft).toBeNull();
    expect(latest.preview).toBeNull();
    expect(latest.canEdit).toBe(false);
    expect(
      queryClient.getQueryData(performanceCycleDetailQueryKey(scope, ID.cycle))
    ).toBeUndefined();
  });

  it('purges cached state when receipt reconciliation loses authority', async () => {
    const detail = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(detail);
    (source.updateCycle as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('Outcome unavailable.', 503, { receiptId: ID.receipt })
    );
    (source.readReceipt as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(updateReceipt('RUNNING'))
      .mockRejectedValueOnce(new HttpError('Unauthenticated.', 401));
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(ID.command);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(),
    });
    await waitForCycleDetail();
    act(() => latest.openEdit());
    await act(async () => latest.saveDraft());
    await act(async () => {
      await vi.waitFor(() => expect(latest.receipt?.state).toBe('RUNNING'));
    });
    await act(async () => {
      await latest.checkReceipt();
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.failure?.kind).toBe('UNAUTHENTICATED'));
    });

    expect(source.readReceipt).toHaveBeenCalledWith(
      ID.receipt,
      scope.contextScopeKey,
      expect.anything()
    );
    expect(latest.detail).toBeNull();
    expect(latest.draft).toBeNull();
    expect(latest.preview).toBeNull();
    expect(latest.recovery).toBeNull();
    expect(latest.canEdit).toBe(false);
    expect(queryClient.getQueryData(performanceReceiptQueryKey(scope, ID.receipt))).toBeUndefined();
  });

  it('does not let a context-invalid cached collection authorize create', async () => {
    const detail = cycleDetail('DRAFT', 1, ['VIEW', 'UPDATE_DRAFT']);
    const source = dataSource(detail, ['CREATE_DRAFT']);

    await renderHarness({
      dataSource: source as unknown as PerformanceCycleDataSource,
      commandExecutors: commandExecutors(),
    });
    await waitForCycleDetail();
    expect(latest.canCreate).toBe(true);
    (source.readCollection as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HttpError('Context changed.', 409)
    );

    await act(async () => {
      await latest.refetchCollection();
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.collection).toBeNull());
    });
    expect(latest.canCreate).toBe(false);
  });
});
