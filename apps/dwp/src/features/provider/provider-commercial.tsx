import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarClock,
  Check,
  CircleAlert,
  FileClock,
  GitCompareArrows,
  History,
  LockKeyhole,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  DateTimePickerField,
  EmptyState,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
  OperationalContextBar,
  SelectField,
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
  ProviderServicePlanPortfolio,
  ProviderSubscriptionPortfolio,
  ProviderSubscriptionRenewalRevision,
} from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
  providerError,
} from './provider-ui';

type RenewalDecision = 'APPROVED' | 'REJECTED';

function RenewalProposalDialog({
  subscription,
  plans,
  busy,
  onClose,
  onSubmit,
}: {
  subscription: ProviderSubscriptionPortfolio;
  plans: ProviderServicePlanPortfolio[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (request: Parameters<typeof createProviderSubscriptionRenewal>[0]) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [targetPlanKey, setTargetPlanKey] = useState(subscription.planKey);
  const [endsAt, setEndsAt] = useState<string | null>(
    subscription.endsAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  );
  const [contractReference, setContractReference] = useState(subscription.contractReference ?? '');
  const [reason, setReason] = useState('');
  const [requestKey] = useState(() => `commercial-renewal-${crypto.randomUUID()}`);
  const targetPlan = plans.find((plan) => plan.planKey === targetPlanKey);
  const validDate = endsAt && new Date(endsAt).getTime() > Date.now();

  return (
    <FormDialog
      open
      maxWidth="md"
      title={t('commercial.renewals.createTitle', { company: subscription.organizationName })}
      description={t('commercial.renewals.createDescription')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('commercial.actions.submitRenewal')}
      submittingLabel={t('commercial.actions.submittingRenewal')}
      busy={busy}
      submitDisabled={
        !targetPlanKey || !validDate || !contractReference.trim() || reason.trim().length < 10
      }
      onClose={onClose}
      onSubmit={() =>
        onSubmit({
          subscriptionId: subscription.subscriptionId,
          targetPlanKey,
          proposedEndsAt: endsAt!,
          proposedContractReference: contractReference.trim(),
          reason: reason.trim(),
          requestKey,
          subscriptionVersion: subscription.version,
        })
      }
    >
      <Stack gap={2}>
        <Alert severity="info">{t('commercial.renewals.approvalGuidance')}</Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('commercial.renewals.currentPlan')}
            </Typography>
            <Typography variant="subtitle2">{subscription.planName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('commercial.renewals.currentTerm', {
                date: subscription.endsAt
                  ? formatProviderDate(subscription.endsAt)
                  : t('commercial.noEndDate'),
              })}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, bgcolor: 'action.selected', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('commercial.renewals.proposedPlan')}
            </Typography>
            <Typography variant="subtitle2">{targetPlan?.planName ?? t('notAvailable')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {targetPlan
                ? t('commercial.plans.version', {
                    key: targetPlan.planKey,
                    version: targetPlan.planVersion,
                  })
                : t('notAvailable')}
            </Typography>
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>
          <SelectField
            required
            label={t('commercial.renewals.fields.targetPlan')}
            value={targetPlanKey}
            options={plans
              .filter((plan) => plan.lifecycleState === 'ACTIVE')
              .map((plan) => ({
                value: plan.planKey,
                label: `${plan.planName} · ${t(`tiers.${plan.serviceTier}`, {
                  defaultValue: plan.serviceTier,
                })}`,
              }))}
            onValueChange={setTargetPlanKey}
          />
          <DateTimePickerField
            required
            label={t('commercial.renewals.fields.endsAt')}
            value={endsAt}
            errorMessage={
              endsAt && !validDate ? t('commercial.renewals.validation.futureDate') : undefined
            }
            onValueChange={setEndsAt}
          />
        </Stack>
        <FormField
          required
          label={t('commercial.renewals.fields.contractReference')}
          value={contractReference}
          inputProps={{ maxLength: 160 }}
          supportingText={t('commercial.renewals.contractReferenceHelp')}
          onChange={(event) => setContractReference(event.target.value)}
        />
        <FormField
          required
          multiline
          minRows={3}
          label={t('commercial.renewals.fields.reason')}
          value={reason}
          inputProps={{ maxLength: 1000 }}
          supportingText={t('commercial.renewals.reasonHelp')}
          onChange={(event) => setReason(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

function RenewalDecisionDialog({
  revision,
  decision,
  busy,
  onClose,
  onSubmit,
}: {
  revision: ProviderSubscriptionRenewalRevision;
  decision: RenewalDecision;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const [reason, setReason] = useState('');
  const action = decision === 'APPROVED' ? 'approve' : 'reject';
  return (
    <FormDialog
      open
      title={t(`commercial.decision.${action}.title`)}
      description={t('commercial.decision.description', {
        company: revision.organizationName,
        revision: revision.revisionNumber,
      })}
      cancelLabel={t('actions.cancel')}
      submitLabel={t(`commercial.actions.${action}`)}
      submitIntent={decision === 'REJECTED' ? 'danger' : 'primary'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <FormField
        autoFocus
        required
        multiline
        minRows={3}
        label={t('commercial.renewals.fields.decisionReason')}
        value={reason}
        inputProps={{ maxLength: 1000 }}
        supportingText={t('commercial.decision.reasonHelp')}
        onChange={(event) => setReason(event.target.value)}
      />
    </FormDialog>
  );
}

function RenewalInspector({
  revision,
  operatorId,
  canWrite,
  canApprove,
  busy,
  onDecision,
  onPublish,
  onAudit,
}: {
  revision: ProviderSubscriptionRenewalRevision;
  operatorId?: number;
  canWrite: boolean;
  canApprove: boolean;
  busy: boolean;
  onDecision: (decision: RenewalDecision) => void;
  onPublish: () => void;
  onAudit: () => void;
}) {
  const { t } = useTranslation('provider');
  const selfApproval =
    revision.lifecycleState === 'PENDING_APPROVAL' && revision.requestedBy === operatorId;
  return (
    <Paper component="aside" variant="outlined" sx={{ minWidth: 0, p: 2 }}>
      <Stack gap={2}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box minWidth={0}>
            <Typography variant="overline" color="text.secondary">
              {t('commercial.renewals.revision', { revision: revision.revisionNumber })}
            </Typography>
            <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>
              {revision.organizationName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {revision.organizationKey} · {revision.proposedContractReference}
            </Typography>
          </Box>
          <ProviderStatusChip state={revision.lifecycleState} />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            borderBlock: 1,
            borderColor: 'divider',
          }}
        >
          {[
            [t('commercial.renewals.currentPlan'), revision.currentPlanName],
            [t('commercial.renewals.proposedPlan'), revision.targetPlanName],
            [
              t('commercial.renewals.currentEnd'),
              revision.currentEndsAt
                ? formatProviderDate(revision.currentEndsAt)
                : t('commercial.noEndDate'),
            ],
            [t('commercial.renewals.proposedEnd'), formatProviderDate(revision.proposedEndsAt)],
          ].map(([label, value], index) => (
            <Box
              key={label}
              sx={{
                py: 1.25,
                px: index % 2 ? 1.5 : 0,
                borderLeft: { sm: index % 2 ? 1 : 0 },
                borderTop: index > 1 ? 1 : 0,
                borderColor: 'divider',
                minWidth: 0,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box>
          <Typography variant="subtitle2">{t('commercial.renewals.entitlementImpact')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('commercial.renewals.tenantImpact', { count: revision.impactedTenants })}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
            {revision.addedEntitlements.map((entitlement) => (
              <Chip
                key={`added:${entitlement}`}
                size="small"
                color="success"
                variant="outlined"
                label={t('commercial.renewals.added', { entitlement })}
              />
            ))}
            {revision.removedEntitlements.map((entitlement) => (
              <Chip
                key={`removed:${entitlement}`}
                size="small"
                color="error"
                variant="outlined"
                label={t('commercial.renewals.removed', { entitlement })}
              />
            ))}
            {!revision.addedEntitlements.length && !revision.removedEntitlements.length && (
              <Chip
                size="small"
                variant="outlined"
                label={t('commercial.renewals.noRightsChange')}
              />
            )}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t('commercial.renewals.businessReason')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {revision.reason}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">{t('commercial.renewals.controlEvidence')}</Typography>
          <Stack divider={<Divider flexItem />} sx={{ mt: 0.5 }}>
            {[
              [
                t('commercial.renewals.requestedBy'),
                t('commercial.renewals.actorAt', {
                  actor: revision.requestedByName,
                  time: formatProviderDate(revision.requestedAt),
                }),
              ],
              [t('commercial.renewals.decisionDue'), formatProviderDate(revision.decisionDueAt)],
              [
                t('commercial.renewals.decidedBy'),
                revision.decidedByName
                  ? t('commercial.renewals.actorAt', {
                      actor: revision.decidedByName,
                      time: formatProviderDate(revision.decidedAt),
                    })
                  : t('commercial.renewals.awaitingDecision'),
              ],
              [
                t('commercial.renewals.publishedBy'),
                revision.publishedByName
                  ? t('commercial.renewals.actorAt', {
                      actor: revision.publishedByName,
                      time: formatProviderDate(revision.publishedAt),
                    })
                  : t('commercial.renewals.notPublished'),
              ],
              [t('commercial.renewals.evidenceHash'), revision.contentSha256],
            ].map(([label, value]) => (
              <Stack
                key={label}
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                gap={0.5}
                sx={{ py: 0.75 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{ overflowWrap: 'anywhere', textAlign: { sm: 'right' }, maxWidth: '70%' }}
                >
                  {value}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {revision.lifecycleState === 'PUBLISHED' &&
          revision.executionState === 'MANUAL_ACTION_REQUIRED' && (
            <Alert severity="warning" icon={<LockKeyhole size={19} />}>
              {t('commercial.renewals.externalExecutionLocked')}
            </Alert>
          )}
        {selfApproval && <Alert severity="info">{t('commercial.renewals.selfApproval')}</Alert>}

        <Stack direction="row" flexWrap="wrap" gap={1}>
          {revision.lifecycleState === 'PENDING_APPROVAL' && canApprove && !selfApproval && (
            <>
              <ActionButton
                intent="primary"
                startIcon={<Check size={16} />}
                disabled={busy}
                onClick={() => onDecision('APPROVED')}
              >
                {t('commercial.actions.approve')}
              </ActionButton>
              <ActionButton
                intent="secondary"
                startIcon={<X size={16} />}
                disabled={busy}
                onClick={() => onDecision('REJECTED')}
              >
                {t('commercial.actions.reject')}
              </ActionButton>
            </>
          )}
          {revision.lifecycleState === 'APPROVED' && canWrite && (
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={busy}
              onClick={onPublish}
            >
              {t('commercial.actions.publish')}
            </ActionButton>
          )}
          <ActionButton intent="quiet" startIcon={<History size={16} />} onClick={onAudit}>
            {t('commercial.actions.viewAudit')}
          </ActionButton>
        </Stack>
      </Stack>
    </Paper>
  );
}

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
          value={commercial.data.expiringSubscriptions.toLocaleString()}
          detail={t('commercial.metrics.expiringDetail')}
          icon={<CalendarClock size={18} />}
          tone={commercial.data.expiringSubscriptions ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('commercial.metrics.pendingApproval')}
          value={pendingCount.toLocaleString()}
          detail={t('commercial.metrics.pendingApprovalDetail')}
          icon={<FileClock size={18} />}
          tone={pendingCount ? 'warning' : 'success'}
        />
        <SignalMetric
          label={t('commercial.metrics.entitlementChanges')}
          value={entitlementChangeCount.toLocaleString()}
          detail={t('commercial.metrics.entitlementChangesDetail')}
          icon={<GitCompareArrows size={18} />}
          tone={entitlementChangeCount ? 'info' : 'neutral'}
        />
        <SignalMetric
          label={t('commercial.metrics.manualActions')}
          value={manualActionCount.toLocaleString()}
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
