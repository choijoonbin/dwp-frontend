import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ApprovalPolicyCreateResponseError,
  createApprovalPolicyDraft,
  getApprovalPolicies,
  HttpError,
  HttpTransportError,
} from '@dwp-frontend/shared-utils';

import { ProductSurfaceMutationAuthorityError } from '../../components/use-product-surface-governed-mutation';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalManagementScopeReset } from './approval-management-scope';
import {
  emptyApprovalPolicyCreateDraft,
  validateApprovalPolicyCreateDraft,
} from './approval-policy-create-model';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';

import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementRequestScope } from './use-approval-experience';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type {
  ApprovalPolicyCreateDraft,
  ApprovalPolicyCreateValidation,
} from './approval-policy-create-model';

export type ApprovalPolicyCreateProblem =
  'DENIED' | 'CONFLICT' | 'UNAVAILABLE' | 'UNKNOWN' | 'ERROR';

type PolicyCreateAttempt = Readonly<{
  contextScopeKey: string;
  expectedMakerId: string;
  idempotencyKey: string;
  input: NonNullable<ApprovalPolicyCreateValidation['input']>;
  queryKey: readonly unknown[];
}>;

type PolicyCreateOptions = Readonly<{
  requestScope: ApprovalManagementRequestScope;
  scopeReady: boolean;
  sourceReady: boolean;
  canCreate: boolean;
  policies: readonly ApprovalPolicy[];
  policiesQueryKey: readonly unknown[];
  onCreated: (policy: ApprovalPolicy) => void;
}>;

function samePolicyKey(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

function classify(error: unknown, dispatched: boolean): ApprovalPolicyCreateProblem {
  if (error instanceof HttpError) {
    if (error.status === 403) return 'DENIED';
    if (error.status === 409) return 'CONFLICT';
    if (error.status === 503) return 'UNAVAILABLE';
    return error.status >= 500 ? 'UNAVAILABLE' : 'ERROR';
  }
  if (error instanceof ProductSurfaceMutationAuthorityError) return 'UNAVAILABLE';
  if (error instanceof HttpTransportError || error instanceof ApprovalPolicyCreateResponseError) {
    return dispatched ? 'UNKNOWN' : 'UNAVAILABLE';
  }
  return dispatched ? 'UNKNOWN' : 'ERROR';
}

export function useApprovalPolicyCreate(options: PolicyCreateOptions) {
  const queryClient = useQueryClient();
  const commandScope = useApprovalManagementCommandScope(options.requestScope.cacheKey);
  const runCreate = useApprovalGovernedMutation('route.approvals.admin.policy-create.action');
  const [open, setOpen] = useState(false);
  const [draft, setDraftState] = useState<ApprovalPolicyCreateDraft>(() =>
    emptyApprovalPolicyCreateDraft()
  );
  const [problem, setProblem] = useState<ApprovalPolicyCreateProblem | null>(null);
  const active = useRef<ApprovalManagementScopedCommand<PolicyCreateAttempt> | null>(null);
  const dispatched = useRef(new WeakSet<object>());
  const current = useRef(options);
  current.current = options;

  const reset = useCallback(() => {
    active.current = null;
    setOpen(false);
    setProblem(null);
    setDraftState(emptyApprovalPolicyCreateDraft());
  }, []);
  useApprovalManagementScopeReset(options.requestScope.cacheKey, reset);

  const validation = useMemo(
    () => validateApprovalPolicyCreateDraft(draft, options.policies),
    [draft, options.policies]
  );

  const assertCurrent = useCallback(
    (command: ApprovalManagementScopedCommand<PolicyCreateAttempt>) => {
      const live = current.current;
      if (
        !commandScope.isCurrent(command) ||
        !live.scopeReady ||
        !live.canCreate ||
        live.requestScope.contextScopeKey !== command.input.contextScopeKey ||
        live.requestScope.cacheKey[1] !== command.input.expectedMakerId
      ) {
        throw new ProductSurfaceOperationCancelledError();
      }
      const state = queryClient.getQueryState<ApprovalPolicy[]>(command.input.queryKey);
      const rows = queryClient.getQueryData<ApprovalPolicy[]>(command.input.queryKey);
      if (state?.status !== 'success' || state.fetchStatus !== 'idle' || state.error || !rows) {
        throw new ProductSurfaceMutationAuthorityError();
      }
      if (rows.some((policy) => samePolicyKey(policy.policyKey, command.input.input.policyKey))) {
        throw new HttpError('The policy key already exists in the current catalog.', 409);
      }
    },
    [commandScope, queryClient]
  );

  const mutation = useMutation({
    mutationFn: async (command: ApprovalManagementScopedCommand<PolicyCreateAttempt>) =>
      commandScope.run(command, async (attempt) => {
        await queryClient.fetchQuery({
          queryKey: attempt.queryKey,
          queryFn: ({ signal }) => getApprovalPolicies(attempt.contextScopeKey, signal),
          staleTime: 0,
        });
        assertCurrent(command);
        return runCreate((execution) =>
          createApprovalPolicyDraft(attempt.input, execution, {
            contextScopeKey: attempt.contextScopeKey,
            expectedMakerId: attempt.expectedMakerId,
            idempotencyKey: attempt.idempotencyKey,
            beforeDispatch: () => assertCurrent(command),
            onDispatch: () => dispatched.current.add(command),
          })
        );
      }),
    onSuccess: ({ command, value }) => {
      if (active.current !== command || !commandScope.isCurrent(command)) return;
      queryClient.setQueryData<ApprovalPolicy[]>(command.input.queryKey, (rows = []) => [
        value,
        ...rows.filter((policy) => policy.policyId !== value.policyId),
      ]);
      active.current = null;
      setProblem(null);
      setDraftState(emptyApprovalPolicyCreateDraft());
      setOpen(false);
      current.current.onCreated(value);
    },
    onError: (error, command) => {
      if (active.current !== command || !commandScope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) {
        active.current = null;
        setProblem(null);
        return;
      }
      setProblem(classify(error, dispatched.current.has(command)));
    },
  });

  const createEnabled = Boolean(
    options.scopeReady &&
    options.sourceReady &&
    options.canCreate &&
    options.requestScope.contextScopeKey &&
    /^[1-9][0-9]*$/u.test(options.requestScope.cacheKey[1])
  );
  const locked = active.current !== null;

  const openCreate = useCallback(() => {
    if (!createEnabled) return;
    if (!active.current) {
      setDraftState(emptyApprovalPolicyCreateDraft());
      setProblem(null);
    }
    setOpen(true);
  }, [createEnabled]);
  const close = useCallback(() => {
    if (mutation.isPending) return;
    setOpen(false);
    if (!active.current) {
      setProblem(null);
      setDraftState(emptyApprovalPolicyCreateDraft());
    }
  }, [mutation.isPending]);
  const setDraft = useCallback((next: ApprovalPolicyCreateDraft) => {
    if (!active.current) setDraftState(next);
  }, []);
  const submit = useCallback(() => {
    const live = current.current;
    const contextScopeKey = live.requestScope.contextScopeKey;
    const expectedMakerId = live.requestScope.cacheKey[1];
    const checked = validateApprovalPolicyCreateDraft(draft, live.policies);
    if (
      active.current ||
      mutation.isPending ||
      !createEnabled ||
      !contextScopeKey ||
      !checked.input
    ) {
      return;
    }
    const command = commandScope.capture({
      contextScopeKey,
      expectedMakerId,
      idempotencyKey: `approval-policy-create-${crypto.randomUUID()}`,
      input: structuredClone(checked.input),
      queryKey: [...live.policiesQueryKey],
    });
    active.current = command;
    setProblem(null);
    mutation.mutate(command);
  }, [commandScope, createEnabled, draft, mutation]);
  const retryOriginal = useCallback(() => {
    const command = active.current;
    if (!command || mutation.isPending || !problem) return;
    setProblem(null);
    mutation.mutate(command);
  }, [mutation, problem]);
  const editPreserved = useCallback(() => {
    if (!problem || !['DENIED', 'CONFLICT'].includes(problem) || mutation.isPending) return;
    active.current = null;
    setProblem(null);
  }, [mutation.isPending, problem]);
  const refreshSource = useCallback(
    () => queryClient.invalidateQueries({ queryKey: options.policiesQueryKey, exact: true }),
    [options.policiesQueryKey, queryClient]
  );

  return {
    open,
    draft,
    validation,
    problem,
    busy: mutation.isPending,
    locked,
    createEnabled,
    canSubmit: createEnabled && !locked && Boolean(validation.input),
    canRetry: Boolean(problem && !mutation.isPending && options.scopeReady && options.canCreate),
    canEditPreserved: Boolean(problem && ['DENIED', 'CONFLICT'].includes(problem)),
    openCreate,
    close,
    setDraft,
    submit,
    retryOriginal,
    editPreserved,
    refreshSource,
  } as const;
}
