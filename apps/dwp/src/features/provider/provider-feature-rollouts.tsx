import type { ReactNode } from 'react';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Check,
  CirclePause,
  CirclePlay,
  Flag,
  GitPullRequestArrow,
  LockKeyhole,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  StepForward,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateProviderFeatureRollout,
  advanceProviderFeatureRollout,
  createProviderFeatureFlag,
  createProviderFeatureRollout,
  decideProviderFeatureRollout,
  getProviderOperatorProfile,
  listAllProviderTenants,
  listProviderFeatureFlags,
  listProviderFeatureRollouts,
  pauseProviderFeatureRollout,
  resumeProviderFeatureRollout,
  rollbackProviderFeatureRollout,
  submitProviderFeatureRollout,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  EmptyState,
  EnterpriseDataGrid,
  OperationalContextBar,
  SignalMetric,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type { ProviderFeatureRollout } from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
} from './provider-ui';
import {
  FeatureFlagDialog,
  FeatureRolloutActionDialog,
  FeatureRolloutDialog,
} from './provider-feature-rollout-dialogs';
import type { RolloutAction } from './provider-feature-rollout-dialogs';
import {
  canDecideFeatureRollout,
  featureRolloutStrategyPresentation,
  rolloutTargetingPresentation,
} from './provider-feature-rollout-form-model';
import { ProviderFeatureRolloutEvaluationPreview } from './provider-feature-rollout-evaluation-preview';
import { ProviderSettingsResolution } from './provider-settings-resolution';

function RolloutInspector({
  rollout,
  operatorId,
  canWrite,
  canApprove,
  onAction,
}: {
  rollout: ProviderFeatureRollout;
  operatorId?: number | null;
  canWrite: boolean;
  canApprove: boolean;
  onAction: (action: RolloutAction) => void;
}) {
  const { t } = useTranslation('provider');
  const activeStage = rollout.stages.find(
    (stage) => stage.stageOrder === rollout.currentStageOrder
  );
  const targeting = rolloutTargetingPresentation(rollout.targeting);
  const decisionAllowed = canDecideFeatureRollout(rollout, operatorId, canApprove);
  const actions: Array<{ action: RolloutAction; icon: ReactNode }> = [];
  if (canWrite && rollout.lifecycleState === 'DRAFT') {
    actions.push({ action: 'submit', icon: <Send size={16} /> });
  }
  if (decisionAllowed && rollout.lifecycleState === 'PENDING_APPROVAL') {
    actions.push({ action: 'approve', icon: <Check size={16} /> });
    actions.push({ action: 'reject', icon: <X size={16} /> });
  }
  if (canWrite && rollout.lifecycleState === 'APPROVED') {
    actions.push({ action: 'activate', icon: <CirclePlay size={16} /> });
  }
  if (canWrite && rollout.lifecycleState === 'ACTIVE') {
    actions.push({ action: 'pause', icon: <CirclePause size={16} /> });
    actions.push({ action: 'advance', icon: <StepForward size={16} /> });
  }
  if (canWrite && rollout.lifecycleState === 'PAUSED') {
    actions.push({ action: 'resume', icon: <CirclePlay size={16} /> });
  }
  if (
    canWrite &&
    canApprove &&
    ['ACTIVE', 'PAUSED', 'COMPLETED'].includes(rollout.lifecycleState)
  ) {
    actions.push({ action: 'rollback', icon: <RotateCcw size={16} /> });
  }

  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading
        title={rollout.name}
        description={`${rollout.featureKey} · ${t('featureRollouts.revision', {
          revision: rollout.revisionNumber,
        })}`}
        action={<ProviderStatusChip state={rollout.lifecycleState} />}
      />
      <Stack gap={2} sx={{ mt: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            size="small"
            variant="outlined"
            label={t(
              `featureRollouts.strategies.${featureRolloutStrategyPresentation(rollout.strategy)}`
            )}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t('featureRollouts.requester', { id: rollout.requestedBy })}
          />
          {rollout.approvedBy && (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={t('featureRollouts.approver', { id: rollout.approvedBy })}
            />
          )}
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            icon={<LockKeyhole size={14} />}
            label={t('featureRollouts.externalLocked')}
          />
        </Stack>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('featureRollouts.fields.targeting')}
          </Typography>
          {targeting === null ? (
            <Alert severity="warning" sx={{ mt: 0.75 }}>
              {t('featureRollouts.targetingUnavailable')}
            </Alert>
          ) : targeting.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('featureRollouts.targetingAll')}
            </Typography>
          ) : (
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.75 }}>
              {targeting.flatMap((group) =>
                group.values.map((value) => (
                  <Chip
                    key={`${group.key}:${value}`}
                    size="small"
                    variant="outlined"
                    label={t('featureRollouts.targetingValue', {
                      group: t(`featureRollouts.targeting.${group.key}`),
                      value,
                    })}
                  />
                ))
              )}
            </Stack>
          )}
        </Box>
        <Divider />
        <Box>
          <Typography variant="subtitle2">{t('featureRollouts.stagePlan')}</Typography>
          <Stack gap={1.25} sx={{ mt: 1 }}>
            {rollout.stages.map((stage) => (
              <Box key={stage.rolloutStageId}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" fontWeight={700}>
                    {stage.stageOrder}. {stage.stageName}
                  </Typography>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {t('featureRollouts.observation', {
                        minutes: stage.minimumObservationMinutes,
                      })}
                    </Typography>
                    <ProviderStatusChip state={stage.lifecycleState} />
                  </Stack>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={stage.exposurePercentage}
                  aria-label={t('featureRollouts.stageExposure', {
                    percentage: stage.exposurePercentage,
                  })}
                  sx={{ mt: 0.75, height: 6, borderRadius: 0.5 }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
        {activeStage && (
          <Alert severity="info">
            {t('featureRollouts.activeStage', {
              name: activeStage.stageName,
              percentage: activeStage.exposurePercentage,
            })}
          </Alert>
        )}
        {canApprove &&
          rollout.lifecycleState === 'PENDING_APPROVAL' &&
          !decisionAllowed &&
          operatorId === rollout.requestedBy && (
            <Alert severity="info">{t('featureRollouts.selfDecisionBlocked')}</Alert>
          )}
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {actions.map(({ action, icon }) => (
            <ActionButton
              key={action}
              intent={['reject', 'rollback'].includes(action) ? 'danger' : 'secondary'}
              startIcon={icon}
              onClick={() => onAction(action)}
            >
              {t(`featureRollouts.actions.${action}`)}
            </ActionButton>
          ))}
          {!actions.length && (
            <Typography variant="body2" color="text.secondary">
              {t('featureRollouts.noAvailableActions')}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

export function ProviderFeatureRollouts() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'flag' | 'rollout' | RolloutAction | null>(null);
  const flags = useQuery({
    queryKey: ['provider', 'feature-flags'],
    queryFn: listProviderFeatureFlags,
  });
  const rollouts = useQuery({
    queryKey: ['provider', 'feature-rollouts'],
    queryFn: () => listProviderFeatureRollouts(),
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const operatorReady = operator.isSuccess;
  const canReadEstate =
    operatorReady && (operator.data?.permissions.includes('ESTATE_READ') ?? false);
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'rollout-evaluation'],
    queryFn: listAllProviderTenants,
    enabled: canReadEstate,
  });
  const selected = (rollouts.data ?? []).find(
    (rollout) => rollout.rolloutRevisionId === selectedId
  );
  const canWrite =
    operatorReady && (operator.data?.permissions.includes('FEATURE_ROLLOUT_WRITE') ?? false);
  const canApprove =
    operatorReady && (operator.data?.permissions.includes('FEATURE_ROLLOUT_APPROVE') ?? false);
  const pendingCount = (rollouts.data ?? []).filter(
    (rollout) => rollout.lifecycleState === 'PENDING_APPROVAL'
  ).length;
  const activeCount = (rollouts.data ?? []).filter((rollout) =>
    ['ACTIVE', 'PAUSED'].includes(rollout.lifecycleState)
  ).length;
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['provider', 'feature-flags'] }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'feature-rollouts'] }),
      ]);
      setDialog(null);
      toast.success(t('featureRollouts.completed'));
    },
    onError: () => toast.error(t('errors.operation')),
  });

  const columns = useMemo<GridColDef<ProviderFeatureRollout>[]>(
    () => [
      {
        field: 'name',
        headerName: t('featureRollouts.columns.rollout'),
        minWidth: 280,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.75 }}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t('featureRollouts.revisionIdentity', {
                key: row.featureKey,
                revision: row.revisionNumber,
              })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'strategy',
        headerName: t('featureRollouts.columns.strategy'),
        minWidth: 150,
        valueFormatter: (value) =>
          t(`featureRollouts.strategies.${featureRolloutStrategyPresentation(String(value))}`),
      },
      {
        field: 'currentStageOrder',
        headerName: t('featureRollouts.columns.stage'),
        minWidth: 190,
        valueGetter: (_value, row) => {
          const stage = row.stages.find((item) => item.stageOrder === row.currentStageOrder);
          return stage ? `${stage.stageName} · ${stage.exposurePercentage}%` : t('notAvailable');
        },
      },
      {
        field: 'lifecycleState',
        headerName: t('featureRollouts.columns.state'),
        width: 150,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'submittedAt',
        headerName: t('featureRollouts.columns.updated'),
        width: 190,
        valueGetter: (_value, row) =>
          formatProviderDate(row.activatedAt ?? row.approvedAt ?? row.submittedAt),
      },
    ],
    [t]
  );

  if ((flags.isLoading || rollouts.isLoading || operator.isLoading) && !rollouts.data) {
    return <ProviderLoading />;
  }
  const firstError = flags.error ?? rollouts.error ?? operator.error;
  if (firstError && !rollouts.data) {
    return (
      <ProviderError
        error={firstError}
        onRetry={() => {
          void flags.refetch();
          void rollouts.refetch();
          void operator.refetch();
        }}
        retrying={flags.isFetching || rollouts.isFetching || operator.isFetching}
      />
    );
  }

  const runAction = async (
    action: RolloutAction,
    reason: string,
    health: Record<string, unknown>
  ) => {
    if (!selected) return;
    const work = () => {
      switch (action) {
        case 'submit':
          return submitProviderFeatureRollout(selected, reason);
        case 'approve':
          return decideProviderFeatureRollout(selected, 'APPROVED', reason);
        case 'reject':
          return decideProviderFeatureRollout(selected, 'REJECTED', reason);
        case 'activate':
          return activateProviderFeatureRollout(selected, reason);
        case 'pause':
          return pauseProviderFeatureRollout(selected, reason);
        case 'resume':
          return resumeProviderFeatureRollout(selected, reason);
        case 'advance':
          return advanceProviderFeatureRollout(selected, reason, health);
        case 'rollback':
          return rollbackProviderFeatureRollout(selected, reason);
      }
    };
    await mutation.mutateAsync(work);
  };

  return (
    <Stack gap={2.5}>
      <OperationalContextBar
        label={t('featureRollouts.contextLabel')}
        items={[
          {
            label: t('featureRollouts.context.registry'),
            value: t('featureRollouts.context.flagCount', { count: flags.data?.length ?? 0 }),
            icon: <Flag size={16} />,
          },
          {
            label: t('featureRollouts.context.evaluation'),
            value: t('featureRollouts.context.deterministic'),
            icon: <Activity size={16} />,
          },
          {
            label: t('featureRollouts.context.externalExecution'),
            value: t('featureRollouts.context.locked'),
            icon: <LockKeyhole size={16} />,
          },
        ]}
        actions={
          canWrite ? (
            <Stack direction="row" gap={1}>
              <ActionButton
                intent="secondary"
                startIcon={<Plus size={16} />}
                onClick={() => setDialog('flag')}
              >
                {t('featureRollouts.actions.newFlag')}
              </ActionButton>
              <ActionButton
                intent="primary"
                startIcon={<GitPullRequestArrow size={16} />}
                disabled={!flags.isSuccess || !flags.data.length}
                onClick={() => setDialog('rollout')}
              >
                {t('featureRollouts.actions.newRollout')}
              </ActionButton>
            </Stack>
          ) : undefined
        }
      />
      <Alert severity="info">{t('featureRollouts.distributionBoundary')}</Alert>
      {flags.isError && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void flags.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('featureRollouts.partial.flags')}
        </Alert>
      )}
      {rollouts.isError && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void rollouts.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('featureRollouts.partial.rollouts')}
        </Alert>
      )}
      {operator.isError && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void operator.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('featureRollouts.partial.operator')}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('featureRollouts.metrics.flags')}
          value={flags.isSuccess ? String(flags.data.length) : t('notAvailable')}
          detail={t('featureRollouts.metrics.flagsDetail')}
          icon={<Flag size={18} />}
        />
        <SignalMetric
          label={t('featureRollouts.metrics.pending')}
          value={String(pendingCount)}
          detail={t('featureRollouts.metrics.pendingDetail')}
          icon={<ShieldCheck size={18} />}
          tone={pendingCount > 0 ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('featureRollouts.metrics.running')}
          value={String(activeCount)}
          detail={t('featureRollouts.metrics.runningDetail')}
          icon={<Activity size={18} />}
          tone={activeCount > 0 ? 'info' : 'neutral'}
        />
      </Box>
      <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
        <ProviderSectionHeading
          title={t('featureRollouts.inventory.title')}
          description={t('featureRollouts.inventory.description')}
        />
        <Box sx={{ mt: 1.5 }}>
          {(rollouts.data ?? []).length ? (
            <EnterpriseDataGrid
              ariaLabel={t('featureRollouts.gridLabel')}
              rows={rollouts.data ?? []}
              columns={columns}
              getRowId={(row) => row.rolloutRevisionId}
              hideFooter
              rowHeight={58}
              minVisibleRows={3}
              maxVisibleRows={8}
              onRowClick={({ row }) => setSelectedId(row.rolloutRevisionId)}
              onCellKeyDown={(params, event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setSelectedId(params.row.rolloutRevisionId);
              }}
              getRowClassName={({ row }) =>
                row.rolloutRevisionId === selectedId ? 'Mui-selected' : ''
              }
            />
          ) : (
            <EmptyState
              title={t('featureRollouts.empty.title')}
              description={t('featureRollouts.empty.description')}
              action={
                canWrite ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<GitPullRequestArrow size={16} />}
                    disabled={!flags.isSuccess || !flags.data.length}
                    onClick={() => setDialog('rollout')}
                  >
                    {t('featureRollouts.actions.newRollout')}
                  </ActionButton>
                ) : undefined
              }
            />
          )}
        </Box>
      </Paper>
      {selected && (
        <RolloutInspector
          rollout={selected}
          operatorId={operator.data?.operatorId}
          canWrite={canWrite}
          canApprove={canApprove}
          onAction={setDialog}
        />
      )}
      <ProviderFeatureRolloutEvaluationPreview
        flags={flags.data ?? []}
        tenants={tenants.data?.content ?? []}
        canReadEstate={canReadEstate}
        tenantLoading={tenants.isLoading}
        tenantError={tenants.error}
        tenantReady={tenants.isSuccess}
        onTenantRetry={() => void tenants.refetch()}
      />
      <ProviderSettingsResolution
        tenants={tenants.data?.content ?? []}
        canReadEstate={canReadEstate}
        tenantLoading={tenants.isLoading}
        tenantError={tenants.error}
        onTenantRetry={() => void tenants.refetch()}
      />
      {dialog === 'flag' && canWrite && (
        <FeatureFlagDialog
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={async (request) => {
            await mutation.mutateAsync(() => createProviderFeatureFlag(request));
          }}
        />
      )}
      {dialog === 'rollout' && canWrite && flags.isSuccess && (
        <FeatureRolloutDialog
          flags={flags.data ?? []}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={async (featureKey, request) => {
            const created = await mutation.mutateAsync(() =>
              createProviderFeatureRollout(featureKey, request)
            );
            if (created && typeof created === 'object' && 'rolloutRevisionId' in created) {
              setSelectedId(String(created.rolloutRevisionId));
            }
          }}
        />
      )}
      {selected && dialog && !['flag', 'rollout'].includes(dialog) && (
        <FeatureRolloutActionDialog
          rollout={selected}
          action={dialog as RolloutAction}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSubmit={(reason, health) => runAction(dialog as RolloutAction, reason, health)}
        />
      )}
    </Stack>
  );
}
