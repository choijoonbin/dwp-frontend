import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock3, RefreshCw, ShieldCheck, TriangleAlert, X } from 'lucide-react';
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
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

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

export function ProviderOperations() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ProviderOperation | null>(null);
  const [filter, setFilter] = useState<'ACTIVE' | 'FAILED' | 'COMPLETED' | 'ALL'>('ALL');
  const [decision, setDecision] = useState<{
    approval: ProviderOperationApproval;
    value: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [busy, setBusy] = useState(false);
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
        width: 125,
        valueGetter: (_value, row) =>
          `${row.steps.filter((step) => step.lifecycleState === 'SUCCEEDED').length}/${row.steps.length}`,
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
  const metrics = [
    {
      label: t('operations.metrics.awaitingApproval'),
      value: pendingApprovals.length,
      icon: ShieldCheck,
    },
    {
      label: t('operations.metrics.running'),
      value: allOperations.filter((item) => item.lifecycleState === 'EXECUTING').length,
      icon: Clock3,
    },
    {
      label: t('operations.metrics.failed'),
      value: allOperations.filter((item) => ['FAILED', 'PARTIAL'].includes(item.lifecycleState))
        .length,
      icon: TriangleAlert,
    },
    {
      label: t('operations.metrics.completed'),
      value: allOperations.filter((item) => item.lifecycleState === 'SUCCEEDED').length,
      icon: Check,
    },
  ];

  return (
    <Stack gap={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        {metrics.map(({ label, value, icon: Icon }, index) => (
          <Box
            key={label}
            sx={{
              p: 1.75,
              borderLeft: { xs: index % 2 ? 1 : 0, lg: index ? 1 : 0 },
              borderTop: { xs: index > 1 ? 1 : 0, lg: 0 },
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
              <Icon size={16} />
              <Typography variant="caption">{label}</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('approvals.title')}
          description={t('approvals.description')}
          action={<Chip size="small" variant="outlined" label={pendingApprovals.length} />}
        />
        <Stack
          divider={<Divider flexItem />}
          sx={{ mt: 1.5, borderBlock: 1, borderColor: 'divider' }}
        >
          {pendingApprovals.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t('approvals.empty')}
            </Typography>
          ) : (
            pendingApprovals.map((approval) => (
              <Stack
                key={approval.operationApprovalId}
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                gap={{ xs: 1, md: 2 }}
                sx={{ py: 1.35 }}
              >
                <Chip size="small" color="warning" variant="outlined" label={approval.riskTier} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {t(`operationTypes.${approval.operationType}`, {
                      defaultValue: approval.operationType,
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {approval.tenantName ?? t('operations.notCreated')} / {approval.requestedByName}{' '}
                    / {approval.gateKey}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('approvals.expires', { value: formatProviderDate(approval.expiresAt) })}
                </Typography>
                {canApprove &&
                  approval.separationOfDuties &&
                  approval.requestedBy === operator.data?.operatorId && (
                    <Chip
                      size="small"
                      variant="outlined"
                      color="warning"
                      icon={<ShieldCheck size={15} />}
                      label={t('approvals.independentReviewerRequired')}
                    />
                  )}
                {canApprove &&
                  (!approval.separationOfDuties ||
                    approval.requestedBy !== operator.data?.operatorId) && (
                    <Stack direction="row" gap={0.5}>
                      <Button
                        size="small"
                        startIcon={<Check size={16} />}
                        onClick={() => setDecision({ approval, value: 'APPROVED' })}
                      >
                        {t('approvals.actions.APPROVED')}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<X size={16} />}
                        onClick={() => setDecision({ approval, value: 'REJECTED' })}
                      >
                        {t('approvals.actions.REJECTED')}
                      </Button>
                    </Stack>
                  )}
              </Stack>
            ))
          )}
        </Stack>
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('operations.title')}
          description={t('operations.description')}
          action={
            <Tooltip title={t('actions.refresh')}>
              <IconButton aria-label={t('actions.refresh')} onClick={() => void invalidate()}>
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          }
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_event, value: typeof filter | null) => value && setFilter(value)}
          aria-label={t('operations.filterLabel')}
          sx={{ mt: 1.5, mb: 1 }}
        >
          {['ACTIVE', 'FAILED', 'COMPLETED', 'ALL'].map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`operations.filters.${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
      </Box>

      {selected && (
        <ProviderOperationDialog
          operation={selected}
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
