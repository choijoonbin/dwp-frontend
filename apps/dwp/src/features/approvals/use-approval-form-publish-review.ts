import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApprovalFormWorkspaceResponseError,
  HttpError,
  HttpTransportError,
  getApprovalFormPublishReviewQueue,
  getApprovalFormPublishReviewRequest,
  getApprovalFormWorkspace,
  productSurfaceServerNow,
  requestApprovalFormPublishReview,
  searchApprovalFormPublishReviewCandidates,
  snapshotApprovalFormWorkspace,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';

import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import {
  ProductSurfaceMutationAuthorityError,
  useProductSurfaceGovernedMutation,
} from '../../components/use-product-surface-governed-mutation';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalManagementScopeReset } from './approval-management-scope';
import {
  approvalManagementSourceState,
  retryApprovalManagementRead,
} from './approval-management-source-state';
import { approvalFormWorkspaceRouteInstalled } from './approval-form-workspace-controller';

import type {
  ApprovalFormPublishReviewCandidate,
  ApprovalFormPublishReviewCandidates,
  ApprovalFormPublishReviewRequest,
  ApprovalFormWorkspace,
} from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type { ApprovalManagementRequestScope } from './use-approval-experience';

export type ApprovalFormPublishReviewProblem =
  'DENIED' | 'CONFLICT' | 'UNAVAILABLE' | 'UNKNOWN' | 'CHANGED';

type AssignmentAttempt = Readonly<{
  formId: string;
  contextScopeKey: string;
  actorId: number;
  workspace: ApprovalFormWorkspace;
  currentRequest: ApprovalFormPublishReviewRequest | null;
  candidateSource: ApprovalFormPublishReviewCandidates;
  candidateQuery: string;
  candidate: ApprovalFormPublishReviewCandidate;
  reason: string;
  idempotencyKey: string;
}>;

type AssignmentOptions = Readonly<{
  formId: string | null;
  workspace: ApprovalFormWorkspace | undefined;
  requestScope: ApprovalManagementRequestScope;
  scopeReady: boolean;
  parentReady: boolean;
  canEdit: boolean;
  onChanged: (formId: string) => void | Promise<void>;
}>;

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function candidateMatches(
  expected: ApprovalFormPublishReviewCandidate,
  actual: ApprovalFormPublishReviewCandidate
): boolean {
  return (
    actual.userId === expected.userId &&
    actual.personPublicId === expected.personPublicId &&
    same(actual, expected)
  );
}

function classify(error: unknown, dispatched: boolean): ApprovalFormPublishReviewProblem {
  if (error instanceof HttpError) {
    if (error.status === 403) return 'DENIED';
    if (error.status === 409) return 'CONFLICT';
    if (error.status === 503) return dispatched ? 'UNKNOWN' : 'UNAVAILABLE';
    return error.status >= 500 ? (dispatched ? 'UNKNOWN' : 'UNAVAILABLE') : 'CHANGED';
  }
  if (error instanceof ProductSurfaceMutationAuthorityError) return 'UNAVAILABLE';
  if (error instanceof HttpTransportError || error instanceof ApprovalFormWorkspaceResponseError)
    return dispatched ? 'UNKNOWN' : 'UNAVAILABLE';
  return dispatched ? 'UNKNOWN' : 'CHANGED';
}

function currentQueryKey(formId: string | null, cacheKey: readonly string[]) {
  return ['approvals', 'admin', 'form-publish-review-request', formId, ...cacheKey] as const;
}

export function useApprovalFormPublishReviewAssignment(options: AssignmentOptions) {
  const client = useQueryClient();
  const authority = useProductSurfaceAuthority();
  const commandScope = useApprovalManagementCommandScope(options.requestScope.cacheKey);
  const dispatch = useProductSurfaceGovernedMutation({
    productKey: 'approvals',
    surfaceKey: 'approvals.admin',
    routeContractKey: 'route.approvals.admin.form-publish-review-request.action',
    taskKind: 'ADMINISTRATION',
  });
  const [open, setOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const deferredCandidateQuery = useDeferredValue(candidateQuery.trim());
  const [candidate, setCandidate] = useState<ApprovalFormPublishReviewCandidate | null>(null);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<ApprovalFormPublishReviewProblem | null>(null);
  const active = useRef<ApprovalManagementScopedCommand<AssignmentAttempt> | null>(null);
  const dispatched = useRef(new WeakSet<object>());
  const live = useRef(options);
  live.current = options;

  const routeReady =
    approvalFormWorkspaceRouteInstalled('form-publish-review-request.data') &&
    approvalFormWorkspaceRouteInstalled('form-publish-review-candidates.data') &&
    approvalFormWorkspaceRouteInstalled('form-publish-review-request.action');
  const requestKey = currentQueryKey(options.formId, options.requestScope.cacheKey);
  const currentRequest = useQuery({
    queryKey: requestKey,
    queryFn: ({ signal }) =>
      getApprovalFormPublishReviewRequest(
        options.formId!,
        options.requestScope.contextScopeKey,
        signal
      ),
    enabled: routeReady && options.scopeReady && options.parentReady && Boolean(options.formId),
    retry: retryApprovalManagementRead,
    staleTime: 15_000,
  });
  const candidates = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'form-publish-review-candidates',
      deferredCandidateQuery,
      ...options.requestScope.cacheKey,
    ],
    queryFn: ({ signal }) =>
      searchApprovalFormPublishReviewCandidates(
        deferredCandidateQuery,
        20,
        options.requestScope.contextScopeKey,
        signal
      ),
    enabled: open && routeReady && options.scopeReady && deferredCandidateQuery.length >= 2,
    retry: retryApprovalManagementRead,
    staleTime: 10_000,
  });
  const currentState = approvalManagementSourceState(currentRequest);
  const candidateState = approvalManagementSourceState(candidates);
  const actorId = Number(options.requestScope.cacheKey[1]);
  const isLatestEditor = options.workspace?.lastEditorUserId === actorId;
  const canOpen = Boolean(
    routeReady &&
    options.scopeReady &&
    options.parentReady &&
    options.canEdit &&
    options.formId &&
    options.workspace?.workingDraft &&
    isLatestEditor &&
    currentState === 'READY'
  );

  const now = useCallback(
    () => (authority.snapshot ? productSurfaceServerNow(authority.snapshot) : Date.now()),
    [authority.snapshot]
  );
  const reset = useCallback(() => {
    active.current = null;
    setOpen(false);
    setCandidateQuery('');
    setCandidate(null);
    setReason('');
    setProblem(null);
  }, []);
  useApprovalManagementScopeReset(options.requestScope.cacheKey, reset);
  const previousForm = useRef(options.formId);
  useEffect(() => {
    if (previousForm.current !== options.formId) {
      previousForm.current = options.formId;
      reset();
    }
  }, [options.formId, reset]);

  const assertLocal = useCallback(
    (command: ApprovalManagementScopedCommand<AssignmentAttempt>) => {
      const value = command.input;
      const current = live.current;
      const requestState = client.getQueryState(
        currentQueryKey(value.formId, current.requestScope.cacheKey)
      );
      const requestValue = client.getQueryData<ApprovalFormPublishReviewRequest | null>(
        currentQueryKey(value.formId, current.requestScope.cacheKey)
      );
      if (
        !commandScope.isCurrent(command) ||
        !routeReady ||
        !current.scopeReady ||
        !current.parentReady ||
        !current.canEdit ||
        current.formId !== value.formId ||
        current.requestScope.contextScopeKey !== value.contextScopeKey ||
        Number(current.requestScope.cacheKey[1]) !== value.actorId ||
        current.workspace?.lastEditorUserId !== value.actorId ||
        !same(current.workspace, value.workspace) ||
        requestState?.status !== 'success' ||
        requestState.fetchStatus !== 'idle' ||
        requestState.error ||
        !same(requestValue, value.currentRequest) ||
        value.candidateSource.decisionRevision !== current.requestScope.cacheKey[5] ||
        Date.parse(value.candidateSource.authorityValidUntil) <= now()
      ) {
        throw new ProductSurfaceOperationCancelledError();
      }
    },
    [client, commandScope, now, routeReady]
  );

  const mutation = useMutation({
    mutationFn: (command: ApprovalManagementScopedCommand<AssignmentAttempt>) =>
      commandScope.run(command, async (attempt) => {
        const [latestWorkspace, latestRequest, latestCandidates] = await Promise.all([
          getApprovalFormWorkspace(attempt.formId, attempt.contextScopeKey),
          getApprovalFormPublishReviewRequest(attempt.formId, attempt.contextScopeKey),
          searchApprovalFormPublishReviewCandidates(
            attempt.candidateQuery,
            20,
            attempt.contextScopeKey
          ),
        ]);
        assertLocal(command);
        if (
          !same(latestWorkspace, attempt.workspace) ||
          !same(latestRequest, attempt.currentRequest) ||
          latestCandidates.decisionRevision !== attempt.candidateSource.decisionRevision ||
          latestCandidates.authorityValidUntil !== attempt.candidateSource.authorityValidUntil ||
          !latestCandidates.candidates.some((value) => candidateMatches(attempt.candidate, value))
        ) {
          throw new ProductSurfaceOperationCancelledError();
        }
        let dispatchChecks = 0;
        return dispatch((execution) =>
          requestApprovalFormPublishReview(
            attempt.formId,
            {
              draftFormVersionId: attempt.workspace.workingDraft!.formVersionId,
              basePublishedVersionId: attempt.workspace.published?.formVersionId ?? null,
              expectedFormRevision: attempt.workspace.formRevision,
              expectedWorkspaceRevision: attempt.workspace.workspaceRevision!,
              schemaSha256: attempt.workspace.workingDraft!.schemaSha256,
              reviewerUserId: attempt.candidate.userId,
              reviewerPersonPublicId: attempt.candidate.personPublicId,
              expectedReviewRequestId: attempt.currentRequest?.reviewRequestId ?? null,
              expectedReviewRequestVersion: attempt.currentRequest?.version ?? null,
              reason: attempt.reason,
            },
            execution,
            {
              idempotencyKey: attempt.idempotencyKey,
              beforeDispatch: () => {
                assertLocal(command);
                dispatchChecks += 1;
                if (dispatchChecks === 2) dispatched.current.add(command);
              },
            }
          )
        );
      }),
    onSuccess: async ({ command, value }) => {
      if (active.current !== command || !commandScope.isCurrent(command)) return;
      client.setQueryData(currentQueryKey(value.formId, live.current.requestScope.cacheKey), value);
      const changed = live.current.onChanged;
      active.current = null;
      setProblem(null);
      setOpen(false);
      setCandidateQuery('');
      setCandidate(null);
      setReason('');
      await changed(value.formId);
    },
    onError: (error, command) => {
      if (active.current !== command || !commandScope.isCurrent(command)) return;
      if (error instanceof ProductSurfaceOperationCancelledError) {
        active.current = null;
        setProblem('CHANGED');
        return;
      }
      setProblem(classify(error, dispatched.current.has(command)));
    },
  });

  const valid = useMemo(
    () =>
      canOpen &&
      candidate !== null &&
      candidateState === 'READY' &&
      candidates.data?.decisionRevision === options.requestScope.cacheKey[5] &&
      Date.parse(candidates.data?.authorityValidUntil ?? '') > now() &&
      candidates.data?.candidates.some((value) => candidateMatches(candidate, value)) &&
      reason === reason.trim() &&
      reason.length >= 10 &&
      reason.length <= 1000 &&
      !hasControlCharacter(reason),
    [
      canOpen,
      candidate,
      candidateState,
      candidates.data,
      now,
      options.requestScope.cacheKey,
      reason,
    ]
  );
  const openRequest = useCallback(() => {
    if (!canOpen) return;
    if (!active.current) {
      setCandidateQuery('');
      setCandidate(null);
      setReason('');
      setProblem(null);
    }
    setOpen(true);
  }, [canOpen]);
  const close = useCallback(() => {
    if (!mutation.isPending) setOpen(false);
  }, [mutation.isPending]);
  const submit = useCallback(() => {
    const current = live.current;
    if (
      !valid ||
      mutation.isPending ||
      active.current ||
      !current.formId ||
      !current.workspace ||
      !current.requestScope.contextScopeKey ||
      !candidate ||
      !candidates.data
    )
      return;
    const command = commandScope.capture({
      formId: current.formId,
      contextScopeKey: current.requestScope.contextScopeKey,
      actorId: Number(current.requestScope.cacheKey[1]),
      workspace: snapshotApprovalFormWorkspace(current.workspace),
      currentRequest: currentRequest.data
        ? snapshotApprovalFormWorkspace(currentRequest.data)
        : null,
      candidateSource: snapshotApprovalFormWorkspace(candidates.data),
      candidateQuery: deferredCandidateQuery,
      candidate: snapshotApprovalFormWorkspace(candidate),
      reason,
      idempotencyKey: `approval-form-publish-review-${crypto.randomUUID()}`,
    });
    active.current = command;
    setProblem(null);
    mutation.mutate(command);
  }, [
    candidate,
    candidates.data,
    commandScope,
    currentRequest.data,
    deferredCandidateQuery,
    mutation,
    reason,
    valid,
  ]);
  const retryOriginal = useCallback(() => {
    if (active.current && problem && !mutation.isPending) {
      setProblem(null);
      mutation.mutate(active.current);
    }
  }, [mutation, problem]);
  const editPreserved = useCallback(() => {
    if (!problem || mutation.isPending) return;
    active.current = null;
    setProblem(null);
  }, [mutation.isPending, problem]);

  return {
    open,
    currentRequest,
    currentState,
    candidates,
    candidateState,
    candidateQuery,
    deferredCandidateQuery,
    candidate,
    reason,
    problem,
    busy: mutation.isPending,
    locked: active.current !== null,
    canOpen,
    canSubmit: Boolean(valid && !active.current && !mutation.isPending),
    assignedToActor:
      currentRequest.data?.status === 'PENDING' && currentRequest.data.reviewerUserId === actorId,
    setCandidateQuery,
    setCandidate,
    setReason,
    openRequest,
    close,
    submit,
    retryOriginal,
    editPreserved,
  } as const;
}

export function useApprovalFormPublishReviewQueue({
  requestScope,
  scopeReady,
  canPublish,
}: {
  requestScope: ApprovalManagementRequestScope;
  scopeReady: boolean;
  canPublish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const installed = approvalFormWorkspaceRouteInstalled('form-publish-review-queue.data');
  const query = useQuery({
    queryKey: ['approvals', 'admin', 'form-publish-review-queue', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getApprovalFormPublishReviewQueue(50, requestScope.contextScopeKey, signal),
    enabled: installed && scopeReady && canPublish,
    retry: retryApprovalManagementRead,
    staleTime: 15_000,
  });
  const state = approvalManagementSourceState(query);
  const reset = useCallback(() => setOpen(false), []);
  useApprovalManagementScopeReset(requestScope.cacheKey, reset);
  return {
    open,
    query,
    state,
    enabled: installed && scopeReady && canPublish,
    openQueue: () => setOpen(true),
    closeQueue: () => setOpen(false),
  } as const;
}
