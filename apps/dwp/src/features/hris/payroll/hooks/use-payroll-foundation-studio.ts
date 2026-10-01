import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpTransportError } from '@dwp-frontend/shared-utils';

import { payrollFoundationDataSource } from '../api/payroll-foundation-api';
import {
  classifyFoundationCommandFailure,
  effectiveFoundationAccess,
  emptyFoundationDraft,
  foundationDefinitionFromDraft,
  foundationDraftFromConfiguration,
  foundationPublishBlockers,
  selectFoundationCommandResult,
  selectFoundationConfiguration,
  selectFoundationVersions,
  selectFoundationWorkspace,
  validateFoundationDraft,
} from '../model/payroll-foundation-model';

import type { PayrollFoundationDataSource } from '../api/payroll-foundation-api';
import type {
  PayrollFoundationReversalCommand,
  PayrollFoundationVersionCommand,
} from '../api/payroll-foundation-api';
import type { ProductSurfaceHighRiskCommandDescriptor } from '../../../../components/product-surface-high-risk-command';
import type { ProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  FoundationCommandFailure,
  FoundationCommandKind,
  FoundationCommandReceipt,
  PayrollFoundationConfiguration,
  PayrollFoundationDraft,
} from '../model/payroll-foundation-model';
import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';

type Visit = Readonly<{ identity: string; generation: number }>;

export type PayrollFoundationCommandExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
) => Promise<T>;

export type PayrollFoundationPublishCommandBinding = Readonly<{
  configurationId: string;
  commandId: string;
  request: PayrollFoundationVersionCommand;
}>;

export type PayrollFoundationReverseCommandBinding = Readonly<{
  configurationId: string;
  commandId: string;
  request: PayrollFoundationReversalCommand;
}>;

export type PayrollFoundationCommandExecutors = Readonly<{
  create: PayrollFoundationCommandExecutor;
  update: PayrollFoundationCommandExecutor;
  simulate: PayrollFoundationCommandExecutor;
  publish: ProductSurfaceHighRiskCommandExecutor<PayrollFoundationPublishCommandBinding>;
  reverse: ProductSurfaceHighRiskCommandExecutor<PayrollFoundationReverseCommandBinding>;
  reconcile: PayrollFoundationCommandExecutor;
}>;

type CommandInput = Readonly<{
  visit: Visit;
  commandId: string;
  kind: FoundationCommandKind;
  configuration: PayrollFoundationConfiguration | null;
  draft?: PayrollFoundationDraft;
}>;
type CommandExpectation = Readonly<{
  commandId: string;
  commandType: FoundationCommandKind;
  configurationId: string | null;
  successVersion: number;
  reversalFailureVersion: number | null;
  reversalOfCommandId: string | null;
}>;
type ReceiptInput = Readonly<{
  visit: Visit;
  receipt: FoundationCommandReceipt;
  expectation: CommandExpectation;
  mode: 'LOOKUP' | 'RECONCILE';
}>;

class CommandOutcomeUnknownError extends Error {
  constructor() {
    super('Payroll foundation owner response could not be bound to the command.');
    this.name = 'CommandOutcomeUnknownError';
  }
}

class ReceiptBindingError extends Error {
  constructor() {
    super('Payroll foundation receipt response did not match the requested receipt.');
    this.name = 'ReceiptBindingError';
  }
}

function receiptNeedsResolution(receipt: FoundationCommandReceipt | null | undefined) {
  return receipt?.status === 'PENDING' || receipt?.status === 'RESULT_UNKNOWN';
}

function resultUnknownReceipt(input: CommandInput): FoundationCommandReceipt {
  return Object.freeze({
    commandId: input.commandId,
    commandType: input.kind,
    status: 'RESULT_UNKNOWN',
    configurationId: input.configuration?.id ?? null,
    resultVersion: null,
    reversalOfCommandId:
      input.kind === 'REVERSE' ? (input.configuration?.lastCommandId ?? null) : null,
    failureCode: 'TRANSPORT_OUTCOME_UNKNOWN',
    correlationId: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  });
}

function commandExpectation(input: CommandInput): CommandExpectation {
  const currentVersion = input.configuration?.version ?? 0;
  return Object.freeze({
    commandId: input.commandId,
    commandType: input.kind,
    configurationId: input.configuration?.id ?? null,
    successVersion: input.kind === 'CREATE' ? 1 : currentVersion + 1,
    reversalFailureVersion: input.kind === 'REVERSE' ? currentVersion : null,
    reversalOfCommandId:
      input.kind === 'REVERSE' ? (input.configuration?.lastCommandId ?? null) : null,
  });
}

function resultMatchesExpectation(
  result: ReturnType<typeof selectFoundationCommandResult>,
  expectation: CommandExpectation
) {
  const { receipt, configuration } = result;
  if (
    receipt.commandId !== expectation.commandId ||
    receipt.commandType !== expectation.commandType ||
    (expectation.configurationId !== null &&
      receipt.configurationId !== expectation.configurationId) ||
    receipt.reversalOfCommandId !== expectation.reversalOfCommandId
  ) {
    return false;
  }
  if (receipt.status === 'PENDING') {
    return receipt.resultVersion === null && configuration === null;
  }
  if (receipt.status === 'RESULT_UNKNOWN') {
    return (
      (receipt.resultVersion === null || receipt.resultVersion === expectation.successVersion) &&
      (configuration === null || configuration.version === expectation.successVersion)
    );
  }
  if (receipt.status === 'REVERSAL_FAILED') {
    return (
      expectation.commandType === 'REVERSE' &&
      receipt.resultVersion === expectation.reversalFailureVersion &&
      configuration?.version === expectation.reversalFailureVersion
    );
  }
  return (
    receipt.resultVersion === expectation.successVersion &&
    configuration?.version === expectation.successVersion
  );
}

function queryKeys(scope: ProductSurfaceRequestScope) {
  const root = ['hris', 'payroll-foundation', ...scope.cacheKey] as const;
  return {
    root,
    list: [...root, 'configurations'] as const,
    detail: (id: string) => [...root, 'configuration', id] as const,
    versions: (id: string) => [...root, 'configuration', id, 'versions'] as const,
  };
}

export function usePayrollFoundationStudio({
  requestScope,
  dataSource = payrollFoundationDataSource,
  commandExecutors,
}: {
  requestScope: ProductSurfaceRequestScope;
  dataSource?: PayrollFoundationDataSource;
  commandExecutors?: PayrollFoundationCommandExecutors;
}) {
  const queryClient = useQueryClient();
  const keys = queryKeys(requestScope);
  const scopeIdentity = JSON.stringify(requestScope.cacheKey);
  const visitRef = useRef<Visit>({ identity: scopeIdentity, generation: 0 });
  const mountedRef = useRef(true);
  const commandGateRef = useRef(false);
  const receiptExpectationRef = useRef<CommandExpectation | null>(null);
  const activeCommandInputRef = useRef<CommandInput | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PayrollFoundationDraft | null>(null);
  const [failure, setFailure] = useState<FoundationCommandFailure | null>(null);
  const [receipt, setReceipt] = useState<FoundationCommandReceipt | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [reverseReviewOpen, setReverseReviewOpen] = useState(false);

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
    setSelectedId(null);
    setDraft(null);
    setFailure(null);
    setReceipt(null);
    setPublishReviewOpen(false);
    setReverseReviewOpen(false);
    commandGateRef.current = false;
    receiptExpectationRef.current = null;
    activeCommandInputRef.current = null;
  }, [scopeIdentity]);

  const requestScopeOptions = (signal?: AbortSignal, visit?: Visit) => ({
    ...(requestScope.contextScopeKey ? { contextScopeKey: requestScope.contextScopeKey } : {}),
    ...(signal ? { signal } : {}),
    ...(visit
      ? {
          beforeDispatch: () => {
            if (visitRef.current !== visit) throw new Error('Payroll foundation scope changed.');
          },
        }
      : {}),
  });

  const workspaceQuery = useQuery({
    queryKey: keys.list,
    queryFn: ({ signal }) =>
      dataSource.list(requestScopeOptions(signal)).then(selectFoundationWorkspace),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });

  useEffect(() => {
    const configurations = workspaceQuery.data?.configurations ?? [];
    if (selectedId && configurations.some((item) => item.id === selectedId)) return;
    setSelectedId(configurations[0]?.id ?? null);
  }, [selectedId, workspaceQuery.data]);

  const detailQuery = useQuery({
    queryKey: selectedId ? keys.detail(selectedId) : [...keys.root, 'configuration', 'none'],
    queryFn: ({ signal }) =>
      dataSource
        .get(selectedId!, requestScopeOptions(signal))
        .then((value) => selectFoundationConfiguration(value)),
    enabled: requestScope.ready && Boolean(selectedId),
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });

  const versionsQuery = useQuery({
    queryKey: selectedId
      ? keys.versions(selectedId)
      : [...keys.root, 'configuration', 'none', 'versions'],
    queryFn: ({ signal }) =>
      dataSource.versions(selectedId!, requestScopeOptions(signal)).then(selectFoundationVersions),
    enabled: requestScope.ready && Boolean(selectedId),
    meta: requestScope.queryMeta,
    staleTime: 20_000,
  });

  const selected =
    detailQuery.data ??
    workspaceQuery.data?.configurations.find((item) => item.id === selectedId) ??
    null;
  const access = workspaceQuery.data
    ? effectiveFoundationAccess(workspaceQuery.data, selected)
    : null;
  const publishBlockers =
    selected && access
      ? Object.freeze([
          ...new Set([
            ...foundationPublishBlockers(selected, access),
            ...(workspaceQuery.data?.partialFailures.length ? ['DEPENDENCY_PARTIAL'] : []),
          ]),
        ])
      : [];
  const validation = draft ? validateFoundationDraft(draft) : null;

  const refresh = async () => {
    await Promise.all([
      workspaceQuery.refetch(),
      selectedId ? detailQuery.refetch() : Promise.resolve(),
      selectedId ? versionsQuery.refetch() : Promise.resolve(),
    ]);
  };

  const settleCommand = async (
    result: ReturnType<typeof selectFoundationCommandResult>,
    input: CommandInput
  ) => {
    if (!mountedRef.current || visitRef.current !== input.visit) return;
    commandGateRef.current = receiptNeedsResolution(result.receipt);
    if (receiptNeedsResolution(result.receipt)) {
      const expectation = receiptExpectationRef.current;
      if (
        expectation?.commandId === result.receipt.commandId &&
        expectation.configurationId === null &&
        result.receipt.configurationId !== null
      ) {
        receiptExpectationRef.current = Object.freeze({
          ...expectation,
          configurationId: result.receipt.configurationId,
        });
      }
    } else {
      receiptExpectationRef.current = null;
    }
    setReceipt(result.receipt);
    setFailure(
      result.receipt.status === 'REVERSAL_FAILED' ? { kind: 'REJECTED', preserveDraft: true } : null
    );
    setPublishReviewOpen(false);
    setReverseReviewOpen(false);
    if (result.configuration) {
      setSelectedId(result.configuration.id);
      const cachedConfiguration = queryClient.getQueryData<PayrollFoundationConfiguration>(
        keys.detail(result.configuration.id)
      );
      const workspaceConfiguration = workspaceQuery.data?.configurations.find(
        (configuration) => configuration.id === result.configuration?.id
      );
      const knownVersion = Math.max(
        cachedConfiguration?.version ?? -1,
        workspaceConfiguration?.version ?? -1,
        input.configuration?.id === result.configuration.id ? input.configuration.version : -1
      );
      if (result.configuration.version >= knownVersion) {
        queryClient.setQueryData(keys.detail(result.configuration.id), result.configuration);
      }
    }
    if (result.receipt.status === 'SUCCEEDED') {
      if (input.kind === 'CREATE' || input.kind === 'UPDATE') setDraft(null);
      await queryClient.invalidateQueries({ queryKey: keys.root });
    }
  };

  const commandMutation = useMutation({
    mutationFn: async (input: CommandInput) => {
      activeCommandInputRef.current = input;
      let effectiveInput = input;
      const scope = requestScopeOptions(undefined, input.visit);
      let result: unknown;
      if (input.kind === 'CREATE') {
        if (!commandExecutors?.create) throw new Error('Create authority is unavailable.');
        result = await commandExecutors.create((authority) =>
          dataSource.create(
            { definition: foundationDefinitionFromDraft(input.draft!) },
            input.commandId,
            scope,
            authority
          )
        );
      } else if (input.kind === 'UPDATE') {
        if (!commandExecutors?.update) throw new Error('Update authority is unavailable.');
        result = await commandExecutors.update((authority) =>
          dataSource.update(
            input.configuration!.id,
            {
              expectedVersion: input.draft!.baseVersion!,
              definition: foundationDefinitionFromDraft(input.draft!),
            },
            input.commandId,
            scope,
            authority
          )
        );
      } else if (input.kind === 'SIMULATE') {
        if (!commandExecutors?.simulate) throw new Error('Simulation authority is unavailable.');
        result = await commandExecutors.simulate((authority) =>
          dataSource.simulate(
            input.configuration!.id,
            { expectedVersion: input.configuration!.version },
            input.commandId,
            scope,
            authority
          )
        );
      } else if (input.kind === 'PUBLISH') {
        if (!commandExecutors?.publish) throw new Error('Publish authority is unavailable.');
        const request = { expectedVersion: input.configuration!.version } as const;
        result = await commandExecutors.publish(
          (authority, command?: ProductSurfaceHighRiskCommandDescriptor) => {
            const commandId = command?.idempotencyKey ?? input.commandId;
            effectiveInput = commandId === input.commandId ? input : { ...input, commandId };
            activeCommandInputRef.current = effectiveInput;
            receiptExpectationRef.current = commandExpectation(effectiveInput);
            return dataSource.publish(
              command?.targetId ?? input.configuration!.id,
              (command?.payload as PayrollFoundationVersionCommand | undefined) ?? request,
              commandId,
              scope,
              authority
            );
          },
          {
            configurationId: input.configuration!.id,
            commandId: input.commandId,
            request,
          }
        );
      } else {
        if (!commandExecutors?.reverse) throw new Error('Reversal authority is unavailable.');
        const request = {
          expectedVersion: input.configuration!.version,
          publishCommandId: input.configuration!.lastCommandId!,
        } as const;
        result = await commandExecutors.reverse(
          (authority, command?: ProductSurfaceHighRiskCommandDescriptor) => {
            const commandId = command?.idempotencyKey ?? input.commandId;
            effectiveInput = commandId === input.commandId ? input : { ...input, commandId };
            activeCommandInputRef.current = effectiveInput;
            receiptExpectationRef.current = commandExpectation(effectiveInput);
            return dataSource.reverse(
              command?.targetId ?? input.configuration!.id,
              (command?.payload as PayrollFoundationReversalCommand | undefined) ?? request,
              commandId,
              scope,
              authority
            );
          },
          {
            configurationId: input.configuration!.id,
            commandId: input.commandId,
            request,
          }
        );
      }
      try {
        const selected = selectFoundationCommandResult(result);
        if (!resultMatchesExpectation(selected, commandExpectation(effectiveInput))) {
          throw new CommandOutcomeUnknownError();
        }
        return { selected, input: effectiveInput };
      } catch (error) {
        if (error instanceof CommandOutcomeUnknownError) throw error;
        throw new CommandOutcomeUnknownError();
      }
    },
    onSuccess: ({ selected, input }) => {
      activeCommandInputRef.current = null;
      void settleCommand(selected, input);
    },
    onError: (error, input) => {
      const effectiveInput = activeCommandInputRef.current ?? input;
      activeCommandInputRef.current = null;
      if (!mountedRef.current || visitRef.current !== effectiveInput.visit) return;
      const classified = classifyFoundationCommandFailure(error);
      const outcomeUnknown =
        classified.kind === 'RESULT_UNKNOWN' ||
        error instanceof HttpTransportError ||
        error instanceof CommandOutcomeUnknownError;
      commandGateRef.current = outcomeUnknown;
      setFailure(outcomeUnknown ? { kind: 'RESULT_UNKNOWN', preserveDraft: true } : classified);
      if (outcomeUnknown) {
        setReceipt(resultUnknownReceipt(effectiveInput));
      } else {
        receiptExpectationRef.current = null;
      }
      setPublishReviewOpen(false);
      setReverseReviewOpen(false);
    },
  });

  const receiptMutation = useMutation({
    mutationFn: async (input: ReceiptInput) => {
      const scope = requestScopeOptions(undefined, input.visit);
      let result: unknown;
      if (input.mode === 'LOOKUP') {
        result = await dataSource.receipt(input.receipt.commandId, scope);
      } else {
        if (!commandExecutors?.reconcile) {
          throw new Error('Reconciliation authority is unavailable.');
        }
        result = await commandExecutors.reconcile((authority) =>
          dataSource.reconcile(input.receipt.commandId, scope, authority)
        );
      }
      let selectedResult: ReturnType<typeof selectFoundationCommandResult>;
      try {
        selectedResult = selectFoundationCommandResult(result);
      } catch {
        throw new ReceiptBindingError();
      }
      if (
        !resultMatchesExpectation(selectedResult, input.expectation) ||
        (input.receipt.configurationId !== null &&
          selectedResult.receipt.configurationId !== input.receipt.configurationId) ||
        (input.receipt.resultVersion !== null &&
          selectedResult.receipt.resultVersion !== input.receipt.resultVersion) ||
        selectedResult.receipt.reversalOfCommandId !== input.receipt.reversalOfCommandId
      ) {
        throw new ReceiptBindingError();
      }
      return selectedResult;
    },
    onSuccess: (result, input) => {
      void settleCommand(result, {
        visit: input.visit,
        commandId: input.receipt.commandId,
        kind: input.receipt.commandType,
        configuration: selected,
      });
    },
    onError: (error, input) => {
      if (!mountedRef.current || visitRef.current !== input.visit) return;
      setFailure(
        error instanceof ReceiptBindingError
          ? { kind: 'RESULT_UNKNOWN', preserveDraft: true }
          : classifyFoundationCommandFailure(error)
      );
      commandGateRef.current = true;
    },
  });

  const unresolvedReceipt = receiptNeedsResolution(receipt);
  const mutationBlocked =
    commandGateRef.current ||
    commandMutation.isPending ||
    receiptMutation.isPending ||
    unresolvedReceipt;

  const run = (
    kind: FoundationCommandKind,
    configuration: PayrollFoundationConfiguration | null,
    commandDraft?: PayrollFoundationDraft
  ) => {
    if (
      commandGateRef.current ||
      commandMutation.isPending ||
      receiptMutation.isPending ||
      receiptNeedsResolution(receipt)
    )
      return;
    commandGateRef.current = true;
    setFailure(null);
    setReceipt(null);
    const input: CommandInput = {
      visit: visitRef.current,
      commandId: globalThis.crypto.randomUUID(),
      kind,
      configuration,
      ...(commandDraft ? { draft: commandDraft } : {}),
    };
    receiptExpectationRef.current = commandExpectation(input);
    commandMutation.mutate(input);
  };

  const beginCreate = () => {
    if (!access?.canCreate || !commandExecutors?.create || mutationBlocked) return;
    setDraft(emptyFoundationDraft());
    setFailure(null);
  };
  const beginEdit = () => {
    if (
      !selected ||
      !access?.canEdit ||
      !commandExecutors?.update ||
      selected.status === 'PUBLISHED' ||
      mutationBlocked
    )
      return;
    setDraft(foundationDraftFromConfiguration(selected));
    setFailure(null);
  };
  const saveDraft = () => {
    if (!draft || !validation?.valid || mutationBlocked) return;
    if (draft.configurationId) {
      if (
        !selected ||
        selected.id !== draft.configurationId ||
        !access?.canEdit ||
        !commandExecutors?.update
      )
        return;
      run('UPDATE', selected, draft);
    } else {
      if (!access?.canCreate || !commandExecutors?.create) return;
      run('CREATE', null, draft);
    }
  };

  const canSimulate = Boolean(
    selected &&
    access?.canSimulate &&
    commandExecutors?.simulate &&
    !mutationBlocked &&
    ['DRAFT', 'SIMULATED'].includes(selected.status)
  );
  const canPublish = Boolean(
    selected && commandExecutors?.publish && !mutationBlocked && publishBlockers.length === 0
  );
  const canReverse = Boolean(
    selected &&
    access?.canReverse &&
    commandExecutors?.reverse &&
    !mutationBlocked &&
    selected.status === 'PUBLISHED' &&
    selected.lastCommandId
  );

  return {
    ready: requestScope.ready,
    workspace: workspaceQuery.data,
    loading: workspaceQuery.isLoading || !requestScope.ready,
    blockingError: workspaceQuery.data ? null : workspaceQuery.error,
    backgroundError: workspaceQuery.data ? workspaceQuery.error : null,
    fetching: workspaceQuery.isFetching || detailQuery.isFetching || versionsQuery.isFetching,
    selected,
    selectedId,
    selectConfiguration: (id: string) => {
      setSelectedId(id);
      setDraft(null);
      setFailure(null);
      setReceipt((current) => (receiptNeedsResolution(current) ? current : null));
    },
    versions: versionsQuery.data ?? [],
    versionsError: versionsQuery.error,
    access,
    canCreate: Boolean(access?.canCreate && commandExecutors?.create && !mutationBlocked),
    canEdit: Boolean(
      selected &&
      access?.canEdit &&
      commandExecutors?.update &&
      selected.status !== 'PUBLISHED' &&
      !mutationBlocked
    ),
    canReconcile: Boolean(access?.canReconcile && commandExecutors?.reconcile),
    publishBlockers,
    draft,
    setDraft,
    validation,
    failure,
    receipt,
    publishReviewOpen,
    setPublishReviewOpen,
    reverseReviewOpen,
    setReverseReviewOpen,
    busy: commandMutation.isPending,
    receiptBusy: receiptMutation.isPending,
    mutationBlocked,
    beginCreate,
    beginEdit,
    closeDraft: () => setDraft(null),
    saveDraft,
    canSimulate,
    canPublish,
    canReverse,
    simulate: () => selected && canSimulate && run('SIMULATE', selected),
    publish: () => selected && canPublish && run('PUBLISH', selected),
    reverse: () => selected && canReverse && run('REVERSE', selected),
    checkReceipt: () => {
      const expectation = receiptExpectationRef.current;
      if (!receipt || !expectation || receiptMutation.isPending) return;
      receiptMutation.mutate({ visit: visitRef.current, receipt, expectation, mode: 'LOOKUP' });
    },
    reconcileReceipt: () => {
      const expectation = receiptExpectationRef.current;
      if (
        !receipt ||
        !expectation ||
        !access?.canReconcile ||
        !commandExecutors?.reconcile ||
        receiptMutation.isPending
      )
        return;
      receiptMutation.mutate({
        visit: visitRef.current,
        receipt,
        expectation,
        mode: 'RECONCILE',
      });
    },
    refresh,
  };
}
