// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  canCreateResubmissionDraft,
  useApprovalResubmitDraft,
} from './use-approval-resubmit-draft';

import type { ApprovalMutationExecution, ApprovalRequest } from '@dwp-frontend/shared-utils';
import type { ApprovalResubmitDraftResponse } from '@dwp-frontend/shared-utils/api/approval-resubmit-draft-api';

const api = vi.hoisted(() => ({ create: vi.fn() }));
const governed = vi.hoisted(() => ({
  run: vi.fn<
    (execute: (execution: ApprovalMutationExecution) => Promise<unknown>) => Promise<unknown>
  >(),
}));
vi.mock('@dwp-frontend/shared-utils/api/approval-resubmit-draft-api', () => ({
  createApprovalResubmitDraft: api.create,
}));
vi.mock('./use-approval-governed-mutation', () => ({
  useApprovalGovernedMutation: () => governed.run,
}));

const source = (version = 7, status: ApprovalRequest['status'] = 'APPROVED') =>
  ({
    requestId: '11111111-1111-4111-8111-111111111111',
    requestNumber: 'APR-09',
    title: 'Completed request',
    summary: 'Immutable source',
    workflowNameKo: '표준 결재',
    workflowNameEn: 'Standard approval',
    totalSteps: 2,
    status,
    priority: 'HIGH',
    dataClassification: 'INTERNAL',
    version,
  }) satisfies ApprovalRequest;
const draft = source(0, 'DRAFT');

type Hook = ReturnType<typeof useApprovalResubmitDraft>;
let hook: Hook;
let requests: ApprovalRequest[];
let refetch =
  vi.fn<
    () => Promise<
      Readonly<{ data?: readonly ApprovalRequest[]; isError: boolean; error?: unknown }>
    >
  >();
let authority = true;
let success = vi.fn<(response: ApprovalResubmitDraftResponse) => void>();

function Harness() {
  hook = useApprovalResubmitDraft({
    identity: 'tenant:actor:scope',
    enabled: authority,
    contextScopeKey: 'opaque-scope',
    requests,
    refetch,
    isAuthorityCurrent: () => authority,
    onSuccess: success,
  });
  return null;
}

let root: Root;
let container: HTMLDivElement;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  requests = [source()];
  refetch = vi.fn(async () => ({ data: requests, isError: false }));
  success = vi.fn<(response: ApprovalResubmitDraftResponse) => void>();
  authority = true;
  governed.run.mockImplementation((execute) =>
    execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' })
  );
  api.create.mockResolvedValue({ draft, sourceRequestId: source().requestId, sourceVersion: 7 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('APR-09 resubmission draft command', () => {
  it('offers the command only for terminal approved or rejected sources', () => {
    expect(canCreateResubmissionDraft(source(7, 'APPROVED'))).toBe(true);
    expect(canCreateResubmissionDraft(source(7, 'REJECTED'))).toBe(true);
    expect(canCreateResubmissionDraft(source(7, 'WITHDRAWN'))).toBe(false);
    expect(canCreateResubmissionDraft(source(7, 'IN_REVIEW'))).toBe(false);
  });

  it('revalidates the exact source immediately before creating and returns the new draft', async () => {
    await act(async () => hook.open(source()));
    await act(async () => hook.submit());
    await vi.waitFor(() => expect(success).toHaveBeenCalledTimes(1));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      source().requestId,
      7,
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' },
      expect.objectContaining({
        contextScopeKey: 'opaque-scope',
        idempotencyKey: expect.any(String),
        beforeDispatch: expect.any(Function),
      })
    );
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ draft: expect.objectContaining({ status: 'DRAFT' }) })
    );
  });

  it('fails closed without a POST when the refreshed source version changed', async () => {
    await act(async () => hook.open(source()));
    requests = [source(8)];
    await act(async () => hook.submit());
    await vi.waitFor(() => expect(hook.problem).toBe('CONFLICT'));

    expect(api.create).not.toHaveBeenCalled();
    expect(hook.candidate?.requestId).toBe(source().requestId);
  });

  it('preserves a source refresh outage as unavailable without misreporting authority loss', async () => {
    refetch.mockResolvedValueOnce({
      isError: true,
      error: new HttpError('Unavailable', 503),
    });
    await act(async () => hook.open(source()));
    await act(async () => hook.submit());
    await vi.waitFor(() => expect(hook.problem).toBe('UNAVAILABLE'));

    expect(api.create).not.toHaveBeenCalled();
    expect(hook.candidate?.requestId).toBe(source().requestId);
  });

  it('retries a 503 only with the original idempotency key and blocks duplicate clicks', async () => {
    api.create
      .mockRejectedValueOnce(new HttpError('Unavailable', 503))
      .mockResolvedValueOnce({ draft, sourceRequestId: source().requestId, sourceVersion: 7 });
    await act(async () => hook.open(source()));
    await act(async () => {
      hook.submit();
      hook.submit();
    });
    await vi.waitFor(() => expect(hook.problem).toBe('UNAVAILABLE'));
    expect(api.create).toHaveBeenCalledTimes(1);
    const originalKey = api.create.mock.calls[0][3].idempotencyKey;

    await act(async () => hook.retryOriginal());
    await vi.waitFor(() => expect(success).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[1][3].idempotencyKey).toBe(originalKey);
  });

  it.each([
    [403, 'DENIED'],
    [409, 'CONFLICT'],
    [422, 'INCOMPATIBLE'],
  ] as const)('maps HTTP %s to a fail-closed %s state', async (status, expected) => {
    api.create.mockRejectedValueOnce(new HttpError('Rejected', status));
    await act(async () => hook.open(source()));
    await act(async () => hook.submit());
    await vi.waitFor(() => expect(hook.problem).toBe(expected));
    expect(success).not.toHaveBeenCalled();
    expect(hook.candidate?.requestId).toBe(source().requestId);
  });

  it('fails closed when authority is revoked before submit', async () => {
    await act(async () => hook.open(source()));
    authority = false;
    await act(async () => root.render(<Harness />));
    await act(async () => hook.submit());
    expect(api.create).not.toHaveBeenCalled();
  });
});
