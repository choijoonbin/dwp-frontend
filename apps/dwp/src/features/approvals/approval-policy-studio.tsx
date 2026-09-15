import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIconButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getApprovalPolicies,
  getApprovalPolicyVersions,
  publishApprovalPolicy,
  updateApprovalPolicy,
  HttpError,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalPolicyPublishCommand } from './approval-high-risk-command-model';
import {
  useApprovalManagementCommandScope,
  useApprovalManagementHighRiskCommand,
} from './approval-management-command-scope';
import {
  useApprovalManagementScopeReady,
  useApprovalManagementScopeReset,
} from './approval-management-scope';
import { ApprovalPolicyEditorDialog, ApprovalPolicyReviewDialog } from './approval-policy-dialogs';
import { ApprovalPolicyCreateDialog } from './approval-policy-create-dialog';
import {
  approvalPolicyRuleInput,
  createApprovalPolicyEditDraft,
  isApprovalPolicyDraftValid,
  isApprovalPolicyMakerBlocked,
  isApprovalPolicySourceCurrent,
} from './approval-policy-model';
import {
  ApprovalPolicyDetail,
  ApprovalPolicyInspector,
  ApprovalPolicyListItem,
} from './approval-policy-workspace';
import { ApprovalPolicySection, ApprovalPolicySummary } from './approval-policy-presentation';
import { ApprovalPolicyImpactPanel } from './approval-policy-impact-panel';
import { approvalPolicyImpactSourceIdentity } from './approval-policy-impact-source';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useApprovalPolicyCreate } from './use-approval-policy-create';

import type { ApprovalPolicyDraft } from './approval-policy-model';
import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopedCommand } from './approval-management-command-scope';

export function ApprovalPolicyStudio() {
  const { t, i18n } = useTranslation('approvals');
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const scopeReady = useApprovalManagementScopeReady(requestScope);
  const commandScope = useApprovalManagementCommandScope(requestScope.cacheKey);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ApprovalPolicyDraft | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [draftOrigin, setDraftOrigin] =
    useState<ApprovalManagementScopedCommand<ApprovalPolicy> | null>(null);
  const [reviewOrigin, setReviewOrigin] =
    useState<ApprovalManagementScopedCommand<ApprovalPolicy> | null>(null);
  const publishSource = useRef<{
    origin: ApprovalManagementScopedCommand<ApprovalPolicy>;
    comment: string;
  } | null>(null);

  const policiesQueryKey = ['approvals', 'admin', 'policies', ...requestScope.cacheKey] as const;
  const policies = useQuery({
    queryKey: policiesQueryKey,
    queryFn: ({ signal }) => getApprovalPolicies(requestScope.contextScopeKey, signal),
    enabled: scopeReady,
    staleTime: 30_000,
    retry: false,
  });
  const versions = useQuery({
    queryKey: ['approvals', 'admin', 'policies', selectedId, 'versions', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getApprovalPolicyVersions(selectedId!, requestScope.contextScopeKey, signal),
    enabled: scopeReady && Boolean(selectedId),
    staleTime: 30_000,
    retry: 1,
  });
  const selected = useMemo(
    () => policies.data?.find((policy) => policy.policyId === selectedId) ?? null,
    [policies.data, selectedId]
  );
  const actorId = requestScope.cacheKey[1];
  const makerBlocked = isApprovalPolicyMakerBlocked(selected, actorId);
  const publishedVersion = versions.data?.[0]?.versionNumber ?? null;
  const publishedVersionLabel = versions.isError
    ? t('admin.studio.policyVersionUnavailable')
    : versions.isLoading
      ? t('admin.studio.policyVersionLoading')
      : publishedVersion === null
        ? t('admin.studio.unpublishedVersion')
        : `v${publishedVersion}`;
  const sourceReady =
    scopeReady && policies.isSuccess && !policies.isFetching && policies.failureCount === 0;
  const policyCreate = useApprovalPolicyCreate({
    requestScope,
    scopeReady,
    sourceReady,
    canCreate: experience.canEditPolicies,
    policies: policies.data ?? [],
    policiesQueryKey,
    onCreated: (policy) => {
      setSelectedId(policy.policyId);
      toast.success(t('admin.studio.policySubmitted'));
    },
  });
  const sourceState = useRef({
    scopeReady,
    queryKey: policiesQueryKey,
    canEdit: experience.canEditPolicies,
    canPublish: experience.canPublishPolicies,
  });
  sourceState.current = {
    scopeReady,
    queryKey: policiesQueryKey,
    canEdit: experience.canEditPolicies,
    canPublish: experience.canPublishPolicies,
  };
  const isImpactSourceCurrent = (policy: ApprovalPolicy) => {
    const current = sourceState.current;
    const state = queryClient.getQueryState<ApprovalPolicy[]>(current.queryKey);
    const latest = state?.data?.find((candidate) => candidate.policyId === policy.policyId);
    return Boolean(
      current.scopeReady &&
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      !state.error &&
      latest &&
      approvalPolicyImpactSourceIdentity(latest) === approvalPolicyImpactSourceIdentity(policy)
    );
  };
  const originalIsCurrent = (
    origin: ApprovalManagementScopedCommand<ApprovalPolicy> | null,
    publish = false
  ) => {
    const current = sourceState.current;
    const state = queryClient.getQueryState<ApprovalPolicy[]>(current.queryKey);
    return Boolean(
      origin &&
      commandScope.isCurrent(origin) &&
      current.scopeReady &&
      (publish ? current.canPublish : current.canEdit) &&
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      !state.error &&
      isApprovalPolicySourceCurrent(
        origin.input,
        state.data?.find((policy) => policy.policyId === origin.input.policyId)
      )
    );
  };
  const requireOriginal = (
    origin: ApprovalManagementScopedCommand<ApprovalPolicy> | null,
    publish = false
  ) => {
    if (!originalIsCurrent(origin, publish))
      throw new HttpError('Approval policy source changed before dispatch.', 409);
  };

  useEffect(() => {
    const available = policies.data ?? [];
    if (available.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !available.some((policy) => policy.policyId === selectedId)) {
      setSelectedId(available[0].policyId);
    }
  }, [policies.data, selectedId]);

  const runUpdate = useApprovalGovernedMutation('route.approvals.admin.policy-update.action');
  const highRiskPublish = useApprovalManagementHighRiskCommand({
    cacheKey: requestScope.cacheKey,
    operation: 'POLICY_PUBLISH',
    execute: (command, execution) => {
      const source = publishSource.current;
      if (
        !source ||
        source.origin.input.policyId !== command.targetId ||
        source.origin.input.version !== command.expectedObjectVersion ||
        source.comment !== command.payload.reviewComment
      ) {
        throw new HttpError('Approval policy review source changed.', 409);
      }
      requireOriginal(source.origin, true);
      return publishApprovalPolicy(
        command.targetId,
        {
          expectedVersion: command.expectedObjectVersion,
          reviewComment: String(command.payload.reviewComment ?? ''),
        },
        execution,
        { beforeDispatch: () => requireOriginal(source.origin, true) }
      );
    },
    onSuccess: (result, command, binding) => {
      if (!commandScope.isCurrent(binding)) return;
      queryClient.setQueryData(policiesQueryKey, result);
      if (command.targetId) {
        void queryClient.invalidateQueries({
          queryKey: [
            'approvals',
            'admin',
            'policies',
            command.targetId,
            'versions',
            ...requestScope.cacheKey,
          ],
          exact: true,
        });
      }
      setReviewOpen(false);
      setReviewComment('');
      setReviewOrigin(null);
      publishSource.current = null;
      toast.success(t('admin.studio.policyPublished'));
    },
    onConflict: async (_command, binding) => {
      if (!commandScope.isCurrent(binding)) return;
      await queryClient.invalidateQueries({ queryKey: policiesQueryKey, exact: true });
    },
  });
  const { close: closeHighRiskPublish } = highRiskPublish.controller;
  const resetScopeState = useCallback(() => {
    setSelectedId(null);
    setEditorOpen(false);
    setDraft(null);
    setReviewOpen(false);
    setReviewComment('');
    setDraftOrigin(null);
    setReviewOrigin(null);
    publishSource.current = null;
    closeHighRiskPublish();
  }, [closeHighRiskPublish]);
  useApprovalManagementScopeReset(requestScope.cacheKey, resetScopeState);

  const save = useMutation({
    mutationFn: (
      command: ApprovalManagementScopedCommand<{
        policyId: string;
        expectedVersion: number;
        draft: ApprovalPolicyDraft;
        origin: ApprovalManagementScopedCommand<ApprovalPolicy>;
      }>
    ) => {
      if (!isApprovalPolicyDraftValid(command.input.draft)) {
        throw new Error('approval-policy-draft-invalid');
      }
      return commandScope.run(command, ({ policyId, expectedVersion, draft: input, origin }) => {
        requireOriginal(origin);
        return runUpdate((execution) => {
          requireOriginal(origin);
          return updateApprovalPolicy(
            policyId,
            {
              enforcementMode: input.enforcementMode,
              severity: input.severity,
              lifecycleState: input.lifecycleState,
              rule: approvalPolicyRuleInput(input.rules),
              changeReason: input.changeReason,
              expectedVersion,
            },
            execution,
            { beforeDispatch: () => requireOriginal(origin) }
          );
        });
      });
    },
    onSuccess: ({ command, value }) => {
      if (!commandScope.isCurrent(command)) return;
      queryClient.setQueryData(policiesQueryKey, value);
      setEditorOpen(false);
      setDraft(null);
      setDraftOrigin(null);
      toast.success(t('admin.studio.policySubmitted'));
    },
    onError: (error, command) => {
      if (!commandScope.isCurrent(command)) return;
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveConflict'));
      }
    },
  });

  const openEditor = () => {
    if (!selected || !sourceReady || !experience.canEditPolicies) return;
    setDraftOrigin(commandScope.capture(structuredClone(selected)));
    setDraft(createApprovalPolicyEditDraft(selected));
    setEditorOpen(true);
  };
  const openReview = () => {
    if (
      !sourceReady ||
      !selected?.pendingReview ||
      makerBlocked ||
      versions.isLoading ||
      versions.isError ||
      versions.isFetching
    )
      return;
    setReviewOrigin(commandScope.capture(structuredClone(selected)));
    setReviewComment('');
    setReviewOpen(true);
  };
  const beginPublish = () => {
    const latest = reviewOrigin?.input ?? null;
    if (
      !originalIsCurrent(reviewOrigin, true) ||
      !latest?.pendingReview ||
      isApprovalPolicyMakerBlocked(latest, actorId) ||
      reviewComment.trim().length < 10
    ) {
      return;
    }
    setReviewOpen(false);
    publishSource.current = { origin: reviewOrigin!, comment: reviewComment };
    void highRiskPublish.begin(
      approvalPolicyPublishCommand(latest.policyId, latest.version, reviewComment)
    );
  };
  const saveDraft = () => {
    if (
      !draftOrigin ||
      !originalIsCurrent(draftOrigin) ||
      !draft ||
      !isApprovalPolicyDraftValid(draft)
    )
      return;
    save.mutate(
      commandScope.capture({
        policyId: draftOrigin.input.policyId,
        expectedVersion: draftOrigin.input.version,
        origin: draftOrigin,
        draft: { ...draft, rules: draft.rules.map((entry) => ({ ...entry })) },
      })
    );
  };

  if (!scopeReady) {
    return (
      <ErrorState title={t('admin.loadError')} description={t('pages.policies.description')} />
    );
  }

  if (policies.isPending) {
    return (
      <LoadingState
        label={t('pages.policies.title')}
        description={t('pages.policies.description')}
        variant="skeleton"
        skeletonRows={5}
      />
    );
  }

  if (policies.isError) {
    return (
      <ErrorState
        title={t('admin.loadError')}
        retryLabel={t('actions.retry')}
        retrying={policies.isFetching}
        onRetry={() => void policies.refetch()}
      />
    );
  }

  return (
    <>
      <ApprovalPolicySummary policies={policies.data} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            md: '240px minmax(0,1fr)',
            lg: '280px minmax(0,1fr) 280px',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ApprovalPolicySection
          title={t('admin.policies.title')}
          meta={t('admin.policies.meta')}
          action={
            <Stack direction="row" gap={1} alignItems="center">
              <Chip size="small" label={policies.data.length} />
              {experience.canEditPolicies ? (
                <ActionIconButton
                  label={t('admin.policyCreate.open')}
                  intent="primary"
                  disabled={!policyCreate.createEnabled}
                  onClick={policyCreate.openCreate}
                >
                  <Plus size={16} />
                </ActionIconButton>
              ) : null}
              <ActionIconButton
                label={t('actions.refresh')}
                loading={policies.isFetching}
                onClick={() => void policies.refetch()}
              >
                <RefreshCcw size={16} />
              </ActionIconButton>
            </Stack>
          }
        >
          <Box sx={{ display: { xs: 'block', md: 'none' }, py: 1.5 }}>
            <SelectField
              aria-label={t('admin.policies.title')}
              value={selectedId ?? ''}
              options={policies.data.map((policy) => ({
                value: policy.policyId,
                label:
                  resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko'
                    ? policy.nameKo
                    : policy.nameEn,
              }))}
              onValueChange={(id) => setSelectedId(id || null)}
            />
          </Box>
          <Stack
            component="ul"
            sx={{ m: 0, p: 0, listStyle: 'none', display: { xs: 'none', md: 'flex' } }}
          >
            {policies.data.map((policy) => (
              <ApprovalPolicyListItem
                key={policy.policyId}
                policy={policy}
                selected={policy.policyId === selectedId}
                locale={i18n.resolvedLanguage}
                onSelect={() => setSelectedId(policy.policyId)}
              />
            ))}
          </Stack>
        </ApprovalPolicySection>

        {!selected ? (
          <EmptyState
            title={t('admin.studio.noPolicy')}
            description={t('admin.studio.noPolicyDescription')}
            icon={<ShieldCheck size={24} />}
          />
        ) : (
          <>
            <ApprovalPolicyDetail
              policy={selected}
              publishedVersionLabel={publishedVersionLabel}
              locale={i18n.resolvedLanguage}
            />
            <Box sx={{ minWidth: 0, gridColumn: { md: 2, lg: 'auto' } }}>
              <ApprovalPolicyInspector
                policy={selected}
                versions={versions.data}
                versionsLoading={versions.isLoading}
                versionsError={versions.isError}
                versionsFetching={versions.isFetching}
                publishedVersionLabel={publishedVersionLabel}
                locale={i18n.resolvedLanguage}
                canEdit={sourceReady && experience.canEditPolicies}
                canReview={
                  sourceReady &&
                  !versions.isFetching &&
                  selected.pendingReview &&
                  experience.canPublishPolicies
                }
                makerBlocked={makerBlocked}
                onEdit={openEditor}
                onReview={openReview}
                onRetryVersions={() => void versions.refetch()}
                impact={
                  <ApprovalPolicyImpactPanel
                    key={selected.policyId}
                    policy={selected}
                    sourceReady={sourceReady}
                    isSourceCurrent={isImpactSourceCurrent}
                  />
                }
              />
            </Box>
          </>
        )}
      </Box>

      <ApprovalPolicyEditorDialog
        open={editorOpen}
        draft={draft}
        busy={save.isPending}
        sourceReady={originalIsCurrent(draftOrigin)}
        onRefreshSource={() => void policies.refetch()}
        onChange={setDraft}
        onClose={() => {
          setEditorOpen(false);
          setDraft(null);
        }}
        onSave={saveDraft}
      />
      <ApprovalPolicyReviewDialog
        open={reviewOpen}
        policy={reviewOrigin?.input ?? null}
        reviewComment={reviewComment}
        busy={highRiskPublish.controller.busy}
        sourceReady={
          originalIsCurrent(reviewOrigin, true) && !versions.isFetching && !versions.isError
        }
        onRefreshSource={() => {
          void policies.refetch();
          void versions.refetch();
        }}
        onReviewCommentChange={setReviewComment}
        onClose={() => {
          setReviewOpen(false);
          setReviewComment('');
        }}
        onPublish={beginPublish}
      />
      <ApprovalPolicyCreateDialog
        open={policyCreate.open}
        draft={policyCreate.draft}
        validation={policyCreate.validation}
        problem={policyCreate.problem}
        busy={policyCreate.busy}
        locked={policyCreate.locked}
        canSubmit={policyCreate.canSubmit}
        canRetry={policyCreate.canRetry}
        canEditPreserved={policyCreate.canEditPreserved}
        onChange={policyCreate.setDraft}
        onClose={policyCreate.close}
        onSubmit={policyCreate.submit}
        onRetryOriginal={policyCreate.retryOriginal}
        onEditPreserved={policyCreate.editPreserved}
        onRefreshSource={policyCreate.refreshSource}
      />
      <ApprovalHighRiskCommandDialog controller={highRiskPublish.controller} />
    </>
  );
}
