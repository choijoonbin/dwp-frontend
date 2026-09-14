import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { HttpError, useToast } from '@dwp-frontend/shared-utils';
import {
  getApprovalDocumentPolicy,
  getApprovalDocumentHold,
  saveApprovalDocumentPolicy,
  proposeApprovalDocumentHold,
  publishApprovalDocumentPolicy,
  publishApprovalDocumentHold,
} from '@dwp-frontend/shared-utils/api/approval-document-api';
import Stack from '@mui/material/Stack';

import { ApprovalAdminDocumentPolicy } from './approval-admin-document-policy';
import { ApprovalAdminDocumentHold } from './approval-admin-document-hold';
import {
  approvalDocumentHoldValid,
  approvalDocumentMakerBlocked,
  approvalDocumentPolicyValid,
  approvalDocumentRequestIdValid,
  approvalDocumentRulesValid,
} from './approval-admin-document-model';
import {
  approvalDocumentPolicyPublishCommand,
  approvalDocumentHoldPublishCommand,
} from './approval-document-command';
import {
  approvalDocumentActionInstalled,
  useApprovalDocumentMutation,
} from './use-approval-document-mutation';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import {
  approvalManagementSourceState,
  retryApprovalManagementRead,
} from './approval-management-source-state';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import { ProductSurfaceOperationCancelledError } from '../../components/product-surface-operation-coordinator';
import { ProductSurfaceMutationAuthorityError } from '../../components/use-product-surface-governed-mutation';
import { isProductSurfaceOperationCancelledError } from './use-approval-governed-mutation';
import type { ApprovalDocumentPolicyDraft } from './approval-admin-document-policy';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';
import type { ApprovalDocumentHoldInput } from '@dwp-frontend/shared-utils/api/approval-document-contract';

export function ApprovalAdminDocumentController() {
  const { t } = useTranslation('approvals');
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const toast = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<ApprovalDocumentPolicyDraft | null>(null);
  const [input, setInput] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [uncertainPolicy, setUncertainPolicy] = useState(false);
  const [uncertainHold, setUncertainHold] = useState(false);
  const [blockedPolicy, setBlockedPolicy] = useState(false);
  const [blockedHold, setBlockedHold] = useState(false);
  const [completedProposals, setCompletedProposals] = useState(0);
  const publicationSource = useRef<{ policyId: string; version: number; sha256: string } | null>(
    null
  );
  const mutationLock = useRef<symbol | null>(null);
  const policyKey = ['approvals', 'admin', 'document-policy', ...requestScope.cacheKey] as const;
  const holdKey = [
    'approvals',
    'admin',
    'document-hold',
    requestId,
    ...requestScope.cacheKey,
  ] as const;
  const policy = useQuery({
    queryKey: policyKey,
    queryFn: ({ signal }) => getApprovalDocumentPolicy(requestScope.contextScopeKey, signal),
    enabled: scopeReady && experience.canViewPolicies,
    staleTime: 30_000,
    retry: retryApprovalManagementRead,
  });
  const hold = useQuery({
    queryKey: holdKey,
    queryFn: ({ signal }) =>
      getApprovalDocumentHold(requestId!, requestScope.contextScopeKey, signal),
    enabled: scopeReady && experience.canViewPolicies && Boolean(requestId),
    staleTime: 30_000,
    retry: retryApprovalManagementRead,
  });
  const policyValid = approvalDocumentPolicyValid(policy.data);
  const holdValid = Boolean(requestId && approvalDocumentHoldValid(hold.data, requestId));
  const policyReady =
    scopeReady &&
    !blockedPolicy &&
    policyValid &&
    approvalManagementSourceState(policy) === 'READY' &&
    !policy.isFetching;
  const holdReady =
    scopeReady &&
    !blockedHold &&
    holdValid &&
    approvalManagementSourceState(hold) === 'READY' &&
    !hold.isFetching;
  const saveAction = useApprovalDocumentMutation(
    'route.approvals.admin.document-policy-draft.action'
  );
  const proposeAction = useApprovalDocumentMutation(
    'route.approvals.admin.document-hold-proposal.action'
  );
  const publishPolicyInstalled = approvalDocumentActionInstalled(
    'route.approvals.admin.document-policy-publish.action'
  );
  const publishHoldInstalled = approvalDocumentActionInstalled(
    'route.approvals.admin.document-hold-publish.action'
  );
  const actorId = requestScope.cacheKey[1];
  const latest = useRef({
    policy: policy.data,
    hold: hold.data,
    policyReady,
    holdReady,
    experience,
    actorId,
    requestId,
  });
  latest.current = {
    policy: policy.data,
    hold: hold.data,
    policyReady,
    holdReady,
    experience,
    actorId,
    requestId,
  };
  const refreshPolicy = async () => {
    const binding = commandScope.binding;
    const result = await policy.refetch();
    if (
      commandScope.isCurrent(binding) &&
      result.isSuccess &&
      approvalDocumentPolicyValid(result.data)
    )
      setBlockedPolicy(false);
  };
  const refreshHold = () => {
    if (!requestId) return;
    const binding = commandScope.binding;
    void hold.refetch().then((result) => {
      if (
        commandScope.isCurrent(binding) &&
        result.isSuccess &&
        approvalDocumentHoldValid(result.data, requestId)
      )
        setBlockedHold(false);
    });
  };
  const highRiskPolicy = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'DOCUMENT_POLICY_PUBLISH',
    execute: async (command, execution) => {
      const current = latest.current;
      if (
        !publishPolicyInstalled ||
        execution.mode !== 'SECURE' ||
        !current.policyReady ||
        !current.experience.canPublishPolicies ||
        current.policy?.policyId !== command.targetId ||
        current.policy.version !== command.expectedObjectVersion ||
        !current.policy.pending ||
        approvalDocumentMakerBlocked(current.policy.pending.makerUserId, current.actorId) ||
        publicationSource.current?.policyId !== command.targetId ||
        publicationSource.current.version !== command.expectedObjectVersion ||
        current.policy.pending.sha256 !== publicationSource.current.sha256
      )
        throw new ProductSurfaceOperationCancelledError();
      const result = await publishApprovalDocumentPolicy(
        command.targetId,
        {
          expectedVersion: command.expectedObjectVersion,
          idempotencyKey: command.idempotencyKey!,
          reviewComment: String(command.payload.reviewComment),
        },
        execution
      );
      if (!approvalDocumentPolicyValid(result)) throw new Error('approval-document-source-invalid');
      return result;
    },
    onSuccess: (value, _command, binding) => {
      if (!commandScope.isCurrent(binding)) return;
      if (approvalDocumentPolicyValid(value)) client.setQueryData(policyKey, value);
      void client.invalidateQueries({ queryKey: policyKey, exact: true });
      toast.success(t('admin.document.publishedSuccess'));
    },
    onConflict: () => {
      void client.invalidateQueries({ queryKey: policyKey, exact: true });
    },
  });
  const highRiskHold = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'DOCUMENT_HOLD_PUBLISH',
    execute: async (command, execution) => {
      const current = latest.current;
      if (
        !publishHoldInstalled ||
        execution.mode !== 'SECURE' ||
        !current.holdReady ||
        !current.experience.canPublishPolicies ||
        current.hold?.requestId !== command.targetId ||
        current.hold.version !== command.expectedObjectVersion ||
        !current.hold.pending ||
        current.hold.pending?.proposalId !== command.payload.proposalId ||
        approvalDocumentMakerBlocked(current.hold.pending.makerUserId, current.actorId)
      )
        throw new ProductSurfaceOperationCancelledError();
      const result = await publishApprovalDocumentHold(
        command.targetId,
        {
          expectedVersion: command.expectedObjectVersion,
          proposalId: String(command.payload.proposalId),
          reviewComment: String(command.payload.reviewComment),
          idempotencyKey: command.idempotencyKey!,
        },
        execution
      );
      if (!approvalDocumentHoldValid(result, command.targetId))
        throw new Error('approval-document-source-invalid');
      return result;
    },
    onSuccess: (value, command, binding) => {
      if (!commandScope.isCurrent(binding)) return;
      if (approvalDocumentHoldValid(value, command.targetId)) client.setQueryData(holdKey, value);
      void client.invalidateQueries({ queryKey: holdKey, exact: true });
      toast.success(t('admin.document.holdPublished'));
    },
    onConflict: () => {
      void client.invalidateQueries({ queryKey: holdKey, exact: true });
    },
  });
  const save = useMutation({
    retry: false,
    mutationFn: (command: ApprovalManagementScopedCommand<ApprovalDocumentPolicyDraft>) =>
      commandScope.run(command, async (item) => {
        const assertCurrent = () => {
          const current = latest.current;
          if (
            !commandScope.isCurrent(command) ||
            !saveAction.available ||
            !current.policyReady ||
            !current.experience.canEditPolicies ||
            current.policy?.policyId !== item.policyId ||
            current.policy.version !== item.expectedVersion ||
            !approvalDocumentRulesValid(item.rules)
          )
            throw new ProductSurfaceOperationCancelledError();
        };
        assertCurrent();
        const value = await saveAction.run((execution) => {
          assertCurrent();
          return saveApprovalDocumentPolicy(
            item.policyId,
            {
              expectedVersion: item.expectedVersion,
              idempotencyKey: item.idempotencyKey,
              rules: item.rules,
            },
            execution
          );
        });
        if (!approvalDocumentPolicyValid(value))
          throw new Error('approval-document-source-invalid');
        return value;
      }),
    onSuccess: ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      client.setQueryData(policyKey, value);
      setDraft(null);
      toast.success(t('admin.document.saved'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) return;
      setBlockedPolicy(true);
      if (
        !(error instanceof ProductSurfaceMutationAuthorityError) &&
        (!(error instanceof HttpError) || error.status >= 500)
      )
        setUncertainPolicy(true);
      toast.error(t('admin.document.sourceUnavailable'));
    },
  });
  const propose = useMutation({
    retry: false,
    mutationFn: (
      command: ApprovalManagementScopedCommand<{
        requestId: string;
        input: ApprovalDocumentHoldInput;
      }>
    ) =>
      commandScope.run(command, async (item) => {
        const assertCurrent = () => {
          const current = latest.current;
          if (
            !commandScope.isCurrent(command) ||
            !proposeAction.available ||
            !current.holdReady ||
            !current.experience.canEditPolicies ||
            current.requestId !== item.requestId ||
            current.hold?.requestId !== item.requestId ||
            current.hold.version !== item.input.expectedVersion ||
            current.hold.pending ||
            (item.input.operation === 'PLACE') === current.hold.active
          )
            throw new ProductSurfaceOperationCancelledError();
        };
        assertCurrent();
        const value = await proposeAction.run((execution) => {
          assertCurrent();
          return proposeApprovalDocumentHold(item.requestId, item.input, execution);
        });
        if (!approvalDocumentHoldValid(value, item.requestId))
          throw new Error('approval-document-source-invalid');
        return value;
      }),
    onSuccess: ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      client.setQueryData(holdKey, value);
      setCompletedProposals((count) => count + 1);
      toast.success(t('admin.document.proposed'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (isProductSurfaceOperationCancelledError(error)) return;
      setBlockedHold(true);
      if (
        !(error instanceof ProductSurfaceMutationAuthorityError) &&
        (!(error instanceof HttpError) || error.status >= 500)
      )
        setUncertainHold(true);
      toast.error(t('admin.document.sourceUnavailable'));
    },
  });
  const closePolicyHighRisk = highRiskPolicy.controller.close;
  const closeHoldHighRisk = highRiskHold.controller.close;
  const reset = useCallback(() => {
    setDraft(null);
    setInput('');
    setRequestId(null);
    setUncertainPolicy(false);
    setUncertainHold(false);
    setBlockedPolicy(false);
    setBlockedHold(false);
    setCompletedProposals(0);
    publicationSource.current = null;
    mutationLock.current = null;
    closePolicyHighRisk();
    closeHoldHighRisk();
  }, [closePolicyHighRisk, closeHoldHighRisk]);
  useApprovalManagementScopeReset(requestScope.cacheKey, reset);
  const busy =
    save.isPending ||
    propose.isPending ||
    highRiskPolicy.controller.busy ||
    highRiskHold.controller.busy;
  const canEditPolicy =
    policyReady && experience.canEditPolicies && saveAction.available && !uncertainPolicy;
  const canEditHold =
    holdReady && experience.canEditPolicies && proposeAction.available && !uncertainHold;
  return (
    <Stack gap={2} minWidth={0}>
      {!saveAction.available ||
      !proposeAction.available ||
      !publishPolicyInstalled ||
      !publishHoldInstalled ? (
        <InlineFeedback severity="warning">{t('admin.document.sourceUnavailable')}</InlineFeedback>
      ) : null}
      {uncertainPolicy || uncertainHold ? (
        <InlineFeedback severity="warning">{t('admin.document.commandUnknown')}</InlineFeedback>
      ) : null}
      {blockedPolicy || blockedHold ? (
        <InlineFeedback severity="warning">{t('admin.document.formDisabled')}</InlineFeedback>
      ) : null}
      {policy.isPending && scopeReady ? (
        <LoadingState label={t('admin.document.title')} size="compact" />
      ) : !scopeReady || !policyValid || approvalManagementSourceState(policy) !== 'READY' ? (
        <ErrorState
          title={t('admin.document.sourceUnavailable')}
          retryLabel={t('admin.document.reloadPolicy')}
          retrying={policy.isFetching}
          onRetry={refreshPolicy}
          size="compact"
        />
      ) : (
        <ApprovalAdminDocumentPolicy
          policy={policy.data!}
          canEdit={canEditPolicy}
          canPublish={policyReady && experience.canPublishPolicies && publishPolicyInstalled}
          makerBlocked={approvalDocumentMakerBlocked(policy.data?.pending?.makerUserId, actorId)}
          busy={busy}
          refreshing={policy.isFetching}
          draft={draft}
          draftReady={Boolean(
            canEditPolicy &&
            draft &&
            draft.policyId === policy.data!.policyId &&
            draft.expectedVersion === policy.data!.version
          )}
          onEdit={() => {
            if (canEditPolicy && !busy)
              setDraft({
                policyId: policy.data!.policyId,
                expectedVersion: policy.data!.version,
                idempotencyKey: crypto.randomUUID(),
                rules: structuredClone(policy.data!.pending?.rules ?? policy.data!.published.rules),
              });
          }}
          onChange={(rules) => {
            if (canEditPolicy && !busy)
              setDraft((value) =>
                value &&
                value.policyId === latest.current.policy?.policyId &&
                value.expectedVersion === latest.current.policy.version
                  ? { ...value, rules }
                  : value
              );
          }}
          onClose={() => {
            if (!busy) setDraft(null);
          }}
          onSave={() => {
            if (
              !canEditPolicy ||
              !draft ||
              busy ||
              mutationLock.current ||
              draft.policyId !== latest.current.policy?.policyId ||
              draft.expectedVersion !== latest.current.policy.version ||
              !approvalDocumentRulesValid(draft.rules)
            )
              return;
            const lock = Symbol();
            mutationLock.current = lock;
            save.mutate(commandScope.capture(structuredClone(draft)), {
              onSettled: () => {
                if (mutationLock.current === lock) mutationLock.current = null;
              },
            });
          }}
          onPublish={(comment, version, sha256) => {
            const current = latest.current;
            if (
              busy ||
              mutationLock.current ||
              !publishPolicyInstalled ||
              !current.policyReady ||
              !current.experience.canPublishPolicies ||
              current.policy?.version !== version ||
              current.policy.pending?.sha256 !== sha256 ||
              approvalDocumentMakerBlocked(current.policy.pending.makerUserId, actorId)
            )
              return false;
            const command = approvalDocumentPolicyPublishCommand(
              current.policy.policyId,
              version,
              comment,
              crypto.randomUUID()
            );
            publicationSource.current = { policyId: current.policy.policyId, version, sha256 };
            void highRiskPolicy.begin(command);
            return true;
          }}
          onRefresh={refreshPolicy}
        />
      )}
      <ApprovalAdminDocumentHold
        key={JSON.stringify(requestScope.cacheKey)}
        input={input}
        selectedId={requestId}
        hold={holdReady ? hold.data : undefined}
        loading={Boolean(requestId && hold.isFetching)}
        unavailable={Boolean(requestId && !hold.isPending && !holdReady)}
        busy={busy}
        canRead={scopeReady && experience.canViewPolicies}
        canEdit={canEditHold}
        canPublish={holdReady && experience.canPublishPolicies && publishHoldInstalled}
        makerBlocked={approvalDocumentMakerBlocked(hold.data?.pending?.makerUserId, actorId)}
        completedProposals={completedProposals}
        onInput={setInput}
        onLookup={() => {
          if (
            !busy &&
            scopeReady &&
            experience.canViewPolicies &&
            approvalDocumentRequestIdValid(input)
          ) {
            if (input === requestId) refreshHold();
            else setRequestId(input);
          }
        }}
        onRefresh={refreshHold}
        onPropose={(operation, reason, version) => {
          if (
            !canEditHold ||
            busy ||
            mutationLock.current ||
            !requestId ||
            hold.data?.version !== version
          )
            return false;
          const lock = Symbol();
          mutationLock.current = lock;
          propose.mutate(
            commandScope.capture({
              requestId,
              input: {
                operation,
                reason,
                expectedVersion: version,
                idempotencyKey: crypto.randomUUID(),
              },
            }),
            {
              onSettled: () => {
                if (mutationLock.current === lock) mutationLock.current = null;
              },
            }
          );
          return true;
        }}
        onPublish={(comment, version, proposalId) => {
          const current = latest.current;
          if (
            busy ||
            mutationLock.current ||
            !publishHoldInstalled ||
            !current.holdReady ||
            !current.experience.canPublishPolicies ||
            current.hold?.version !== version ||
            current.hold.pending?.proposalId !== proposalId ||
            approvalDocumentMakerBlocked(current.hold.pending.makerUserId, actorId)
          )
            return false;
          void highRiskHold.begin(
            approvalDocumentHoldPublishCommand(
              current.hold.requestId,
              version,
              proposalId,
              comment,
              crypto.randomUUID()
            )
          );
          return true;
        }}
      />
      <ApprovalHighRiskCommandDialog controller={highRiskPolicy.controller} />
      <ApprovalHighRiskCommandDialog controller={highRiskHold.controller} />
    </Stack>
  );
}
