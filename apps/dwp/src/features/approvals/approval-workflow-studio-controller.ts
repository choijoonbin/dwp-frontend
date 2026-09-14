import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApprovalWorkflowDraft,
  getApprovalStudioWorkflow,
  getApprovalStudioWorkflows,
  publishApprovalWorkflow,
  updateApprovalWorkflowDraft,
  useToast,
} from '@dwp-frontend/shared-utils';

import { approvalWorkflowPublishCommand } from './approval-high-risk-command-model';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import { createApprovalWorkflowDraftSeed } from './approval-workflow-model';
import {
  approvalWorkflowOwnerDraft,
  approvalWorkflowWorkspaceValid,
  captureApprovalWorkflowOwnerDetail,
  createApprovalWorkflowWorkspaceSeed,
  isApprovalTypedWorkflowDraft,
} from './approval-workflow-typed-workspace-model';
import { useApprovalWorkflowConditionSource } from './approval-workflow-typed-source';
import { compileApprovalTypedWorkflow } from './approval-workflow-typed-compiler';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { approvalManagementDraftBindingMatches } from './approval-management-draft-binding';
import {
  approvalManagementSourceState,
  retryApprovalManagementRead,
} from './approval-management-source-state';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';

import type { ApprovalWorkflowWorkspaceDraft } from './approval-workflow-typed-workspace-model';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type { ApprovalManagementDraftBinding } from './approval-management-draft-binding';
import type { ApprovalWorkflowFormSourcePin } from './approval-workflow-typed-source';

export function useApprovalWorkflowStudioController() {
  const { t, i18n } = useTranslation('approvals');
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftBinding, setDraftBinding] = useState<
    (ApprovalManagementDraftBinding & { definitionHash: string }) | null
  >(null);
  const [draft, setDraft] = useState<ApprovalWorkflowWorkspaceDraft>(
    createApprovalWorkflowDraftSeed
  );
  const [checking, setChecking] = useState(false);
  const saveLock = useRef(false);
  const creationDrafts = useRef({
    legacy: createApprovalWorkflowWorkspaceSeed('legacy'),
    typed: createApprovalWorkflowWorkspaceSeed('typed'),
  });
  const publishPin = useRef<{
    id: string;
    version: number;
    hash: string;
    conditional: boolean;
    form: ApprovalWorkflowFormSourcePin | null;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('ALL');

  const workflowsQueryKey = [
    'approvals',
    'admin',
    'workflows',
    'view',
    'absent',
    ...requestScope.cacheKey,
  ] as const;

  const workflows = useQuery({
    queryKey: workflowsQueryKey,
    queryFn: ({ signal }) => getApprovalStudioWorkflows(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });
  const detail = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'workflows',
      selectedId,
      'view',
      'absent',
      ...requestScope.cacheKey,
    ],
    queryFn: async ({ signal }) =>
      captureApprovalWorkflowOwnerDetail(
        await getApprovalStudioWorkflow(selectedId!, requestScope.contextScopeKey, signal)
      ),
    enabled: scopeReady && Boolean(selectedId),
    retry: retryApprovalManagementRead,
    staleTime: 30_000,
  });

  const workflowsState = approvalManagementSourceState(workflows);
  const detailState = approvalManagementSourceState(detail);
  const catalogWriteReady = scopeReady && workflowsState === 'READY' && !workflows.isFetching;
  const detailWriteReady = catalogWriteReady && detailState === 'READY' && !detail.isFetching;
  const draftBindingMatches =
    approvalManagementDraftBindingMatches(
      draftBinding,
      detail.data
        ? { objectId: detail.data.workflow.workflowId, ...detail.data.workflow }
        : undefined
    ) && draftBinding?.definitionHash === detail.data?.definitionHash;
  const draftWriteReady = creating ? catalogWriteReady : detailWriteReady && draftBindingMatches;
  const conditionSource = useApprovalWorkflowConditionSource(
    scopeReady &&
      ((isApprovalTypedWorkflowDraft(draft) && editorOpen) || detail.data?.kind === 'typed'),
    requestScope
  );
  const baseConditional =
    !creating &&
    detail.data?.kind === 'typed' &&
    detail.data.definition.stages.some((stage) => stage.routeCondition);
  const needsConditionSource = Boolean(
    baseConditional ||
    (editorOpen &&
      isApprovalTypedWorkflowDraft(draft) &&
      draft.typedDefinition.stages.some((stage) => stage.routeCondition))
  );
  const latest = useRef({
    draftWriteReady,
    detailWriteReady,
    draftBindingMatches,
    draft,
    editorOpen,
    canEdit: experience.canEditDesign,
    needsConditionSource,
    owner: detail.data,
    canPublish: experience.canPublish,
  });
  latest.current = {
    draftWriteReady,
    detailWriteReady,
    draftBindingMatches,
    draft,
    editorOpen,
    canEdit: experience.canEditDesign,
    needsConditionSource,
    owner: detail.data,
    canPublish: experience.canPublish,
  };
  const visibleWorkflows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (workflows.data ?? []).filter(
      (workflow) =>
        (lifecycleFilter === 'ALL' || workflow.lifecycleState === lifecycleFilter) &&
        (!needle ||
          [workflow.workflowKey, workflow.nameKo, workflow.nameEn, workflow.ownerGroupRef]
            .join(' ')
            .toLocaleLowerCase()
            .includes(needle))
    );
  }, [lifecycleFilter, search, workflows.data]);

  useEffect(() => {
    const available = visibleWorkflows;
    if (available.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !available.some((workflow) => workflow.workflowId === selectedId)) {
      setSelectedId(available[0].workflowId);
    }
  }, [selectedId, visibleWorkflows]);

  const refresh = async (
    binding: Parameters<typeof commandScope.isCurrent>[0],
    workflowId?: string
  ) => {
    if (!commandScope.isCurrent(binding)) return;
    await queryClient.invalidateQueries({ queryKey: workflowsQueryKey, exact: true });
    if (!commandScope.isCurrent(binding)) return;
    if (workflowId) {
      setSelectedId(workflowId);
      await queryClient.invalidateQueries({
        queryKey: [
          'approvals',
          'admin',
          'workflows',
          workflowId,
          'view',
          'absent',
          ...requestScope.cacheKey,
        ],
        exact: true,
      });
    }
  };
  const runCreate = useApprovalGovernedMutation('route.approvals.admin.workflow-create.action');
  const runUpdate = useApprovalGovernedMutation('route.approvals.admin.workflow-update.action');
  const highRiskPublish = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'WORKFLOW_PUBLISH',
    execute: async (command, execution) => {
      const pin = publishPin.current;
      const currentMatches = () =>
        Boolean(
          pin &&
          latest.current.detailWriteReady &&
          latest.current.canPublish &&
          !latest.current.editorOpen &&
          latest.current.owner?.workflow.workflowId === pin.id &&
          latest.current.owner.workflow.version === pin.version &&
          latest.current.owner.definitionHash === pin.hash &&
          latest.current.owner.workflow.lifecycleState === 'DRAFT' &&
          command.targetId === pin.id &&
          command.expectedObjectVersion === pin.version
        );
      if (!currentMatches() || !pin) throw new ProductSurfaceOperationCancelledError();
      if (pin.conditional) await conditionSource.verify(pin.form);
      if (!currentMatches()) throw new ProductSurfaceOperationCancelledError();
      return publishApprovalWorkflow(command.targetId, command.expectedObjectVersion, execution);
    },
    onSuccess: async (_result, command, binding) => {
      await refresh(binding, command.targetId);
      if (!commandScope.isCurrent(binding)) return;
      toast.success(t('admin.workflowPublished'));
    },
    onConflict: async (command, binding) => {
      await refresh(binding, command.targetId);
    },
  });
  const { close: closeHighRiskPublish } = highRiskPublish.controller;
  const resetScopeState = useCallback(() => {
    setSelectedId(null);
    setEditorOpen(false);
    setCreating(false);
    setDraftBinding(null);
    setDraft(createApprovalWorkflowDraftSeed());
    setSearch('');
    setLifecycleFilter('ALL');
    setChecking(false);
    publishPin.current = null;
    closeHighRiskPublish();
  }, [closeHighRiskPublish]);
  useApprovalManagementScopeReset(requestScope.cacheKey, resetScopeState);
  const create = useMutation({
    mutationFn: (command: ApprovalManagementScopedCommand<ApprovalWorkflowWorkspaceDraft>) =>
      commandScope.run(command, (input) =>
        runCreate(async (execution) => {
          if (
            !commandScope.isCurrent(command) ||
            !latest.current.draftWriteReady ||
            !latest.current.canEdit
          )
            throw new ProductSurfaceOperationCancelledError();
          if (isApprovalTypedWorkflowDraft(input)) {
            if (latest.current.needsConditionSource)
              await conditionSource.verify(conditionSource.pin);
            if (
              !commandScope.isCurrent(command) ||
              !latest.current.draftWriteReady ||
              !latest.current.canEdit
            )
              throw new ProductSurfaceOperationCancelledError();
            return createApprovalWorkflowDraft(input, execution);
          }
          return createApprovalWorkflowDraft(input, execution);
        })
      ),
    onSuccess: async ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      await refresh(command, value.workflow.workflowId);
      if (!commandScope.isCurrent(command)) return;
      setEditorOpen(false);
      toast.success(t('admin.studio.workflowCreated'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveError'));
      }
    },
  });
  const update = useMutation({
    mutationFn: (
      command: ApprovalManagementScopedCommand<{
        id: string;
        input: ApprovalWorkflowWorkspaceDraft & { expectedVersion: number };
      }>
    ) =>
      commandScope.run(command, ({ id, input }) =>
        runUpdate(async (execution) => {
          if (
            !commandScope.isCurrent(command) ||
            !latest.current.draftWriteReady ||
            !latest.current.canEdit
          )
            throw new ProductSurfaceOperationCancelledError();
          if (isApprovalTypedWorkflowDraft(input)) {
            if (latest.current.needsConditionSource)
              await conditionSource.verify(conditionSource.pin);
            if (
              !commandScope.isCurrent(command) ||
              !latest.current.draftWriteReady ||
              !latest.current.canEdit ||
              !latest.current.draftBindingMatches
            )
              throw new ProductSurfaceOperationCancelledError();
            return updateApprovalWorkflowDraft(id, input, execution);
          }
          return updateApprovalWorkflowDraft(id, input, execution);
        })
      ),
    onSuccess: async ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      await refresh(command, value.workflow.workflowId);
      if (!commandScope.isCurrent(command)) return;
      setEditorOpen(false);
      toast.success(t('admin.studio.workflowSaved'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveConflict'));
      }
    },
  });

  const openCreate = () => {
    if (!catalogWriteReady || !experience.canEditDesign || editorOpen) return;
    setCreating(true);
    setDraftBinding(null);
    const legacy = createApprovalWorkflowWorkspaceSeed('legacy');
    creationDrafts.current = { legacy, typed: createApprovalWorkflowWorkspaceSeed('typed') };
    setDraft(legacy);
    setEditorOpen(true);
  };
  const openEdit = () => {
    if (!detail.data || !detailWriteReady || !experience.canEditDesign || editorOpen) return;
    const workflow = detail.data.workflow;
    if (workflow.lifecycleState !== 'DRAFT') return;
    setCreating(false);
    setDraftBinding({
      objectId: workflow.workflowId,
      version: workflow.version,
      definitionHash: detail.data.definitionHash,
    });
    setDraft(approvalWorkflowOwnerDraft(detail.data));
    setEditorOpen(true);
  };
  const save = async () => {
    if (
      !editorOpen ||
      !draftWriteReady ||
      !experience.canEditDesign ||
      !approvalWorkflowWorkspaceValid(draft, conditionSource.compiled) ||
      (needsConditionSource && !conditionSource.available) ||
      saveLock.current ||
      create.isPending ||
      update.isPending
    )
      return;
    saveLock.current = true;
    setChecking(true);
    const binding = commandScope.capture(null);
    const captured = draft;
    try {
      const snapshot: ApprovalWorkflowWorkspaceDraft = isApprovalTypedWorkflowDraft(draft)
        ? {
            ...draft,
            typedDefinition: (await compileApprovalTypedWorkflow(draft.typedDefinition)).definition,
          }
        : { ...draft, steps: draft.steps.map((step) => ({ ...step })) };
      if (
        !commandScope.isCurrent(binding) ||
        latest.current.draft !== captured ||
        !latest.current.draftWriteReady ||
        !latest.current.canEdit
      )
        return;
      if (creating) {
        await create.mutateAsync(commandScope.capture(snapshot));
        return;
      }
      if (!draftBinding || !latest.current.draftBindingMatches || !latest.current.detailWriteReady)
        return;
      await update.mutateAsync(
        commandScope.capture({
          id: draftBinding.objectId,
          input: { ...snapshot, expectedVersion: draftBinding.version },
        })
      );
    } catch {
      /* Mutation callbacks report owner errors; stale scope is discarded. */
    } finally {
      saveLock.current = false;
      if (commandScope.isCurrent(binding)) setChecking(false);
    }
  };

  const displayDraft = editorOpen
    ? draft
    : detail.data
      ? approvalWorkflowOwnerDraft(detail.data)
      : null;
  const retryRead = () => {
    void workflows.refetch();
    if (!(editorOpen && creating) && selectedId) void detail.refetch();
  };
  const publish = async () => {
    if (
      !detail.data ||
      !detailWriteReady ||
      !experience.canPublish ||
      editorOpen ||
      checking ||
      highRiskPublish.controller.busy
    )
      return;
    const owner = detail.data;
    const conditional =
      owner.kind === 'typed' && owner.definition.stages.some((stage) => stage.routeCondition);
    if (conditional) {
      if (!conditionSource.available) return;
      const binding = commandScope.capture(null);
      try {
        await conditionSource.verify(conditionSource.pin);
      } catch {
        return;
      }
      if (
        !commandScope.isCurrent(binding) ||
        !latest.current.detailWriteReady ||
        latest.current.owner !== owner ||
        !latest.current.canPublish ||
        latest.current.editorOpen
      )
        return;
    }
    publishPin.current = {
      id: owner.workflow.workflowId,
      version: owner.workflow.version,
      hash: owner.definitionHash,
      conditional,
      form: conditional ? conditionSource.pin : null,
    };
    void highRiskPublish.begin(
      approvalWorkflowPublishCommand(detail.data.workflow.workflowId, detail.data.workflow.version)
    );
  };

  return {
    t,
    i18n,
    scopeReady,
    workflowsState,
    detailState,
    workflows,
    detail,
    selectedId,
    setSelectedId,
    experience,
    catalogWriteReady,
    detailWriteReady,
    draftWriteReady,
    draftBindingMatches,
    editorOpen,
    setEditorOpen,
    creating,
    draft,
    setDraft,
    checking,
    creationDrafts,
    create,
    update,
    search,
    setSearch,
    lifecycleFilter,
    setLifecycleFilter,
    visibleWorkflows,
    highRiskPublish,
    openCreate,
    openEdit,
    save,
    displayDraft,
    conditionSource,
    needsConditionSource,
    baseConditional,
    retryRead,
    publish,
  };
}
