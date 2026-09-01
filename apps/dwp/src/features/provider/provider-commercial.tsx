import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  CircleAlert,
  FileClock,
  GitCompareArrows,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import {
  createProviderSubscriptionRenewal,
  decideProviderSubscriptionRenewal,
  getProviderCommercialOverview,
  getProviderOperatorProfile,
  listProviderSubscriptionRenewals,
  publishProviderSubscriptionRenewal,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ProviderSubscriptionPortfolio,
  ProviderSubscriptionRenewalRevision,
} from '@dwp-frontend/shared-utils';

import {
  RenewalDecisionDialog,
  RenewalInspector,
  RenewalProposalDialog,
} from './provider-commercial-renewals';
import type { RenewalDecision } from './provider-commercial-renewals';
import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

export function ProviderCommercial() {
  const { t } = useTranslation('provider');
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [proposalSubscription, setProposalSubscription] =
    useState<ProviderSubscriptionPortfolio | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [decision, setDecision] = useState<RenewalDecision | null>(null);
  const [publishing, setPublishing] = useState(false);
  const commercial = useQuery({
    queryKey: ['provider', 'commercial'],
    queryFn: getProviderCommercialOverview,
  });
  const renewals = useQuery({
    queryKey: ['provider', 'subscription-renewals'],
    queryFn: listProviderSubscriptionRenewals,
  });
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const selectedRevision =
    (renewals.data ?? []).find((item) => item.renewalRevisionId === selectedRevisionId) ??
    renewals.data?.[0] ??
    null;
  const canWrite = operator.data?.permissions.includes('COMMERCIAL_WRITE') ?? false;
  const canApprove = operator.data?.permissions.includes('COMMERCIAL_APPROVE') ?? false;
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['provider', 'commercial'] }),
        queryClient.invalidateQueries({ queryKey: ['provider', 'subscription-renewals'] }),
      ]);
      setProposalSubscription(null);
      setDecision(null);
      setPublishing(false);
      toast.success(t('commercial.completed'));
    },
    onError: (error) => {
      setPublishing(false);
      toast.error(providerError(error, t('errors.operation')));
    },
  });

  const subscriptionColumns = useMemo<GridColDef<ProviderSubscriptionPortfolio>[]>(
    () => [
      {
        field: 'organizationName',
        headerName: t('commercial.columns.customer'),
        minWidth: 210,
        flex: 1,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.organizationName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.organizationKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'planName',
        headerName: t('commercial.columns.plan'),
        minWidth: 175,
        flex: 0.75,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" noWrap>
              {row.planName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {t(`tiers.${row.serviceTier}`, { defaultValue: row.serviceTier })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'contractReference',
        headerName: t('commercial.columns.contract'),
        minWidth: 150,
        flex: 0.65,
        valueFormatter: (value?: string | null) => value ?? t('commercial.noReference'),
      },
      {
        field: 'tenants',
        headerName: t('commercial.columns.tenants'),
        width: 100,
      },
      {
        field: 'activeEntitlements',
        headerName: t('commercial.columns.entitlements'),
        width: 115,
      },
      {
        field: 'endsAt',
        headerName: t('commercial.columns.renewal'),
        width: 175,
        valueFormatter: (value?: string | null) =>
          value ? formatProviderDate(value) : t('commercial.noEndDate'),
      },
      {
        field: 'actions',
        headerName: t('commercial.columns.actions'),
        width: 145,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) =>
          canWrite ? (
            <ActionButton
              size="small"
              intent="secondary"
              startIcon={<Plus size={15} />}
              onClick={(event) => {
                event.stopPropagation();
                setProposalSubscription(row);
              }}
            >
              {t('commercial.actions.propose')}
            </ActionButton>
          ) : null,
      },
    ],
    [canWrite, t]
  );

  const renewalColumns = useMemo<GridColDef<ProviderSubscriptionRenewalRevision>[]>(
    () => [
      {
        field: 'organizationName',
        headerName: t('commercial.columns.customer'),
        minWidth: 190,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.organizationName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {t('commercial.renewals.revision', { revision: row.revisionNumber })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'targetPlanName',
        headerName: t('commercial.renewals.columns.change'),
        minWidth: 210,
        flex: 1,
        valueGetter: (_value, row) => `${row.currentPlanName} → ${row.targetPlanName}`,
      },
      {
        field: 'impactedTenants',
        headerName: t('commercial.renewals.columns.impact'),
        width: 105,
      },
      {
        field: 'decisionDueAt',
        headerName: t('commercial.renewals.columns.due'),
        width: 175,
        valueFormatter: (value?: string | null) => formatProviderDate(value),
      },
      {
        field: 'lifecycleState',
        headerName: t('commercial.columns.state'),
        width: 145,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
    ],
    [t]
  );

  if ((commercial.isLoading || operator.isLoading) && !commercial.data) return <ProviderLoading />;
  if ((commercial.isError || operator.isError) && !commercial.data) {
    return (
      <ProviderError
        error={commercial.error ?? operator.error}
        onRetry={() => {
          void commercial.refetch();
          void operator.refetch();
        }}
        retrying={commercial.isFetching || operator.isFetching}
      />
    );
  }
  if (!commercial.data) return null;

  const renewalItems = renewals.data ?? [];
  const pendingCount = renewalItems.filter(
    (item) => item.lifecycleState === 'PENDING_APPROVAL'
  ).length;
  const entitlementChangeCount = renewalItems.filter(
    (item) => item.addedEntitlements.length || item.removedEntitlements.length
  ).length;
  const manualActionCount = renewalItems.filter(
    (item) => item.executionState === 'MANUAL_ACTION_REQUIRED'
  ).length;

  const submitProposal = async (
    request: Parameters<typeof createProviderSubscriptionRenewal>[0]
  ) => {
    await mutation.mutateAsync(() => createProviderSubscriptionRenewal(request));
  };

  return (
    <Stack gap={2.5}>
      <OperationalContextBar
        label={t('commercial.context.label')}
        items={[
          {
            label: t('commercial.context.scope'),
            value: t('commercial.context.allCustomers'),
            icon: <Building2 size={16} />,
          },
          {
            label: t('commercial.context.approval'),
            value: t('commercial.context.separatedApproval'),
            icon: <ShieldCheck size={16} />,
          },
          {
            label: t('commercial.context.externalExecution'),
            value: t('commercial.context.locked'),
            icon: <LockKeyhole size={16} />,
          },
        ]}
        actions={
          <ActionIconButton
            label={t('actions.refresh')}
            onClick={() => {
              void commercial.refetch();
              void renewals.refetch();
            }}
          >
            <RefreshCw size={18} />
          </ActionIconButton>
        }
      />

      {renewals.isError && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void renewals.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('commercial.renewals.partialFailure')}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
          gap: 1,
        }}
      >
        <SignalMetric
          label={t('commercial.metrics.expiring')}
          value={formatNumber(commercial.data.expiringSubscriptions)}
          detail={t('commercial.metrics.expiringDetail')}
          icon={<CalendarClock size={18} />}
          tone={commercial.data.expiringSubscriptions ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('commercial.metrics.pendingApproval')}
          value={formatNumber(pendingCount)}
          detail={t('commercial.metrics.pendingApprovalDetail')}
          icon={<FileClock size={18} />}
          tone={pendingCount ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('commercial.metrics.entitlementChanges')}
          value={formatNumber(entitlementChangeCount)}
          detail={t('commercial.metrics.entitlementChangesDetail')}
          icon={<GitCompareArrows size={18} />}
          tone={entitlementChangeCount ? 'info' : 'neutral'}
        />
        <SignalMetric
          label={t('commercial.metrics.manualActions')}
          value={formatNumber(manualActionCount)}
          detail={t('commercial.metrics.manualActionsDetail')}
          icon={<CircleAlert size={18} />}
          tone={manualActionCount ? 'error' : 'success'}
        />
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.renewals.title')}
          description={t('commercial.renewals.description')}
          action={<Chip size="small" variant="outlined" label={renewalItems.length} />}
        />
        {!renewals.isError && !renewalItems.length ? (
          <Paper variant="outlined" sx={{ mt: 1.5 }}>
            <EmptyState
              size="compact"
              title={t('commercial.renewals.emptyTitle')}
              description={t('commercial.renewals.emptyDescription')}
            />
          </Paper>
        ) : (
          <Box
            sx={{
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.6fr) minmax(360px, 1fr)' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <EnterpriseDataGrid
              ariaLabel={t('commercial.renewals.title')}
              rows={renewalItems}
              columns={renewalColumns}
              getRowId={(row) => row.renewalRevisionId}
              onRowClick={({ row }) => setSelectedRevisionId(row.renewalRevisionId)}
              loading={renewals.isFetching}
              hideFooter
              maxVisibleRows={8}
              sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
            />
            {selectedRevision && (
              <RenewalInspector
                revision={selectedRevision}
                operatorId={operator.data?.operatorId}
                canWrite={canWrite}
                canApprove={canApprove}
                busy={mutation.isPending}
                onDecision={setDecision}
                onPublish={() => setPublishing(true)}
                onAudit={() =>
                  navigate(
                    `/provider/audit?query=${encodeURIComponent(selectedRevision.renewalRevisionId)}`
                  )
                }
              />
            )}
          </Box>
        )}
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.subscriptions.title')}
          description={t('commercial.subscriptions.description')}
          action={
            <Chip size="small" variant="outlined" label={commercial.data.subscriptions.length} />
          }
        />
        <Box sx={{ mt: 1.5 }}>
          {desktop ? (
            <EnterpriseDataGrid
              ariaLabel={t('commercial.subscriptions.title')}
              rows={commercial.data.subscriptions}
              columns={subscriptionColumns}
              getRowId={(row) => row.subscriptionId}
              loading={commercial.isFetching}
              hideFooter
              maxVisibleRows={10}
            />
          ) : (
            <Stack
              component="ul"
              aria-label={t('commercial.subscriptions.title')}
              divider={<Divider flexItem />}
              sx={{ m: 0, p: 0, listStyle: 'none', borderBlock: 1, borderColor: 'divider' }}
            >
              {commercial.data.subscriptions.map((subscription) => (
                <Box component="li" key={subscription.subscriptionId} sx={{ py: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box minWidth={0}>
                      <Typography variant="subtitle2">{subscription.organizationName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {subscription.planName} ·{' '}
                        {subscription.contractReference ?? t('commercial.noReference')}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={subscription.tenants} />
                  </Stack>
                  {canWrite && (
                    <ActionButton
                      size="small"
                      intent="secondary"
                      startIcon={<Plus size={15} />}
                      onClick={() => setProposalSubscription(subscription)}
                      sx={{ mt: 1 }}
                    >
                      {t('commercial.actions.propose')}
                    </ActionButton>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.plans.title')}
          description={t('commercial.plans.description')}
        />
        <Stack
          divider={<Divider flexItem />}
          sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}
        >
          {commercial.data.plans.map((plan) => (
            <Stack
              key={`${plan.planKey}:${plan.planVersion}`}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              gap={1}
              sx={{ py: 1.25 }}
            >
              <Box minWidth={0}>
                <Typography variant="subtitle2">{plan.planName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('commercial.plans.version', {
                    key: plan.planKey,
                    version: plan.planVersion,
                  })}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" gap={2}>
                <Typography variant="caption">
                  {t('commercial.plans.deployment', {
                    customers: plan.organizations,
                    tenants: plan.tenants,
                  })}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`tiers.${plan.serviceTier}`, { defaultValue: plan.serviceTier })}
                />
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box component="section">
        <ProviderSectionHeading
          title={t('commercial.adoption.title')}
          description={t('commercial.adoption.description')}
        />
        <Stack
          divider={<Divider flexItem />}
          sx={{ mt: 1.25, borderBlock: 1, borderColor: 'divider' }}
        >
          {commercial.data.entitlements.map((entitlement) => {
            const adoption = entitlement.eligibleTenants
              ? (entitlement.assignedTenants / entitlement.eligibleTenants) * 100
              : 0;
            return (
              <Box key={entitlement.entitlementId} sx={{ py: 1.25 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Box minWidth={0}>
                    <Typography variant="body2" fontWeight={750} noWrap>
                      {entitlement.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entitlement.entitlementKey} · {entitlement.entitlementType}
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={750}>
                    {entitlement.assignedTenants}/{entitlement.eligibleTenants}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={adoption}
                  aria-label={t('commercial.adoption.progress', { name: entitlement.name })}
                  sx={{ mt: 0.75, height: 5, borderRadius: 0.5 }}
                />
              </Box>
            );
          })}
        </Stack>
      </Box>

      {proposalSubscription && (
        <RenewalProposalDialog
          subscription={proposalSubscription}
          plans={commercial.data.plans}
          busy={mutation.isPending}
          onClose={() => setProposalSubscription(null)}
          onSubmit={submitProposal}
        />
      )}
      {selectedRevision && decision && (
        <RenewalDecisionDialog
          revision={selectedRevision}
          decision={decision}
          busy={mutation.isPending}
          onClose={() => setDecision(null)}
          onSubmit={async (reason) => {
            await mutation.mutateAsync(() =>
              decideProviderSubscriptionRenewal(selectedRevision, decision, reason)
            );
          }}
        />
      )}
      {selectedRevision && (
        <ConfirmDialog
          open={publishing}
          title={t('commercial.publish.title')}
          description={t('commercial.publish.description', {
            company: selectedRevision.organizationName,
            plan: selectedRevision.targetPlanName,
          })}
          cancelLabel={t('actions.cancel')}
          confirmLabel={t('commercial.actions.publish')}
          confirmingLabel={t('commercial.actions.publishing')}
          busy={mutation.isPending}
          onClose={() => setPublishing(false)}
          onConfirm={async () => {
            await mutation.mutateAsync(() => publishProviderSubscriptionRenewal(selectedRevision));
          }}
        />
      )}
    </Stack>
  );
}
