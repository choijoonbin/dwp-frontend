import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EnterpriseDataGrid,
  ErrorState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  getDwaionOperationalGatePortfolio,
  type DwaionGateEnvironment,
  type DwaionOperationalGate,
  usePermissions,
} from '@dwp-frontend/shared-utils';
import {
  BadgeCheck,
  ChevronRight,
  FileCheck2,
  FileSearch2,
  ScanSearch,
  Settings2,
  ShieldCheck,
} from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { DwaionAdminPageHeader } from './dwaion-admin-ui';
import { DwaionGateDialogHost, type GateDialogAction } from './dwaion-gate-dialogs';
import {
  GateStatusChip,
  gateCategoryLabel,
  gateDescription,
  gateOptionLabel,
  gateTitle,
} from './dwaion-gate-ui';

import type { GridColDef } from '@mui/x-data-grid';

const ENVIRONMENTS: DwaionGateEnvironment[] = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];

export function DwaionAdminGates() {
  const { t } = useTranslation('work');
  const { hasPermission } = usePermissions();
  const [environment, setEnvironment] = useState<DwaionGateEnvironment>('PRODUCTION');
  const [action, setAction] = useState<GateDialogAction>(null);
  const [saved, setSaved] = useState(false);
  const canUpdate =
    hasPermission('ADMIN.DWAION_GATES', 'UPDATE') || hasPermission('ADMIN.DWAION_GATES', 'MANAGE');
  const canCreate =
    hasPermission('ADMIN.DWAION_GATES', 'CREATE') || hasPermission('ADMIN.DWAION_GATES', 'MANAGE');
  const canApprove =
    hasPermission('ADMIN.DWAION_GATES', 'APPROVE') || hasPermission('ADMIN.DWAION_GATES', 'MANAGE');
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'gates', environment],
    queryFn: () => getDwaionOperationalGatePortfolio(environment),
    staleTime: 15_000,
  });

  const columns = useMemo<GridColDef<DwaionOperationalGate>[]>(
    () => [
      {
        field: 'gateKey',
        headerName: t('dwaionAdmin.gates.columns.gate'),
        minWidth: 280,
        flex: 1.25,
        renderCell: ({ row }) => (
          <Stack sx={{ minWidth: 0, py: 0.75 }}>
            <Typography variant="body2" fontWeight={680} noWrap>
              {gateTitle(t, row.gateKey)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {gateDescription(t, row.gateKey)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'category',
        headerName: t('dwaionAdmin.gates.columns.category'),
        width: 154,
        valueGetter: (_, row) => gateCategoryLabel(t, row.category),
      },
      {
        field: 'selectedOption',
        headerName: t('dwaionAdmin.gates.columns.option'),
        minWidth: 190,
        flex: 0.8,
        renderCell: ({ row }) => {
          const selected = row.selectedOption;
          const recommended = row.options.find((item) => item.recommended)?.code;
          if (!selected) {
            return (
              <Typography variant="body2" color="text.secondary">
                {t('dwaionAdmin.gates.notSelected')}
              </Typography>
            );
          }
          return (
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {gateOptionLabel(t, row.gateKey, selected)}
              </Typography>
              {selected === recommended && (
                <Typography variant="caption" color="primary.main">
                  {t('dwaionAdmin.gates.recommended')}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: 'status',
        headerName: t('dwaionAdmin.gates.columns.status'),
        width: 154,
        renderCell: ({ row }) => (
          <GateStatusChip
            status={row.status}
            label={t(`dwaionAdmin.gates.statuses.${row.status}`)}
          />
        ),
      },
      {
        field: 'evidenceCount',
        headerName: t('dwaionAdmin.gates.columns.evidence'),
        width: 110,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.75} alignItems="center">
            <FileCheck2 size={16} />
            <Typography variant="body2">{row.evidenceCount}</Typography>
          </Stack>
        ),
      },
      {
        field: 'expiresAt',
        headerName: t('dwaionAdmin.gates.columns.expires'),
        width: 132,
        valueFormatter: (value?: string | null) =>
          value ? formatDate(value, { dateStyle: 'medium' }) : t('dwaionAdmin.gates.noExpiry'),
      },
      {
        field: 'actions',
        headerName: t('dwaionAdmin.gates.columns.actions'),
        width: 430,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" spacing={0.25}>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<FileSearch2 size={15} />}
              onClick={() => setAction({ kind: 'REVIEW', gate: row })}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              {t('dwaionAdmin.gates.actions.review')}
            </ActionButton>
            {canUpdate && (
              <ActionButton
                intent={row.selectedOption ? 'quiet' : 'secondary'}
                size="small"
                startIcon={<Settings2 size={15} />}
                onClick={() => setAction({ kind: 'CONFIGURE', gate: row })}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                {t(
                  row.selectedOption
                    ? 'dwaionAdmin.gates.actions.reconfigure'
                    : 'dwaionAdmin.gates.actions.configure'
                )}
              </ActionButton>
            )}
            {canCreate &&
              row.selectedOption &&
              ['CONFIGURING', 'BLOCKED', 'READY_FOR_APPROVAL'].includes(row.status) && (
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<FileCheck2 size={15} />}
                  onClick={() => setAction({ kind: 'EVIDENCE', gate: row })}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  {t('dwaionAdmin.gates.actions.evidence')}
                </ActionButton>
              )}
            {canUpdate && row.selectedOption && ['CONFIGURING', 'BLOCKED'].includes(row.status) && (
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<ScanSearch size={15} />}
                onClick={() => setAction({ kind: 'VALIDATE', gate: row })}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                {t('dwaionAdmin.gates.actions.validate')}
              </ActionButton>
            )}
            {canApprove && row.status === 'READY_FOR_APPROVAL' && (
              <ActionButton
                intent="primary"
                size="small"
                startIcon={<BadgeCheck size={15} />}
                onClick={() => setAction({ kind: 'DECIDE', gate: row })}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                {t('dwaionAdmin.gates.actions.decide')}
              </ActionButton>
            )}
          </Stack>
        ),
      },
    ],
    [canApprove, canCreate, canUpdate, t]
  );

  const portfolio = query.data;
  const readinessSeverity = portfolio?.deliveryReady
    ? 'success'
    : (portfolio?.blockedCount ?? 0) + (portfolio?.expiredCount ?? 0) > 0
      ? 'warning'
      : 'info';

  if (query.isError) {
    return (
      <PageCanvas>
        <DwaionAdminPageHeader
          eyebrow={t('dwaionAdmin.shared.governance')}
          title={t('dwaionAdmin.gates.title')}
          description={t('dwaionAdmin.gates.description')}
        />
        <Box sx={{ mt: 3 }}>
          <ErrorState
            size="page"
            title={t('dwaionAdmin.gates.error')}
            description={t('dwaionAdmin.gates.unavailableDescription')}
            retryLabel={t('dwaionAdmin.shared.retry')}
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        </Box>
      </PageCanvas>
    );
  }

  if (query.isLoading || !portfolio) {
    return (
      <PageCanvas>
        <DwaionAdminPageHeader
          eyebrow={t('dwaionAdmin.shared.governance')}
          title={t('dwaionAdmin.gates.title')}
          description={t('dwaionAdmin.gates.description')}
        />
        <LoadingState size="page" variant="skeleton" label={t('dwaionAdmin.gates.loading')} />
      </PageCanvas>
    );
  }
  return (
    <PageCanvas>
      <DwaionAdminPageHeader
        eyebrow={t('dwaionAdmin.shared.governance')}
        title={t('dwaionAdmin.gates.title')}
        description={t('dwaionAdmin.gates.description')}
      />
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSaved(false)}>
          {t('dwaionAdmin.gates.saved')}
        </Alert>
      )}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mt: 3 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <ShieldCheck size={19} />
          <Box>
            <Typography variant="subtitle2">{t('dwaionAdmin.gates.environmentTitle')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('dwaionAdmin.gates.environmentDescription')}
            </Typography>
          </Box>
        </Stack>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={environment}
          aria-label={t('dwaionAdmin.gates.environmentTitle')}
          onChange={(_, value: DwaionGateEnvironment | null) => value && setEnvironment(value)}
        >
          {ENVIRONMENTS.map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`dwaionAdmin.gates.environments.${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
      <GateWorkflow />
      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        <GateMetric
          label={t('dwaionAdmin.gates.metrics.readiness')}
          value={`${portfolio.completionPercent}%`}
        />
        <GateMetric
          label={t('dwaionAdmin.gates.metrics.approved')}
          value={`${portfolio.approvedCount} / ${portfolio.requiredCount}`}
        />
        <GateMetric
          label={t('dwaionAdmin.gates.metrics.review')}
          value={String(portfolio.readyForApprovalCount)}
        />
        <GateMetric
          label={t('dwaionAdmin.gates.metrics.attention')}
          value={String(portfolio.blockedCount + portfolio.expiredCount)}
          last
        />
      </Box>
      <LinearProgress
        variant="determinate"
        value={portfolio.completionPercent}
        color={portfolio.deliveryReady ? 'success' : 'primary'}
        aria-label={t('dwaionAdmin.gates.metrics.readiness')}
        sx={{ height: 3, borderRadius: 0 }}
      />
      <Alert severity={readinessSeverity} sx={{ mt: 2 }}>
        {portfolio.deliveryReady ? t('dwaionAdmin.gates.ready') : t('dwaionAdmin.gates.notReady')}
      </Alert>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
        {(
          [
            'AI_RUNTIME',
            'CONNECTIVITY',
            'ACCESS_CONTROL',
            'ASSURANCE',
            'DATA_PROTECTION',
            'OPERATIONS',
          ] as const
        ).map((category) => (
          <Chip
            key={category}
            size="small"
            variant="outlined"
            label={`${gateCategoryLabel(t, category)} ${portfolio.gates.filter((gate) => gate.category === category && gate.status === 'APPROVED').length}/${portfolio.gates.filter((gate) => gate.category === category).length}`}
          />
        ))}
      </Stack>
      <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
        <EnterpriseDataGrid
          ariaLabel={t('dwaionAdmin.gates.tableLabel')}
          rows={portfolio.gates}
          columns={columns}
          getRowId={(row) => row.gateKey}
          loading={query.isLoading}
          hideFooter
          getRowHeight={() => 64}
          sx={{ border: 0, borderRadius: 0 }}
        />
      </Box>
      <DwaionGateDialogHost
        action={action}
        environment={environment}
        onClose={() => setAction(null)}
        onCompleted={() => setSaved(true)}
      />
    </PageCanvas>
  );
}

function GateWorkflow() {
  const { t } = useTranslation('work');
  const steps = [
    t('dwaionAdmin.gates.workflow.configure'),
    t('dwaionAdmin.gates.workflow.evidence'),
    t('dwaionAdmin.gates.workflow.validate'),
    t('dwaionAdmin.gates.workflow.approve'),
  ];

  return (
    <Stack
      component="section"
      aria-label={t('dwaionAdmin.gates.workflow.title')}
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={{ xs: 0.75, sm: 1 }}
      useFlexGap
      flexWrap="wrap"
      sx={{ mt: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mr: { sm: 0.5 } }}>
        {t('dwaionAdmin.gates.workflow.title')}
      </Typography>
      {steps.map((label, index) => (
        <Stack key={label} direction="row" alignItems="center" spacing={1}>
          <Box
            sx={{
              width: 22,
              height: 22,
              flex: '0 0 22px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              bgcolor: 'action.selected',
              color: 'text.primary',
              typography: 'caption',
              fontWeight: 700,
            }}
          >
            {index + 1}
          </Box>
          <Typography variant="body2" fontWeight={600}>
            {label}
          </Typography>
          {index < steps.length - 1 && <ChevronRight size={15} aria-hidden color="currentColor" />}
        </Stack>
      ))}
    </Stack>
  );
}

function GateMetric({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <Box
      sx={{
        px: 2,
        py: 1.75,
        minWidth: 0,
        borderRight: { xs: 0, lg: last ? 0 : 1 },
        borderBottom: { xs: 1, lg: 0 },
        borderColor: 'divider',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}
