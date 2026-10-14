import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { performanceReviewDataSource } from '../api/performance-review-api';
import {
  PERFORMANCE_REVIEW_DRAFT_CONTRACT,
  PERFORMANCE_REVIEW_SUBMIT_CONTRACT,
} from '../model/performance-review-contract';
import {
  buildPerformanceReviewDraftCommand,
  setPerformanceReviewAnswer,
  validatePerformanceReviewAnswers,
} from '../model/performance-review-draft';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type {
  PerformanceReviewDataSource,
  PerformanceReviewMutationExecution,
} from '../api/performance-review-api';
import type {
  PerformanceReviewAnswer,
  PerformanceReviewDraftCommand,
  PerformanceReviewSnapshot,
  PerformanceReviewSubmission,
  PerformanceReviewValidation,
  SubmitPerformanceReviewCommand,
} from '../model/performance-review-types';

export type PerformanceReviewCommandDescriptor = Readonly<{
  kind: 'SAVE_DRAFT' | 'SUBMIT';
  routeContractKey:
    typeof PERFORMANCE_REVIEW_DRAFT_CONTRACT | typeof PERFORMANCE_REVIEW_SUBMIT_CONTRACT;
  reviewId: string;
  idempotencyKey: string;
  expectedVersion: number;
  etag: string;
}>;

export type PerformanceReviewCommandExecutor = <T>(
  descriptor: PerformanceReviewCommandDescriptor,
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
) => Promise<T>;

export type PerformanceReviewFailureKind =
  'DENIED' | 'CONFLICT' | 'INVALID' | 'RETRYABLE' | 'FAILED';

export type PerformanceReviewFailure = Readonly<{
  kind: PerformanceReviewFailureKind;
  message: string;
}>;

type PendingCommand =
  | Readonly<{
      descriptor: PerformanceReviewCommandDescriptor & { kind: 'SAVE_DRAFT' };
      body: PerformanceReviewDraftCommand;
      base: PerformanceReviewSnapshot;
    }>
  | Readonly<{
      descriptor: PerformanceReviewCommandDescriptor & { kind: 'SUBMIT' };
      body: SubmitPerformanceReviewCommand;
      base: PerformanceReviewSnapshot;
    }>;

export type PerformanceReviewRuntimeOptions = Readonly<{
  reviewId: string | null;
  requestScope: ProductSurfaceRequestScope;
  dataSource?: PerformanceReviewDataSource;
  commandExecutor?: PerformanceReviewCommandExecutor;
  createIdempotencyKey?: () => string;
}>;

function queryKey(scope: ProductSurfaceRequestScope, reviewId: string | null) {
  return ['hris', 'performance', 'assigned-review', reviewId ?? 'none', ...scope.cacheKey] as const;
}

function classifyFailure(error: unknown): PerformanceReviewFailure {
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403 || error.status === 404) {
      return { kind: 'DENIED', message: 'This review is unavailable for the current assignment.' };
    }
    if (error.status === 409 || error.status === 423) {
      return { kind: 'CONFLICT', message: 'The review changed. Reload the latest draft.' };
    }
    if (error.status === 400 || error.status === 422) {
      return { kind: 'INVALID', message: 'Review the highlighted answers and try again.' };
    }
    if (error.status === 429 || error.status >= 500) {
      return { kind: 'RETRYABLE', message: 'The result is not confirmed. Retry the same request.' };
    }
  }
  if (
    error instanceof HttpTransportError &&
    (error.reason === 'NETWORK' || error.reason === 'TIMEOUT')
  ) {
    return { kind: 'RETRYABLE', message: 'The result is not confirmed. Retry the same request.' };
  }
  return { kind: 'FAILED', message: 'The review could not be updated.' };
}

function defaultIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function sameReviewIdentity(
  base: PerformanceReviewSnapshot,
  candidate: PerformanceReviewSnapshot
): boolean {
  return (
    candidate.review.reviewId === base.review.reviewId &&
    candidate.review.participantId === base.review.participantId &&
    candidate.review.reviewerAssignmentId === base.review.reviewerAssignmentId &&
    candidate.review.templateVersionId === base.review.templateVersionId &&
    candidate.review.templateContentHash === base.review.templateContentHash &&
    candidate.review.aggregateVersion === base.review.aggregateVersion + 1
  );
}

export function useHrisPerformanceReviewRequestScope() {
  return useProductSurfaceRequestScope({ productKey: 'hcm', surfaceKey: 'hcm.operations' });
}

export function usePerformanceReviewRuntime({
  reviewId,
  requestScope,
  dataSource = performanceReviewDataSource,
  commandExecutor,
  createIdempotencyKey = defaultIdempotencyKey,
}: PerformanceReviewRuntimeOptions) {
  const queryClient = useQueryClient();
  const selectionIdentity = JSON.stringify([requestScope.cacheKey, reviewId, requestScope.ready]);
  const [stateSelectionIdentity, setStateSelectionIdentity] = useState(selectionIdentity);
  const selectionCurrent = stateSelectionIdentity === selectionIdentity;
  const scopeEpochRef = useRef({ identity: selectionIdentity, epoch: 0 });
  if (scopeEpochRef.current.identity !== selectionIdentity) {
    scopeEpochRef.current = { identity: selectionIdentity, epoch: scopeEpochRef.current.epoch + 1 };
  }
  const [answers, setAnswers] = useState<readonly PerformanceReviewAnswer[]>([]);
  const [dirty, setDirty] = useState(false);
  const [validationVisible, setValidationVisible] = useState(false);
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandFailure, setCommandFailure] = useState<PerformanceReviewFailure | null>(null);
  const [feedback, setFeedback] = useState<'SAVED' | 'SUBMITTED' | null>(null);
  const [submission, setSubmission] = useState<PerformanceReviewSubmission | null>(null);
  const [authorityRevoked, setAuthorityRevoked] = useState(false);
  const editBaseRef = useRef<PerformanceReviewSnapshot | undefined>(undefined);
  const editGenerationRef = useRef(0);
  const dirtyRef = useRef(false);
  const commandInFlightEpochRef = useRef<number | null>(null);
  const reloadInFlightEpochRef = useRef<number | null>(null);
  const dispatchAllowedRef = useRef(false);
  const loadedRef = useRef('');

  useEffect(() => {
    if (selectionCurrent) return;
    setStateSelectionIdentity(selectionIdentity);
    setAnswers([]);
    setDirty(false);
    setValidationVisible(false);
    setPending(null);
    setCommandBusy(false);
    setCommandFailure(null);
    setFeedback(null);
    setSubmission(null);
    setAuthorityRevoked(false);
    editBaseRef.current = undefined;
    editGenerationRef.current += 1;
    dirtyRef.current = false;
    loadedRef.current = '';
    queryClient.removeQueries({ queryKey: ['hris', 'performance', 'assigned-review'] });
  }, [queryClient, selectionCurrent, selectionIdentity]);

  const activeReviewId = selectionCurrent ? reviewId : null;
  const reviewQueryKey = useMemo(
    () => queryKey(requestScope, activeReviewId),
    [activeReviewId, requestScope]
  );
  const reviewQuery = useQuery({
    queryKey: reviewQueryKey,
    queryFn: async ({ signal }) => {
      if (!activeReviewId) throw new Error('No assigned performance review was selected.');
      return dataSource.read(activeReviewId, requestScope.contextScopeKey, signal);
    },
    enabled: requestScope.ready && selectionCurrent && activeReviewId !== null && !authorityRevoked,
    meta: requestScope.queryMeta,
    retry: false,
  });
  const querySnapshot = selectionCurrent ? reviewQuery.data : undefined;
  const snapshot = dirty && editBaseRef.current ? editBaseRef.current : querySnapshot;

  useEffect(() => {
    if (!querySnapshot) return;
    const loaded = querySnapshot.review.reviewId + ':' + querySnapshot.etag;
    if (
      loadedRef.current === loaded ||
      (dirtyRef.current && loadedRef.current.startsWith(querySnapshot.review.reviewId))
    ) {
      return;
    }
    loadedRef.current = loaded;
    editBaseRef.current = undefined;
    setAnswers(querySnapshot.review.answers);
    dirtyRef.current = false;
    setDirty(false);
    setValidationVisible(false);
    setCommandFailure(null);
    setFeedback(null);
    setSubmission(null);
  }, [dirty, querySnapshot]);

  const validation = useMemo<PerformanceReviewValidation>(() => {
    if (!snapshot) return Object.freeze({ valid: false, issues: Object.freeze([]) });
    return validatePerformanceReviewAnswers(snapshot.review.form, answers, true);
  }, [answers, snapshot]);

  const updateAnswer = (itemKey: string, answer: PerformanceReviewAnswer | null) => {
    if (
      !requestScope.ready ||
      !selectionCurrent ||
      !snapshot?.review.writable ||
      commandInFlightEpochRef.current === scopeEpochRef.current.epoch ||
      commandBusy ||
      pending
    )
      return;
    if (!dirtyRef.current) editBaseRef.current = snapshot;
    editGenerationRef.current += 1;
    dirtyRef.current = true;
    setAnswers((current) => setPerformanceReviewAnswer(current, answer, itemKey));
    setDirty(true);
    setCommandFailure(null);
    setFeedback(null);
    setSubmission(null);
  };

  const authorityBoundToScope = (
    authority: ProductSurfaceGovernedMutationAuthority,
    descriptor: PerformanceReviewCommandDescriptor
  ): boolean =>
    authority.mode === 'SECURE' &&
    authority.contextScopeKey === requestScope.contextScopeKey &&
    authority.expectedDecisionRevision === requestScope.queryMeta.decisionRevision &&
    (authority.idempotencyKey === undefined ||
      authority.idempotencyKey === descriptor.idempotencyKey) &&
    (authority.objectVersion === undefined ||
      authority.objectVersion === descriptor.expectedVersion);

  const executePending = async (command: PendingCommand): Promise<boolean> => {
    const epoch = scopeEpochRef.current.epoch;
    if (
      !commandExecutor ||
      !requestScope.ready ||
      !selectionCurrent ||
      authorityRevoked ||
      commandInFlightEpochRef.current === epoch ||
      reloadInFlightEpochRef.current === epoch
    ) {
      return false;
    }
    commandInFlightEpochRef.current = epoch;
    setCommandBusy(true);
    setCommandFailure(null);
    try {
      const result = await commandExecutor(command.descriptor, async (authority) => {
        if (scopeEpochRef.current.epoch !== epoch || !dispatchAllowedRef.current) {
          throw new Error('Performance-review selection changed before dispatch.');
        }
        if (!authorityBoundToScope(authority, command.descriptor)) {
          throw new Error('Performance-review authority changed before dispatch.');
        }
        const execution: PerformanceReviewMutationExecution = {
          authority,
          idempotencyKey: command.descriptor.idempotencyKey,
          expectedVersion: command.descriptor.expectedVersion,
          etag: command.descriptor.etag,
        };
        return command.descriptor.kind === 'SAVE_DRAFT'
          ? dataSource.saveDraft(
              command.descriptor.reviewId,
              command.body as PerformanceReviewDraftCommand,
              execution
            )
          : dataSource.submit(
              command.descriptor.reviewId,
              command.body as SubmitPerformanceReviewCommand,
              execution
            );
      });
      if (scopeEpochRef.current.epoch !== epoch) return false;
      if (command.descriptor.kind === 'SAVE_DRAFT') {
        const saved = result as PerformanceReviewSnapshot;
        try {
          if (!sameReviewIdentity(command.base, saved)) {
            throw new Error('Saved performance-review evidence changed identity.');
          }
        } catch (cause) {
          throw new HttpTransportError('NETWORK', cause);
        }
        queryClient.setQueryData(reviewQueryKey, saved);
        loadedRef.current = saved.review.reviewId + ':' + saved.etag;
        editBaseRef.current = undefined;
        setAnswers(saved.review.answers);
        dirtyRef.current = false;
        setDirty(false);
        setValidationVisible(false);
        setFeedback('SAVED');
      } else {
        const submitted = result as PerformanceReviewSubmission;
        const submitBody = command.body as SubmitPerformanceReviewCommand;
        if (submitted.contentHash !== submitBody.draftContentHash) {
          throw new HttpTransportError(
            'NETWORK',
            new Error('Submitted performance-review evidence changed content.')
          );
        }
        setSubmission(submitted);
        dirtyRef.current = false;
        setDirty(false);
        setFeedback('SUBMITTED');
        queryClient.setQueryData<PerformanceReviewSnapshot>(reviewQueryKey, {
          ...command.base,
          review: { ...command.base.review, state: 'SUBMITTED', writable: false },
        });
      }
      setPending(null);
      return true;
    } catch (error) {
      if (scopeEpochRef.current.epoch !== epoch || !dispatchAllowedRef.current) return false;
      const failure = classifyFailure(error);
      setCommandFailure(failure);
      if (failure.kind !== 'RETRYABLE') setPending(null);
      return false;
    } finally {
      if (commandInFlightEpochRef.current === epoch) {
        commandInFlightEpochRef.current = null;
        if (scopeEpochRef.current.epoch === epoch) setCommandBusy(false);
      }
    }
  };

  const saveDraft = async (): Promise<boolean> => {
    if (
      !selectionCurrent ||
      !requestScope.ready ||
      !snapshot ||
      !snapshot.review.writable ||
      !commandExecutor ||
      commandInFlightEpochRef.current === scopeEpochRef.current.epoch ||
      reloadInFlightEpochRef.current === scopeEpochRef.current.epoch ||
      commandBusy ||
      pending ||
      !dirty
    )
      return false;
    let body: PerformanceReviewDraftCommand;
    try {
      body = buildPerformanceReviewDraftCommand(snapshot.review.form, answers);
    } catch {
      setValidationVisible(true);
      setCommandFailure({
        kind: 'INVALID',
        message: 'Add at least one valid answer before saving.',
      });
      return false;
    }
    const command: PendingCommand = Object.freeze({
      descriptor: Object.freeze({
        kind: 'SAVE_DRAFT',
        routeContractKey: PERFORMANCE_REVIEW_DRAFT_CONTRACT,
        reviewId: snapshot.review.reviewId,
        idempotencyKey: createIdempotencyKey(),
        expectedVersion: snapshot.review.aggregateVersion,
        etag: snapshot.etag,
      }),
      body,
      base: snapshot,
    });
    setPending(command);
    return executePending(command);
  };

  const submit = async (): Promise<boolean> => {
    if (
      !selectionCurrent ||
      !requestScope.ready ||
      commandInFlightEpochRef.current === scopeEpochRef.current.epoch ||
      reloadInFlightEpochRef.current === scopeEpochRef.current.epoch
    )
      return false;
    if (reviewQuery.isError) return false;
    setValidationVisible(true);
    if (
      !snapshot ||
      !snapshot.review.writable ||
      !commandExecutor ||
      commandBusy ||
      pending ||
      dirtyRef.current ||
      !validation.valid
    ) {
      if (dirtyRef.current) {
        setCommandFailure({
          kind: 'INVALID',
          message: 'Save the current draft before submitting.',
        });
      }
      return false;
    }
    const command: PendingCommand = Object.freeze({
      descriptor: Object.freeze({
        kind: 'SUBMIT',
        routeContractKey: PERFORMANCE_REVIEW_SUBMIT_CONTRACT,
        reviewId: snapshot.review.reviewId,
        idempotencyKey: createIdempotencyKey(),
        expectedVersion: snapshot.review.aggregateVersion,
        etag: snapshot.etag,
      }),
      body: Object.freeze({
        draftContentHash: snapshot.review.draftContentHash,
        acknowledgement: true,
      }),
      base: snapshot,
    });
    setPending(command);
    return executePending(command);
  };

  const retryPending = async (): Promise<boolean> => (pending ? executePending(pending) : false);

  const reloadAuthoritative = async (discardDirty: boolean): Promise<boolean> => {
    const epoch = scopeEpochRef.current.epoch;
    if (
      !requestScope.ready ||
      !selectionCurrent ||
      activeReviewId === null ||
      authorityRevoked ||
      commandInFlightEpochRef.current === epoch ||
      reloadInFlightEpochRef.current === epoch ||
      commandBusy ||
      pending ||
      (dirtyRef.current && !discardDirty)
    ) {
      return false;
    }
    reloadInFlightEpochRef.current = epoch;
    const editGeneration = editGenerationRef.current;
    try {
      const result = await reviewQuery.refetch();
      if (
        scopeEpochRef.current.epoch !== epoch ||
        editGenerationRef.current !== editGeneration ||
        commandInFlightEpochRef.current === epoch
      )
        return false;
      if (result.error || !result.data) return false;
      setPending(null);
      setCommandFailure(null);
      setFeedback(null);
      loadedRef.current = result.data.review.reviewId + ':' + result.data.etag;
      editBaseRef.current = undefined;
      setAnswers(result.data.review.answers);
      dirtyRef.current = false;
      setDirty(false);
      setValidationVisible(false);
      setSubmission(null);
      return true;
    } finally {
      if (reloadInFlightEpochRef.current === epoch) reloadInFlightEpochRef.current = null;
    }
  };

  const reload = async (): Promise<boolean> => reloadAuthoritative(false);
  const discardAndReload = async (): Promise<boolean> => reloadAuthoritative(true);

  const loadFailure = reviewQuery.error ? classifyFailure(reviewQuery.error) : null;
  const denied =
    authorityRevoked || loadFailure?.kind === 'DENIED' || commandFailure?.kind === 'DENIED';
  dispatchAllowedRef.current = requestScope.ready && selectionCurrent && !denied;

  useEffect(() => {
    if (!denied) return;
    setAuthorityRevoked(true);
    setAnswers([]);
    dirtyRef.current = false;
    setDirty(false);
    setPending(null);
    setSubmission(null);
    editBaseRef.current = undefined;
    loadedRef.current = '';
  }, [denied]);

  useEffect(() => {
    if (!authorityRevoked) return;
    queryClient.removeQueries({ queryKey: ['hris', 'performance', 'assigned-review'] });
  }, [authorityRevoked, queryClient]);

  const viewCurrent = requestScope.ready && selectionCurrent && !denied;

  return {
    review: viewCurrent ? snapshot?.review : undefined,
    etag: viewCurrent ? snapshot?.etag : undefined,
    answers: viewCurrent ? answers : Object.freeze([] as PerformanceReviewAnswer[]),
    validation: viewCurrent
      ? validation
      : Object.freeze({ valid: false, issues: Object.freeze([]) }),
    validationVisible: viewCurrent ? validationVisible : false,
    submission: viewCurrent ? submission : null,
    dirty: viewCurrent ? dirty : false,
    pendingKind: viewCurrent ? (pending?.descriptor.kind ?? null) : null,
    commandBusy: viewCurrent ? commandBusy : false,
    commandConnected: Boolean(commandExecutor),
    feedback: viewCurrent ? feedback : null,
    loadFailure: requestScope.ready && selectionCurrent ? loadFailure : null,
    commandFailure: viewCurrent ? commandFailure : null,
    denied,
    loading:
      !requestScope.ready ||
      !selectionCurrent ||
      (activeReviewId !== null && reviewQuery.isPending),
    fetching: requestScope.ready && selectionCurrent && reviewQuery.isFetching,
    empty: requestScope.ready && selectionCurrent && activeReviewId === null,
    partial: Boolean(viewCurrent && snapshot && reviewQuery.isError),
    updateAnswer,
    saveDraft,
    submit,
    retryPending,
    reload,
    discardAndReload,
  } as const;
}

export type PerformanceReviewRuntime = ReturnType<typeof usePerformanceReviewRuntime>;
