import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  EnterpriseDataGrid,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  HrisMappingProfile,
  HrisReconciliationIssue,
  listHrisReconciliations,
} from '@dwp-frontend/shared-utils';

export function HrisStateChip({ state }: { state: string }) {
  const display = useDisplayDictionary();
  const color = ['ACTIVE', 'HEALTHY', 'SUCCEEDED', 'RESOLVED'].includes(state)
    ? 'success'
    : ['FAILED', 'CRITICAL'].includes(state)
      ? 'error'
      : ['DEGRADED', 'WARNING', 'PARTIAL'].includes(state)
        ? 'warning'
        : 'default';
  return <Chip size="small" variant="outlined" color={color} label={display('states', state)} />;
}

export function formatHrisInstant(value?: string | null): string {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

export function HrisReconciliationView({
  issues,
  runs,
  canUpdate,
  onResolve,
}: {
  issues: HrisReconciliationIssue[];
  runs: Awaited<ReturnType<typeof listHrisReconciliations>>;
  canUpdate: boolean;
  onResolve: (issue: HrisReconciliationIssue) => void;
}) {
  const { t } = useTranslation('workforce');
  const columns = useMemo<GridColDef<HrisReconciliationIssue>[]>(
    () => [
      {
        field: 'firstDetectedAt',
        headerName: t('provisioning.hris.reconciliation.detected'),
        width: 180,
        valueGetter: (_value, row) => formatHrisInstant(row.firstDetectedAt),
      },
      {
        field: 'severity',
        headerName: t('provisioning.hris.reconciliation.severity'),
        width: 120,
        renderCell: ({ row }) => <HrisStateChip state={row.severity} />,
      },
      {
        field: 'issueCode',
        headerName: t('provisioning.hris.reconciliation.issue'),
        minWidth: 220,
        flex: 0.8,
      },
      {
        field: 'entityType',
        headerName: t('provisioning.hris.reconciliation.entity'),
        width: 120,
      },
      {
        field: 'redactedSummary',
        headerName: t('provisioning.hris.reconciliation.summary'),
        minWidth: 320,
        flex: 1.3,
      },
      {
        field: 'action',
        headerName: '',
        width: 70,
        sortable: false,
        renderCell: ({ row }) => (
          <ActionIconButton
            label={t('provisioning.hris.actions.resolve')}
            size="small"
            disabled={!canUpdate}
            onClick={() => onResolve(row)}
          >
            <ArrowRight size={15} />
          </ActionIconButton>
        ),
      },
    ],
    [canUpdate, onResolve, t]
  );
  return (
    <Box>
      <Stack
        direction="row"
        gap={2}
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2" fontWeight={700}>
          {t('provisioning.hris.reconciliation.open', { count: issues.length })}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('provisioning.hris.reconciliation.runs', { count: runs.length })}
        </Typography>
      </Stack>
      {issues.length ? (
        <EnterpriseDataGrid
          ariaLabel={t('provisioning.hris.views.reconciliation')}
          rows={issues}
          columns={columns}
          getRowId={(row) => row.reconciliationIssueId}
          minVisibleRows={5}
          maxVisibleRows={10}
          hideFooter={issues.length <= 25}
          sx={{ border: 0, borderRadius: 0 }}
        />
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('provisioning.hris.reconciliation.emptyTitle')}
          description={t('provisioning.hris.reconciliation.emptyDescription')}
        />
      )}
    </Box>
  );
}

export function HrisMappingView({
  mappings,
  canCreate,
  canUpdate,
  busy,
  onCreate,
  onActivate,
}: {
  mappings: HrisMappingProfile[];
  canCreate: boolean;
  canUpdate: boolean;
  busy: boolean;
  onCreate: () => void;
  onActivate: (mapping: HrisMappingProfile) => Promise<void>;
}) {
  const { t } = useTranslation('workforce');
  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="body2" color="text.secondary">
          {t('provisioning.hris.mapping.policy')}
        </Typography>
        <ActionButton
          intent="secondary"
          size="small"
          startIcon={<Plus size={15} />}
          disabled={!canCreate || busy}
          onClick={onCreate}
        >
          {t('provisioning.hris.actions.newMapping')}
        </ActionButton>
      </Stack>
      {mappings.map((mapping) => (
        <Stack
          key={mapping.mappingProfileId}
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={1.5}
          sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <CheckCircle2 size={17} color="currentColor" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2">{mapping.profileKey}</Typography>
            <Typography variant="caption" color="text.secondary">
              {mapping.adapterType} · {mapping.sourceSchemaVersion} → {mapping.targetSchemaVersion}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {mapping.mappingSha256.slice(0, 12)}
          </Typography>
          <HrisStateChip state={mapping.lifecycleState} />
          {mapping.lifecycleState === 'DRAFT' && (
            <ActionButton
              intent="secondary"
              size="small"
              disabled={!canUpdate || busy}
              onClick={() => void onActivate(mapping)}
            >
              {t('provisioning.hris.actions.activate')}
            </ActionButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}
