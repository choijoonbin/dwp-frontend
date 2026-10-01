import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  CalendarClock,
  DatabaseZap,
  Plus,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  appendProviderResourceLedger,
  createProviderResourceCommitmentChange,
  getProviderOperatorProfile,
  listAllProviderTenants,
  listProviderResourceCommitments,
  listProviderResourceLedger,
  listProviderSubscriptionRenewals,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
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
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  ProviderResourceCommitment,
  ProviderSubscriptionRenewalRevision,
} from '@dwp-frontend/shared-utils';
import type { GridColDef } from '@mui/x-data-grid';

import {
  formatProviderDate,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
  ProviderStatusChip,
} from './provider-ui';
import { canManageProviderResourceGovernance } from './provider-resource-governance-access';
import { providerOwnerCountLabel } from './provider-bounded-list-coverage';
import { ProviderResourceChangeGovernance } from './provider-resource-change-governance';
import { ProviderResourceLedgerDialog } from './provider-resource-ledger-dialog';
import {
  providerResourceControlModeLabel,
  providerResourceFreshnessLabel,
  providerResourceLedgerEntryTypeLabel,
  providerResourceUnitLabel,
} from './provider-resource-presentation';
import { ProviderTenantLifecycleGovernance } from './provider-tenant-lifecycle-governance';

const UNITS = ['SEAT', 'GIB', 'REQUEST', 'CURRENCY_MINOR', 'COUNT'] as const;

type CommitmentDraft = {
  tenantId: string;
  resourceKey: string;
  unit: ProviderResourceCommitment['unit'];
  quotaLimit: string;
  budgetLimit: string;
  currencyCode: string;
  controlPeriodStartsAt: string;
  controlPeriodEndsAt: string;
  controlMode: ProviderResourceCommitment['controlMode'];
  lifecycleState: ProviderResourceCommitment['lifecycleState'];
  changeKind: 'CONTRACT_CHANGE' | 'TEMPORARY_OVERRIDE';
  commercialRenewalRevisionId: string;
  overrideExpiresAt: string;
  justification: string;
};

function keyOf(item: Pick<ProviderResourceCommitment, 'providerTenantId' | 'resourceKey'>) {
  return `${item.providerTenantId}:${item.resourceKey}`;
}

function decimalOrNull(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function localDateTime(value: string | null | undefined, fallback: Date) {
  const date = value ? new Date(value) : fallback;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function CommitmentDialog({
  commitment,
  tenants,
  commercialRenewals,
  busy,
  onClose,
  onSave,
}: {
  commitment: ProviderResourceCommitment | null;
  tenants: Array<{
    tenantId: string;
    tenantKey: string;
    displayName: string;
    organizationId: string;
  }>;
  commercialRenewals: ProviderSubscriptionRenewalRevision[];
  busy: boolean;
  onClose: () => void;
  onSave: (draft: CommitmentDraft) => Promise<void>;
}) {
  const { t } = useTranslation('provider');
  const initialStart = new Date();
  initialStart.setSeconds(0, 0);
  const initialEnd = new Date(initialStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const initialOverrideEnd = new Date(initialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const initialTenantId = commitment?.providerTenantId ?? tenants[0]?.tenantId ?? '';
  const initialOrganizationId = tenants.find(
    (tenant) => tenant.tenantId === initialTenantId
  )?.organizationId;
  const initialCommercialRevisionId =
    commercialRenewals.find(
      (renewal) =>
        renewal.lifecycleState === 'PUBLISHED' && renewal.organizationId === initialOrganizationId
    )?.renewalRevisionId ?? '';
  const [draft, setDraft] = useState<CommitmentDraft>({
    tenantId: initialTenantId,
    resourceKey: commitment?.resourceKey ?? '',
    unit: commitment?.unit ?? 'SEAT',
    quotaLimit: commitment?.quotaLimit?.toString() ?? '',
    budgetLimit: commitment?.budgetLimit?.toString() ?? '',
    currencyCode: commitment?.currencyCode ?? '',
    controlPeriodStartsAt: localDateTime(commitment?.controlPeriod.startsAt, initialStart),
    controlPeriodEndsAt: localDateTime(commitment?.controlPeriod.endsAt, initialEnd),
    controlMode: commitment?.controlMode ?? 'SOFT_ALERT',
    lifecycleState: commitment?.lifecycleState ?? 'ACTIVE',
    changeKind: commitment ? 'TEMPORARY_OVERRIDE' : 'CONTRACT_CHANGE',
    commercialRenewalRevisionId: initialCommercialRevisionId,
    overrideExpiresAt: localDateTime(undefined, initialOverrideEnd),
    justification: '',
  });
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof CommitmentDraft>(key: K, value: CommitmentDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const selectedOrganizationId = tenants.find(
    (tenant) => tenant.tenantId === draft.tenantId
  )?.organizationId;
  const eligibleCommercialRenewals = commercialRenewals.filter(
    (renewal) =>
      renewal.lifecycleState === 'PUBLISHED' && renewal.organizationId === selectedOrganizationId
  );

  const save = async () => {
    const quotaLimit = decimalOrNull(draft.quotaLimit);
    const budgetLimit = decimalOrNull(draft.budgetLimit);
    if (!draft.tenantId || !draft.resourceKey.trim()) {
      setError(t('resourceGovernance.validation.commitmentIdentity'));
      return;
    }
    if (quotaLimit === null && budgetLimit === null) {
      setError(t('resourceGovernance.validation.limit'));
      return;
    }
    if ((budgetLimit === null) !== !draft.currencyCode.trim()) {
      setError(t('resourceGovernance.validation.currency'));
      return;
    }
    if (
      !draft.controlPeriodStartsAt ||
      !draft.controlPeriodEndsAt ||
      new Date(draft.controlPeriodStartsAt) >= new Date(draft.controlPeriodEndsAt)
    ) {
      setError(t('resourceGovernance.validation.controlPeriod'));
      return;
    }
    if (!draft.justification.trim()) {
      setError(t('resourceGovernance.validation.justification'));
      return;
    }
    if (
      draft.changeKind === 'CONTRACT_CHANGE' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        draft.commercialRenewalRevisionId.trim()
      )
    ) {
      setError(t('resourceGovernance.validation.commercialEvidence'));
      return;
    }
    if (
      draft.changeKind === 'TEMPORARY_OVERRIDE' &&
      (!commitment || !draft.overrideExpiresAt || new Date(draft.overrideExpiresAt) <= new Date())
    ) {
      setError(t('resourceGovernance.validation.overrideExpiry'));
      return;
    }
    try {
      await onSave(draft);
    } catch {
      setError(t('errors.operation'));
    }
  };

  return (
    <FormDialog
      open
      title={t(commitment ? 'resourceGovernance.editTitle' : 'resourceGovernance.createTitle')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('resourceGovernance.changes.requestReview')}
      busy={busy}
      submitDisabled={!draft.tenantId || !draft.resourceKey.trim()}
      onClose={onClose}
      onSubmit={save}
    >
      <Stack gap={2}>
        <Alert severity="info">{t('resourceGovernance.commitmentGuidance')}</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <SelectField
          label={t('resourceGovernance.changes.changeKind')}
          value={draft.changeKind}
          options={(commitment
            ? (['CONTRACT_CHANGE', 'TEMPORARY_OVERRIDE'] as const)
            : (['CONTRACT_CHANGE'] as const)
          ).map((value) => ({
            value,
            label: t(`resourceGovernance.changes.kinds.${value}`),
          }))}
          onValueChange={(value) => {
            const changeKind = value as CommitmentDraft['changeKind'];
            setDraft((current) => ({
              ...current,
              changeKind,
              commercialRenewalRevisionId:
                changeKind === 'CONTRACT_CHANGE'
                  ? current.commercialRenewalRevisionId ||
                    eligibleCommercialRenewals[0]?.renewalRevisionId ||
                    ''
                  : current.commercialRenewalRevisionId,
            }));
          }}
        />
        {draft.changeKind === 'CONTRACT_CHANGE' ? (
          <Stack gap={1}>
            <SelectField
              required
              label={t('resourceGovernance.changes.commercialRevisionId')}
              value={draft.commercialRenewalRevisionId}
              options={eligibleCommercialRenewals.map((renewal) => ({
                value: renewal.renewalRevisionId,
                label: `${renewal.organizationName} · ${renewal.targetPlanName} · #${renewal.revisionNumber}`,
              }))}
              onValueChange={(value) => update('commercialRenewalRevisionId', value)}
            />
            <Typography variant="caption" color="text.secondary">
              {t('resourceGovernance.changes.commercialRevisionHelp')}
            </Typography>
            {!eligibleCommercialRenewals.length && (
              <Alert severity="warning">
                {t('resourceGovernance.changes.noCommercialEvidence')}
              </Alert>
            )}
          </Stack>
        ) : (
          <FormField
            required
            type="datetime-local"
            label={t('resourceGovernance.changes.overrideExpiresAt')}
            value={draft.overrideExpiresAt}
            onChange={(event) => update('overrideExpiresAt', event.target.value)}
            supportingText={t('resourceGovernance.changes.overrideExpiryHelp')}
          />
        )}
        <SelectField
          required
          disabled={Boolean(commitment)}
          label={t('resourceGovernance.fields.tenant')}
          value={draft.tenantId}
          options={tenants.map((tenant) => ({
            value: tenant.tenantId,
            label: `${tenant.displayName} · ${tenant.tenantKey}`,
          }))}
          onValueChange={(value) => {
            const organizationId = tenants.find(
              (tenant) => tenant.tenantId === value
            )?.organizationId;
            const renewalId =
              commercialRenewals.find(
                (renewal) =>
                  renewal.lifecycleState === 'PUBLISHED' &&
                  renewal.organizationId === organizationId
              )?.renewalRevisionId ?? '';
            setDraft((current) => ({
              ...current,
              tenantId: value,
              commercialRenewalRevisionId: renewalId,
            }));
          }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            disabled={Boolean(commitment)}
            label={t('resourceGovernance.fields.resourceKey')}
            value={draft.resourceKey}
            onChange={(event) => update('resourceKey', event.target.value)}
            supportingText={t('resourceGovernance.resourceKeyHelp')}
          />
          <SelectField
            disabled={draft.changeKind === 'TEMPORARY_OVERRIDE'}
            label={t('resourceGovernance.fields.unit')}
            value={draft.unit}
            options={UNITS.map((unit) => ({
              value: unit,
              label: providerResourceUnitLabel(t, unit),
            }))}
            onValueChange={(value) => update('unit', value as CommitmentDraft['unit'])}
          />
          <SelectField
            disabled={draft.changeKind === 'TEMPORARY_OVERRIDE'}
            label={t('resourceGovernance.fields.lifecycle')}
            value={draft.lifecycleState}
            options={(['ACTIVE', 'SUSPENDED', 'RETIRED'] as const).map((state) => ({
              value: state,
              label: t(`states.${state}`),
            }))}
            onValueChange={(value) =>
              update('lifecycleState', value as CommitmentDraft['lifecycleState'])
            }
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            required
            disabled={draft.changeKind === 'TEMPORARY_OVERRIDE'}
            type="datetime-local"
            label={t('resourceGovernance.fields.controlPeriodStartsAt')}
            value={draft.controlPeriodStartsAt}
            onChange={(event) => update('controlPeriodStartsAt', event.target.value)}
          />
          <FormField
            required
            disabled={draft.changeKind === 'TEMPORARY_OVERRIDE'}
            type="datetime-local"
            label={t('resourceGovernance.fields.controlPeriodEndsAt')}
            value={draft.controlPeriodEndsAt}
            onChange={(event) => update('controlPeriodEndsAt', event.target.value)}
          />
          <SelectField
            label={t('resourceGovernance.fields.controlMode')}
            value={draft.controlMode}
            options={(['SOFT_ALERT', 'HARD_BLOCK'] as const).map((mode) => ({
              value: mode,
              label: t(`resourceGovernance.controlModes.${mode}`),
            }))}
            onValueChange={(value) => update('controlMode', value)}
          />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <FormField
            type="number"
            label={t('resourceGovernance.fields.quotaLimit')}
            value={draft.quotaLimit}
            onChange={(event) => update('quotaLimit', event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
          <FormField
            type="number"
            label={t('resourceGovernance.fields.budgetLimit')}
            value={draft.budgetLimit}
            onChange={(event) => update('budgetLimit', event.target.value)}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
          />
          <FormField
            disabled={draft.changeKind === 'TEMPORARY_OVERRIDE'}
            label={t('resourceGovernance.fields.currency')}
            value={draft.currencyCode}
            onChange={(event) => update('currencyCode', event.target.value.toUpperCase())}
            slotProps={{ htmlInput: { maxLength: 3 } }}
          />
        </Stack>
        <FormField
          required
          multiline
          minRows={3}
          label={t('resourceGovernance.changes.justification')}
          value={draft.justification}
          onChange={(event) => update('justification', event.target.value)}
          supportingText={t('resourceGovernance.changes.justificationHelp')}
        />
      </Stack>
    </FormDialog>
  );
}

export function ProviderResourceGovernance() {
  const { t } = useTranslation('provider');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'commitment' | 'ledger' | null>(null);
  const operator = useQuery({
    queryKey: ['provider', 'operator'],
    queryFn: getProviderOperatorProfile,
  });
  const commitments = useQuery({
    queryKey: ['provider', 'resource-governance', 'commitments'],
    queryFn: () => listProviderResourceCommitments(),
  });
  const canReadEstate = operator.data?.permissions.includes('ESTATE_READ') ?? false;
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'resource-governance'],
    queryFn: listAllProviderTenants,
    enabled: canReadEstate,
  });
  const selected = commitments.data?.items.find((item) => keyOf(item) === selectedKey) ?? null;
  const ledger = useQuery({
    queryKey: [
      'provider',
      'resource-governance',
      'ledger',
      selected?.providerTenantId,
      selected?.resourceKey,
    ],
    queryFn: () => listProviderResourceLedger(selected!.providerTenantId, selected!.resourceKey),
    enabled: Boolean(selected),
  });
  const canWrite = operator.data?.permissions.includes('RESOURCE_GOVERNANCE_WRITE') ?? false;
  const canManage = canManageProviderResourceGovernance(canWrite, canReadEstate);
  const renewals = useQuery({
    queryKey: ['provider', 'subscription-renewals', 'resource-governance'],
    queryFn: listProviderSubscriptionRenewals,
    enabled: canManage,
  });
  const ownerCatalogReady = canManage && tenants.isSuccess && renewals.isSuccess;
  const mutation = useMutation({
    mutationFn: async (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['provider', 'resource-governance'] });
      setDialog(null);
      toast.success(t('resourceGovernance.completed'));
    },
    onError: () => toast.error(t('errors.operation')),
  });

  const columns = useMemo<GridColDef<ProviderResourceCommitment>[]>(
    () => [
      {
        field: 'tenantDisplayName',
        headerName: t('resourceGovernance.columns.tenant'),
        minWidth: 190,
        flex: 0.9,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {row.tenantDisplayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.tenantKey}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'resourceKey',
        headerName: t('resourceGovernance.columns.resource'),
        minWidth: 190,
        flex: 1,
        renderCell: ({ row }) => (
          <Box minWidth={0}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.resourceKey}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {providerResourceUnitLabel(t, row.unit)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'quotaLimit',
        headerName: t('resourceGovernance.columns.quota'),
        width: 130,
        valueGetter: (_value, row) => row.quotaLimit ?? t('notAvailable'),
      },
      {
        field: 'budgetLimit',
        headerName: t('resourceGovernance.columns.budget'),
        width: 150,
        valueGetter: (_value, row) =>
          row.budgetLimit == null ? t('notAvailable') : `${row.budgetLimit} ${row.currencyCode}`,
      },
      {
        field: 'controlMode',
        headerName: t('resourceGovernance.columns.control'),
        width: 145,
        renderCell: ({ row }) => (
          <Chip
            size="small"
            variant="outlined"
            color={row.controlMode === 'HARD_BLOCK' ? 'warning' : 'default'}
            label={providerResourceControlModeLabel(t, row.controlMode)}
          />
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('resourceGovernance.columns.state'),
        width: 135,
        renderCell: ({ value }) => <ProviderStatusChip state={String(value)} />,
      },
    ],
    [t]
  );

  if ((operator.isLoading || commitments.isLoading) && !commitments.data)
    return <ProviderLoading />;
  if ((operator.isError || commitments.isError) && !commitments.data) {
    return (
      <ProviderError
        error={operator.error ?? commitments.error}
        onRetry={() => {
          void operator.refetch();
          void commitments.refetch();
        }}
        retrying={operator.isFetching || commitments.isFetching}
      />
    );
  }
  const rows = commitments.data?.items ?? [];
  const commitmentsPartial = commitments.data?.hasMore ?? false;
  const active = rows.filter((item) => item.lifecycleState === 'ACTIVE').length;
  const activePeriods = rows.filter((item) => item.controlPeriod.state === 'ACTIVE').length;
  const internalBudget = rows.filter((item) => item.budgetLimit != null).length;
  const tenantOptions = (tenants.data?.content ?? []).map((tenant) => ({
    tenantId: tenant.tenantId,
    tenantKey: tenant.tenantKey,
    displayName: tenant.displayName,
    organizationId: tenant.organizationId,
  }));

  return (
    <Stack gap={2.5}>
      <OperationalContextBar
        label={t('resourceGovernance.contextLabel')}
        items={[
          {
            label: t('resourceGovernance.context.source'),
            value: t('resourceGovernance.context.internalOnly'),
            icon: <DatabaseZap size={16} />,
          },
          {
            label: t('resourceGovernance.context.activePeriods'),
            value: commitmentsPartial ? t('notAvailable') : String(activePeriods),
            icon: <CalendarClock size={16} />,
          },
          {
            label: t('resourceGovernance.context.externalFeed'),
            value: t('resourceGovernance.context.unavailable'),
            icon: <WalletCards size={16} />,
          },
        ]}
        actions={
          <Stack direction="row" gap={1}>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => {
                void commitments.refetch();
                void operator.refetch();
                if (canManage) {
                  void tenants.refetch();
                  void renewals.refetch();
                }
              }}
            >
              {t('actions.refresh')}
            </ActionButton>
            {canManage && (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={16} />}
                disabled={!ownerCatalogReady}
                onClick={() => {
                  setSelectedKey(null);
                  setDialog('commitment');
                }}
              >
                {t('resourceGovernance.newCommitment')}
              </ActionButton>
            )}
          </Stack>
        }
      />
      <Alert severity="info">{t('resourceGovernance.boundary')}</Alert>
      {commitmentsPartial && (
        <Alert severity="warning">
          {t('resourceGovernance.listPartial', {
            count: rows.length,
            limit: commitments.data?.limit ?? rows.length,
          })}
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
          {t('resourceGovernance.operatorUnavailable')}
        </Alert>
      )}
      {!canReadEstate && canWrite && (
        <Alert severity="warning">{t('resourceGovernance.tenantSelectionUnavailable')}</Alert>
      )}
      {canManage && (tenants.isLoading || renewals.isLoading) && (
        <Alert severity="info">{t('resourceGovernance.catalogLoading')}</Alert>
      )}
      {canManage && tenants.isError && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void tenants.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('resourceGovernance.tenantCatalogUnavailable')}
        </Alert>
      )}
      {canManage && renewals.isError && (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void renewals.refetch()}>
              {t('actions.retryLoad')}
            </ActionButton>
          }
        >
          {t('resourceGovernance.renewalCatalogUnavailable')}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <SignalMetric
          label={t('resourceGovernance.metrics.commitments')}
          value={providerOwnerCountLabel(rows.length, commitmentsPartial)}
          detail={t('resourceGovernance.metrics.commitmentsDetail')}
          icon={<BookOpenCheck size={18} />}
        />
        <SignalMetric
          label={t('resourceGovernance.metrics.active')}
          value={commitmentsPartial ? t('notAvailable') : String(active)}
          detail={
            commitmentsPartial
              ? t('resourceGovernance.metrics.partialDetail')
              : t('resourceGovernance.metrics.activeDetail')
          }
          icon={<DatabaseZap size={18} />}
          tone={active ? 'success' : 'neutral'}
        />
        <SignalMetric
          label={t('resourceGovernance.metrics.budgets')}
          value={commitmentsPartial ? t('notAvailable') : String(internalBudget)}
          detail={
            commitmentsPartial
              ? t('resourceGovernance.metrics.partialDetail')
              : t('resourceGovernance.metrics.budgetsDetail')
          }
          icon={<WalletCards size={18} />}
          tone={internalBudget ? 'info' : 'neutral'}
        />
      </Box>
      <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
        <ProviderSectionHeading
          title={t('resourceGovernance.inventoryTitle')}
          description={t('resourceGovernance.inventoryDescription')}
        />
        <Box sx={{ mt: 1.5 }}>
          {rows.length ? (
            <EnterpriseDataGrid
              ariaLabel={t('resourceGovernance.gridLabel')}
              rows={rows}
              columns={columns}
              getRowId={keyOf}
              hideFooter
              rowHeight={58}
              minVisibleRows={3}
              maxVisibleRows={8}
              onRowClick={({ row }) => setSelectedKey(keyOf(row))}
              onCellKeyDown={(params, event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                setSelectedKey(keyOf(params.row));
              }}
              getRowClassName={({ row }) => (keyOf(row) === selectedKey ? 'Mui-selected' : '')}
            />
          ) : !commitmentsPartial ? (
            <EmptyState
              title={t('resourceGovernance.empty.title')}
              description={t('resourceGovernance.empty.description')}
              action={
                canManage ? (
                  <ActionButton
                    intent="primary"
                    startIcon={<Plus size={16} />}
                    disabled={!ownerCatalogReady}
                    onClick={() => {
                      setSelectedKey(null);
                      setDialog('commitment');
                    }}
                  >
                    {t('resourceGovernance.newCommitment')}
                  </ActionButton>
                ) : undefined
              }
            />
          ) : null}
        </Box>
      </Paper>
      {selected && (
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <ProviderSectionHeading
            title={selected.resourceKey}
            description={`${selected.tenantDisplayName} · ${selected.tenantKey}`}
            action={<ProviderStatusChip state={selected.lifecycleState} />}
          />
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={`${t('resourceGovernance.fields.quotaLimit')} · ${selected.quotaLimit ?? t('notAvailable')}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${t('resourceGovernance.fields.budgetLimit')} · ${selected.budgetLimit == null ? t('notAvailable') : `${selected.budgetLimit} ${selected.currencyCode}`}`}
            />
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={t('resourceGovernance.context.unavailable')}
            />
            <Chip
              size="small"
              variant="outlined"
              color={selected.controlMode === 'HARD_BLOCK' ? 'warning' : 'default'}
              label={providerResourceControlModeLabel(t, selected.controlMode)}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t('resourceGovernance.periodLabel', {
                start: formatProviderDate(selected.controlPeriod.startsAt),
                end: formatProviderDate(selected.controlPeriod.endsAt),
              })}
            />
            <Chip
              size="small"
              variant="outlined"
              color={
                selected.internalEvidenceFreshness.state === 'CURRENT_PERIOD_EVIDENCE'
                  ? 'success'
                  : 'warning'
              }
              label={providerResourceFreshnessLabel(t, selected.internalEvidenceFreshness.state)}
            />
            {selected.activeOverride && (
              <Chip
                size="small"
                variant="outlined"
                color="warning"
                label={t('resourceGovernance.changes.activeOverride', {
                  date: formatProviderDate(selected.activeOverride.expiresAt),
                })}
              />
            )}
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1,
              mt: 2,
            }}
          >
            {[
              ['allocationBalance', selected.totals.allocationBalance],
              ['remainingQuota', selected.totals.remainingQuota],
              ['meteredInternalEvidence', selected.totals.meteredInternalEvidence],
              ['remainingBudget', selected.totals.remainingBudget],
            ].map(([metric, value]) => (
              <Box
                key={metric as string}
                sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t(`resourceGovernance.metrics.${metric}`)}
                </Typography>
                <Typography variant="h6">
                  {value == null ? t('notAvailable') : String(value)}
                </Typography>
              </Box>
            ))}
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
            {canManage && (
              <ActionButton
                intent="secondary"
                disabled={!ownerCatalogReady}
                onClick={() => setDialog('commitment')}
              >
                {t('resourceGovernance.editCommitment')}
              </ActionButton>
            )}
            {canManage && selected.lifecycleState === 'ACTIVE' && (
              <ActionButton intent="primary" onClick={() => setDialog('ledger')}>
                {t('resourceGovernance.recordEvidence')}
              </ActionButton>
            )}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <ProviderSectionHeading
            title={t('resourceGovernance.ledgerInventory')}
            description={t('resourceGovernance.ledgerDescription')}
          />
          {ledger.isLoading ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('loading')}
            </Typography>
          ) : ledger.isError ? (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {t('resourceGovernance.ledgerLoadError')}
            </Alert>
          ) : ledger.data?.items.length ? (
            <Stack gap={1.25} sx={{ mt: 1.25 }}>
              {ledger.data.hasMore && (
                <Alert severity="warning">
                  {t('resourceGovernance.ledgerPartial', { count: ledger.data.items.length })}
                </Alert>
              )}
              <Stack divider={<Divider flexItem />} sx={{ borderBlock: 1, borderColor: 'divider' }}>
                {ledger.data.items.map((entry) => (
                  <Box key={entry.ledgerEntryId} sx={{ py: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" gap={2}>
                      <Box minWidth={0}>
                        <Typography variant="body2" fontWeight={750}>
                          {providerResourceLedgerEntryTypeLabel(t, entry.entryType)} ·{' '}
                          {entry.amount} {providerResourceUnitLabel(t, entry.unit)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {entry.evidenceRef} · {entry.reason}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {formatProviderDate(entry.occurredAt)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
              {t('resourceGovernance.ledgerEmpty')}
            </Typography>
          )}
        </Paper>
      )}
      {dialog === 'commitment' && ownerCatalogReady && (
        <CommitmentDialog
          commitment={selected}
          tenants={tenantOptions}
          commercialRenewals={renewals.data ?? []}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={async (draft) => {
            const quotaLimit = decimalOrNull(draft.quotaLimit);
            const budgetLimit = decimalOrNull(draft.budgetLimit);
            await mutation.mutateAsync(() =>
              createProviderResourceCommitmentChange(draft.tenantId, draft.resourceKey.trim(), {
                changeKind: draft.changeKind,
                ...(selected ? { baselineCommitmentVersion: selected.version } : {}),
                proposed: {
                  unit: draft.unit,
                  ...(quotaLimit == null ? {} : { quotaLimit }),
                  ...(budgetLimit == null ? {} : { budgetLimit }),
                  ...(budgetLimit == null ? {} : { currencyCode: draft.currencyCode.trim() }),
                  controlPeriodStartsAt: new Date(draft.controlPeriodStartsAt).toISOString(),
                  controlPeriodEndsAt: new Date(draft.controlPeriodEndsAt).toISOString(),
                  controlMode: draft.controlMode,
                  lifecycleState: draft.lifecycleState,
                  ...(selected ? { version: selected.version } : {}),
                },
                ...(draft.changeKind === 'CONTRACT_CHANGE'
                  ? { commercialRenewalRevisionId: draft.commercialRenewalRevisionId.trim() }
                  : {
                      overrideExpiresAt: new Date(draft.overrideExpiresAt).toISOString(),
                    }),
                requestKey: crypto.randomUUID(),
                justification: draft.justification.trim(),
              })
            );
            setSelectedKey(`${draft.tenantId}:${draft.resourceKey.trim()}`);
          }}
        />
      )}
      {dialog === 'ledger' && selected && canManage && (
        <ProviderResourceLedgerDialog
          commitment={selected}
          busy={mutation.isPending}
          onClose={() => setDialog(null)}
          onSave={async (request) => {
            await mutation.mutateAsync(() =>
              appendProviderResourceLedger(selected.providerTenantId, selected.resourceKey, request)
            );
          }}
        />
      )}
      <ProviderResourceChangeGovernance />
      <ProviderTenantLifecycleGovernance />
    </Stack>
  );
}
