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
  useToast,
} from '@dwp-frontend/shared-utils';

import { ApprovalDelegationEditor } from './approval-delegation-editor';
import {
  canRevokeApprovalDelegation,
  isApprovalDelegationSnapshotCurrent,
} from './approval-delegation-model';
import { ApprovalDelegationWorkspace } from './approval-delegation-workspace';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { approvalRequestRecovery } from './approval-request-model';
import { ApprovalSurface } from './approval-ui';
import { useApprovalExperience } from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type { ApprovalDelegation, ApprovalDelegationCreateInput } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

type DelegationRecovery = Readonly<{
  command: 'create' | 'revoke';
  kind: ReturnType<typeof approvalRequestRecovery>;
}>;

type CreateDelegationCommand = ApprovalManagementScopedCommand<ApprovalDelegationCreateInput>;
type RevokeDelegationCommand = ApprovalManagementScopedCommand<ApprovalDelegation>;

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
    requestScope.ready && !delegations.isError && !delegations.isFetching && !recovery;
  const latestAuthority = useRef({ sourceReady, canManage, delegations: delegations.data });
  latestAuthority.current = { sourceReady, canManage, delegations: delegations.data };
  const activeCreate = useRef<CreateDelegationCommand | undefined>(undefined);
  const activeRevoke = useRef<RevokeDelegationCommand | undefined>(undefined);

  useEffect(() => {
    setEditorOpen(false);
    setRevoking(null);
    setRecovery(undefined);
    setSelectedId(undefined);
    activeCreate.current = undefined;
    activeRevoke.current = undefined;
  }, [identityKey]);

  useEffect(() => {
    if (delegations.isError || delegations.isFetching) setRevoking(null);
    if (
      delegations.error instanceof HttpError &&
      [401, 403, 404].includes(delegations.error.status)
    ) {
      setEditorOpen(false);
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
    if (commandScope.isCurrent(binding) && !result.isError) setRecovery(undefined);
  };
  const createPending =
    create.isPending && Boolean(create.variables && commandScope.isCurrent(create.variables));
  const revokePending =
    revoke.isPending && Boolean(revoke.variables && commandScope.isCurrent(revoke.variables));

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
            disabled={!sourceReady || createPending || revokePending}
            onClick={() => setEditorOpen(true)}
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
          pending={createPending || revokePending}
          onSelect={(delegation) => setSelectedId(delegation.delegationId)}
          onRevoke={(delegation) => {
            if (
              sourceReady &&
              !activeCreate.current &&
              !activeRevoke.current &&
              canRevokeApprovalDelegation(delegation, true)
            )
              setRevoking(delegation);
          }}
        />
      )}

      <ApprovalDelegationEditor
        open={editorOpen}
        busy={createPending}
        sourceReady={sourceReady || recovery?.command === 'create'}
        requestScope={requestScope}
        recoveryMessage={recovery?.command === 'create' ? t('delegations.createError') : undefined}
        onClose={() => {
          setEditorOpen(false);
          setRecovery(undefined);
        }}
        onSubmit={(input) => {
          if (!sourceReady || activeCreate.current || activeRevoke.current) return;
          const command = commandScope.capture(structuredClone(input));
          activeCreate.current = command;
          create.mutate(command);
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
          if (revoking && sourceReady && !activeCreate.current && !activeRevoke.current) {
            const command = commandScope.capture(structuredClone(revoking));
            activeRevoke.current = command;
            revoke.mutate(command);
          }
        }}
      />
    </ApprovalSurface>
  );
}
