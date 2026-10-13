import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { compensationPlanningDataSource } from './compensation-planning-api';
import { parseCompensationCycleAuthoringContext } from './compensation-planning-contract';
import {
  isAmbiguousCompensationCommandFailure,
  isResultUnknown,
  validatePendingCompensationCommand,
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
  ApproveCompensationPlanBody,
  CompensationBudgetBody,
  CompensationCycleAuthoringContext,
  CompensationCycleCollection,
  CompensationGuidelines,
  CreateCompensationCycleBody,
  PublishCompensationSnapshotBody,
  CompensationProposalCollection,
  CompensationProposalDetail,
  ReviseCompensationCycleBody,
  SubmitCompensationProposalBody,
  UpsertCompensationProposalBody,
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
  create?: (body: CreateCompensationCycleBody) => PendingCompensationCommand;
  revise?: (
    cycleId: string,
    version: number,
    body: ReviseCompensationCycleBody
  ) => PendingCompensationCommand;
  allocate?: (
    cycleId: string,
    version: number,
    body: CompensationBudgetBody
  ) => PendingCompensationCommand;
  draftProposal?: (
    cycleId: string,
    version: number,
    proposalId: string,
    body: UpsertCompensationProposalBody
  ) => PendingCompensationCommand;
  submitProposal?: (
    cycleId: string,
    proposalId: string,
    version: number,
    body: SubmitCompensationProposalBody
  ) => PendingCompensationCommand;
  approve?: (
    cycleId: string,
    version: number,
    body: ApproveCompensationPlanBody
  ) => PendingCompensationCommand;
  publish?: (
    cycleId: string,
    version: number,
    body: PublishCompensationSnapshotBody
  ) => PendingCompensationCommand;
  cancel?: (
    cycleId: string,
    version: number,
    body: Record<string, never>
  ) => PendingCompensationCommand;
}>;

export type CompensationPlanningRuntimeOptions = Readonly<{
  requestScope: ProductSurfaceRequestScope;
  dataSource?: CompensationPlanningDataSource;
  commandExecutors?: CompensationPlanningCommandExecutors;
  commandIntents?: CompensationPlanningCommandIntents;
  cycleAuthoringContext?: CompensationCycleAuthoringContext | null;
}>;

export function useCompensationPlanningRequestScope() {
  return useProductSurfaceRequestScope({ productKey: 'hcm', surfaceKey: 'hcm.operations' });
}

function readKey(scope: ProductSurfaceRequestScope, kind: string, ...parts: unknown[]) {
  return ['hris', 'performance', 'compensation-planning', kind, ...parts, ...scope.cacheKey] as const;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function urlValue(name: string, uuidOnly = false): string | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(name);
  return value && (!uuidOnly || UUID.test(value)) ? value : null;
}

function replaceUrlValue(name: string, value: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
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

function bindAuthoringGuidelines(
  context: CompensationCycleAuthoringContext,
  candidate: CompensationGuidelines,
  effectiveFrom: string,
  effectiveTo: string | null
): CompensationGuidelines {
  if (candidate.components.length !== context.guidelines.components.length) {
    throw new Error('Compensation guideline choices are not bound to Central authoring context.');
  }
  const requested = new Map(candidate.components.map((item) => [item.componentCode, item]));
  return Object.freeze({
    components: Object.freeze(context.guidelines.components.map((trusted) => {
      const editable = requested.get(trusted.componentCode);
      if (!editable) {
        throw new Error('Compensation guideline choices are not bound to Central authoring context.');
      }
      return Object.freeze({
        ...trusted,
        minimumAmount: editable.minimumAmount,
        maximumAmount: editable.maximumAmount,
      });
    })),
    budgetMode: 'HARD_CAP',
    effectiveFrom,
    effectiveTo,
  });
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
  cycleAuthoringContext,
}: CompensationPlanningRuntimeOptions) {
  const queryClient = useQueryClient();
  const verifiedAuthoringContext = useMemo(() => {
    if (!cycleAuthoringContext) return null;
    try {
      return parseCompensationCycleAuthoringContext(cycleAuthoringContext);
    } catch {
      return null;
    }
  }, [cycleAuthoringContext]);
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const scopeRef = useRef(scopeIdentity);
  const latestScopeIdentityRef = useRef(scopeIdentity);
  latestScopeIdentityRef.current = scopeIdentity;
  const scopeCurrent = scopeRef.current === scopeIdentity;
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(() =>
    urlValue('cycle', true)
  );
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(() =>
    urlValue('proposal', true)
  );
  const [filter, setFilter] = useState(() => urlValue('q') ?? '');
  const correlationRef = useRef(crypto.randomUUID());
  const [pendingCommand, setPendingCommand] = useState<PendingCompensationCommand | null>(null);
  const [lastResult, setLastResult] = useState<CompensationCommandResult | null>(null);
  const [commandError, setCommandError] = useState<unknown>(null);
  const [commandBusy, setCommandBusy] = useState(false);

  const activeCycleId = scopeCurrent ? selectedCycleId : null;
  const activePending = scopeCurrent ? pendingCommand : null;
  const activeResult = scopeCurrent ? lastResult : null;

  useEffect(() => {
    if (scopeRef.current === scopeIdentity) return;
    scopeRef.current = scopeIdentity;
    setSelectedCycleId(null);
    setSelectedProposalId(null);
    correlationRef.current = crypto.randomUUID();
    setPendingCommand(null);
    setLastResult(null);
    setCommandError(null);
    setCommandBusy(false);
    queryClient.removeQueries({ queryKey: ['hris', 'performance', 'compensation-planning'] });
  }, [queryClient, scopeIdentity]);

  const cyclesQuery = useQuery({
    queryKey: readKey(requestScope, 'cycles-v2', 'current', 'first'),
    queryFn: ({ signal }) =>
      readAllCycles(dataSource, {
        correlationId: correlationRef.current,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      }),
    enabled: requestScope.ready && scopeCurrent,
    meta: requestScope.queryMeta,
  });
  const selectedCycleSummary = cyclesQuery.data?.items.find(
    (item) => item.cycleId === activeCycleId
  );

  const cycleQuery = useQuery({
    queryKey: readKey(
      requestScope,
      'cycle-v1',
      activeCycleId ?? 'none',
      cyclesQuery.data?.asOf ?? 'current',
      cyclesQuery.data?.scopeRevision ?? 'scope',
      cyclesQuery.data?.fieldPolicyRevision ?? 'policy',
      selectedCycleSummary?.aggregateVersion ?? 'version'
    ),
    queryFn: async ({ signal }) => {
      if (!selectedCycleSummary) throw new Error('Selected compensation cycle is stale.');
      const detail = await dataSource.cycle(activeCycleId!, {
        correlationId: correlationRef.current,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      });
      if (
        detail.item.cycleId !== activeCycleId ||
        detail.item.aggregateVersion !== selectedCycleSummary.aggregateVersion ||
        detail.fieldPolicyRevision !== cyclesQuery.data?.fieldPolicyRevision
      ) {
        throw new Error('Compensation cycle detail is not bound to the selected projection.');
      }
      return detail;
    },
    enabled:
      requestScope.ready && scopeCurrent && activeCycleId !== null && cyclesQuery.isSuccess,
    meta: requestScope.queryMeta,
  });

  const proposalsQuery = useQuery({
    queryKey: readKey(
      requestScope,
      'proposals-v1',
      activeCycleId ?? 'none',
      cycleQuery.data?.referenceEffectiveAt ?? 'current',
      cycleQuery.data?.freshnessWatermark ?? 'freshness',
      cycleQuery.data?.fieldPolicyRevision ?? 'policy',
      cycleQuery.data?.item.aggregateVersion ?? 'version',
      'first'
    ),
    queryFn: async ({ signal }) => {
      const collection = await readAllProposals(
        dataSource,
        activeCycleId!,
        cycleQuery.data!.referenceEffectiveAt,
        {
          correlationId: correlationRef.current,
          contextScopeKey: requestScope.contextScopeKey,
          signal,
        }
      );
      const cycle = cycleQuery.data!;
      if (
        collection.referenceEffectiveAt !== cycle.referenceEffectiveAt ||
        collection.freshnessWatermark !== cycle.freshnessWatermark ||
        collection.fieldPolicyRevision !== cycle.fieldPolicyRevision ||
        collection.items.some((item) => item.cycleId !== activeCycleId)
      ) {
        throw new Error('Compensation proposal list is not bound to the selected cycle.');
      }
      return collection;
    },
    enabled:
      requestScope.ready && scopeCurrent && activeCycleId !== null && cycleQuery.isSuccess,
    meta: requestScope.queryMeta,
  });
  const selectedProposalSummary = proposalsQuery.data?.items.find(
    (item) => item.proposalId === selectedProposalId
  );

  const proposalQuery = useQuery<CompensationProposalDetail>({
    queryKey: readKey(
      requestScope,
      'proposal-v1',
      selectedProposalId ?? 'none',
      proposalsQuery.data?.referenceEffectiveAt ?? 'current',
      proposalsQuery.data?.freshnessWatermark ?? 'freshness',
      proposalsQuery.data?.fieldPolicyRevision ?? 'policy',
      selectedProposalSummary?.aggregateVersion ?? 'version',
      selectedProposalSummary?.currentRevision ?? 'revision',
      selectedProposalSummary?.contentDigest ?? 'digest'
    ),
    queryFn: async ({ signal }) => {
      if (!selectedProposalSummary) throw new Error('Selected compensation proposal is stale.');
      const detail = await dataSource.proposal(selectedProposalId!, {
        correlationId: correlationRef.current,
        contextScopeKey: requestScope.contextScopeKey,
        signal,
      });
      const item = detail.item;
      const summaryMatches =
        item.proposalId === selectedProposalId &&
        item.cycleId === activeCycleId &&
        item.aggregateVersion === selectedProposalSummary.aggregateVersion &&
        item.currentRevision === selectedProposalSummary.currentRevision &&
        item.contentDigest === selectedProposalSummary.contentDigest &&
        item.workerId === selectedProposalSummary.workerId &&
        item.assignmentId === selectedProposalSummary.assignmentId &&
        item.componentCode === selectedProposalSummary.componentCode &&
        item.currency === selectedProposalSummary.currency &&
        item.status === selectedProposalSummary.status;
      if (
        !summaryMatches ||
        detail.referenceEffectiveAt !== proposalsQuery.data?.referenceEffectiveAt ||
        detail.freshnessWatermark !== proposalsQuery.data?.freshnessWatermark ||
        detail.fieldPolicyRevision !== proposalsQuery.data?.fieldPolicyRevision
      ) {
        throw new Error('Compensation proposal detail is not bound to the selected projection.');
      }
      return detail;
    },
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
    replaceUrlValue('cycle', null);
    replaceUrlValue('proposal', null);
    setPendingCommand(null);
    setLastResult(null);
    queryClient.removeQueries({ queryKey: ['hris', 'performance', 'compensation-planning'] });
  }, [authorityDenied, queryClient]);

  useEffect(() => {
    if (
      authorityDenied ||
      !scopeCurrent ||
      !cyclesQuery.data?.items.length
    ) {
      return;
    }
    if (selectedCycleId && cyclesQuery.data.items.some((item) => item.cycleId === selectedCycleId)) {
      return;
    }
    const cycleId = cyclesQuery.data.items[0].cycleId;
    setSelectedProposalId(null);
    setSelectedCycleId(cycleId);
    replaceUrlValue('proposal', null);
    replaceUrlValue('cycle', cycleId);
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
        validatePendingCompensationCommand(pending);
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
    async (intent: (() => PendingCompensationCommand) | undefined) => {
      if (!intent || commandBusy || activePending) return undefined;
      return execute(intent());
    },
    [activePending, commandBusy, execute]
  );

  const selected = cycleQuery.data?.item;
  const executorReady = useCallback(
    (command: CompensationCommandName) => Boolean(commandExecutors[command]),
    [commandExecutors]
  );
  const readError = cyclesQuery.error ?? cycleQuery.error;
  const unlocked =
    requestScope.ready &&
    scopeCurrent &&
    !authorityDenied &&
    !readError &&
    !commandBusy &&
    !activePending;
  const actions: CompensationPlanningWorkspaceActions = useMemo(
    () => ({
      canCreate:
        unlocked &&
        Boolean(verifiedAuthoringContext) &&
        executorReady('CREATE_CYCLE') &&
        Boolean(commandIntents.create),
      canRevise:
        unlocked &&
        Boolean(verifiedAuthoringContext) &&
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
      onCreate: (body) =>
        runIntent(verifiedAuthoringContext && commandIntents.create ? () =>
          commandIntents.create!({
            cycleCode: body.cycleCode,
            effectiveFrom: body.effectiveFrom,
            effectiveTo: body.effectiveTo,
            guidelines: bindAuthoringGuidelines(
              verifiedAuthoringContext,
              body.guidelines,
              body.effectiveFrom,
              body.effectiveTo
            ),
            population: verifiedAuthoringContext.population,
            populationSourceRef: verifiedAuthoringContext.populationSourceRef,
          }) : undefined),
      onRevise: (body) =>
        runIntent(
          selected && verifiedAuthoringContext && commandIntents.revise
            ? () => commandIntents.revise!(selected.cycleId, selected.aggregateVersion, {
                effectiveFrom: body.effectiveFrom,
                effectiveTo: body.effectiveTo,
                guidelines: bindAuthoringGuidelines(
                  verifiedAuthoringContext,
                  body.guidelines,
                  body.effectiveFrom,
                  body.effectiveTo
                ),
                population: verifiedAuthoringContext.population,
                populationSourceRef: verifiedAuthoringContext.populationSourceRef,
              })
            : undefined
        ),
      onAllocate: (body) =>
        runIntent(
          selected && commandIntents.allocate
            ? () => commandIntents.allocate!(selected.cycleId, selected.aggregateVersion, body)
            : undefined
        ),
      onDraftProposal: (proposalId, body) =>
        runIntent(
          selected && commandIntents.draftProposal
            ? () => commandIntents.draftProposal!(
                selected.cycleId,
                selected.aggregateVersion,
                proposalId,
                body
              )
            : undefined
        ),
      onSubmitProposal: (proposal, body) =>
        runIntent(
          commandIntents.submitProposal
            ? () =>
                commandIntents.submitProposal!(
                  proposal.cycleId,
                  proposal.proposalId,
                  proposal.aggregateVersion,
                  body
                )
            : undefined
        ),
      onApprove: (body) =>
        runIntent(
          selected && commandIntents.approve
            ? () => commandIntents.approve!(selected.cycleId, selected.aggregateVersion, body)
            : undefined
        ),
      onPublish: (body) =>
        runIntent(
          selected && commandIntents.publish
            ? () => commandIntents.publish!(selected.cycleId, selected.aggregateVersion, body)
            : undefined
        ),
      onCancel: () =>
        runIntent(
          selected && commandIntents.cancel
            ? () => commandIntents.cancel!(selected.cycleId, selected.aggregateVersion, {})
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
      verifiedAuthoringContext,
    ]
  );

  const queryError = readError;
  let status: CompensationPlanningWorkspaceStatus = 'READY';
  if (authorityDenied) status = 'DENIED';
  else if (
    !requestScope.ready ||
    cyclesQuery.isPending ||
    (activeCycleId !== null && cycleQuery.isPending)
  ) {
    status = 'LOADING';
  }
  else if (activePending) status = 'RESULT_UNKNOWN';
  else if (stepUpRequired(commandError)) status = 'STEP_UP_REQUIRED';
  else if (commandError instanceof HttpError && [409, 412].includes(commandError.status)) {
    status = 'STALE_VERSION';
  } else if (queryError) status = 'ERROR';
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
    cycleAuthoringContext: verifiedAuthoringContext,
    commandBusy,
    pendingCommand: activePending,
    lastResult: activeResult,
    errorMessage:
      queryError instanceof Error
        ? queryError.message
        : commandError instanceof Error
          ? commandError.message
          : null,
    proposalsError:
      proposalsQuery.error instanceof Error ? proposalsQuery.error.message : null,
    proposalDetailError:
      proposalQuery.error instanceof Error ? proposalQuery.error.message : null,
    proposalLoading: proposalsQuery.isPending || proposalsQuery.isFetching,
    lastRefreshedAt: Math.max(
      cyclesQuery.dataUpdatedAt,
      cycleQuery.dataUpdatedAt,
      proposalsQuery.dataUpdatedAt,
      proposalQuery.dataUpdatedAt
    ),
    freshnessWatermark:
      proposalQuery.data?.freshnessWatermark ??
      proposalsQuery.data?.freshnessWatermark ??
      cycleQuery.data?.freshnessWatermark ??
      null,
    filter,
    setFilter: (value: string) => {
      setFilter(value);
      replaceUrlValue('q', value.trim() ? value : null);
    },
    selectCycle: (cycleId: string) => {
      setSelectedProposalId(null);
      setSelectedCycleId(cycleId);
      replaceUrlValue('proposal', null);
      replaceUrlValue('cycle', cycleId);
    },
    selectProposal: (proposalId: string) => {
      setSelectedProposalId(proposalId);
      replaceUrlValue('proposal', proposalId);
    },
    refresh: () => {
      if (!denied(commandError)) setCommandError(null);
      correlationRef.current = crypto.randomUUID();
      void queryClient.invalidateQueries({
        queryKey: ['hris', 'performance', 'compensation-planning'],
      });
    },
    retryProposals: () => void proposalsQuery.refetch(),
    retryProposalDetail: () => void proposalQuery.refetch(),
    retryPending: activePending ? () => void execute(activePending).catch(() => undefined) : undefined,
  } as const;
}
