// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  usePerformanceReviewRuntime,
  type PerformanceReviewCommandExecutor,
} from './use-performance-review';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { PerformanceReviewDataSource } from '../api/performance-review-api';
import type { PerformanceReviewSnapshot } from '../model/performance-review-types';
import {
  assignedPerformanceReviewFixture,
  PERFORMANCE_REVIEW_TEST_ID,
} from '../model/performance-review-test-fixtures';

const scope: ProductSurfaceRequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:assigned-review',
  cacheKey: [
    'tenant-1',
    'actor-1',
    'NORMAL',
    'hcm.operations',
    'scope:assigned-review',
    'decision-42',
  ],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:assigned-review',
    decisionRevision: 'decision-42',
  },
};

const SECOND_REVIEW_ID = '66666666-6666-4666-8666-666666666666';

function snapshotFor(
  reviewId: string,
  version = 7,
  text = 'Initial answer.'
): PerformanceReviewSnapshot {
  const review = assignedPerformanceReviewFixture({
    reviewId,
    aggregateVersion: version,
    answers: assignedPerformanceReviewFixture().answers.map((answer) =>
      answer.kind === 'TEXT' ? { ...answer, textValue: text } : answer
    ),
  });
  return { review, etag: '"review:' + String(version) + '"' };
}

function snapshot(version = 7, text = 'Initial answer.'): PerformanceReviewSnapshot {
  return snapshotFor(PERFORMANCE_REVIEW_TEST_ID.review, version, text);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function authority(descriptor: {
  idempotencyKey: string;
  expectedVersion: number;
}): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: scope.queryMeta.decisionRevision,
    contextKey: 'hcm.operations',
    contextScopeKey: scope.contextScopeKey!,
    idempotencyKey: descriptor.idempotencyKey,
    objectVersion: descriptor.expectedVersion,
  };
}

const executor: PerformanceReviewCommandExecutor = async (descriptor, execute) =>
  execute(authority(descriptor));

let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
let latest: ReturnType<typeof usePerformanceReviewRuntime>;
let renderHistory: Array<ReturnType<typeof usePerformanceReviewRuntime>>;

function Harness({
  dataSource,
  requestScope = scope,
  reviewId = PERFORMANCE_REVIEW_TEST_ID.review,
  commandExecutor = executor,
}: {
  dataSource: PerformanceReviewDataSource;
  requestScope?: ProductSurfaceRequestScope;
  reviewId?: string;
  commandExecutor?: PerformanceReviewCommandExecutor;
}) {
  latest = usePerformanceReviewRuntime({
    reviewId,
    requestScope,
    dataSource,
    commandExecutor,
    createIdempotencyKey: () => 'idempotency-key-0001',
  });
  renderHistory.push(latest);
  return null;
}

async function renderHarness(
  dataSource: PerformanceReviewDataSource,
  requestScope: ProductSurfaceRequestScope = scope,
  reviewId = PERFORMANCE_REVIEW_TEST_ID.review
) {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(Harness, { dataSource, requestScope, reviewId })
      )
    );
  });
  await act(async () => {
    await vi.waitFor(() => expect(latest.review?.reviewId).toBe(reviewId));
  });
}

describe('assigned performance-review runtime', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHistory = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
    vi.restoreAllMocks();
  });

  it('retries an ambiguous save with the exact idempotency key, body, ETag, and version', async () => {
    const read = vi.fn<PerformanceReviewDataSource['read']>().mockResolvedValue(snapshot());
    const saveDraft = vi
      .fn<PerformanceReviewDataSource['saveDraft']>()
      .mockRejectedValueOnce(new HttpTransportError('TIMEOUT'))
      .mockResolvedValueOnce(snapshot(8, 'Updated answer.'));
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft,
      submit: vi.fn(),
    };
    await renderHarness(dataSource);

    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Updated answer.',
      });
    });
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(false);
    });
    expect(latest.commandFailure?.kind).toBe('RETRYABLE');
    expect(latest.pendingKind).toBe('SAVE_DRAFT');

    const firstBody = saveDraft.mock.calls[0]![1];
    const firstExecution = saveDraft.mock.calls[0]![2];
    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(latest.commandFailure?.kind).toBe('RETRYABLE');
    expect(latest.pendingKind).toBe('SAVE_DRAFT');
    await act(async () => {
      await expect(latest.retryPending()).resolves.toBe(true);
    });
    expect(saveDraft.mock.calls[1]![1]).toBe(firstBody);
    expect(saveDraft.mock.calls[1]![2]).toEqual(firstExecution);
    expect(firstExecution).toMatchObject({
      idempotencyKey: 'idempotency-key-0001',
      expectedVersion: 7,
      etag: '"review:7"',
    });
    expect(latest.feedback).toBe('SAVED');
    expect(latest.dirty).toBe(false);
  });

  it('does not let a reload race and overwrite an active command', async () => {
    const save = deferred<PerformanceReviewSnapshot>();
    const read = vi.fn<PerformanceReviewDataSource['read']>().mockResolvedValue(snapshot());
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(() => save.promise),
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Pending answer.',
      });
    });
    let pendingSave!: Promise<boolean>;
    act(() => {
      pendingSave = latest.saveDraft();
    });
    await vi.waitFor(() => expect(latest.commandBusy).toBe(true));

    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    expect(read).toHaveBeenCalledTimes(1);
    save.resolve(snapshot(8, 'Pending answer.'));
    await act(async () => {
      await expect(pendingSave).resolves.toBe(true);
    });
    expect(latest.feedback).toBe('SAVED');
    expect(latest.review?.aggregateVersion).toBe(8);
  });

  it('preserves edits made during reload and blocks commands until the read settles', async () => {
    const reload = deferred<PerformanceReviewSnapshot>();
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(() => reload.promise);
    const saveDraft = vi.fn<PerformanceReviewDataSource['saveDraft']>();
    const submit = vi.fn<PerformanceReviewDataSource['submit']>();
    const dataSource: PerformanceReviewDataSource = { read, saveDraft, submit };
    await renderHarness(dataSource);

    let pendingReload!: Promise<boolean>;
    act(() => {
      pendingReload = latest.reload();
    });
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await act(async () => {
      await expect(latest.submit()).resolves.toBe(false);
    });
    expect(submit).not.toHaveBeenCalled();

    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Edit made while reload was pending.',
      });
    });
    expect(latest.dirty).toBe(true);
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(false);
    });
    expect(saveDraft).not.toHaveBeenCalled();

    reload.resolve(snapshot(8, 'Server answer from the pending reload.'));
    await act(async () => {
      await expect(pendingReload).resolves.toBe(false);
    });
    expect(latest.review?.aggregateVersion).toBe(7);
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Edit made while reload was pending.',
    });
    expect(latest.dirty).toBe(true);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('dispatches only one retry when the same pending command is retried twice rapidly', async () => {
    const successfulRetry = deferred<PerformanceReviewSnapshot>();
    const forbiddenLaterFailure = deferred<PerformanceReviewSnapshot>();
    const saveDraft = vi
      .fn<PerformanceReviewDataSource['saveDraft']>()
      .mockRejectedValueOnce(new HttpTransportError('TIMEOUT'))
      .mockImplementationOnce(() => successfulRetry.promise)
      .mockImplementationOnce(() => forbiddenLaterFailure.promise);
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn(async () => snapshot()),
      saveDraft,
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Retry exactly once.',
      });
    });
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(false);
    });
    expect(latest.commandFailure?.kind).toBe('RETRYABLE');

    let acceptedRetry!: Promise<boolean>;
    let duplicateRetry!: Promise<boolean>;
    await act(async () => {
      acceptedRetry = latest.retryPending();
      duplicateRetry = latest.retryPending();
      await expect(duplicateRetry).resolves.toBe(false);
    });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(latest.commandBusy).toBe(true);

    successfulRetry.resolve(snapshot(8, 'Retry exactly once.'));
    await act(async () => {
      await expect(acceptedRetry).resolves.toBe(true);
    });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(latest.commandFailure).toBeNull();
    expect(latest.pendingKind).toBeNull();
    expect(latest.feedback).toBe('SAVED');
    expect(latest.commandBusy).toBe(false);
  });

  it('does not dispatch when scope becomes unready before delayed authority executes', async () => {
    let releaseAuthority!: () => void;
    const delayedExecutor: PerformanceReviewCommandExecutor = (descriptor, execute) =>
      new Promise((resolve, reject) => {
        releaseAuthority = () => {
          void execute(authority(descriptor)).then(resolve, reject);
        };
      });
    const saveDraft = vi.fn<PerformanceReviewDataSource['saveDraft']>();
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn(async () => snapshot()),
      saveDraft,
      submit: vi.fn(),
    };
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, commandExecutor: delayedExecutor })
        )
      );
    });
    await vi.waitFor(() => expect(latest.review?.reviewId).toBe(PERFORMANCE_REVIEW_TEST_ID.review));
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Pending authority answer.',
      });
    });
    let pendingSave!: Promise<boolean>;
    act(() => {
      pendingSave = latest.saveDraft();
    });
    await vi.waitFor(() => expect(latest.commandBusy).toBe(true));

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, {
            dataSource,
            commandExecutor: delayedExecutor,
            requestScope: { ...scope, ready: false },
          })
        )
      );
    });
    releaseAuthority();
    await act(async () => {
      await expect(pendingSave).resolves.toBe(false);
    });
    expect(saveDraft).not.toHaveBeenCalled();
    expect(latest.review).toBeUndefined();
    expect(latest.answers).toEqual([]);
  });

  it('keeps a stale CAS side-effect free and reloads the authoritative draft', async () => {
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot(9, 'Authoritative answer.'));
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(async () => {
        throw new HttpError('conflict', 409);
      }),
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Stale local answer.',
      });
    });
    await act(async () => {
      await latest.saveDraft();
    });
    expect(latest.commandFailure?.kind).toBe('CONFLICT');
    expect(latest.dirty).toBe(true);

    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(latest.dirty).toBe(true);
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Stale local answer.',
    });
    await act(async () => {
      await expect(latest.discardAndReload()).resolves.toBe(true);
    });
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Authoritative answer.',
    });
    expect(latest.review?.aggregateVersion).toBe(9);
    expect(latest.dirty).toBe(false);
  });

  it('keeps the edited snapshot CAS pinned across a newer background refetch', async () => {
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot(8, 'Newer server answer.'));
    const saveDraft = vi
      .fn<PerformanceReviewDataSource['saveDraft']>()
      .mockResolvedValue(snapshot(8, 'Local edit.'));
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft,
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Local edit.',
      });
    });

    await act(async () => {
      await client.refetchQueries({
        queryKey: ['hris', 'performance', 'assigned-review'],
      });
    });

    expect(latest.review?.aggregateVersion).toBe(7);
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Local edit.',
    });
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(true);
    });
    expect(saveDraft).toHaveBeenCalledWith(
      PERFORMANCE_REVIEW_TEST_ID.review,
      expect.objectContaining({
        answers: expect.arrayContaining([
          expect.objectContaining({ kind: 'TEXT', textValue: 'Local edit.' }),
        ]),
      }),
      expect.objectContaining({ expectedVersion: 7, etag: '"review:7"' })
    );
  });

  it('preserves exact replay when a post-dispatch save response changes identity', async () => {
    const changedIdentity = snapshot(8, 'Updated answer.');
    const saveDraft = vi
      .fn<PerformanceReviewDataSource['saveDraft']>()
      .mockResolvedValueOnce({
        ...changedIdentity,
        review: { ...changedIdentity.review, participantId: SECOND_REVIEW_ID },
      })
      .mockResolvedValueOnce(snapshot(8, 'Updated answer.'));
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn(async () => snapshot()),
      saveDraft,
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Updated answer.',
      });
    });
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(false);
    });
    expect(latest.commandFailure?.kind).toBe('RETRYABLE');
    expect(latest.pendingKind).toBe('SAVE_DRAFT');
    const firstBody = saveDraft.mock.calls[0]![1];
    const firstExecution = saveDraft.mock.calls[0]![2];

    await act(async () => {
      await expect(latest.retryPending()).resolves.toBe(true);
    });
    expect(saveDraft.mock.calls[1]![1]).toBe(firstBody);
    expect(saveDraft.mock.calls[1]![2]).toEqual(firstExecution);
  });

  it('preserves exact replay when post-dispatch submission evidence changes hash', async () => {
    const submission = {
      submissionId: PERFORMANCE_REVIEW_TEST_ID.submission,
      submissionNo: 1,
      state: 'SUBMITTED' as const,
      contentHash: assignedPerformanceReviewFixture().draftContentHash,
      submittedAt: '2027-03-01T00:00:00Z',
    };
    const submit = vi
      .fn<PerformanceReviewDataSource['submit']>()
      .mockResolvedValueOnce({ ...submission, contentHash: 'b'.repeat(64) })
      .mockResolvedValueOnce(submission);
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn(async () => snapshot()),
      saveDraft: vi.fn(),
      submit,
    };
    await renderHarness(dataSource);
    await act(async () => {
      await expect(latest.submit()).resolves.toBe(false);
    });
    expect(latest.commandFailure?.kind).toBe('RETRYABLE');
    expect(latest.pendingKind).toBe('SUBMIT');
    const firstBody = submit.mock.calls[0]![1];
    const firstExecution = submit.mock.calls[0]![2];

    await act(async () => {
      await expect(latest.retryPending()).resolves.toBe(true);
    });
    expect(submit.mock.calls[1]![1]).toBe(firstBody);
    expect(submit.mock.calls[1]![2]).toEqual(firstExecution);
    expect(latest.feedback).toBe('SUBMITTED');
  });

  it('hides prior assignment data immediately when governed scope changes', async () => {
    let resolveNext: ((value: PerformanceReviewSnapshot) => void) | undefined;
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNext = resolve;
          })
      );
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(),
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Sensitive local answer.',
      });
    });
    const transitionStart = renderHistory.length;
    const nextScope: ProductSurfaceRequestScope = {
      ...scope,
      contextScopeKey: 'scope:other-assignment',
      cacheKey: [
        'tenant-1',
        'actor-1',
        'NORMAL',
        'hcm.operations',
        'scope:other-assignment',
        'decision-43',
      ],
      queryMeta: {
        ...scope.queryMeta,
        contextScopeKey: 'scope:other-assignment',
        decisionRevision: 'decision-43',
      },
    };
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, requestScope: nextScope })
        )
      );
    });
    const immediateTransition = renderHistory[transitionStart]!;
    expect(immediateTransition.review).toBeUndefined();
    expect(immediateTransition.answers).toEqual([]);
    expect(immediateTransition.validation.issues).toEqual([]);
    expect(immediateTransition.submission).toBeNull();
    expect(immediateTransition.dirty).toBe(false);
    expect(immediateTransition.feedback).toBeNull();
    expect(immediateTransition.loading).toBe(true);
    expect(latest.review).toBeUndefined();
    expect(latest.answers).toEqual([]);
    await act(async () => resolveNext?.(snapshot(10, 'Other scope.')));
  });

  it('does not dispatch reads or forced reloads before governed scope is ready', async () => {
    const unreadyScope: ProductSurfaceRequestScope = {
      governed: true,
      ready: false,
      cacheKey: ['tenant-1', 'actor-1', 'NORMAL', 'hcm.operations', '', 'decision-42'],
      queryMeta: {
        accessSensitive: true,
        tenantId: 'tenant-1',
        actorId: 'actor-1',
        accessMode: 'NORMAL',
        productId: 'hcm',
        surfaceId: 'hcm.operations',
        decisionRevision: 'decision-42',
      },
    };
    const read = vi.fn<PerformanceReviewDataSource['read']>();
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(),
      submit: vi.fn(),
    };
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, requestScope: unreadyScope })
        )
      );
    });

    expect(latest.loading).toBe(true);
    expect(latest.review).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('redacts a loaded dirty review and disables commands when governed scope becomes unready', async () => {
    const read = vi.fn<PerformanceReviewDataSource['read']>().mockResolvedValue(snapshot());
    const saveDraft = vi.fn<PerformanceReviewDataSource['saveDraft']>();
    const submit = vi.fn<PerformanceReviewDataSource['submit']>();
    const dataSource: PerformanceReviewDataSource = { read, saveDraft, submit };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Sensitive unsaved answer.',
      });
    });
    const transitionStart = renderHistory.length;
    const unreadyScope: ProductSurfaceRequestScope = {
      ...scope,
      ready: false,
    };
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, requestScope: unreadyScope })
        )
      );
    });

    const immediateTransition = renderHistory[transitionStart]!;
    expect(immediateTransition.review).toBeUndefined();
    expect(immediateTransition.etag).toBeUndefined();
    expect(immediateTransition.answers).toEqual([]);
    expect(immediateTransition.validation.issues).toEqual([]);
    expect(immediateTransition.submission).toBeNull();
    expect(immediateTransition.dirty).toBe(false);
    expect(immediateTransition.pendingKind).toBeNull();
    expect(immediateTransition.feedback).toBeNull();
    expect(immediateTransition.loading).toBe(true);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Must not be accepted.',
      });
      await expect(latest.saveDraft()).resolves.toBe(false);
      await expect(latest.submit()).resolves.toBe(false);
      await expect(latest.retryPending()).resolves.toBe(false);
      await expect(latest.reload()).resolves.toBe(false);
      await expect(latest.discardAndReload()).resolves.toBe(false);
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(saveDraft).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('purges a retained draft when a reload revokes assignment authority', async () => {
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new HttpError('opaque absence', 404));
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(),
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.denied).toBe(true));
    });
    expect(latest.review).toBeUndefined();
    expect(latest.answers).toEqual([]);
  });

  it('purges retained data when a mutation denial follows a masked partial-load error', async () => {
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'));
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(async () => {
        throw new HttpError('opaque denial', 403);
      }),
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    await vi.waitFor(() => expect(latest.loadFailure?.kind).toBe('RETRYABLE'));
    expect(latest.partial).toBe(true);

    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'A locally retained answer.',
      });
    });
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(false);
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.denied).toBe(true));
    });
    expect(latest.review).toBeUndefined();
    expect(latest.answers).toEqual([]);
  });

  it('does not submit from a partial snapshot after a failed refetch', async () => {
    const read = vi
      .fn<PerformanceReviewDataSource['read']>()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValueOnce(new HttpTransportError('NETWORK'));
    const submit = vi.fn<PerformanceReviewDataSource['submit']>();
    const dataSource: PerformanceReviewDataSource = {
      read,
      saveDraft: vi.fn(),
      submit,
    };
    await renderHarness(dataSource);
    await act(async () => {
      await expect(latest.reload()).resolves.toBe(false);
    });
    await vi.waitFor(() => expect(latest.partial).toBe(true));
    await act(async () => {
      await expect(latest.submit()).resolves.toBe(false);
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it('lets review B save while a late save from review A remains isolated', async () => {
    const saveA = deferred<PerformanceReviewSnapshot>();
    const saveDraft = vi.fn<PerformanceReviewDataSource['saveDraft']>((reviewId) =>
      reviewId === SECOND_REVIEW_ID
        ? Promise.resolve(snapshotFor(SECOND_REVIEW_ID, 5, 'Saved review B answer.'))
        : saveA.promise
    );
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn(async (reviewId) =>
        reviewId === SECOND_REVIEW_ID
          ? snapshotFor(SECOND_REVIEW_ID, 4, 'Review B answer.')
          : snapshot()
      ),
      saveDraft,
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Pending review A answer.',
      });
    });
    let pendingSave!: Promise<boolean>;
    act(() => {
      pendingSave = latest.saveDraft();
    });
    await vi.waitFor(() => expect(dataSource.saveDraft).toHaveBeenCalledOnce());

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, reviewId: SECOND_REVIEW_ID })
        )
      );
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.review?.reviewId).toBe(SECOND_REVIEW_ID));
    });
    await act(async () => {
      latest.updateAnswer('a_text', {
        itemKey: 'a_text',
        kind: 'TEXT',
        textValue: 'Saved review B answer.',
      });
    });
    await act(async () => {
      await expect(latest.saveDraft()).resolves.toBe(true);
    });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(latest.review?.aggregateVersion).toBe(5);
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Saved review B answer.',
    });

    saveA.resolve(snapshot(8, 'Late review A answer.'));
    await act(async () => {
      await expect(pendingSave).resolves.toBe(false);
    });

    expect(latest.review?.reviewId).toBe(SECOND_REVIEW_ID);
    expect(latest.review?.aggregateVersion).toBe(5);
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Saved review B answer.',
    });
    expect(latest.feedback).toBe('SAVED');
  });

  it('ignores a late submit from review A after selection changes to review B', async () => {
    const submit = deferred<Awaited<ReturnType<PerformanceReviewDataSource['submit']>>>();
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn(async (reviewId) =>
        reviewId === SECOND_REVIEW_ID
          ? snapshotFor(SECOND_REVIEW_ID, 4, 'Review B answer.')
          : snapshot()
      ),
      saveDraft: vi.fn(),
      submit: vi.fn(() => submit.promise),
    };
    await renderHarness(dataSource);
    let pendingSubmit!: Promise<boolean>;
    act(() => {
      pendingSubmit = latest.submit();
    });
    await vi.waitFor(() => expect(dataSource.submit).toHaveBeenCalledOnce());

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, reviewId: SECOND_REVIEW_ID })
        )
      );
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.review?.reviewId).toBe(SECOND_REVIEW_ID));
    });
    submit.resolve({
      submissionId: PERFORMANCE_REVIEW_TEST_ID.submission,
      submissionNo: 1,
      state: 'SUBMITTED',
      contentHash: assignedPerformanceReviewFixture().draftContentHash,
      submittedAt: '2027-03-01T00:00:00Z',
    });
    await act(async () => {
      await expect(pendingSubmit).resolves.toBe(false);
    });

    expect(latest.review?.reviewId).toBe(SECOND_REVIEW_ID);
    expect(latest.submission).toBeNull();
    expect(latest.feedback).toBeNull();
  });

  it('ignores a late reload from review A after selection changes to review B', async () => {
    const reload = deferred<PerformanceReviewSnapshot>();
    let firstReviewReads = 0;
    const dataSource: PerformanceReviewDataSource = {
      read: vi.fn((reviewId) => {
        if (reviewId === SECOND_REVIEW_ID) {
          return Promise.resolve(snapshotFor(SECOND_REVIEW_ID, 4, 'Review B answer.'));
        }
        firstReviewReads += 1;
        return firstReviewReads === 1 ? Promise.resolve(snapshot()) : reload.promise;
      }),
      saveDraft: vi.fn(),
      submit: vi.fn(),
    };
    await renderHarness(dataSource);
    let pendingReload!: Promise<boolean>;
    act(() => {
      pendingReload = latest.reload();
    });
    await vi.waitFor(() => expect(firstReviewReads).toBe(2));

    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(Harness, { dataSource, reviewId: SECOND_REVIEW_ID })
        )
      );
    });
    await act(async () => {
      await vi.waitFor(() => expect(latest.review?.reviewId).toBe(SECOND_REVIEW_ID));
    });
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Review B answer.',
    });
    reload.resolve(snapshot(9, 'Late review A reload.'));
    await act(async () => {
      await expect(pendingReload).resolves.toBe(false);
    });

    expect(latest.review?.reviewId).toBe(SECOND_REVIEW_ID);
    expect(latest.answers.find((answer) => answer.kind === 'TEXT')).toMatchObject({
      textValue: 'Review B answer.',
    });
    expect(latest.feedback).toBeNull();
  });
});
