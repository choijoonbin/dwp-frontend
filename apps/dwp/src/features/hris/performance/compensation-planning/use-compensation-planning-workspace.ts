import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { compensationPlanningDataSource } from './compensation-planning-api';
import {
  isAmbiguousCompensationCommandFailure,
  isResultUnknown,
  verifyCompensationCommandResult,
} from './compensation-planning-command';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type {
  CompensationPlanningDataSource,
  CompensationReadContext,
} from './compensation-planning-api';
import type {
  CompensationCommandName,
  PendingCompensationCommand,
} from './compensation-planning-command';
import type {
  CompensationCommandResult,
  CompensationCycleCollection,
  CompensationProposalCollection,
  CompensationProposalDetail,
} from './compensation-planning-contract';
import type {
  CompensationPlanningWorkspaceActions,
  CompensationPlanningWorkspaceStatus,
} from './compensation-planning-workspace';

export type CompensationCommandExecutor = (
  pending: PendingCompensationCommand
) => Promise<CompensationCommandResult>;

export type CompensationPlanningCommandExecutors = Readonly<
  Partial<Record<CompensationCommandName, CompensationCommandExecutor>>
>;

export type CompensationPlanningCommandIntents = Readonly<{
  create?: () => PendingCompensationCommand;
  revise?: (cycleId: string, version: number) => PendingCompensationCommand;
  allocate?: (cycleId: string, version: number) => PendingCompensationCommand;
  draftProposal?: (cycleId: string, version: number) => PendingCompensationCommand;
  submitProposal?: (
    cycleId: string,
    proposalId: string,
    version: number,
    contentDigest: string,
    effectiveFrom: string
  ) => PendingCompensationCommand;
  approve?: (cycleId: string, version: number) => PendingCompensationCommand;
  publish?: (cycleId: string, version: number) => PendingCompensationCommand;
  cancel?: (cycleId: string, version: number) => PendingCompensationCommand;
}>;

export type CompensationPlanningRuntimeOptions = Readonly<{
  requestScope: ProductSurfaceRequestScope;
  dataSource?: CompensationPlanningDataSource;
  commandExecutors?: CompensationPlanningCommandExecutors;
  commandIntents?: CompensationPlanningCommandIntents;
}>;

export function useCompensationPlanningRequestScope() {
  return useProductSurfaceRequestScope({ productKey: 'hcm', surfaceKey: 'hcm.operations' });
}

function readKey(scope: ProductSurfaceRequestScope, kind: string, ...parts: unknown[]) {
  return ['hris', 'performance', 'compensation-planning', kind, ...parts, ...scope.cacheKey] as const;
}

function errorCode(error: unknown): string | null {
  if (!(error instanceof HttpError) || !error.details || typeof error.details !== 'object') {
    return null;
  }
  const value = (error.details as Record<string, unknown>).errorCode;
  return typeof value === 'string' ? value.trim().toUpperCase() : null;
}

function stepUpRequired(error: unknown): boolean {
  return error instanceof HttpError && error.status === 403 && errorCode(error) === 'STEP_UP_REQUIRED';
}

function denied(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.status === 401 || (error.status === 403 && !stepUpRequired(error)))
  );
}

async function readAllCycles(
  dataSource: CompensationPlanningDataSource,
  context: CompensationReadContext
): Promise<CompensationCycleCollection> {
  const items: CompensationCycleCollection['items'][number][] = [];
  let cursor: string | null | undefined;
  let anchor: string | null | undefined;
  let first: CompensationCycleCollection | undefined;
  const seen = new Set<string>();
  for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
    const page = await dataSource.cycles(
      { asOf: anchor, cursor, limit: 200 },
      context
    );
    first ??= page;
    if (
      page.asOf !== first.asOf ||
      page.scopeRevision !== first.scopeRevision ||
      page.fieldPolicyRevision !== first.fieldPolicyRevision
    ) {
      throw new Error('Compensation cycle continuation authority changed.');
    }
    items.push(...page.items);
    if (!page.hasMore) {
      return Object.freeze({ ...page, items: Object.freeze(items) });
    }
    if (!page.nextCursor || seen.has(page.nextCursor)) {
      throw new Error('Compensation cycle continuation is invalid.');
    }
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
    anchor = page.asOf;
  }
  throw new Error('Compensation cycle continuation exceeded the closed limit.');
}

async function readAllProposals(
  dataSource: CompensationPlanningDataSource,
  cycleId: string,
  referenceEffectiveAt: string,
  context: CompensationReadContext
): Promise<CompensationProposalCollection> {
  const items: CompensationProposalCollection['items'][number][] = [];
  let cursor: string | null | undefined;
  let first: CompensationProposalCollection | undefined;
  const seen = new Set<string>();
  for (let pageNumber = 0; pageNumber < 500; pageNumber += 1) {
    const page = await dataSource.proposals(
      cycleId,
      { referenceEffectiveAt, cursor, limit: 200 },
      context
    );
    first ??= page;
    if (
      page.referenceEffectiveAt !== first.referenceEffectiveAt ||
      page.freshnessWatermark !== first.freshnessWatermark ||
      page.fieldPolicyRevision !== first.fieldPolicyRevision
    ) {
      throw new Error('Compensation proposal continuation authority changed.');
    }
    items.push(...page.items);
    if (!page.hasMore) {
      return Object.freeze({ ...page, items: Object.freeze(items) });
    }
    if (!page.nextCursor || seen.has(page.nextCursor)) {
      throw new Error('Compensation proposal continuation is invalid.');
    }
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw new Error('Compensation proposal continuation exceeded the closed limit.');
}

export function useCompensationPlanningRuntime({
  requestScope,
  dataSource = compensationPlanningDataSource,
  commandExecutors = {},
  commandIntents = {},
}: CompensationPlanningRuntimeOptions) {
  const queryClient = useQueryClient();
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const scopeRef = useRef(scopeIdentity);
  const latestScopeIdentityRef = useRef(scopeIdentity);
  latestScopeIdentityRef.current = scopeIdentity;
  const scopeCurrent = scopeRef.current === scopeIdentity;
  const transitionCorrelationRef = useRef({
    scopeIdentity,
    correlationId: crypto.randomUUID(),
  });
  if (transitionCorrelationRef.current.scopeIdentity !== scopeIdentity) {
    transitionCorrelationRef.current = {
      scopeIdentity,
      correlationId: crypto.randomUUID(),
    };
  }
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState(() => crypto.randomUUID());
  const [pendingCommand, setPendingCommand] = useState<PendingCompensationCommand | null>(null);
  const [lastResult, setLastResult] = useState<CompensationCommandResult | null>(null);
  const [commandError, setCommandError] = useState<unknown>(null);
  const [commandBusy, setCommandBusy] = useState(false);

  const activeCycleId = scopeCurrent ? selectedCycleId : null;
  const activeCorrelationId = scopeCurrent
    ? correlationId
    : transitionCorrelationRef.current.correlationId;
  const activePending = scopeCurrent ? pendingCommand : null;
  const activeResult = scopeCurrent ? lastResult : null;

  useEffect(() => {
    if (scopeRef.current === scopeIdentity) return;
    scopeRef.current = scopeIdentity;
    setSelectedCycleId(null);
    setSelectedProposalId(null);
    setCorrelationId(crypto.randomUUID());
    setPendingCommand(null);
    setLastResult(null);
    setCommandError(null);
    setCommandBusy(false);
    queryClient.removeQueries({ queryKey: ['hris', 'performance', 'compensation-planning'] });
  }, [queryClient, scopeIdentity]);

  const cyclesQuery = useQuery({
    queryKey: readKey(requestScope, 'cycles-v1', 'current', 'first', activeCorrelationId),
    queryFn: ({ signal }) =>
      readAllCycles(dataSource, {
        correlationId: activeCorrelationId,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled: requestScope.ready && scopeCurrent,
    meta: requestScope.queryMeta,
  });

  const cycleQuery = useQuery({
    queryKey: readKey(
      requestScope,
      'cycle-v1',
      activeCycleId ?? 'none',
      cyclesQuery.data?.asOf ?? 'current',
      activeCorrelationId
    ),
    queryFn: ({ signal }) =>
      dataSource.cycle(activeCycleId!, {
        correlationId: activeCorrelationId,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled: requestScope.ready && scopeCurrent && activeCycleId !== null,
    meta: requestScope.queryMeta,
  });

  const proposalsQuery = useQuery({
    queryKey: readKey(
      requestScope,
      'proposals-v1',
      activeCycleId ?? 'none',
      cycleQuery.data?.referenceEffectiveAt ?? 'current',
      'first',
      activeCorrelationId
    ),
    queryFn: ({ signal }) =>
      readAllProposals(
        dataSource,
        activeCycleId!,
        cycleQuery.data!.referenceEffectiveAt,
        {
          correlationId: activeCorrelationId,
          contextScopeKey: requestScope.contextScopeKey,
          signal,
        }
      ),
    enabled:
      requestScope.ready && scopeCurrent && activeCycleId !== null && cycleQuery.isSuccess,
    meta: requestScope.queryMeta,
  });

  const proposalQuery = useQuery<CompensationProposalDetail>({
    queryKey: readKey(
      requestScope,
      'proposal-v1',
      selectedProposalId ?? 'none',
      cycleQuery.data?.referenceEffectiveAt ?? 'current',
      activeCorrelationId
    ),
    queryFn: ({ signal }) =>
      dataSource.proposal(selectedProposalId!, {
        correlationId: activeCorrelationId,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled:
      requestScope.ready &&
      scopeCurrent &&
      selectedProposalId !== null &&
      proposalsQuery.isSuccess &&
      proposalsQuery.data.items.some((item) => item.proposalId === selectedProposalId),
    meta: requestScope.queryMeta,
  });

  const authorityDenied = [
    cyclesQuery.error,
    cycleQuery.error,
    proposalsQuery.error,
    proposalQuery.error,
    commandError,
  ].some(denied);
  useEffect(() => {
    if (!authorityDenied) return;
    setSelectedCycleId(null);
    setSelectedProposalId(null);
    setPendingCommand(null);
    setLastResult(null);
    queryClient.removeQueries({ queryKey: ['hris', 'performance', 'compensation-planning'] });
  }, [authorityDenied, queryClient]);

  useEffect(() => {
    setSelectedProposalId(null);
  }, [activeCycleId]);

  useEffect(() => {
    if (
      authorityDenied ||
      !scopeCurrent ||
      selectedCycleId !== null ||
      !cyclesQuery.data?.items.length
    ) {
      return;
    }
    setSelectedCycleId(cyclesQuery.data.items[0].cycleId);
  }, [authorityDenied, cyclesQuery.data?.items, scopeCurrent, selectedCycleId]);

  const execute = useCallback(
    async (pending: PendingCompensationCommand) => {
      if (!requestScope.ready || !scopeCurrent || authorityDenied) {
        throw new Error('Compensation command authority is not currently available.');
      }
      if (activePending && activePending !== pending) {
        throw new Error('Resolve the pending compensation command before starting another.');
      }
      const executor = commandExecutors[pending.command];
      if (!executor) throw new Error('This governed compensation action is not registered.');
      setCommandBusy(true);
      setCommandError(null);
      const startingScopeIdentity = scopeIdentity;
      try {
        const result = verifyCompensationCommandResult(pending, await executor(pending));
        if (latestScopeIdentityRef.current !== startingScopeIdentity) {
          throw new Error('Compensation authority changed while the command was running.');
        }
        if (isResultUnknown(result)) {
          setPendingCommand(pending);
          setLastResult(result);
          return result;
        }
        setPendingCommand(null);
        setLastResult(result);
        await queryClient.invalidateQueries({
          queryKey: ['hris', 'performance', 'compensation-planning'],
        });
        return result;
      } catch (error) {
        if (latestScopeIdentityRef.current !== startingScopeIdentity) throw error;
        setCommandError(error);
        if (denied(error)) {
          setSelectedCycleId(null);
          setPendingCommand(null);
          setLastResult(null);
          queryClient.removeQueries({
            queryKey: ['hris', 'performance', 'compensation-planning'],
          });
        } else if (isAmbiguousCompensationCommandFailure(error)) {
          setPendingCommand(pending);
        }
        throw error;
      } finally {
        if (latestScopeIdentityRef.current === startingScopeIdentity) setCommandBusy(false);
      }
    },
    [
      activePending,
      authorityDenied,
      commandExecutors,
      queryClient,
      requestScope.ready,
      scopeCurrent,
      scopeIdentity,
    ]
  );

  const runIntent = useCallback(
    (intent: (() => PendingCompensationCommand) | undefined) => {
      if (!intent || commandBusy || activePending) return;
      void execute(intent()).catch(() => undefined);
    },
    [activePending, commandBusy, execute]
  );

  const selected = cycleQuery.data?.item;
  const executorReady = useCallback(
    (command: CompensationCommandName) => Boolean(commandExecutors[command]),
    [commandExecutors]
  );
  const readError =
    cyclesQuery.error ?? cycleQuery.error ?? proposalsQuery.error ?? proposalQuery.error;
  const unlocked =
    requestScope.ready &&
    scopeCurrent &&
    !authorityDenied &&
    !readError &&
    !commandError &&
    !commandBusy &&
    !activePending;
  const actions: CompensationPlanningWorkspaceActions = useMemo(
    () => ({
      canCreate: unlocked && executorReady('CREATE_CYCLE') && Boolean(commandIntents.create),
      canRevise:
        unlocked &&
        cycleQuery.isSuccess &&
        Boolean(selected && ['DRAFT', 'OPEN'].includes(selected.status)) &&
        executorReady('REVISE_CYCLE') &&
        Boolean(commandIntents.revise),
      canAllocate:
        unlocked &&
        cycleQuery.isSuccess &&
        Boolean(selected && ['DRAFT', 'OPEN'].includes(selected.status)) &&
        executorReady('ALLOCATE_BUDGET') &&
        Boolean(commandIntents.allocate),
      canDraftProposal:
        unlocked &&
        cycleQuery.isSuccess &&
        Boolean(selected && ['OPEN', 'PROPOSAL_REVIEW'].includes(selected.status)) &&
        executorReady('UPSERT_PROPOSAL') &&
        Boolean(commandIntents.draftProposal),
      canSubmitProposal:
        unlocked &&
        cycleQuery.isSuccess &&
        proposalsQuery.isSuccess &&
        executorReady('SUBMIT_PROPOSAL') &&
        Boolean(commandIntents.submitProposal),
      canApprove:
        unlocked &&
        cycleQuery.isSuccess &&
        proposalsQuery.isSuccess &&
        selected?.status === 'PROPOSAL_REVIEW' &&
        executorReady('APPROVE_PLAN') &&
        Boolean(commandIntents.approve),
      canPublish:
        unlocked &&
        cycleQuery.isSuccess &&
        proposalsQuery.isSuccess &&
        selected?.status === 'APPROVED' &&
        executorReady('PUBLISH_SNAPSHOT') &&
        Boolean(commandIntents.publish),
      canCancel:
        unlocked &&
        cycleQuery.isSuccess &&
        Boolean(selected && ['DRAFT', 'OPEN', 'PROPOSAL_REVIEW'].includes(selected.status)) &&
        executorReady('CANCEL_CYCLE') &&
        Boolean(commandIntents.cancel),
      onCreate: () => runIntent(commandIntents.create),
      onRevise: () =>
        runIntent(
          selected && commandIntents.revise
            ? () => commandIntents.revise!(selected.cycleId, selected.aggregateVersion)
            : undefined
        ),
      onAllocate: () =>
        runIntent(
          selected && commandIntents.allocate
            ? () => commandIntents.allocate!(selected.cycleId, selected.aggregateVersion)
            : undefined
        ),
      onDraftProposal: () =>
        runIntent(
          selected && commandIntents.draftProposal
            ? () => commandIntents.draftProposal!(selected.cycleId, selected.aggregateVersion)
            : undefined
        ),
      onSubmitProposal: (proposal) =>
        runIntent(
          commandIntents.submitProposal
            ? () =>
                commandIntents.submitProposal!(
                  proposal.cycleId,
                  proposal.proposalId,
                  proposal.aggregateVersion,
                  proposal.contentDigest,
                  proposal.effectiveFrom
                )
            : undefined
        ),
      onApprove: () =>
        runIntent(
          selected && commandIntents.approve
            ? () => commandIntents.approve!(selected.cycleId, selected.aggregateVersion)
            : undefined
        ),
      onPublish: () =>
        runIntent(
          selected && commandIntents.publish
            ? () => commandIntents.publish!(selected.cycleId, selected.aggregateVersion)
            : undefined
        ),
      onCancel: () =>
        runIntent(
          selected && commandIntents.cancel
            ? () => commandIntents.cancel!(selected.cycleId, selected.aggregateVersion)
            : undefined
        ),
    }),
    [
      commandIntents,
      cycleQuery.isSuccess,
      executorReady,
      proposalsQuery.isSuccess,
      runIntent,
      selected,
      unlocked,
    ]
  );

  const queryError = readError;
  let status: CompensationPlanningWorkspaceStatus = 'READY';
  if (authorityDenied) status = 'DENIED';
  else if (
    !requestScope.ready ||
    cyclesQuery.isPending ||
    (activeCycleId !== null && cycleQuery.isPending) ||
    (cycleQuery.isSuccess && proposalsQuery.isPending)
  ) {
    status = 'LOADING';
  }
  else if (activePending) status = 'RESULT_UNKNOWN';
  else if (stepUpRequired(commandError)) status = 'STEP_UP_REQUIRED';
  else if (commandError instanceof HttpError && [409, 412].includes(commandError.status)) {
    status = 'STALE_VERSION';
  } else if (queryError || commandError) status = 'ERROR';
  else if ((cyclesQuery.data?.items.length ?? 0) === 0) status = 'EMPTY';

  return {
    status,
    cycles: authorityDenied || !scopeCurrent ? [] : cyclesQuery.data?.items ?? [],
    selectedCycleId: activeCycleId,
    cycleDetail: authorityDenied ? null : cycleQuery.data ?? null,
    proposals: authorityDenied ? null : proposalsQuery.data ?? null,
    proposalDetail: authorityDenied ? null : proposalQuery.data ?? null,
    selectedProposalId: authorityDenied ? null : selectedProposalId,
    actions,
    pendingCommand: activePending,
    lastResult: activeResult,
    errorMessage:
      queryError instanceof Error
        ? queryError.message
        : commandError instanceof Error
          ? commandError.message
          : null,
    selectCycle: (cycleId: string) => {
      setSelectedProposalId(null);
      setSelectedCycleId(cycleId);
    },
    selectProposal: setSelectedProposalId,
    refresh: () => {
      if (!denied(commandError)) setCommandError(null);
      setCorrelationId(crypto.randomUUID());
      void queryClient.invalidateQueries({
        queryKey: ['hris', 'performance', 'compensation-planning'],
      });
    },
    retryPending: activePending ? () => void execute(activePending).catch(() => undefined) : undefined,
  } as const;
}
