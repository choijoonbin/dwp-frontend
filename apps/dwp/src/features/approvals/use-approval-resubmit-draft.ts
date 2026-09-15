import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createApprovalResubmitDraft,
  type ApprovalResubmitDraftResponse,
} from '@dwp-frontend/shared-utils/api/approval-resubmit-draft-api';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { useApprovalGovernedMutation } from './use-approval-governed-mutation';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

export type ApprovalResubmitRecovery =
  'CONFLICT' | 'DENIED' | 'INCOMPATIBLE' | 'UNAVAILABLE' | 'UNKNOWN' | 'ERROR';

type RefetchResult = Readonly<{
  data?: readonly ApprovalRequest[];
  isError: boolean;
  error?: unknown;
}>;

type ApprovalResubmitDraftOptions = Readonly<{
  identity: string;
  enabled: boolean;
  contextScopeKey?: string;
  requests?: readonly ApprovalRequest[];
  refetch: () => Promise<RefetchResult>;
  isAuthorityCurrent: () => boolean;
  onSuccess: (response: ApprovalResubmitDraftResponse) => void | Promise<void>;
}>;

type ResubmitCommand = Readonly<{
  identity: string;
  requestId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;

class ResubmitSourceChangedError extends Error {}
class ResubmitAuthorityChangedError extends Error {}

export function canCreateResubmissionDraft(request: ApprovalRequest | undefined): boolean {
  return request?.status === 'APPROVED' || request?.status === 'REJECTED';
}

function sameSource(request: ApprovalRequest | undefined, command: ResubmitCommand): boolean {
  return Boolean(
    request &&
    request.requestId === command.requestId &&
    request.version === command.expectedVersion &&
    canCreateResubmissionDraft(request)
  );
}

function recovery(error: unknown): ApprovalResubmitRecovery {
  if (error instanceof ResubmitAuthorityChangedError) return 'DENIED';
  if (error instanceof ResubmitSourceChangedError) return 'CONFLICT';
  if (error instanceof HttpError) {
    if ([401, 403, 404].includes(error.status)) return 'DENIED';
    if (error.status === 409) return 'CONFLICT';
    if (error.status === 422) return 'INCOMPATIBLE';
    if (error.status === 503) return 'UNAVAILABLE';
  }
  if (error instanceof HttpTransportError) return 'UNKNOWN';
  return 'ERROR';
}

export function useApprovalResubmitDraft(options: ApprovalResubmitDraftOptions) {
  const runCreate = useApprovalGovernedMutation(
    'route.approvals.work.request-resubmit-draft.action'
  );
  const [candidate, setCandidate] = useState<ApprovalRequest>();
  const [problem, setProblem] = useState<ApprovalResubmitRecovery>();
  const [pending, setPending] = useState(false);
  const command = useRef<ResubmitCommand | undefined>(undefined);
  const verifiedSource = useRef<
    Readonly<{ command: ResubmitCommand; source: ApprovalRequest }> | undefined
  >(undefined);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    setCandidate(undefined);
    setProblem(undefined);
    setPending(false);
    command.current = undefined;
    verifiedSource.current = undefined;
  }, [options.identity]);

  const open = useCallback(
    (request: ApprovalRequest) => {
      const current = latest.current;
      if (!current.enabled || !canCreateResubmissionDraft(request) || pending || command.current)
        return;
      setCandidate(Object.freeze({ ...request }));
      setProblem(undefined);
      command.current = undefined;
      verifiedSource.current = undefined;
    },
    [pending]
  );

  const close = useCallback(() => {
    if (pending) return;
    setCandidate(undefined);
    setProblem(undefined);
    command.current = undefined;
    verifiedSource.current = undefined;
  }, [pending]);

  const execute = useCallback(
    async (original: ResubmitCommand) => {
      const current = latest.current;
      if (pending || command.current !== original) return;
      setPending(true);
      setProblem(undefined);
      try {
        if (!current.enabled || !current.isAuthorityCurrent())
          throw new ResubmitAuthorityChangedError();
        const refreshed = await current.refetch();
        if (command.current !== original) return;
        if (refreshed.isError)
          throw refreshed.error ?? new Error('Approval source refresh failed.');
        const source = refreshed.data?.find((item) => item.requestId === original.requestId);
        if (!source || !sameSource(source, original)) throw new ResubmitSourceChangedError();
        verifiedSource.current = { command: original, source };
        const assertCurrent = () => {
          const live = latest.current;
          const liveSource = live.requests?.find((item) => item.requestId === original.requestId);
          if (!live.enabled || !live.isAuthorityCurrent())
            throw new ResubmitAuthorityChangedError();
          if (
            liveSource
              ? !sameSource(liveSource, original)
              : verifiedSource.current?.command !== original ||
                !sameSource(verifiedSource.current.source, original)
          )
            throw new ResubmitSourceChangedError();
        };
        const result = await runCreate((execution) =>
          createApprovalResubmitDraft(original.requestId, original.expectedVersion, execution, {
            idempotencyKey: original.idempotencyKey,
            contextScopeKey: current.contextScopeKey,
            beforeDispatch: assertCurrent,
          })
        );
        if (command.current !== original || latest.current.identity !== original.identity) return;
        command.current = undefined;
        verifiedSource.current = undefined;
        await latest.current.onSuccess(result);
        setCandidate(undefined);
      } catch (error) {
        if (command.current !== original || latest.current.identity !== original.identity) return;
        const next = recovery(error);
        setProblem(next);
        if (!['UNAVAILABLE', 'UNKNOWN'].includes(next)) {
          command.current = undefined;
          verifiedSource.current = undefined;
        }
      } finally {
        if (latest.current.identity === original.identity) setPending(false);
      }
    },
    [pending, runCreate]
  );

  const submit = useCallback(() => {
    const current = latest.current;
    if (
      pending ||
      command.current ||
      !candidate ||
      !current.enabled ||
      !current.isAuthorityCurrent() ||
      !canCreateResubmissionDraft(candidate)
    )
      return;
    const original = Object.freeze({
      identity: current.identity,
      requestId: candidate.requestId,
      expectedVersion: candidate.version,
      idempotencyKey: crypto.randomUUID(),
    });
    command.current = original;
    void execute(original);
  }, [candidate, execute, pending]);

  const retryOriginal = useCallback(() => {
    const original = command.current;
    if (!original || pending || !['UNAVAILABLE', 'UNKNOWN'].includes(problem ?? '')) return;
    void execute(original);
  }, [execute, pending, problem]);

  const sourceCurrent = Boolean(
    candidate &&
    options.enabled &&
    canCreateResubmissionDraft(candidate) &&
    options.requests?.some(
      (request) =>
        request.requestId === candidate.requestId &&
        request.status === candidate.status &&
        request.version === candidate.version
    )
  );

  return {
    candidate,
    problem,
    pending,
    sourceCurrent,
    open,
    close,
    submit,
    retryOriginal,
  } as const;
}

export type ApprovalResubmitDraftController = ReturnType<typeof useApprovalResubmitDraft>;
