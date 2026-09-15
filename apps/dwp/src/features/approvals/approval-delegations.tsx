import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  createApprovalDelegation,
  getApprovalDelegations,
  HttpError,
  revokeApprovalDelegation,
  updateApprovalDelegation,
  useToast,
} from '@dwp-frontend/shared-utils';

import { ApprovalDelegationEditor } from './approval-delegation-editor';
import {
  canUpdateApprovalDelegation,
  canRevokeApprovalDelegation,
  isApprovalDelegationSnapshotCurrent,
  isApprovalDelegationUpdateSnapshotCurrent,
  sameApprovalDelegationUpdateInput,
} from './approval-delegation-model';
import { ApprovalDelegationWorkspace } from './approval-delegation-workspace';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { approvalRequestRecovery } from './approval-request-model';
import { ApprovalSurface } from './approval-ui';
import { useApprovalExperience } from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalDelegationUpdateGovernedMutation,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type {
  ApprovalDelegation,
  ApprovalDelegationCreateInput,
  ApprovalDelegationUpdateInput,
} from '@dwp-frontend/shared-utils';
import type { ApprovalDelegationEditorSubmission } from './approval-delegation-editor';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

type DelegationRecovery = Readonly<{
  command: 'create' | 'update' | 'revoke';
  kind: ReturnType<typeof approvalRequestRecovery>;
}>;

type CreateDelegationCommand = ApprovalManagementScopedCommand<ApprovalDelegationCreateInput>;
type UpdateDelegationAttempt = Readonly<{
  source: ApprovalDelegation;
  input: ApprovalDelegationUpdateInput;
  idempotencyKey: string;
}>;
type UpdateDelegationCommand = ApprovalManagementScopedCommand<UpdateDelegationAttempt>;
type RevokeDelegationCommand = ApprovalManagementScopedCommand<ApprovalDelegation>;

function createDelegationUpdateIdempotencyKey(): string {
  return `delegation-update:${globalThis.crypto.randomUUID()}`;
}

export function ApprovalDelegations() {
  const { t } = useTranslation('approvals');
  const { canManageDelegations: canManage } = useApprovalExperience();
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const identityKey = commandScope.binding.scopeIdentity;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalDelegation | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [revoking, setRevoking] = useState<ApprovalDelegation | null>(null);
  const [recovery, setRecovery] = useState<DelegationRecovery | undefined>(undefined);
  const delegationsKey = ['approvals', ...requestScope.cacheKey, 'delegations'] as const;
  const delegations = useQuery({
    queryKey: delegationsKey,
    queryFn: ({ signal }) => getApprovalDelegations(requestScope.contextScopeKey, signal),
    enabled: requestScope.ready,
    meta: requestScope.queryMeta,
    staleTime: 20_000,
    retry: false,
  });
  const visibleDelegations = useMemo(
    () =>
      !requestScope.ready || delegations.isError || delegations.isFetching
        ? []
        : (delegations.data ?? []),
    [requestScope.ready, delegations.data, delegations.isError, delegations.isFetching]
  );
  const sourceReady =
    requestScope.ready &&
    delegations.status === 'success' &&
    delegations.fetchStatus === 'idle' &&
    delegations.dataUpdatedAt > 0 &&
    !recovery;
  const latestAuthority = useRef({ sourceReady, canManage, delegations: delegations.data });
  latestAuthority.current = { sourceReady, canManage, delegations: delegations.data };
  const activeCreate = useRef<CreateDelegationCommand | undefined>(undefined);
  const activeUpdate = useRef<UpdateDelegationCommand | undefined>(undefined);
  const preservedUpdate = useRef<UpdateDelegationAttempt | undefined>(undefined);
  const activeRevoke = useRef<RevokeDelegationCommand | undefined>(undefined);

  useEffect(() => {
    setEditorOpen(false);
    setEditing(null);
    setRevoking(null);
    setRecovery(undefined);
    setSelectedId(undefined);
    activeCreate.current = undefined;
    activeUpdate.current = undefined;
    preservedUpdate.current = undefined;
    activeRevoke.current = undefined;
  }, [identityKey]);

  useEffect(() => {
    if (delegations.isError || delegations.isFetching) setRevoking(null);
    if (
      delegations.error instanceof HttpError &&
      [401, 403, 404].includes(delegations.error.status)
    ) {
      setEditorOpen(false);
      setEditing(null);
      setSelectedId(undefined);
    }
  }, [delegations.isError, delegations.isFetching, delegations.error]);

  useEffect(() => {
    if (!selectedId && visibleDelegations[0]) setSelectedId(visibleDelegations[0].delegationId);
    if (
      selectedId &&
      !visibleDelegations.some((delegation) => delegation.delegationId === selectedId)
    ) {
      setSelectedId(visibleDelegations[0]?.delegationId);
    }
  }, [selectedId, visibleDelegations]);

  const runCreate = useApprovalGovernedMutation('route.approvals.work.delegation-create.action');
  const runUpdate = useApprovalDelegationUpdateGovernedMutation();
  const runRevoke = useApprovalGovernedMutation('route.approvals.work.delegation-revoke.action');

  const create = useMutation({
    mutationFn: async (command: CreateDelegationCommand) => {
      if (!commandScope.isCurrent(command) || !sourceReady || !canManage) {
        throw new HttpError('Delegation authority is not current.', 409);
      }
      await getApprovalDelegations(requestScope.contextScopeKey);
      if (!commandScope.isCurrent(command)) {
        throw new HttpError('Delegation identity changed.', 409);
      }
      const result = await runCreate((execution) => {
        if (
          !commandScope.isCurrent(command) ||
          !latestAuthority.current.sourceReady ||
          !latestAuthority.current.canManage
        ) {
          throw new HttpError('Delegation authority changed before dispatch.', 409);
        }
        return createApprovalDelegation(command.input, execution);
      });
      return { result, command };
    },
    onSuccess: ({ result, command }) => {
      if (!commandScope.isCurrent(command)) return;
      queryClient.setQueryData(delegationsKey, result);
      setEditorOpen(false);
      setRecovery(undefined);
      toast.success(t('delegations.created'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) return;
      const status = error instanceof HttpError ? error.status : undefined;
      setRecovery({ command: 'create', kind: approvalRequestRecovery(status) });
      toast.error(t('delegations.createError'));
    },
    onSettled: (_, __, command) => {
      if (activeCreate.current === command) activeCreate.current = undefined;
    },
  });

  const update = useMutation({
    mutationFn: async (command: UpdateDelegationCommand) => {
      const attempt = command.input;
      const { source, input } = attempt;
      if (
        !commandScope.isCurrent(command) ||
        !sourceReady ||
        !canManage ||
        !canUpdateApprovalDelegation(source, true) ||
        !isApprovalDelegationUpdateSnapshotCurrent(delegations.data, source) ||
        input.delegateUserId !== source.delegateUserId ||
        input.expectedVersion !== source.version
      ) {
        throw new HttpError('Delegation update authority is not current.', 409);
      }
      const latest = await getApprovalDelegations(requestScope.contextScopeKey);
      if (
        !commandScope.isCurrent(command) ||
        !isApprovalDelegationUpdateSnapshotCurrent(latest, source)
      ) {
        throw new HttpError('Delegation changed before update execution.', 409);
      }
      const result = await runUpdate((execution) => {
        if (
          !commandScope.isCurrent(command) ||
          !latestAuthority.current.sourceReady ||
          !latestAuthority.current.canManage ||
          !isApprovalDelegationUpdateSnapshotCurrent(latestAuthority.current.delegations, source)
        ) {
          throw new HttpError('Delegation authority changed before update dispatch.', 409);
        }
        return updateApprovalDelegation(source.delegationId, input, {
          ...execution,
          ...(execution.mode === 'SECURE' ? { objectVersion: input.expectedVersion } : {}),
          idempotencyKey: attempt.idempotencyKey,
        });
      });
      return { result, command };
    },
    onSuccess: ({ result, command }) => {
      if (!commandScope.isCurrent(command)) return;
      queryClient.setQueryData(delegationsKey, result);
      setEditorOpen(false);
      setEditing(null);
      setRecovery(undefined);
      preservedUpdate.current = undefined;
      toast.success(t('delegations.update.saved'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) return;
      const status = error instanceof HttpError ? error.status : undefined;
      preservedUpdate.current = command.input;
      setRecovery({ command: 'update', kind: approvalRequestRecovery(status) });
      toast.error(t('delegations.update.failed'));
    },
    onSettled: (_, __, command) => {
      if (activeUpdate.current === command) activeUpdate.current = undefined;
    },
  });

  const revoke = useMutation({
    mutationFn: async (command: RevokeDelegationCommand) => {
      const delegation = command.input;
      if (
        !commandScope.isCurrent(command) ||
        !sourceReady ||
        !canManage ||
        !canRevokeApprovalDelegation(delegation, true) ||
        !isApprovalDelegationSnapshotCurrent(delegations.data, delegation)
      ) {
        throw new HttpError('Delegation authority is not current.', 409);
      }
      const latest = await getApprovalDelegations(requestScope.contextScopeKey);
      if (
        !commandScope.isCurrent(command) ||
        !isApprovalDelegationSnapshotCurrent(latest, delegation)
      ) {
        throw new HttpError('Delegation changed before command execution.', 409);
      }
      const result = await runRevoke((execution) => {
        if (
          !commandScope.isCurrent(command) ||
          !latestAuthority.current.sourceReady ||
          !latestAuthority.current.canManage ||
          !isApprovalDelegationSnapshotCurrent(latestAuthority.current.delegations, delegation)
        ) {
          throw new HttpError('Delegation authority changed before dispatch.', 409);
        }
        return revokeApprovalDelegation(delegation.delegationId, delegation.version, execution);
      });
      return { result, command };
    },
    onSuccess: ({ result, command }) => {
      if (!commandScope.isCurrent(command)) return;
      queryClient.setQueryData(delegationsKey, result);
      setRevoking(null);
      setRecovery(undefined);
      toast.success(t('delegations.revoked'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) return;
      const status = error instanceof HttpError ? error.status : undefined;
      setRevoking(null);
      setRecovery({ command: 'revoke', kind: approvalRequestRecovery(status) });
      toast.error(t('delegations.revokeError'));
    },
    onSettled: (_, __, command) => {
      if (activeRevoke.current === command) activeRevoke.current = undefined;
    },
  });

  const refreshAuthority = async () => {
    const binding = commandScope.binding;
    const result = await delegations.refetch();
    if (!commandScope.isCurrent(binding) || result.isError) return;
    if (
      recovery?.command === 'update' &&
      editing &&
      !isApprovalDelegationUpdateSnapshotCurrent(result.data, editing)
    ) {
      setRecovery({ command: 'update', kind: 'CONFLICT' });
      return;
    }
    setRecovery(undefined);
  };
  const createPending =
    create.isPending && Boolean(create.variables && commandScope.isCurrent(create.variables));
  const updatePending =
    update.isPending && Boolean(update.variables && commandScope.isCurrent(update.variables));
  const revokePending =
    revoke.isPending && Boolean(revoke.variables && commandScope.isCurrent(revoke.variables));
  const mutationPending = createPending || updatePending || revokePending;

  return (
    <ApprovalSurface
      title={t('pages.delegations.title')}
      meta={t('pages.delegations.description')}
      action={
        canManage ? (
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Plus size={16} />}
            disabled={!sourceReady || mutationPending}
            onClick={() => {
              setEditing(null);
              preservedUpdate.current = undefined;
              setEditorOpen(true);
            }}
          >
            {t('delegations.add')}
          </ActionButton>
        ) : undefined
      }
    >
      {recovery && recovery.command === 'revoke' && (
        <InlineFeedback
          severity={recovery.kind === 'CONFLICT' ? 'warning' : 'error'}
          action={
            <ActionButton
              type="button"
              intent="quiet"
              size="small"
              disabled={delegations.isFetching}
              onClick={() => void refreshAuthority()}
            >
              {t('actions.refresh')}
            </ActionButton>
          }
        >
          {t('delegations.revokeError')}
        </InlineFeedback>
      )}
      {recovery?.command === 'update' && !editorOpen && (
        <InlineFeedback
          severity={recovery.kind === 'CONFLICT' ? 'warning' : 'error'}
          action={
            <ActionButton
              type="button"
              intent="quiet"
              size="small"
              disabled={delegations.isFetching}
              onClick={() => void refreshAuthority()}
            >
              {t('actions.refresh')}
            </ActionButton>
          }
        >
          {t(`delegations.update.errors.${recovery.kind}`)}
        </InlineFeedback>
      )}
      {delegations.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton
              type="button"
              intent="quiet"
              size="small"
              disabled={delegations.isFetching}
              onClick={() => void delegations.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('delegations.loadError')}
        </InlineFeedback>
      ) : delegations.isFetching ? (
        <LoadingState label={t('common:labels.loading')} size="page" embedded />
      ) : (
        <ApprovalDelegationWorkspace
          key={JSON.stringify([
            commandScope.binding.scopeIdentity,
            commandScope.binding.scopeEpoch,
          ])}
          delegations={visibleDelegations}
          selectedId={selectedId}
          canManage={canManage}
          sourceReady={sourceReady}
          pending={mutationPending}
          onSelect={(delegation) => setSelectedId(delegation.delegationId)}
          onEdit={(delegation) => {
            if (
              sourceReady &&
              !activeCreate.current &&
              !activeUpdate.current &&
              !activeRevoke.current &&
              canUpdateApprovalDelegation(delegation, true) &&
              isApprovalDelegationUpdateSnapshotCurrent(delegations.data, delegation)
            ) {
              setEditing(structuredClone(delegation));
              preservedUpdate.current = undefined;
              setEditorOpen(true);
            }
          }}
          onRevoke={(delegation) => {
            if (
              sourceReady &&
              !activeCreate.current &&
              !activeUpdate.current &&
              !activeRevoke.current &&
              canRevokeApprovalDelegation(delegation, true)
            )
              setRevoking(delegation);
          }}
        />
      )}

      <ApprovalDelegationEditor
        open={editorOpen}
        busy={createPending || updatePending}
        sourceReady={
          sourceReady || recovery?.command === 'create' || recovery?.command === 'update'
        }
        requestScope={requestScope}
        delegation={editing}
        recoveryMessage={
          recovery?.command === 'create'
            ? t('delegations.createError')
            : recovery?.command === 'update'
              ? t(`delegations.update.errors.${recovery.kind}`)
              : undefined
        }
        onClose={() => {
          if (createPending || updatePending) return;
          setEditorOpen(false);
          setEditing(null);
          if (recovery?.command !== 'update') setRecovery(undefined);
          preservedUpdate.current = undefined;
        }}
        onSubmit={(submission: ApprovalDelegationEditorSubmission) => {
          if (
            !sourceReady ||
            activeCreate.current ||
            activeUpdate.current ||
            activeRevoke.current
          ) {
            return;
          }
          if (submission.kind === 'create') {
            const command = commandScope.capture(structuredClone(submission.input));
            activeCreate.current = command;
            create.mutate(command);
            return;
          }
          if (
            !editing ||
            !canUpdateApprovalDelegation(editing, true) ||
            !isApprovalDelegationUpdateSnapshotCurrent([editing], submission.source) ||
            submission.input.delegateUserId !== editing.delegateUserId ||
            submission.input.expectedVersion !== editing.version
          ) {
            return;
          }
          const previous = preservedUpdate.current;
          const attempt =
            previous &&
            isApprovalDelegationUpdateSnapshotCurrent([previous.source], editing) &&
            sameApprovalDelegationUpdateInput(previous.input, submission.input)
              ? previous
              : {
                  source: structuredClone(editing),
                  input: structuredClone(submission.input),
                  idempotencyKey: createDelegationUpdateIdempotencyKey(),
                };
          preservedUpdate.current = attempt;
          const command = commandScope.capture(attempt);
          activeUpdate.current = command;
          update.mutate(command);
        }}
        onRecover={() => void refreshAuthority()}
      />
      <ConfirmDialog
        open={Boolean(revoking)}
        title={t('delegations.revoke.title')}
        description={t('delegations.revoke.description', {
          name: revoking?.delegateDisplayName ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('delegations.revoke.confirm')}
        intent="danger"
        busy={revokePending}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (
            revoking &&
            sourceReady &&
            !activeCreate.current &&
            !activeUpdate.current &&
            !activeRevoke.current
          ) {
            const command = commandScope.capture(structuredClone(revoking));
            activeRevoke.current = command;
            revoke.mutate(command);
          }
        }}
      />
    </ApprovalSurface>
  );
}
