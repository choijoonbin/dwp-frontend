// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { useGovernanceChangeReview } from './workplace-governance-change-review';
import {
  governanceChangeOutcome,
  governanceReviewFingerprint,
  governanceReviewIsCurrent,
} from './workplace-governance-change-model';
import type {
  WorkplaceGovernanceChangeReview,
  WorkplaceGovernanceChangeInput,
} from '@dwp-frontend/shared-utils';

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: 'button',
  FormField: 'input',
  InlineFeedback: 'div',
}));
vi.mock('@dwp-frontend/shared-utils', async () => ({
  HttpError: (await import('@dwp-frontend/shared-utils/http-error')).HttpError,
}));

type Proposed = { effect: string; version: number };
const result = (proposed: Proposed): WorkplaceGovernanceChangeReview<Proposed> => ({
  targetType: 'SITE_ACCESS_RULE',
  targetId: 'rule-1',
  current: { effect: 'ALLOW', version: proposed.version },
  proposed,
  currentActorAccess: null,
  knownImpact: ['One matching rule will be updated.'],
  warnings: [],
  evaluatedAt: '2026-09-14T00:00:00Z',
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
let root: Root;
let container: HTMLDivElement;
let observed: ReturnType<typeof useGovernanceChangeReview<Proposed>>;
let proposed: Proposed;
let contextKey: string;
let canManage: boolean;
let sourceReady: boolean;
let review =
  vi.fn<
    (
      input: WorkplaceGovernanceChangeInput<Proposed>
    ) => Promise<WorkplaceGovernanceChangeReview<Proposed>>
  >();
let apply = vi.fn<(input: WorkplaceGovernanceChangeInput<Proposed>) => Promise<unknown>>();
let recheck = vi.fn<() => Promise<boolean>>();
let onSaved = vi.fn<() => void>();
function Probe() {
  observed = useGovernanceChangeReview({
    contextKey,
    proposed,
    canManage,
    sourceReady,
    valid: true,
    review,
    apply,
    recheck,
    onSaved,
  });
  return null;
}
const render = async () => {
  await act(async () => {
    root.render(createElement(Probe));
  });
};
const reviewed = async () => {
  await act(async () => {
    observed.review();
  });
  await act(async () => {
    observed.setReason('Access change approved by site owner.');
  });
  await act(async () => {
    observed.setConfirmed(true);
  });
};

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  proposed = { effect: 'DENY', version: 1 };
  contextKey = 'tenant1:user7:site1';
  canManage = true;
  sourceReady = true;
  review = vi.fn(async (_input: WorkplaceGovernanceChangeInput<Proposed>) => result(proposed));
  apply = vi.fn(async (_input: WorkplaceGovernanceChangeInput<Proposed>): Promise<unknown> => ({
    version: 2,
  }));
  recheck = vi.fn(async () => true);
  onSaved = vi.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await render();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('governance review and guarded writes', () => {
  it('sends readonly review before accepting reason and confirmation, then prevents duplicate save', async () => {
    expect(observed.canSave).toBe(false);
    await reviewed();
    expect(review).toHaveBeenCalledWith({ proposed, reason: '', confirmed: false });
    expect(observed.canSave).toBe(true);
    const pending = deferred<unknown>();
    apply.mockReturnValueOnce(pending.promise);
    await act(async () => {
      observed.save();
      observed.save();
    });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({
      proposed,
      reason: 'Access change approved by site owner.',
      confirmed: true,
    });
    await act(async () => pending.resolve({ version: 2 }));
    expect(observed.saved).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
  it('invalidates review and confirmation when proposed fields, source freshness or current version change', async () => {
    await reviewed();
    proposed = { ...proposed, effect: 'ALLOW' };
    await render();
    expect(observed.canSave).toBe(false);
    expect(observed.currentReview).toBeUndefined();
    await reviewed();
    sourceReady = false;
    await render();
    sourceReady = true;
    await render();
    expect(observed.confirmed).toBe(false);
    await reviewed();
    proposed = { ...proposed, version: 2 };
    await render();
    expect(observed.canSave).toBe(false);
  });
  it('discards a late review after site changes and a late save callback after authority is revoked', async () => {
    const pendingReview = deferred<WorkplaceGovernanceChangeReview<Proposed>>();
    review.mockReturnValueOnce(pendingReview.promise);
    await act(async () => observed.review());
    contextKey = 'tenant1:user7:site2';
    await render();
    await act(async () => pendingReview.resolve(result(proposed)));
    expect(observed.currentReview).toBeUndefined();
    await reviewed();
    const pendingWrite = deferred<unknown>();
    apply.mockReturnValueOnce(pendingWrite.promise);
    await act(async () => observed.save());
    canManage = false;
    await render();
    await act(async () => pendingWrite.resolve({ version: 2 }));
    expect(onSaved).not.toHaveBeenCalled();
    expect(observed.saved).toBe(false);
    expect(observed.reason).toBe('');
  });
  it('requires recheck and a new review after conflict even when recheck changes version', async () => {
    await reviewed();
    apply.mockRejectedValueOnce(new HttpError('Stale', 409));
    await act(async () => observed.save());
    expect(observed.outcome).toBe('conflict');
    recheck.mockImplementationOnce(async () => {
      proposed = { ...proposed, version: 2 };
      await render();
      return true;
    });
    await act(async () => observed.recheck());
    expect(observed.outcome).toBeNull();
    expect(observed.canSave).toBe(false);
    await reviewed();
    expect(observed.canSave).toBe(true);
  });
  it('never retries an unknown write and blocks a forbidden review', async () => {
    await reviewed();
    apply.mockRejectedValueOnce(new Error('Network timeout'));
    await act(async () => observed.save());
    await act(async () => observed.save());
    expect(apply).toHaveBeenCalledTimes(1);
    expect(observed.outcome).toBe('unknown');
    await act(async () => observed.recheck());
    review.mockRejectedValueOnce(new HttpError('Forbidden', 403));
    await act(async () => observed.review());
    expect(observed.outcome).toBe('denied');
    expect(observed.canSave).toBe(false);
  });
  it('expires review after thirty seconds and classifies read failures separately from submitted writes', async () => {
    vi.useFakeTimers();
    await reviewed();
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(observed.canSave).toBe(false);
    const key = governanceReviewFingerprint(contextKey, proposed);
    expect(governanceReviewIsCurrent({ fingerprint: key, reviewedAt: 100 }, key, 30_100)).toBe(
      false
    );
    expect(governanceChangeOutcome(new Error('timeout'), false)).toBe('reviewUnavailable');
    expect(governanceChangeOutcome(new Error('timeout'), true)).toBe('unknown');
  });
});
