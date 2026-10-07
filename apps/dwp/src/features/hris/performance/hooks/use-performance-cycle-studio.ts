import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';

import { resolveHcmQueryFailure } from '../../../../components/hcm-query-state-model';
import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { performanceCycleDataSource } from '../api/performance-cycle-api';
import {
  buildCreatePerformanceCycleRequest,
  buildPublishPerformanceCycleRequest,
  buildUpdatePerformanceCycleRequest,
  classifyPerformanceCommandFailure,
  createPerformanceCycleDraft,
  newPerformanceCommandId,
  performancePreviewState,
  performanceReceiptDisposition,
  rebasePerformanceCycleDraft,
  validatePerformanceCycleDraft,
} from '../model/performance-cycle-command';
import {
  performanceCycleCollectionQueryKey,
  performanceCycleDetailQueryKey,
  performanceReceiptQueryKey,
  selectPerformanceCommandReceipt,
  selectPerformanceCycleCollection,
  selectPerformanceCycleCommandResult,
  selectPerformanceCycleDetail,
  selectPerformancePreviewCommandResult,
} from '../model/performance-cycle-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { ProductSurfaceHighRiskCommandDescriptor } from '../../../../components/product-surface-high-risk-command';
import type { ProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import type { PerformanceCycleDataSource } from '../api/performance-cycle-api';
import type {
  CreatePerformanceCycleRequest,
  PerformanceCommandFailure,
  PerformanceCycleDraft,
  PreviewPerformancePopulationRequest,
  PublishPerformanceCycleRequest,
  UpdatePerformanceCycleRequest,
  ValidatePerformanceCycleRequest,
} from '../model/performance-cycle-command';
import type {
  PerformanceCommandReceipt,
  PerformanceCycleCollection,
  PerformanceCycleDetail,
  PerformancePopulationPreview,
} from '../model/performance-cycle-contract';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

export type PerformanceCommandExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
) => Promise<T>;

export type PerformancePublishCommandBinding = Readonly<{
  cycleId: string;
  request: PublishPerformanceCycleRequest;
}>;

export type PerformancePublishCommandExecutor =
  ProductSurfaceHighRiskCommandExecutor<PerformancePublishCommandBinding>;

export type PerformanceCommandExecutors = Readonly<{
  create: PerformanceCommandExecutor;
  update: PerformanceCommandExecutor;
  validate: PerformanceCommandExecutor;
  preview: PerformanceCommandExecutor;
  publish: PerformancePublishCommandExecutor;
}>;

export type HrisPerformanceCycleRuntimeOptions = Readonly<{
  requestScope: ProductSurfaceRequestScope;
  dataSource?: PerformanceCycleDataSource;
  commandExecutors?: PerformanceCommandExecutors;
}>;

type ScopeVisit = Readonly<{ identity: string; generation: number }>;
type Boundary = Readonly<{
  scopeIdentity: string;
  scopeGeneration: number;
  settlementGeneration: number;
}>;
type CommandPayload =
  | Readonly<{ kind: 'CREATE'; request: CreatePerformanceCycleRequest }>
  | Readonly<{ kind: 'UPDATE'; cycleId: string; request: UpdatePerformanceCycleRequest }>
  | Readonly<{ kind: 'VALIDATE'; cycleId: string; request: ValidatePerformanceCycleRequest }>
  | Readonly<{ kind: 'PREVIEW'; cycleId: string; request: PreviewPerformancePopulationRequest }>
  | Readonly<{ kind: 'PUBLISH'; cycleId: string; request: PublishPerformanceCycleRequest }>;
type CommandInput = Boundary & CommandPayload;
type CommandOutput = Readonly<{
  input: CommandInput;
  receipt: PerformanceCommandReceipt;
  cycle: PerformanceCycleDetail | null;
  preview: PerformancePopulationPreview | null;
  freshCycle: PerformanceCycleDetail | null;
}>;
type Recovery = Readonly<{
  input: CommandInput;
  receiptId: string | null;
  aggregateId: string | null;
}>;
export type PerformanceCycleFeedback =
  'CREATED' | 'SAVED' | 'VALIDATED' | 'PREVIEWED' | 'PUBLISHED';

function supersededRead(): never {
  const error = new Error('Performance cycle read was superseded.');
  error.name = 'AbortError';
  throw error;
}

function matchesBoundary(input: Boundary, visit: ScopeVisit, settlement: number): boolean {
  return (
    input.scopeIdentity === visit.identity &&
    input.scopeGeneration === visit.generation &&
    input.settlementGeneration === settlement
  );
}

function commandCycleId(input: CommandInput, receipt: PerformanceCommandReceipt): string {
  return input.kind === 'CREATE' ? receipt.aggregateId : input.cycleId;
}

const COMMAND_IDENTITY = Object.freeze({
  CREATE: Object.freeze({
    commandType: 'CREATE_DRAFT',
    originatingAction: 'performance.cycle.create',
  }),
  UPDATE: Object.freeze({
    commandType: 'UPDATE_DRAFT',
    originatingAction: 'performance.cycle.update',
  }),
  VALIDATE: Object.freeze({
    commandType: 'VALIDATE_DRAFT',
    originatingAction: 'performance.cycle.validate',
  }),
  PREVIEW: Object.freeze({
    commandType: 'PREVIEW_PARTICIPANTS',
    originatingAction: 'performance.cycle.preview',
  }),
  PUBLISH: Object.freeze({
    commandType: 'PUBLISH',
    originatingAction: 'performance.cycle.publish',
  }),
} as const);

function assertReceiptMatchesCommand(
  input: CommandInput,
  receipt: PerformanceCommandReceipt,
  expectedReceiptId?: string,
  expectedAggregateId?: string
): void {
  const identity = COMMAND_IDENTITY[input.kind];
  const expectedRevision = input.kind === 'CREATE' ? 0 : input.request.expectedRevision;
  if (
    receipt.receiptId !== input.request.commandId ||
    (expectedReceiptId !== undefined && receipt.receiptId !== expectedReceiptId) ||
    receipt.commandType !== identity.commandType ||
    receipt.originatingAction !== identity.originatingAction ||
    receipt.expectedAggregateVersion !== expectedRevision ||
    (expectedAggregateId !== undefined && receipt.aggregateId !== expectedAggregateId) ||
    (input.kind !== 'CREATE' && receipt.aggregateId !== input.cycleId)
  ) {
    throw new Error('Performance command receipt identity does not match the request.');
  }
}

function feedbackFor(kind: CommandInput['kind']): PerformanceCycleFeedback {
  if (kind === 'CREATE') return 'CREATED';
  if (kind === 'UPDATE') return 'SAVED';
  if (kind === 'VALIDATE') return 'VALIDATED';
  if (kind === 'PREVIEW') return 'PREVIEWED';
  return 'PUBLISHED';
}

export function useHrisPerformanceCycleRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
}

export function useHrisPerformanceCycleRuntime({
  requestScope,
  dataSource = performanceCycleDataSource,
  commandExecutors,
}: HrisPerformanceCycleRuntimeOptions) {
  const queryClient = useQueryClient();
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const scopeCacheKey = requestScope.cacheKey;
  const visitRef = useRef<ScopeVisit>({ identity: scopeIdentity, generation: 0 });
  const settlementRef = useRef(0);
  const mountedRef = useRef(true);
  const commandActiveRef = useRef(false);
  const activeCommandInputRef = useRef<CommandInput | null>(null);
  const activeReceiptKeyRef = useRef<ReturnType<typeof performanceReceiptQueryKey> | null>(null);
  const previousScopeRef = useRef(scopeIdentity);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PerformanceCycleDraft | null>(null);
  const [preview, setPreview] = useState<PerformancePopulationPreview | null>(null);
  const [failure, setFailure] = useState<PerformanceCommandFailure | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [feedback, setFeedback] = useState<PerformanceCycleFeedback | null>(null);
  const commandAuthorityRevoked =
    failure?.kind === 'FORBIDDEN' || failure?.kind === 'UNAUTHENTICATED';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const current = visitRef.current;
    if (current.identity === scopeIdentity) return;
    visitRef.current = { identity: scopeIdentity, generation: current.generation + 1 };
    settlementRef.current += 1;
  }, [scopeIdentity]);

  useEffect(() => {
    if (previousScopeRef.current === scopeIdentity) return;
    previousScopeRef.current = scopeIdentity;
    setSelectedCycleId(null);
    setDraft(null);
    setPreview(null);
    setFailure(null);
    setRecovery(null);
    setFeedback(null);
    commandActiveRef.current = false;
    activeCommandInputRef.current = null;
  }, [scopeIdentity]);

  const collectionKey = useMemo(
    () => performanceCycleCollectionQueryKey({ cacheKey: scopeCacheKey }),
    [scopeCacheKey]
  );
  const collectionQuery = useQuery<PerformanceCycleCollection>({
    queryKey: collectionKey,
    queryFn: async ({ signal }) => {
      const visit = visitRef.current;
      const settlement = settlementRef.current;
      const collection = selectPerformanceCycleCollection(
        await dataSource.readCollection(requestScope.contextScopeKey, signal)
      );
      if (visitRef.current !== visit || settlementRef.current !== settlement) {
        return (
          queryClient.getQueryData<PerformanceCycleCollection>(collectionKey) ?? supersededRead()
        );
      }
      return collection;
    },
    enabled: requestScope.ready && !commandAuthorityRevoked,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });

  useEffect(() => {
    const cycles = collectionQuery.data?.cycles;
    if (!cycles) return;
    if (!cycles.length) {
      setSelectedCycleId(null);
      return;
    }
    if (!selectedCycleId || !cycles.some((cycle) => cycle.cycleId === selectedCycleId)) {
      setSelectedCycleId(cycles[0]!.cycleId);
    }
  }, [collectionQuery.data, selectedCycleId]);

  const detailKey = useMemo(
    () => performanceCycleDetailQueryKey({ cacheKey: scopeCacheKey }, selectedCycleId ?? 'none'),
    [scopeCacheKey, selectedCycleId]
  );
  const detailQuery = useQuery<PerformanceCycleDetail>({
    queryKey: detailKey,
    queryFn: async ({ signal }) => {
      if (!selectedCycleId) return supersededRead();
      const visit = visitRef.current;
      const settlement = settlementRef.current;
      const detail = selectPerformanceCycleDetail(
        await dataSource.readCycle(selectedCycleId, requestScope.contextScopeKey, signal)
      );
      if (detail.cycleId !== selectedCycleId) {
        throw new Error('Performance cycle detail identity does not match the request.');
      }
      if (visitRef.current !== visit || settlementRef.current !== settlement) {
        return queryClient.getQueryData<PerformanceCycleDetail>(detailKey) ?? supersededRead();
      }
      return detail;
    },
    enabled: requestScope.ready && Boolean(selectedCycleId) && !commandAuthorityRevoked,
    meta: requestScope.queryMeta,
    staleTime: 15_000,
  });

  const receiptId = recovery?.receiptId ?? null;
  const receiptKey = useMemo(
    () => performanceReceiptQueryKey({ cacheKey: scopeCacheKey }, receiptId ?? 'none'),
    [receiptId, scopeCacheKey]
  );
  useLayoutEffect(() => {
    if (receiptId) activeReceiptKeyRef.current = receiptKey;
  }, [receiptId, receiptKey]);
  const receiptQuery = useQuery<PerformanceCommandReceipt>({
    queryKey: receiptKey,
    queryFn: async ({ signal }) => {
      if (!receiptId) return supersededRead();
      const receipt = selectPerformanceCommandReceipt(
        await dataSource.readReceipt(receiptId, requestScope.contextScopeKey, signal)
      );
      if (!recovery) return supersededRead();
      assertReceiptMatchesCommand(
        recovery.input,
        receipt,
        receiptId,
        recovery.aggregateId ?? undefined
      );
      return receipt;
    },
    enabled: requestScope.ready && Boolean(receiptId) && !commandAuthorityRevoked,
    meta: requestScope.queryMeta,
    staleTime: 0,
    retry: false,
    refetchInterval: receiptId ? 3_000 : false,
    refetchIntervalInBackground: false,
  });

  const mutation = useMutation({
    mutationFn: async (input: CommandInput): Promise<CommandOutput> => {
      activeCommandInputRef.current = input;
      if (!matchesBoundary(input, visitRef.current, settlementRef.current)) {
        throw new Error('Performance cycle request scope changed.');
      }
      let effectiveInput = input;
      let cycle: PerformanceCycleDetail | null = null;
      let previewResult: PerformancePopulationPreview | null = null;
      let receipt: PerformanceCommandReceipt;
      if (input.kind === 'PUBLISH') {
        if (!commandExecutors?.publish) throw new Error('Publisher authority is unavailable.');
        const result = selectPerformanceCycleCommandResult(
          await commandExecutors.publish(
            (authority, command?: ProductSurfaceHighRiskCommandDescriptor) => {
              const request =
                (command?.payload as PublishPerformanceCycleRequest | undefined) ?? input.request;
              effectiveInput = { ...input, request };
              activeCommandInputRef.current = effectiveInput;
              return dataSource.publishCycle(
                command?.targetId ?? input.cycleId,
                request,
                authority
              );
            },
            { cycleId: input.cycleId, request: input.request }
          )
        );
        cycle = result.cycle;
        receipt = result.receipt;
      } else {
        if (input.kind === 'CREATE') {
          if (!commandExecutors?.create) throw new Error('Create authority is unavailable.');
          const result = selectPerformanceCycleCommandResult(
            await commandExecutors.create((authority) =>
              dataSource.createCycle(input.request, authority)
            )
          );
          cycle = result.cycle;
          receipt = result.receipt;
        } else if (input.kind === 'UPDATE') {
          if (!commandExecutors?.update) throw new Error('Update authority is unavailable.');
          const result = selectPerformanceCycleCommandResult(
            await commandExecutors.update((authority) =>
              dataSource.updateCycle(input.cycleId, input.request, authority)
            )
          );
          cycle = result.cycle;
          receipt = result.receipt;
        } else if (input.kind === 'VALIDATE') {
          if (!commandExecutors?.validate) throw new Error('Validate authority is unavailable.');
          const result = selectPerformanceCycleCommandResult(
            await commandExecutors.validate((authority) =>
              dataSource.validateCycle(input.cycleId, input.request, authority)
            )
          );
          cycle = result.cycle;
          receipt = result.receipt;
        } else {
          if (!commandExecutors?.preview) throw new Error('Preview authority is unavailable.');
          const result = selectPerformancePreviewCommandResult(
            await commandExecutors.preview((authority) =>
              dataSource.previewPopulation(input.cycleId, input.request, authority)
            )
          );
          previewResult = result.preview;
          receipt = result.receipt;
        }
      }
      assertReceiptMatchesCommand(effectiveInput, receipt);
      let freshCycle: PerformanceCycleDetail | null = null;
      if (
        performanceReceiptDisposition(receipt) === 'REFRESH_REQUIRED' &&
        input.kind !== 'PREVIEW'
      ) {
        try {
          const expectedCycleId = commandCycleId(effectiveInput, receipt);
          const selected = selectPerformanceCycleDetail(
            await dataSource.readCycle(expectedCycleId, requestScope.contextScopeKey)
          );
          freshCycle = selected.cycleId === expectedCycleId ? selected : null;
        } catch (error) {
          if (resolveHcmQueryFailure(error)?.kind === 'permission') throw error;
          freshCycle = null;
        }
      }
      return { input: effectiveInput, receipt, cycle, preview: previewResult, freshCycle };
    },
    onSuccess: (output) => {
      activeCommandInputRef.current = null;
      if (
        !mountedRef.current ||
        !matchesBoundary(output.input, visitRef.current, settlementRef.current)
      ) {
        return;
      }
      commandActiveRef.current = false;
      const disposition = performanceReceiptDisposition(output.receipt);
      if (disposition === 'FAILED') {
        setFailure({
          kind: output.receipt.state === 'QUARANTINED' ? 'QUARANTINED' : 'REJECTED',
          preserveDraft: true,
          requiresRefresh: false,
          replayExactCommand: false,
          receiptId: output.receipt.receiptId,
        });
        setRecovery(null);
        return;
      }
      if (
        disposition === 'PENDING' ||
        disposition === 'RESULT_UNKNOWN' ||
        (disposition === 'REFRESH_REQUIRED' &&
          output.input.kind !== 'PREVIEW' &&
          !output.freshCycle)
      ) {
        setRecovery({
          input: output.input,
          receiptId: output.receipt.receiptId,
          aggregateId: output.receipt.aggregateId,
        });
        setFailure({
          kind: 'RESULT_UNKNOWN',
          preserveDraft: true,
          requiresRefresh: true,
          replayExactCommand: false,
          receiptId: output.receipt.receiptId,
        });
        return;
      }
      settlementRef.current += 1;
      setFailure(null);
      setRecovery(null);
      setFeedback(feedbackFor(output.input.kind));
      if (output.input.kind === 'PREVIEW' && output.preview) {
        setPreview(output.preview);
      } else if (output.freshCycle) {
        const freshKey = performanceCycleDetailQueryKey(requestScope, output.freshCycle.cycleId);
        queryClient.setQueryData(freshKey, output.freshCycle);
        setSelectedCycleId(output.freshCycle.cycleId);
        setDraft(null);
        setPreview(null);
        void queryClient.invalidateQueries({ queryKey: collectionKey, exact: true });
      }
    },
    onError: (error, input) => {
      const effectiveInput = activeCommandInputRef.current ?? input;
      activeCommandInputRef.current = null;
      if (
        !mountedRef.current ||
        !matchesBoundary(effectiveInput, visitRef.current, settlementRef.current)
      ) {
        return;
      }
      commandActiveRef.current = false;
      const classified = classifyPerformanceCommandFailure(error);
      setFailure(classified);
      setFeedback(null);
      if (classified.kind === 'RESULT_UNKNOWN') {
        setRecovery({
          input: effectiveInput,
          receiptId: classified.receiptId,
          aggregateId: effectiveInput.kind === 'CREATE' ? null : effectiveInput.cycleId,
        });
      }
      if (classified.kind === 'FORBIDDEN' || classified.kind === 'UNAUTHENTICATED') {
        setDraft(null);
        setPreview(null);
      }
    },
  });

  useEffect(() => {
    const receipt = receiptQuery.data;
    if (!receipt || !recovery || receipt.receiptId !== recovery.receiptId || mutation.isPending)
      return;
    const disposition = performanceReceiptDisposition(receipt);
    if (disposition === 'FAILED') {
      setFailure({
        kind: receipt.state === 'QUARANTINED' ? 'QUARANTINED' : 'REJECTED',
        preserveDraft: true,
        requiresRefresh: false,
        replayExactCommand: false,
        receiptId: receipt.receiptId,
      });
      setRecovery(null);
      return;
    }
    if (disposition === 'REFRESH_REQUIRED') {
      const exactInput = recovery.input;
      setRecovery(null);
      commandActiveRef.current = true;
      mutation.mutate(exactInput);
    }
  }, [mutation, receiptQuery.data, recovery]);

  const collectionFailure = resolveHcmQueryFailure(collectionQuery.error);
  const detailFailure = resolveHcmQueryFailure(detailQuery.error);
  const readErrors = [collectionQuery.error, detailQuery.error, receiptQuery.error];
  const readAuthorityFailure = readErrors.some(
    (error) => error instanceof HttpError && error.status === 401
  )
    ? 'UNAUTHENTICATED'
    : readErrors.some((error) => error instanceof HttpError && error.status === 403)
      ? 'FORBIDDEN'
      : null;
  const readAuthorityRevoked = readAuthorityFailure !== null;

  useLayoutEffect(() => {
    if (!readAuthorityFailure) return;
    settlementRef.current += 1;
    commandActiveRef.current = false;
    setDraft(null);
    setPreview(null);
    setRecovery(null);
    setFeedback(null);
    activeCommandInputRef.current = null;
    setFailure({
      kind: readAuthorityFailure,
      preserveDraft: false,
      requiresRefresh: false,
      replayExactCommand: false,
      receiptId: null,
    });
  }, [readAuthorityFailure]);

  useLayoutEffect(() => {
    if (!commandAuthorityRevoked) return;
    queryClient.removeQueries({ queryKey: collectionKey, exact: true });
    queryClient.removeQueries({ queryKey: detailKey, exact: true });
    if (activeReceiptKeyRef.current) {
      queryClient.removeQueries({ queryKey: activeReceiptKeyRef.current, exact: true });
      activeReceiptKeyRef.current = null;
    }
  }, [collectionKey, commandAuthorityRevoked, detailKey, queryClient]);

  const startCommand = (payload: CommandPayload) => {
    if (commandActiveRef.current || recovery) return;
    commandActiveRef.current = true;
    const visit = visitRef.current;
    settlementRef.current += 1;
    mutation.mutate({
      ...payload,
      scopeIdentity: visit.identity,
      scopeGeneration: visit.generation,
      settlementGeneration: settlementRef.current,
    });
  };

  const detail = detailQuery.data ?? null;
  const previewState = detail && preview ? performancePreviewState(detail, preview) : null;
  const blocksCachedCollection =
    collectionFailure?.kind === 'permission' ||
    collectionFailure?.kind === 'not-found' ||
    collectionFailure?.kind === 'context-changed';
  const blocksCachedDetail =
    detailFailure?.kind === 'permission' ||
    detailFailure?.kind === 'not-found' ||
    detailFailure?.kind === 'context-changed';
  const authorityRevoked = readAuthorityRevoked || commandAuthorityRevoked;
  const collection =
    authorityRevoked || blocksCachedCollection ? null : (collectionQuery.data ?? null);
  const detailBlocked = authorityRevoked || blocksCachedDetail;
  const validation = draft ? validatePerformanceCycleDraft(draft) : null;

  const selectCycle = (cycleId: string) => {
    if (authorityRevoked || blocksCachedCollection || cycleId === selectedCycleId) return;
    settlementRef.current += 1;
    commandActiveRef.current = false;
    setSelectedCycleId(cycleId);
    setDraft(null);
    setPreview(null);
    setFailure(null);
    setRecovery(null);
    setFeedback(null);
  };

  const saveDraft = () => {
    if (
      !draft ||
      !(draft.cycleId ? commandExecutors?.update : commandExecutors?.create) ||
      mutation.isPending ||
      recovery ||
      (draft.cycleId !== null && detailBlocked)
    ) {
      return;
    }
    const commandId = newPerformanceCommandId();
    if (draft.cycleId) {
      if (!detail?.allowedActions.includes('UPDATE_DRAFT') || detail.lifecycleState === 'RETIRED') {
        return;
      }
      const request = buildUpdatePerformanceCycleRequest(draft, commandId);
      if (request) startCommand({ kind: 'UPDATE', cycleId: draft.cycleId, request });
    } else {
      if (!collection?.allowedActions.includes('CREATE_DRAFT')) return;
      const request = buildCreatePerformanceCycleRequest(draft, commandId);
      if (request) startCommand({ kind: 'CREATE', request });
    }
  };

  const validateSelected = () => {
    if (
      !detail ||
      !commandExecutors?.validate ||
      recovery ||
      detailBlocked ||
      detail.lifecycleState !== 'DRAFT' ||
      !detail.allowedActions.includes('UPDATE_DRAFT')
    ) {
      return;
    }
    startCommand({
      kind: 'VALIDATE',
      cycleId: detail.cycleId,
      request: { commandId: newPerformanceCommandId(), expectedRevision: detail.aggregateVersion },
    });
  };

  const previewSelected = (asOf: string) => {
    if (
      !detail ||
      !commandExecutors?.preview ||
      recovery ||
      detailBlocked ||
      detail.lifecycleState !== 'VALIDATED' ||
      !detail.allowedActions.includes('PREVIEW_PARTICIPANTS')
    ) {
      return;
    }
    try {
      const normalized = new Date(asOf).toISOString();
      startCommand({
        kind: 'PREVIEW',
        cycleId: detail.cycleId,
        request: {
          commandId: newPerformanceCommandId(),
          expectedRevision: detail.aggregateVersion,
          asOf: normalized,
        },
      });
    } catch {
      return;
    }
  };

  const publishSelected = (publicationApprovalRef: string, reason: string) => {
    if (!detail || !preview || !commandExecutors?.publish || recovery || detailBlocked) return;
    const request = buildPublishPerformanceCycleRequest(
      detail,
      preview,
      newPerformanceCommandId(),
      publicationApprovalRef,
      reason
    );
    if (request) startCommand({ kind: 'PUBLISH', cycleId: detail.cycleId, request });
  };

  const retryUnknownCommand = () => {
    if (!recovery || recovery.receiptId || mutation.isPending || commandActiveRef.current) return;
    commandActiveRef.current = true;
    mutation.mutate(recovery.input);
  };

  const loadLatest = async () => {
    if (authorityRevoked) return;
    const result = await detailQuery.refetch();
    if (result.error || !result.data || !mountedRef.current) return;
    setDraft((current) => (current ? rebasePerformanceCycleDraft(current, result.data) : current));
    setPreview(null);
    setFailure(null);
  };

  return {
    ready: requestScope.ready,
    loading: !requestScope.ready || collectionQuery.isLoading,
    collection,
    collectionError:
      collectionQuery.error && (!collectionQuery.data || blocksCachedCollection)
        ? collectionQuery.error
        : null,
    collectionStaleError:
      collectionQuery.error && collectionQuery.data && !blocksCachedCollection
        ? collectionQuery.error
        : null,
    refetchCollection: async () => (authorityRevoked ? undefined : await collectionQuery.refetch()),
    collectionFetching: collectionQuery.isFetching,
    selectedCycleId,
    selectCycle,
    detail: detailBlocked ? null : detail,
    detailLoading: Boolean(selectedCycleId) && detailQuery.isLoading,
    detailError: detailQuery.error,
    detailFetching: detailQuery.isFetching,
    refetchDetail: async () => (authorityRevoked ? undefined : await detailQuery.refetch()),
    draft: detailBlocked ? null : draft,
    setDraft,
    validation: detailBlocked ? null : validation,
    openCreate: () => {
      if (
        !recovery &&
        collection?.allowedActions.includes('CREATE_DRAFT') &&
        commandExecutors?.create
      ) {
        setDraft(createPerformanceCycleDraft());
        setFailure(null);
      }
    },
    openEdit: () => {
      if (
        detail &&
        !detailBlocked &&
        detail.lifecycleState !== 'RETIRED' &&
        detail.allowedActions.includes('UPDATE_DRAFT') &&
        commandExecutors?.update &&
        !recovery
      ) {
        setDraft(createPerformanceCycleDraft(detail));
        setFailure(null);
      }
    },
    closeDraft: () => setDraft(null),
    saveDraft,
    validateSelected,
    previewSelected,
    publishSelected,
    loadLatest,
    preview: detailBlocked ? null : preview,
    previewState: detailBlocked ? null : previewState,
    failure,
    recovery: authorityRevoked ? null : recovery,
    receipt: authorityRevoked ? null : (receiptQuery.data ?? null),
    receiptError: receiptQuery.error,
    checkReceipt: async () => (authorityRevoked ? undefined : await receiptQuery.refetch()),
    retryUnknownCommand,
    feedback,
    clearFeedback: () => setFeedback(null),
    busy: mutation.isPending,
    canCreate: Boolean(
      commandExecutors?.create &&
      !recovery &&
      collection?.allowedActions.includes('CREATE_DRAFT') &&
      !authorityRevoked
    ),
    canEdit: Boolean(
      commandExecutors?.update &&
      !recovery &&
      detail &&
      !blocksCachedDetail &&
      detail.lifecycleState !== 'RETIRED' &&
      detail.allowedActions.includes('UPDATE_DRAFT') &&
      !authorityRevoked
    ),
    canValidate: Boolean(
      commandExecutors?.validate &&
      !recovery &&
      detail?.lifecycleState === 'DRAFT' &&
      !blocksCachedDetail &&
      detail.allowedActions.includes('UPDATE_DRAFT') &&
      !authorityRevoked
    ),
    canPreview: Boolean(
      commandExecutors?.preview &&
      !recovery &&
      detail?.lifecycleState === 'VALIDATED' &&
      !blocksCachedDetail &&
      detail.allowedActions.includes('PREVIEW_PARTICIPANTS') &&
      !authorityRevoked
    ),
    canPublish: Boolean(
      commandExecutors?.publish &&
      !recovery &&
      detail?.lifecycleState === 'VALIDATED' &&
      !blocksCachedDetail &&
      detail.version.versionState === 'VALIDATED' &&
      detail.allowedActions.includes('PUBLISH') &&
      previewState === 'READY' &&
      !authorityRevoked
    ),
    authorConnected: Boolean(commandExecutors),
    publisherConnected: Boolean(commandExecutors?.publish),
  };
}

export type HrisPerformanceCycleRuntime = ReturnType<typeof useHrisPerformanceCycleRuntime>;
