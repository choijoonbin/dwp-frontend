import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApprovalDraftAutosave,
  ApprovalDraftSaveBlockedError,
  ApprovalDraftSaveConflictError,
} from './approval-request-autosave-model';

import type {
  ApprovalDraftReceipt,
  ApprovalDraftSaveAttempt,
  ApprovalDraftSnapshot,
} from './approval-request-autosave-model';

const input = (title = 'Local draft'): ApprovalDraftSnapshot => ({
  workflowId: 'workflow-1',
  formId: 'form-1',
  title,
  summary: '',
  priority: 'NORMAL',
  payload: { summary: '', createdFrom: 'DWP_APPROVALS' },
});
const receipt = (version = 1): ApprovalDraftReceipt => ({
  requestId: 'request-1',
  version,
  status: 'DRAFT',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('Approval draft autosave queue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces partial content and does not create an entirely blank draft automatically', async () => {
    const save = vi.fn().mockResolvedValue(receipt());
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile: save,
      classify: () => 'ERROR',
    });
    controller.update(input(''), true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).not.toHaveBeenCalled();
    controller.update(input('Partial'), true);
    await vi.advanceTimersByTimeAsync(1000);
    controller.update(input('Partial title'), true);
    await vi.advanceTimersByTimeAsync(1749);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toMatchObject({
      input: { title: 'Partial title', summary: '' },
    });
    expect(controller.getSnapshot()).toMatchObject({
      status: 'SAVED',
      dirty: false,
      receipt: receipt(),
    });
  });

  it('serializes close and concurrent flush calls, draining newer input with the returned version', async () => {
    const first = deferred<ApprovalDraftReceipt>();
    const second = deferred<ApprovalDraftReceipt>();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile: save,
      classify: () => 'ERROR',
    });
    controller.update(input('First'), true);
    const close = controller.flush();
    const duplicateClose = controller.flush();
    controller.update(input('Latest while saving'), true);
    first.resolve(receipt(4));
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0]).toMatchObject({
      requestId: 'request-1',
      expectedVersion: 4,
      input: { title: 'Latest while saving' },
    });
    let closed = false;
    void close.then(() => {
      closed = true;
    });
    expect(closed).toBe(false);
    second.resolve(receipt(5));
    await expect(close).resolves.toEqual(receipt(5));
    await expect(duplicateClose).resolves.toEqual(receipt(5));
    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({ status: 'SAVED', dirty: false });
  });

  it('preserves the immutable attempt key and input until an unknown result is reconciled', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Response connection lost'));
    const reconcile = vi.fn().mockResolvedValue(receipt(1));
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile,
      classify: () => 'UNKNOWN',
      key: () => 'stable-attempt-key',
    });
    controller.update(input('Sent input'), true);
    await expect(controller.flush()).rejects.toThrow('Response connection lost');
    const original = save.mock.calls[0]![0] as ApprovalDraftSaveAttempt;
    controller.update(input('New local input'), true);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(controller.flush()).rejects.toBeInstanceOf(ApprovalDraftSaveBlockedError);
    expect(save).toHaveBeenCalledTimes(1);
    await controller.reconcile();
    expect(reconcile).toHaveBeenCalledWith(original);
    expect(original.input.title).toBe('Sent input');
    expect(original.idempotencyKey).toBe('stable-attempt-key');
    expect(controller.getSnapshot()).toMatchObject({ status: 'LOCAL', dirty: true });
  });

  it('requires latest review and explicit reapply after 409 without changing local input', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('409')).mockResolvedValueOnce(receipt(8));
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile: save,
      classify: () => 'CONFLICT',
    });
    controller.hydrate(receipt(3), input('Server baseline'));
    controller.update(input('Preserved edit'), true);
    await expect(controller.flush()).rejects.toThrow('409');
    await expect(controller.reapply()).rejects.toBeInstanceOf(ApprovalDraftSaveBlockedError);
    controller.reviewLatest(receipt(7));
    expect(save).toHaveBeenCalledTimes(1);
    await controller.reapply();
    expect(save.mock.calls[1]![0]).toMatchObject({
      expectedVersion: 7,
      input: { title: 'Preserved edit' },
    });
    expect(controller.getSnapshot().receipt?.version).toBe(8);
  });

  it.each(['DENIED', 'UNAVAILABLE'] as const)(
    'stops writes on the first %s failure',
    async (problem) => {
      const save = vi.fn().mockRejectedValue(new Error(problem));
      const controller = new ApprovalDraftAutosave({
        save,
        reconcile: save,
        classify: () => problem,
      });
      controller.update(input(), true);
      await expect(controller.flush()).rejects.toThrow(problem);
      controller.update(input('More local changes'), true);
      await vi.advanceTimersByTimeAsync(10000);
      expect(save).toHaveBeenCalledTimes(1);
      expect(controller.getSnapshot().status).toBe(problem);
    }
  );

  it('binds a reconciled create conflict to the existing document before explicit reapply', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unknown'))
      .mockResolvedValueOnce(receipt(5));
    const reconcile = vi.fn().mockRejectedValue(new ApprovalDraftSaveConflictError(receipt(4)));
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile,
      classify: (error) =>
        error instanceof ApprovalDraftSaveConflictError ? 'CONFLICT' : 'UNKNOWN',
    });
    controller.update(input('Preserved local input'), true);
    await expect(controller.flush()).rejects.toThrow('Unknown');
    await expect(controller.reconcile()).rejects.toBeInstanceOf(ApprovalDraftSaveConflictError);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'CONFLICT',
      dirty: true,
      receipt: receipt(4),
      latestLoaded: false,
    });
    controller.reviewLatest(receipt(4));
    await controller.reapply();
    expect(save.mock.calls[1]![0]).toMatchObject({
      requestId: 'request-1',
      expectedVersion: 4,
      input: { title: 'Preserved local input' },
    });
  });

  it('drops late success after disposal and never hydrates a new session with its receipt', async () => {
    const pending = deferred<ApprovalDraftReceipt>();
    const save = vi.fn().mockReturnValue(pending.promise);
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile: save,
      classify: () => 'ERROR',
    });
    const changed = vi.fn();
    controller.subscribe(changed);
    controller.update(input(), true);
    const old = controller.flush();
    controller.dispose();
    changed.mockClear();
    pending.resolve(receipt());
    await expect(old).rejects.toBeInstanceOf(ApprovalDraftSaveBlockedError);
    expect(changed).not.toHaveBeenCalled();
    expect(controller.getSnapshot().receipt).toBeUndefined();
  });

  it('preserves an unknown command through receipt authority failure and resumes reconciliation, not a new create', async () => {
    const save = vi.fn().mockRejectedValue(new Error('UNKNOWN'));
    const reconcile = vi
      .fn()
      .mockRejectedValueOnce(new Error('DENIED'))
      .mockResolvedValueOnce(receipt());
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile,
      classify: (error) =>
        error instanceof Error && error.message === 'DENIED' ? 'DENIED' : 'UNKNOWN',
      key: () => 'original-key',
    });
    controller.update(input(), true);
    await expect(controller.flush()).rejects.toThrow('UNKNOWN');
    await expect(controller.reconcile()).rejects.toThrow('DENIED');
    controller.resume();
    expect(controller.getSnapshot().status).toBe('UNKNOWN');
    await controller.reconcile();
    expect(reconcile.mock.calls[0]).toEqual(reconcile.mock.calls[1]);
    expect(reconcile.mock.calls[1]![0].idempotencyKey).toBe('original-key');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it.each([
    receipt(3),
    { ...receipt(4), requestId: 'other' },
    { ...receipt(4), status: 'SUBMITTED' },
  ])('does not mark malformed or non-monotonic mutation receipts saved', async (invalid) => {
    const save = vi.fn().mockResolvedValue(invalid);
    const controller = new ApprovalDraftAutosave({
      save,
      reconcile: save,
      classify: () => 'ERROR',
    });
    controller.hydrate(receipt(3), input('Baseline'));
    controller.update(input(), true);
    await expect(controller.flush()).rejects.toBeInstanceOf(ApprovalDraftSaveBlockedError);
    expect(controller.getSnapshot()).toMatchObject({
      status: 'UNKNOWN',
      dirty: true,
      receipt: receipt(3),
    });
  });
});
