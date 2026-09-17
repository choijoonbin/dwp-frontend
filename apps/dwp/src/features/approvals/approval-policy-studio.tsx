import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Clock3,
  Layers3,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShieldX,
  UserRoundCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIconButton,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  getApprovalPolicies,
  getApprovalPolicyVersions,
  publishApprovalPolicy,
  updateApprovalPolicy,
  HttpError,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

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
  parseApprovalPolicyProjection,
  parseApprovalPolicyVersionProjection,
} from './approval-policy-model';
import {
  ApprovalPolicyDetail,
  ApprovalPolicyInspector,
  ApprovalPolicyListItem,
} from './approval-policy-workspace';
import { ApprovalPolicySection } from './approval-policy-presentation';
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
import { StatusChip } from './approval-ui';

import type {
  ApprovalOversightPolicy,
  ApprovalOversightPolicyVersion,
  ApprovalPolicyDraft,
  ApprovalPolicyProjection,
} from './approval-policy-model';
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
  const policyProjection = useMemo(() => {
    if (!policies.data) return null;
    try {
      return parseApprovalPolicyProjection(
        policies.data,
        experience.canEditPolicies || experience.canPublishPolicies ? 'full' : 'oversight'
      );
    } catch {
      return null;
    }
  }, [experience.canEditPolicies, experience.canPublishPolicies, policies.data]);
  const projectionInvalid = policies.isSuccess && policyProjection === null;
  const policyRows = useMemo(() => policyProjection?.policies ?? [], [policyProjection]);
  const selectedMetadata = policyRows.find((policy) => policy.policyId === selectedId) ?? null;
  const fullPolicies = policyProjection?.kind === 'full' ? policyProjection.policies : [];
  const selected = fullPolicies.find((policy) => policy.policyId === selectedId) ?? null;
  const selectedOversight =
    policyProjection?.kind === 'oversight'
      ? (policyProjection.policies.find((policy) => policy.policyId === selectedId) ?? null)
      : null;
  const versions = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'policies',
      selectedId,
      'versions',
      policyProjection?.kind,
      ...requestScope.cacheKey,
    ],
    queryFn: async ({ signal }) =>
      parseApprovalPolicyVersionProjection(
        await getApprovalPolicyVersions(selectedId!, requestScope.contextScopeKey, signal),
        policyProjection!.kind
      ),
    enabled: scopeReady && Boolean(selectedId) && policyProjection !== null,
    staleTime: 30_000,
    retry: 1,
  });
  const actorId = requestScope.cacheKey[1];
  const makerBlocked = isApprovalPolicyMakerBlocked(selected, actorId);
  const publishedVersion = versions.data?.versions[0]?.versionNumber ?? null;
  const publishedVersionLabel = versions.isError
    ? t('admin.studio.policyVersionUnavailable')
    : versions.isLoading
      ? t('admin.studio.policyVersionLoading')
      : publishedVersion === null
        ? t('admin.studio.unpublishedVersion')
        : `v${publishedVersion}`;
  const sourceReady =
    scopeReady &&
    policies.isSuccess &&
    !policies.isFetching &&
    policies.failureCount === 0 &&
    policyProjection?.kind === 'full';
  const policyCreate = useApprovalPolicyCreate({
    requestScope,
    scopeReady,
    sourceReady,
    canCreate: experience.canEditPolicies,
    policies: fullPolicies,
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
    let latest: ApprovalPolicy | undefined;
    try {
      const projection = parseApprovalPolicyProjection(state?.data, 'full');
      if (projection.kind === 'full') {
        latest = projection.policies.find((candidate) => candidate.policyId === policy.policyId);
      }
    } catch {
      latest = undefined;
    }
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
    let latest: ApprovalPolicy | undefined;
    try {
      const projection = parseApprovalPolicyProjection(state?.data, 'full');
      if (projection.kind === 'full') {
        latest = projection.policies.find((policy) => policy.policyId === origin?.input.policyId);
      }
    } catch {
      latest = undefined;
    }
    return Boolean(
      origin &&
      commandScope.isCurrent(origin) &&
      current.scopeReady &&
      (publish ? current.canPublish : current.canEdit) &&
      state?.status === 'success' &&
      state.fetchStatus === 'idle' &&
      !state.error &&
      isApprovalPolicySourceCurrent(origin.input, latest)
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
    const available = policyRows;
    if (available.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !available.some((policy) => policy.policyId === selectedId)) {
      setSelectedId(available[0].policyId);
    }
  }, [policyRows, selectedId]);

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
            'full',
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

  if (policies.isError || projectionInvalid || !policyProjection) {
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
      <ApprovalPolicyMetadataSummary policies={policyRows} />
      {policyProjection.kind === 'oversight' ? (
        <InlineFeedback severity="info" sx={{ mb: 2 }}>
          {t('admin.studio.readOnly')}
        </InlineFeedback>
      ) : null}
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
              <Chip size="small" label={policyRows.length} />
              {policyProjection.kind === 'full' && experience.canEditPolicies ? (
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
              options={policyRows.map((policy) => ({
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
            {policyProjection.kind === 'full'
              ? policyProjection.policies.map((policy) => (
                  <ApprovalPolicyListItem
                    key={policy.policyId}
                    policy={policy}
                    selected={policy.policyId === selectedId}
                    locale={i18n.resolvedLanguage}
                    onSelect={() => setSelectedId(policy.policyId)}
                  />
                ))
              : policyProjection.policies.map((policy) => (
                  <ApprovalOversightPolicyListItem
                    key={policy.policyId}
                    policy={policy}
                    selected={policy.policyId === selectedId}
                    locale={i18n.resolvedLanguage}
                    onSelect={() => setSelectedId(policy.policyId)}
                  />
                ))}
          </Stack>
        </ApprovalPolicySection>

        {!selectedMetadata ? (
          <EmptyState
            title={t('admin.studio.noPolicy')}
            description={t('admin.studio.noPolicyDescription')}
            icon={<ShieldCheck size={24} />}
          />
        ) : policyProjection.kind === 'oversight' && selectedOversight ? (
          <ApprovalOversightPolicyWorkspace
            policy={selectedOversight}
            versions={versions.data?.kind === 'oversight' ? versions.data.versions : undefined}
            versionsLoading={versions.isLoading}
            versionsError={versions.isError}
            versionsFetching={versions.isFetching}
            locale={i18n.resolvedLanguage}
            onRetryVersions={() => void versions.refetch()}
          />
        ) : selected ? (
          <>
            <ApprovalPolicyDetail
              policy={selected}
              publishedVersionLabel={publishedVersionLabel}
              locale={i18n.resolvedLanguage}
            />
            <Box sx={{ minWidth: 0, gridColumn: { md: 2, lg: 'auto' } }}>
              <ApprovalPolicyInspector
                policy={selected}
                versions={versions.data?.kind === 'full' ? [...versions.data.versions] : undefined}
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
        ) : null}
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

function ApprovalPolicyMetadataSummary({
  policies,
}: {
  policies: ApprovalPolicyProjection['policies'];
}) {
  const { t } = useTranslation('approvals');
  const signals = [
    ['totalPolicies', policies.length, Layers3, 'primary.main'],
    [
      'pendingReviews',
      policies.filter((policy) => policy.pendingReview).length,
      UserRoundCheck,
      'warning.main',
    ],
    [
      'blockingPolicies',
      policies.filter((policy) => policy.enforcementMode === 'BLOCK').length,
      ShieldX,
      'error.main',
    ],
    [
      'activePolicies',
      policies.filter((policy) => policy.lifecycleState === 'ACTIVE').length,
      ShieldCheck,
      'success.main',
    ],
    [
      'slaPolicies',
      policies.filter((policy) => policy.policyType === 'SLA').length,
      Clock3,
      'info.main',
    ],
  ] as const;
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        py: 2,
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(5,minmax(0,1fr))' },
        gap: 1.5,
      }}
    >
      {signals.map(([key, count, Icon, color]) => (
        <Box
          key={key}
          sx={{
            minWidth: 0,
            p: 1.5,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Stack component="dt" direction="row" justifyContent="space-between" gap={1}>
            <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t(`admin.studio.workspace.${key}`)}
            </Box>
            <Box sx={{ color, display: 'flex', flexShrink: 0 }}>
              <Icon size={18} aria-hidden="true" />
            </Box>
          </Stack>
          <Box component="dd" sx={{ m: 0, mt: 0.75, typography: 'h4' }}>
            {count}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ApprovalOversightPolicyListItem({
  policy,
  selected,
  locale,
  onSelect,
}: {
  policy: ApprovalOversightPolicy;
  selected: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        sx={(theme) => ({
          width: 1,
          minHeight: 96,
          p: 1.5,
          display: 'block',
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          borderInlineStart: 3,
          borderInlineStartColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
        })}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Chip size="small" variant="outlined" label={policy.severity} />
          <StatusChip status={policy.pendingReview ? 'ATTENTION' : policy.lifecycleState} />
        </Stack>
        <Box
          sx={{
            mt: 1,
            typography: 'body2',
            fontWeight: 'fontWeightBold',
            overflowWrap: 'anywhere',
          }}
        >
          {korean ? policy.nameKo : policy.nameEn}
        </Box>
        <Box
          sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {policy.policyKey}
        </Box>
        <Box sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary' }}>
          {t(`admin.studio.policyTypes.${policy.policyType}`, { defaultValue: policy.policyType })}
        </Box>
      </ButtonBase>
    </Box>
  );
}

function ApprovalOversightPolicyWorkspace({
  policy,
  versions,
  versionsLoading,
  versionsError,
  versionsFetching,
  locale,
  onRetryVersions,
}: {
  policy: ApprovalOversightPolicy;
  versions: readonly ApprovalOversightPolicyVersion[] | undefined;
  versionsLoading: boolean;
  versionsError: boolean;
  versionsFetching: boolean;
  locale?: string;
  onRetryVersions: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const displayLocale = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language);
  const korean = displayLocale === 'ko';
  const rows = [
    [t('admin.studio.enforcement'), policy.enforcementMode],
    [t('admin.studio.severity'), policy.severity],
    [t('admin.studio.lifecycle'), policy.lifecycleState],
    [t('admin.studio.policyVersion'), String(policy.version)],
  ];
  return (
    <>
      <Stack gap={2} minWidth={0}>
        <Box component="header" sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <StatusChip status={policy.lifecycleState} />
            <Chip size="small" variant="outlined" label={t('admin.studio.readOnly')} />
          </Stack>
          <Box component="h2" sx={{ m: 0, mt: 1, typography: 'h5', overflowWrap: 'anywhere' }}>
            {korean ? policy.nameKo : policy.nameEn}
          </Box>
          <Box
            sx={{ mt: 1, typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
          >
            {policy.policyKey}
          </Box>
        </Box>
        <ApprovalPolicySection title={t('admin.studio.readOnly')}>
          <Box component="dl" sx={{ m: 0, py: 1 }}>
            {rows.map(([label, value]) => (
              <Stack
                key={label}
                direction="row"
                justifyContent="space-between"
                gap={2}
                sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {label}
                </Box>
                <Box component="dd" sx={{ m: 0, typography: 'body2', overflowWrap: 'anywhere' }}>
                  {value}
                </Box>
              </Stack>
            ))}
            {policy.pendingAt ? (
              <Stack direction="row" justifyContent="space-between" gap={2} sx={{ py: 1 }}>
                <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
                  {t('admin.studio.workspace.requestedAt')}
                </Box>
                <Box component="dd" sx={{ m: 0, typography: 'body2' }}>
                  {formatDate(
                    policy.pendingAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    displayLocale
                  )}
                </Box>
              </Stack>
            ) : null}
          </Box>
        </ApprovalPolicySection>
      </Stack>
      <Box sx={{ minWidth: 0, gridColumn: { md: 2, lg: 'auto' } }}>
        <ApprovalPolicySection
          title={t('admin.studio.historyTitle')}
          meta={t('admin.studio.historyMeta')}
        >
          {versionsError ? (
            <Box sx={{ py: 1.5 }}>
              <ErrorState
                title={t('admin.studio.historyLoadError')}
                retryLabel={t('actions.retry')}
                retrying={versionsFetching}
                onRetry={onRetryVersions}
                size="compact"
              />
            </Box>
          ) : versionsLoading ? (
            <LoadingState label={t('admin.studio.policyVersionLoading')} size="compact" />
          ) : (versions?.length ?? 0) === 0 ? (
            <EmptyState
              title={t('admin.studio.historyEmpty')}
              description={t('admin.studio.historyMeta')}
              icon={<Clock3 size={22} />}
            />
          ) : (
            <Stack component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {versions?.slice(0, 8).map((version) => (
                <Box
                  key={version.policyVersionId}
                  component="li"
                  sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    <Chip size="small" variant="outlined" label={`v${version.versionNumber}`} />
                    <StatusChip status={version.lifecycleState} />
                  </Stack>
                  <Box sx={{ mt: 0.75, typography: 'caption', color: 'text.secondary' }}>
                    {formatDate(
                      version.publishedAt,
                      { dateStyle: 'medium', timeStyle: 'short' },
                      displayLocale
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </ApprovalPolicySection>
      </Box>
    </>
  );
}
