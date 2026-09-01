import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, History, KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import {
  getApprovalPolicies,
  getApprovalPolicyVersions,
  publishApprovalPolicy,
  type ApprovalPolicy,
  updateApprovalPolicy,
  useToast,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { ApprovalSurface, StatusChip, approvalTone } from './approval-ui';
import { ApprovalHighRiskCommandDialog } from './approval-high-risk-command-dialog';
import { approvalPolicyPublishCommand } from './approval-high-risk-command-model';
import {
  useApprovalExperience,
  useApprovalManagementRequestScope,
} from './use-approval-experience';
import {
  isProductSurfaceOperationCancelledError,
  useApprovalGovernedMutation,
} from './use-approval-governed-mutation';
import { useApprovalHighRiskCommand } from './use-approval-high-risk-command';

type RuleEntry = { key: string; value: string };

const ENFORCEMENT_OPTIONS = ['BLOCK', 'WARN', 'MONITOR'].map((value) => ({
  value,
  label: value,
}));
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({
  value,
  label: value,
}));
const LIFECYCLE_OPTIONS = ['ACTIVE', 'DISABLED', 'RETIRED'].map((value) => ({
  value,
  label: value,
}));

function PolicyChangeComparison({ policy }: { policy: ApprovalPolicy }) {
  const { t } = useTranslation('approvals');
  const pendingRule = policy.pendingRule ?? {};
  const ruleKeys = Array.from(new Set([...Object.keys(policy.rule), ...Object.keys(pendingRule)]));
  const rows = [
    {
      key: 'enforcement',
      label: t('admin.studio.enforcement'),
      current: policy.enforcementMode,
      proposed: policy.pendingEnforcementMode ?? policy.enforcementMode,
    },
    {
      key: 'severity',
      label: t('admin.studio.severity'),
      current: policy.severity,
      proposed: policy.pendingSeverity ?? policy.severity,
    },
    {
      key: 'lifecycle',
      label: t('admin.studio.lifecycle'),
      current: policy.lifecycleState,
      proposed: policy.pendingLifecycleState ?? policy.lifecycleState,
    },
    ...ruleKeys.map((key) => ({
      key: `rule-${key}`,
      label: `${t('admin.studio.ruleValue')} · ${key}`,
      current: policy.rule[key],
      proposed: Object.hasOwn(pendingRule, key) ? pendingRule[key] : policy.rule[key],
    })),
  ];
  const renderValue = (value: unknown) =>
    typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—');

  return (
    <Box
      role="table"
      aria-label={t('admin.studio.changeComparison')}
      sx={{ borderTop: 1, borderColor: 'divider' }}
    >
      <Box
        role="row"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(150px,0.8fr) minmax(0,1fr) minmax(0,1fr)',
          gap: 1.5,
          px: 2,
          py: 1,
          bgcolor: 'action.hover',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography role="columnheader" variant="caption" fontWeight={740}>
          {t('admin.studio.changeField')}
        </Typography>
        <Typography role="columnheader" variant="caption" fontWeight={740}>
          {t('admin.studio.currentValue')}
        </Typography>
        <Typography role="columnheader" variant="caption" fontWeight={740}>
          {t('admin.studio.proposedValue')}
        </Typography>
      </Box>
      {rows.map((row) => {
        const changed = JSON.stringify(row.current) !== JSON.stringify(row.proposed);
        return (
          <Box
            role="row"
            key={row.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(120px,0.8fr) minmax(0,1fr) minmax(0,1fr)',
                sm: 'minmax(150px,0.8fr) minmax(0,1fr) minmax(0,1fr)',
              },
              gap: 1.5,
              minHeight: 52,
              px: 2,
              py: 1.1,
              alignItems: 'center',
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: changed ? alpha(approvalTone.amber, 0.06) : 'transparent',
            }}
          >
            <Typography role="cell" variant="body2" fontWeight={680}>
              {row.label}
            </Typography>
            <Typography
              role="cell"
              variant="body2"
              color="text.secondary"
              sx={{ wordBreak: 'break-word' }}
            >
              {renderValue(row.current)}
            </Typography>
            <Stack role="cell" direction="row" gap={0.75} alignItems="center" minWidth={0}>
              <Typography
                variant="body2"
                fontWeight={changed ? 720 : 400}
                sx={{ wordBreak: 'break-word' }}
              >
                {renderValue(row.proposed)}
              </Typography>
              {changed && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={t('admin.studio.changed')}
                />
              )}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

export function ApprovalPolicyStudio() {
  const { t, i18n } = useTranslation('approvals');
  const experience = useApprovalExperience();
  const requestScope = useApprovalManagementRequestScope();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState('BLOCK');
  const [severity, setSeverity] = useState('HIGH');
  const [state, setState] = useState('ACTIVE');
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const policiesQueryKey = ['approvals', 'admin', 'policies', ...requestScope.cacheKey] as const;
  const policies = useQuery({
    queryKey: policiesQueryKey,
    queryFn: ({ signal }) => getApprovalPolicies(requestScope.contextScopeKey, signal),
    staleTime: 30_000,
  });
  const versions = useQuery({
    queryKey: ['approvals', 'admin', 'policies', selectedId, 'versions', ...requestScope.cacheKey],
    queryFn: ({ signal }) =>
      getApprovalPolicyVersions(selectedId!, requestScope.contextScopeKey, signal),
    enabled: Boolean(selectedId),
    staleTime: 30_000,
    retry: 1,
  });
  const selected = useMemo(
    () => policies.data?.find((policy) => policy.policyId === selectedId) ?? null,
    [policies.data, selectedId]
  );
  const publishedVersion = versions.data?.[0]?.versionNumber ?? null;
  const publishedVersionLabel = versions.isError
    ? t('admin.studio.policyVersionUnavailable')
    : versions.isLoading
      ? t('admin.studio.policyVersionLoading')
      : publishedVersion === null
        ? t('admin.studio.unpublishedVersion')
        : `v${publishedVersion}`;
  const enumLabel = (group: 'policyTypes' | 'enforcementModes' | 'severities', value: string) =>
    t(`admin.studio.${group}.${value}`, { defaultValue: value });
  const evidenceText = (value: string) => {
    if (value === 'Initial governed policy baseline') {
      return t('admin.studio.initialPolicyEvidence.change');
    }
    if (value === 'Baseline captured during policy governance upgrade') {
      return t('admin.studio.initialPolicyEvidence.review');
    }
    return value;
  };
  useEffect(() => {
    if (!selectedId && policies.data?.length) setSelectedId(policies.data[0].policyId);
  }, [policies.data, selectedId]);

  const runUpdate = useApprovalGovernedMutation('route.approvals.admin.policy-update.action');
  const highRiskPublish = useApprovalHighRiskCommand({
    operation: 'POLICY_PUBLISH',
    execute: (command, execution) =>
      publishApprovalPolicy(
        command.targetId,
        {
          expectedVersion: command.expectedObjectVersion,
          reviewComment: String(command.payload.reviewComment ?? ''),
        },
        execution
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(policiesQueryKey, result);
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: ['approvals', 'admin', 'policies', selectedId, 'versions'],
        });
      }
      setReviewOpen(false);
      setReviewComment('');
      toast.success(t('admin.studio.policyPublished'));
    },
    onConflict: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approvals', 'admin', 'policies'] });
    },
  });

  const save = useMutation({
    mutationFn: () =>
      runUpdate((execution) =>
        updateApprovalPolicy(
          selected!.policyId,
          {
            enforcementMode: mode,
            severity,
            lifecycleState: state,
            rule: Object.fromEntries(
              rules.map((entry) => [entry.key, parseRuleValue(entry.value)])
            ),
            changeReason,
            expectedVersion: selected!.version,
          },
          execution
        )
      ),
    onSuccess: (result) => {
      queryClient.setQueryData(policiesQueryKey, result);
      setEditorOpen(false);
      setChangeReason('');
      toast.success(t('admin.studio.policySubmitted'));
    },
    onError: (error) => {
      if (!isProductSurfaceOperationCancelledError(error)) {
        toast.error(t('admin.studio.saveConflict'));
      }
    },
  });
  const openEditor = () => {
    if (!selected) return;
    setMode(selected.enforcementMode);
    setSeverity(selected.severity);
    setState(selected.lifecycleState);
    setRules(Object.entries(selected.rule).map(([key, value]) => ({ key, value: String(value) })));
    setChangeReason('');
    setEditorOpen(true);
  };

  if (policies.isError) return <Alert severity="error">{t('admin.loadError')}</Alert>;

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(270px, 0.8fr) minmax(0, 2.2fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ApprovalSurface
          title={t('admin.policies.title')}
          meta={t('admin.policies.meta')}
          action={<Chip size="small" label={policies.data?.length ?? 0} />}
        >
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {(policies.data ?? []).map((policy) => (
              <Box component="li" key={policy.policyId}>
                <ButtonBase
                  onClick={() => setSelectedId(policy.policyId)}
                  sx={{
                    width: 1,
                    minHeight: 76,
                    px: 2,
                    py: 1.25,
                    gap: 1.25,
                    display: 'flex',
                    textAlign: 'left',
                    borderBottom: 1,
                    borderColor: 'divider',
                    bgcolor:
                      policy.policyId === selectedId
                        ? alpha(approvalTone.primary, 0.08)
                        : 'transparent',
                    boxShadow:
                      policy.policyId === selectedId
                        ? `inset 3px 0 0 ${approvalTone.primary}`
                        : 'none',
                    '&:hover': { bgcolor: alpha(approvalTone.primary, 0.055) },
                  }}
                >
                  <ShieldCheck size={18} color={approvalTone.primary} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={750} noWrap>
                      {i18n.resolvedLanguage?.startsWith('ko') ? policy.nameKo : policy.nameEn}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {enumLabel('policyTypes', policy.policyType)}
                    </Typography>
                  </Box>
                  <StatusChip status={policy.lifecycleState} />
                </ButtonBase>
              </Box>
            ))}
          </Stack>
        </ApprovalSurface>

        {!selected ? (
          <EmptyState
            title={t('admin.studio.noPolicy')}
            description={t('admin.studio.noPolicyDescription')}
            icon={<ShieldCheck size={24} />}
          />
        ) : (
          <Stack gap={2} minWidth={0}>
            <Box
              component="section"
              sx={{
                p: { xs: 2, md: 2.5 },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                <Box minWidth={0}>
                  <Typography variant="overline" color="primary.main">
                    {enumLabel('policyTypes', selected.policyType)}
                  </Typography>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    <Typography component="h2" variant="h5">
                      {i18n.resolvedLanguage?.startsWith('ko') ? selected.nameKo : selected.nameEn}
                    </Typography>
                    <StatusChip status={selected.lifecycleState} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {selected.policyKey}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {experience.canEditPolicies && (
                    <ActionButton
                      intent="secondary"
                      startIcon={<SlidersHorizontal size={17} />}
                      onClick={openEditor}
                    >
                      {t('admin.studio.configurePolicy')}
                    </ActionButton>
                  )}
                  {selected.pendingReview && experience.canPublishPolicies && (
                    <ActionButton
                      intent="primary"
                      startIcon={<CheckCircle2 size={17} />}
                      disabled={versions.isLoading || versions.isError}
                      sx={{
                        bgcolor: approvalTone.primary,
                        transition: 'none',
                        '&:hover': { bgcolor: '#1F449E' },
                      }}
                      onClick={() => setReviewOpen(true)}
                    >
                      {t('admin.studio.reviewAndPublish')}
                    </ActionButton>
                  )}
                </Stack>
              </Stack>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {[
                [
                  t('admin.studio.enforcement'),
                  enumLabel('enforcementModes', selected.enforcementMode),
                ],
                [t('admin.studio.severity'), enumLabel('severities', selected.severity)],
                [t('admin.studio.policyVersion'), publishedVersionLabel],
              ].map(([label, value]) => (
                <Box
                  key={String(label)}
                  sx={{ p: 2, borderRight: { md: 1 }, borderColor: 'divider' }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography component="p" variant="h6" sx={{ mt: 0.4 }}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <ApprovalSurface title={t('admin.studio.ruleTitle')} meta={t('admin.studio.ruleMeta')}>
              <Box component="dl" sx={{ m: 0 }}>
                {Object.entries(selected.rule).map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      minHeight: 64,
                      px: 2,
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px,0.7fr) minmax(0,1.3fr)' },
                      alignItems: 'center',
                      gap: 2,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography component="dt" variant="body2" fontWeight={720}>
                      {key}
                    </Typography>
                    <Typography component="dd" variant="body2" color="text.secondary" sx={{ m: 0 }}>
                      {String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </ApprovalSurface>
            {selected.pendingReview && (
              <ApprovalSurface
                title={t('admin.studio.pendingTitle')}
                meta={t('admin.studio.pendingMeta')}
              >
                <Stack gap={1.25} sx={{ p: 2 }}>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Chip size="small" color="warning" label={selected.pendingEnforcementMode} />
                    <Chip size="small" variant="outlined" label={selected.pendingSeverity} />
                    <Chip size="small" variant="outlined" label={selected.pendingLifecycleState} />
                  </Stack>
                  <Typography variant="body2">{selected.pendingChangeReason}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('admin.studio.pendingMaker', { userId: selected.pendingBy })}
                  </Typography>
                </Stack>
                <PolicyChangeComparison policy={selected} />
              </ApprovalSurface>
            )}
            <ApprovalSurface
              title={t('admin.studio.historyTitle')}
              meta={t('admin.studio.historyMeta')}
              action={<History size={17} />}
            >
              {versions.isError ? (
                <Alert
                  severity="error"
                  sx={{ m: 2 }}
                  action={
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={versions.isFetching}
                      onClick={() => void versions.refetch()}
                    >
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('admin.studio.historyLoadError')}
                </Alert>
              ) : (versions.data ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3 }}>
                  {t('admin.studio.historyEmpty')}
                </Typography>
              ) : (
                <Stack component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {(versions.data ?? []).slice(0, 8).map((version) => (
                    <Stack
                      component="li"
                      key={version.policyVersionId}
                      direction={{ xs: 'column', sm: 'row' }}
                      alignItems={{ sm: 'center' }}
                      gap={1.25}
                      sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                    >
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`v${version.versionNumber}`}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={720}>
                          {evidenceText(version.changeReason)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {evidenceText(version.reviewComment)}
                        </Typography>
                      </Box>
                      <Stack alignItems={{ sm: 'flex-end' }} gap={0.35}>
                        <Stack direction="row" gap={0.75}>
                          <StatusChip status={version.lifecycleState} />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={enumLabel('enforcementModes', version.enforcementMode)}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(
                            version.publishedAt,
                            {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            },
                            resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
                          )}
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              )}
            </ApprovalSurface>
            <Alert
              severity={selected.enforcementMode === 'BLOCK' ? 'warning' : 'info'}
              icon={<KeyRound size={18} />}
            >
              {t('admin.studio.policyChangeNotice')}
            </Alert>
          </Stack>
        )}
      </Box>

      <FormDialog
        open={editorOpen}
        title={t('admin.studio.configurePolicy')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('actions.save')}
        submittingLabel={t('actions.save')}
        busy={save.isPending}
        submitDisabled={changeReason.trim().length < 10}
        onClose={() => setEditorOpen(false)}
        onSubmit={() => save.mutate()}
        maxWidth="sm"
      >
        <Stack gap={2}>
          <Alert severity="warning">{t('admin.studio.policyReviewNotice')}</Alert>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' },
              gap: 1.25,
            }}
          >
            <SelectField
              label={t('admin.studio.enforcement')}
              value={mode}
              options={ENFORCEMENT_OPTIONS}
              onValueChange={(value) => value && setMode(value)}
            />
            <SelectField
              label={t('admin.studio.severity')}
              value={severity}
              options={SEVERITY_OPTIONS}
              onValueChange={(value) => value && setSeverity(value)}
            />
            <SelectField
              label={t('admin.studio.lifecycle')}
              value={state}
              options={LIFECYCLE_OPTIONS}
              onValueChange={(value) => value && setState(value)}
            />
          </Box>
          <Typography variant="subtitle2">{t('admin.studio.ruleTitle')}</Typography>
          {rules.map((entry, index) => (
            <Box
              key={entry.key}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                gap: 1.25,
              }}
            >
              <FormField label={t('admin.studio.ruleKey')} value={entry.key} disabled />
              <FormField
                label={t('admin.studio.ruleValue')}
                value={entry.value}
                onChange={(event) =>
                  setRules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value: event.target.value } : item
                    )
                  )
                }
              />
            </Box>
          ))}
          <FormField
            label={t('admin.studio.changeReason')}
            value={changeReason}
            onChange={(event) => setChangeReason(event.target.value)}
            multiline
            minRows={3}
            required
            supportingText={t('admin.studio.changeReasonHelp')}
          />
        </Stack>
      </FormDialog>

      <FormDialog
        open={reviewOpen}
        title={t('admin.studio.reviewAndPublish')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.studio.publishPolicy')}
        submittingLabel={t('admin.studio.publishPolicy')}
        busy={highRiskPublish.controller.busy}
        submitDisabled={reviewComment.trim().length < 10}
        onClose={() => setReviewOpen(false)}
        onSubmit={() => {
          if (!selected) return;
          setReviewOpen(false);
          void highRiskPublish.begin(
            approvalPolicyPublishCommand(selected.policyId, selected.version, reviewComment)
          );
        }}
        maxWidth="md"
      >
        <Stack gap={2}>
          <Alert severity="warning">{t('admin.studio.makerCheckerNotice')}</Alert>
          <Typography variant="body2">{selected?.pendingChangeReason}</Typography>
          {selected && <PolicyChangeComparison policy={selected} />}
          <FormField
            label={t('admin.studio.reviewComment')}
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            multiline
            minRows={3}
            required
            supportingText={t('admin.studio.reviewCommentHelp')}
          />
        </Stack>
      </FormDialog>
      <ApprovalHighRiskCommandDialog controller={highRiskPublish.controller} />
    </>
  );
}

function parseRuleValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return trimmed;
}
