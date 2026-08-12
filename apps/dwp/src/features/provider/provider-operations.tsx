import type { ReactNode } from 'react';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  Clock3,
  Globe2,
  Layers3,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideProviderOperationApproval,
  executeProviderOperation,
  getProviderOperatorProfile,
  listProviderOperationApprovals,
  listProviderOperations,
  listProviderTenants,
  retryProviderOperation,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DistributionBar,
  EnterpriseDataGrid,
  LiveStatus,
  OperationalContextBar,
  SignalMetric,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { GridColDef } from '@mui/x-data-grid';
import type { ProviderOperation, ProviderOperationApproval } from '@dwp-frontend/shared-utils';

import { ProviderOperationDialog } from './provider-operation-dialog';
import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

function ApprovalDecisionDialog({
  approval,
  decision,
  busy,
  onClose,
  onDecide,
}: {
  approval: ProviderOperationApproval;
  decision: 'APPROVED' | 'REJECTED';
  busy: boolean;
  onClose: () => void;
  onDecide: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(`approvals.dialog.${decision}.title`)}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight={750}>
              {t(`operationTypes.${approval.operationType}`, {
                defaultValue: approval.operationType,
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {approval.tenantName ?? t('operations.notCreated')} / {approval.riskTier} /{' '}
              {approval.gateKey}
            </Typography>
          </Box>
          <TextField
            required
            multiline
            minRows={3}
            label={t('approvals.fields.reason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('actions.cancel')}
        </Button>
        <Button
          variant="contained"
          color={decision === 'APPROVED' ? 'primary' : 'error'}
          startIcon={decision === 'APPROVED' ? <Check size={17} /> : <X size={17} />}
          disabled={busy || !reason.trim()}
          onClick={() => void onDecide(reason.trim())}
        >
          {t(`approvals.actions.${decision}`)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChangeSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <ProviderSectionHeading title={title} description={description} action={action} />
      <Box sx={{ mt: 1.75 }}>{children}</Box>
    </Paper>
  );
}

const operationFilters = ['ACTIVE', 'FAILED', 'COMPLETED', 'ALL'] as const;
type OperationFilter = (typeof operationFilters)[number];

export function ProviderOperations() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<ProviderOperation | null>(null);
  const [decision, setDecision] = useState<{
    approval: ProviderOperationApproval;
    value: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const requestedFilter = searchParams.get('state')?.toUpperCase();
  const filter: OperationFilter = operationFilters.includes(requestedFilter as OperationFilter)
    ? (requestedFilter as OperationFilter)
    : 'ALL';
  const setFilter = (value: OperationFilter) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'ALL') next.delete('state');
    else next.set('state', value.toLowerCase());
    setSearchParams(next, { replace: true });
  };
  const operations = useQuery({
    queryKey: ['provider', 'operations'],
    queryFn: listProviderOperations,
  });
  const approvals = useQuery({
    queryKey: ['provider', 'approvals'],
    queryFn: () => listProviderOperationApprovals(),
  });
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'operation-map'],
    queryFn: () => listProviderTenants({ page: 0, size: 100 }),
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const canExecute = operator.data?.permissions.includes('OPERATION_EXECUTE') ?? false;
  const canApprove = operator.data?.permissions.includes('CHANGE_APPROVE') ?? false;
  const tenantNames = useMemo(
    () =>
      new Map((tenants.data?.content ?? []).map((tenant) => [tenant.tenantId, tenant.displayName])),
    [tenants.data]
  );
  const visibleOperations = useMemo(
    () =>
      (operations.data?.content ?? []).filter((operation) => {
        if (filter === 'ALL') return true;
        if (filter === 'FAILED') return ['FAILED', 'PARTIAL'].includes(operation.lifecycleState);
        if (filter === 'COMPLETED')
          return ['SUCCEEDED', 'CANCELLED'].includes(operation.lifecycleState);
        return ['PREVIEWED', 'EXECUTING'].includes(operation.lifecycleState);
      }),
    [filter, operations.data]
  );
  const pendingApprovals = (approvals.data ?? []).filter(
    (approval) => approval.lifecycleState === 'PENDING'
  );
  const selectedApprovals = (approvals.data ?? []).filter(
    (approval) => approval.operationId === selected?.operationId
  );
  const selectedApprovalPending =
    selected?.lifecycleState === 'PREVIEWED' &&
    selected?.riskTier === 'L3' &&
    (selectedApprovals.length === 0 ||
      selectedApprovals.some((approval) => approval.lifecycleState !== 'APPROVED'));

  const columns = useMemo<GridColDef<ProviderOperation>[]>(
    () => [
      {
        field: 'operationType',
        headerName: t('operations.columns.operation'),
        minWidth: 230,
        flex: 1.2,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {t(`operationTypes.${row.operationType}`, { defaultValue: row.operationType })}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.operationId}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'tenantId',
        headerName: t('operations.columns.tenant'),
        minWidth: 185,
        flex: 0.8,
        valueGetter: (_value, row) =>
          row.tenantId
            ? (tenantNames.get(row.tenantId) ?? row.tenantId)
            : t('operations.notCreated'),
      },
      {
        field: 'riskTier',
        headerName: t('operations.columns.risk'),
        width: 90,
        renderCell: ({ value }) => (
          <Chip
            size="small"
            variant="outlined"
            color={value === 'L3' ? 'warning' : 'default'}
            label={String(value)}
          />
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('operations.columns.state'),
        width: 140,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
      {
        field: 'createdAt',
        headerName: t('operations.columns.created'),
        width: 180,
        valueFormatter: (value?: string | null) => formatProviderDate(value),
      },
      {
        field: 'steps',
        headerName: t('operations.columns.steps'),
        width: 170,
        sortable: false,
        renderCell: ({ row }) => {
          const succeeded = row.steps.filter((step) => step.lifecycleState === 'SUCCEEDED').length;
          const failed = row.steps.filter((step) =>
            ['FAILED', 'PARTIAL'].includes(step.lifecycleState)
          ).length;
          return (
            <Box sx={{ width: 1 }}>
              <Typography variant="caption" fontWeight={750}>
                {succeeded}/{row.steps.length}
              </Typography>
              <DistributionBar
                height={5}
                label={t('operations.stepProgress', {
                  completed: succeeded,
                  total: row.steps.length,
                  failed,
                })}
                segments={[
                  { key: 'completed', value: succeeded, color: foundationTokens.color.data.teal },
                  { key: 'failed', value: failed, color: foundationTokens.color.data.coral },
                  {
                    key: 'remaining',
                    value: Math.max(0, row.steps.length - succeeded - failed),
                    color: foundationTokens.color.data.cyan,
                  },
                ]}
              />
            </Box>
          );
        },
      },
    ],
    [t, tenantNames]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['provider'] });
  const execute = async (operation: ProviderOperation) => {
    setBusy(true);
    try {
      const next = await executeProviderOperation(operation);
      setSelected(next);
      toast.success(t('operations.executed'));
      await invalidate();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const retry = async (operation: ProviderOperation, justification: string) => {
    setBusy(true);
    try {
      const next = await retryProviderOperation(operation, justification);
      setSelected(next);
      toast.success(t('operations.retried'));
      await invalidate();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };
  const decide = async (reason: string) => {
    if (!decision) return;
    setBusy(true);
    try {
      await decideProviderOperationApproval(decision.approval, decision.value, reason);
      toast.success(t(`approvals.completed.${decision.value}`));
      setDecision(null);
      await invalidate();
    } catch (error) {
      toast.error(providerError(error, t('errors.operation')));
    } finally {
      setBusy(false);
    }
  };

  if (
    operations.isLoading ||
    approvals.isLoading ||
    tenants.isLoading ||
    (operator.isLoading && !operator.data)
  )
    return <ProviderLoading />;
  if (
    operations.isError ||
    approvals.isError ||
    tenants.isError ||
    (operator.isError && !operator.data)
  )
    return (
      <ProviderError
        error={operations.error ?? approvals.error ?? tenants.error ?? operator.error}
        onRetry={() =>
          void Promise.all([
            operations.refetch(),
            approvals.refetch(),
            tenants.refetch(),
            operator.refetch(),
          ])
        }
        retrying={
          operations.isFetching || approvals.isFetching || tenants.isFetching || operator.isFetching
        }
      />
    );

  const allOperations = operations.data?.content ?? [];
  const runningOperations = allOperations.filter((item) => item.lifecycleState === 'EXECUTING');
  const recoveryOperations = allOperations.filter((item) =>
    ['FAILED', 'PARTIAL'].includes(item.lifecycleState)
  );
  const completedOperations = allOperations.filter((item) =>
    ['SUCCEEDED', 'CANCELLED'].includes(item.lifecycleState)
  );
  const succeededOperations = allOperations.filter((item) => item.lifecycleState === 'SUCCEEDED');
  const previewedOperations = allOperations.filter((item) => item.lifecycleState === 'PREVIEWED');
  const successRate = completedOperations.length
    ? (succeededOperations.length / completedOperations.length) * 100
    : 0;
  const highRiskApprovals = pendingApprovals.filter((approval) =>
    ['L3', 'HIGH', 'CRITICAL'].includes(approval.riskTier)
  ).length;
  const controlState = recoveryOperations.length
    ? 'RECOVERY'
    : pendingApprovals.length
      ? 'APPROVAL'
      : runningOperations.length
        ? 'RUNNING'
        : 'CLEAR';
  const controlTone =
    controlState === 'RECOVERY' ? 'error' : controlState === 'CLEAR' ? 'success' : 'warning';
  const observedAt = Math.max(operations.dataUpdatedAt, approvals.dataUpdatedAt);
  const primaryRecovery = recoveryOperations[0];

  return (
    <Stack gap={2.5} sx={{ width: 1, maxWidth: 1600, mx: 'auto' }}>
      <OperationalContextBar
        label={t('operations.context.label')}
        items={[
          {
            label: t('operations.context.scope'),
            value: t('operations.context.global'),
            icon: <Globe2 size={16} />,
          },
          {
            label: t('operations.context.mode'),
            value: t('operations.context.governed'),
            icon: <ShieldCheck size={16} />,
          },
          {
            label: t('operations.context.coverage'),
            value: t('operations.context.coverageValue', {
              operations: allOperations.length,
              tenants: tenants.data?.content.length ?? 0,
            }),
            icon: <Layers3 size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={operations.isFetching || approvals.isFetching ? 'syncing' : 'live'}
            label={t(
              operations.isFetching || approvals.isFetching
                ? 'operations.live.syncing'
                : 'operations.live.live'
            )}
            detail={t('operations.context.lastLoaded', {
              value: formatProviderDate(new Date(observedAt).toISOString()),
            })}
            refreshLabel={t('actions.refresh')}
            refreshing={operations.isFetching || approvals.isFetching}
            onRefresh={() => void invalidate()}
          />
        }
      />

      <Paper
        component="section"
        variant="outlined"
        sx={(theme) => {
          const color = theme.palette[controlTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, md: 2.5 },
            py: { xs: 2, md: 2.25 },
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055),
            borderColor: alpha(color, 0.35),
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: color,
              content: '""',
            },
          };
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                flex: '0 0 38px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: `${controlTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {controlState === 'RECOVERY' ? (
                <TriangleAlert size={20} />
              ) : controlState === 'CLEAR' ? (
                <ShieldCheck size={20} />
              ) : (
                <Clock3 size={20} />
              )}
            </Box>
            <Box minWidth={0}>
              <Typography component="h2" variant="h5">
                {t(`operations.pulse.title.${controlState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`operations.pulse.detail.${controlState}`, {
                  approvals: pendingApprovals.length,
                  running: runningOperations.length,
                  recovery: recoveryOperations.length,
                })}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={pendingApprovals.length ? 'warning' : 'success'}
                  label={t('operations.pulse.approvals', { count: pendingApprovals.length })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={runningOperations.length ? 'info' : 'default'}
                  label={t('operations.pulse.running', { count: runningOperations.length })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={recoveryOperations.length ? 'error' : 'success'}
                  label={t('operations.pulse.recovery', { count: recoveryOperations.length })}
                />
              </Stack>
            </Box>
          </Stack>
          {(primaryRecovery || pendingApprovals.length > 0) && (
            <Button
              variant="contained"
              color={controlTone}
              startIcon={primaryRecovery ? <RotateCcw size={17} /> : <ShieldCheck size={17} />}
              onClick={() => {
                if (primaryRecovery) setSelected(primaryRecovery);
                else document.getElementById('provider-approval-queue')?.scrollIntoView();
              }}
              sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
            >
              {t(
                primaryRecovery ? 'operations.pulse.openRecovery' : 'operations.pulse.openApproval'
              )}
            </Button>
          )}
        </Stack>
      </Paper>

      <Box
        component="section"
        aria-label={t('operations.signals.label')}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        <SignalMetric
          label={t('operations.metrics.awaitingApproval')}
          value={pendingApprovals.length.toLocaleString()}
          detail={t('operations.signals.approvalDetail', { highRisk: highRiskApprovals })}
          icon={<ShieldCheck size={18} />}
          tone={pendingApprovals.length ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('operations.metrics.running')}
          value={runningOperations.length.toLocaleString()}
          detail={t('operations.signals.runningDetail', { previewed: previewedOperations.length })}
          icon={<Clock3 size={18} />}
          tone={runningOperations.length ? 'info' : 'neutral'}
        />
        <SignalMetric
          label={t('operations.metrics.failed')}
          value={recoveryOperations.length.toLocaleString()}
          detail={t('operations.signals.recoveryDetail')}
          icon={<TriangleAlert size={18} />}
          tone={recoveryOperations.length ? 'error' : 'success'}
        />
        <SignalMetric
          label={t('operations.signals.successRate')}
          value={completedOperations.length ? `${successRate.toFixed(1)}%` : '-'}
          detail={t('operations.signals.successRateDetail', {
            successful: succeededOperations.length,
            terminal: completedOperations.length,
          })}
          icon={<Check size={18} />}
          tone={completedOperations.length && successRate < 95 ? 'warning' : 'success'}
          progress={completedOperations.length ? successRate : undefined}
          progressLabel={
            completedOperations.length
              ? t('operations.signals.successProgress', { value: successRate.toFixed(1) })
              : undefined
          }
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(360px, 5fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <ChangeSection
          title={t('approvals.title')}
          description={t('approvals.description')}
          action={<Chip size="small" variant="outlined" label={pendingApprovals.length} />}
        >
          <Box id="provider-approval-queue" sx={{ scrollMarginTop: 96 }}>
            {pendingApprovals.length === 0 ? (
              <Stack direction="row" alignItems="center" gap={1.25} sx={{ py: 2 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 34,
                    height: 34,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    color: 'success.main',
                    bgcolor: 'action.hover',
                  }}
                >
                  <ShieldCheck size={18} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={750}>
                    {t('approvals.emptyTitle')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('approvals.empty')}
                  </Typography>
                </Box>
              </Stack>
            ) : (
              <Stack divider={<Divider flexItem />}>
                {pendingApprovals.map((approval) => {
                  const requesterBlocked =
                    approval.separationOfDuties &&
                    approval.requestedBy === operator.data?.operatorId;
                  return (
                    <Box key={approval.operationApprovalId} sx={{ py: 1.35 }}>
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        alignItems={{ md: 'flex-start' }}
                        gap={1.25}
                      >
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: 4,
                            minHeight: 48,
                            flex: '0 0 4px',
                            borderRadius: 0.5,
                            bgcolor: 'warning.main',
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
                            <Typography variant="body2" fontWeight={750}>
                              {t(`operationTypes.${approval.operationType}`, {
                                defaultValue: approval.operationType,
                              })}
                            </Typography>
                            <Chip
                              size="small"
                              color="warning"
                              variant="outlined"
                              label={approval.riskTier}
                            />
                            <Chip size="small" variant="outlined" label={approval.gateKey} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}>
                            {approval.requestReason}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 0.6, display: 'block' }}
                          >
                            {approval.tenantName ?? t('operations.notCreated')} ·{' '}
                            {approval.requestedByName} ·{' '}
                            {t('approvals.expires', {
                              value: formatProviderDate(approval.expiresAt),
                            })}
                          </Typography>
                        </Box>
                        {canApprove && requesterBlocked && (
                          <Chip
                            size="small"
                            variant="outlined"
                            color="warning"
                            icon={<ShieldCheck size={15} />}
                            label={t('approvals.independentReviewerRequired')}
                            sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                          />
                        )}
                        {canApprove && !requesterBlocked && (
                          <Stack
                            direction="row"
                            gap={0.5}
                            sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                          >
                            <ActionButton
                              intent="quiet"
                              size="small"
                              startIcon={<Check size={16} />}
                              onClick={() => setDecision({ approval, value: 'APPROVED' })}
                            >
                              {t('approvals.actions.APPROVED')}
                            </ActionButton>
                            <ActionButton
                              intent="danger"
                              size="small"
                              startIcon={<X size={16} />}
                              onClick={() => setDecision({ approval, value: 'REJECTED' })}
                            >
                              {t('approvals.actions.REJECTED')}
                            </ActionButton>
                          </Stack>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </ChangeSection>

        <ChangeSection
          title={t('operations.path.title')}
          description={t('operations.path.description')}
        >
          <Stack divider={<Divider flexItem />}>
            {[
              { key: 'PLAN', count: previewedOperations.length, icon: ListChecks },
              { key: 'GATE', count: pendingApprovals.length, icon: ShieldCheck },
              { key: 'EXECUTE', count: runningOperations.length, icon: Clock3 },
              { key: 'RECOVER', count: recoveryOperations.length, icon: RotateCcw },
            ].map(({ key, count, icon: Icon }, index) => (
              <Stack key={key} direction="row" alignItems="center" gap={1.25} sx={{ py: 1.05 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    color: count ? 'primary.main' : 'text.secondary',
                    bgcolor: count ? 'action.selected' : 'action.hover',
                  }}
                >
                  <Icon size={15} />
                </Box>
                <Box minWidth={0} flex={1}>
                  <Typography variant="body2" fontWeight={750}>
                    {index + 1}. {t(`operations.path.stages.${key}.title`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`operations.path.stages.${key}.detail`)}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </ChangeSection>
      </Box>

      <ChangeSection
        title={t('operations.title')}
        description={t('operations.description')}
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_event, value: OperationFilter | null) => value && setFilter(value)}
            aria-label={t('operations.filterLabel')}
          >
            {operationFilters.map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`operations.filters.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      >
        <EnterpriseDataGrid
          ariaLabel={t('operations.title')}
          rows={visibleOperations}
          columns={columns}
          getRowId={(row) => row.operationId}
          onRowClick={({ row }) => setSelected(row)}
          loading={operations.isFetching}
          hideFooter
          maxVisibleRows={12}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </ChangeSection>

      {selected && (
        <ProviderOperationDialog
          operation={selected}
          approvals={selectedApprovals}
          busy={busy}
          approvalPending={selectedApprovalPending}
          onClose={() => setSelected(null)}
          onExecute={canExecute && !selectedApprovalPending ? execute : undefined}
          onRetry={canExecute ? retry : undefined}
        />
      )}
      {decision && (
        <ApprovalDecisionDialog
          approval={decision.approval}
          decision={decision.value}
          busy={busy}
          onClose={() => setDecision(null)}
          onDecide={decide}
        />
      )}
    </Stack>
  );
}
