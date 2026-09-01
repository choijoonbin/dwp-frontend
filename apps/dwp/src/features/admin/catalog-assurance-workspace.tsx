import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScanSearch, ShieldCheck } from 'lucide-react';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EnterpriseDataGrid,
  FormDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CatalogMetric } from './catalog-metric';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  CatalogAssuranceFinding,
  CatalogAssuranceFindingState,
  CatalogAssuranceSummary,
} from '@dwp-frontend/shared-utils';

export type FindingDecision = Exclude<CatalogAssuranceFindingState, 'OPEN'>;

export function FindingDispositionDialog({
  finding,
  busy,
  onClose,
  onSubmit,
}: {
  finding: CatalogAssuranceFinding;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: {
    decision: FindingDecision;
    reason: string;
    evidenceRef: string;
  }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [decision, setDecision] = useState<FindingDecision>('ACKNOWLEDGED');
  const [reason, setReason] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  return (
    <FormDialog
      open
      title={t('catalog.assurance.disposition.title')}
      description={t('catalog.assurance.disposition.description', {
        entity: finding.entityRef,
      })}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('catalog.assurance.disposition.submit')}
      submittingLabel={t('catalog.assurance.disposition.submitting')}
      submitIntent={decision === 'FALSE_POSITIVE' ? 'secondary' : 'primary'}
      submitDisabled={reason.trim().length < 10}
      busy={busy}
      onClose={onClose}
      onSubmit={() =>
        onSubmit({ decision, reason: reason.trim(), evidenceRef: evidenceRef.trim() })
      }
    >
      <Stack gap={2}>
        <Alert severity={decision === 'ACCEPTED_RISK' ? 'warning' : 'info'}>
          {t(`catalog.assurance.disposition.guidance.${decision}`)}
        </Alert>
        <FormField
          select
          required
          label={t('catalog.assurance.disposition.decision')}
          value={decision}
          onChange={(event) => setDecision(event.target.value as FindingDecision)}
        >
          {(
            ['ACKNOWLEDGED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'RESOLVED'] as FindingDecision[]
          ).map((value) => (
            <MenuItem key={value} value={value}>
              {t(`catalog.assurance.states.${value}`)}
            </MenuItem>
          ))}
        </FormField>
        <FormField
          required
          multiline
          minRows={3}
          label={t('catalog.assurance.disposition.reason')}
          value={reason}
          inputProps={{ maxLength: 1000 }}
          supportingText={t('catalog.assurance.disposition.reasonHelp')}
          onChange={(event) => setReason(event.target.value)}
        />
        <FormField
          label={t('catalog.assurance.disposition.evidence')}
          value={evidenceRef}
          inputProps={{ maxLength: 500 }}
          supportingText={t('catalog.assurance.disposition.evidenceHelp')}
          onChange={(event) => setEvidenceRef(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}

export function AssuranceWorkspace({
  summary,
  loading,
  evaluating,
  selectedFindingId,
  onEvaluate,
  onSelect,
  onReview,
}: {
  summary?: CatalogAssuranceSummary;
  loading: boolean;
  evaluating: boolean;
  selectedFindingId: string | null;
  onEvaluate: () => void;
  onSelect: (findingId: string) => void;
  onReview: (finding: CatalogAssuranceFinding) => void;
}) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
  const findings = summary?.findings ?? [];
  const selected = findings.find((finding) => finding.findingId === selectedFindingId) ?? null;
  const columns = useMemo<GridColDef<CatalogAssuranceFinding>[]>(
    () => [
      {
        field: 'entityRef',
        headerName: t('catalog.assurance.columns.asset'),
        minWidth: 250,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.5 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.entityRef}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(`catalog.assurance.findings.${row.findingCode}`)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'severity',
        headerName: t('catalog.assurance.columns.severity'),
        width: 112,
        renderCell: ({ value }) => (
          <Chip
            size="small"
            variant="outlined"
            color={value === 'CRITICAL' || value === 'HIGH' ? 'error' : 'default'}
            label={display('severities', String(value))}
          />
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('catalog.assurance.columns.state'),
        width: 140,
        renderCell: ({ value }) => (
          <Chip
            size="small"
            label={t(`catalog.assurance.states.${String(value)}`, {
              defaultValue: display('states', String(value)),
            })}
          />
        ),
      },
      {
        field: 'lastDetectedAt',
        headerName: t('catalog.assurance.columns.detected'),
        width: 176,
        valueFormatter: (value?: string) =>
          value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-',
      },
      {
        field: 'actions',
        headerName: '',
        width: 104,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => (
          <ActionButton
            intent="quiet"
            size="small"
            disabled={!['OPEN', 'ACKNOWLEDGED'].includes(row.lifecycleState)}
            onClick={(event) => {
              event.stopPropagation();
              onReview(row);
            }}
          >
            {t('catalog.assurance.actions.review')}
          </ActionButton>
        ),
      },
    ],
    [display, onReview, t]
  );

  return (
    <Stack gap={2}>
      <Box
        component="section"
        aria-label={t('catalog.assurance.contextLabel')}
        sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ px: 2, py: 1.5 }}
        >
          <Box minWidth={0}>
            <Stack direction="row" alignItems="center" gap={1}>
              <ShieldCheck size={18} />
              <Typography component="h2" variant="subtitle1">
                {t('catalog.assurance.title')}
              </Typography>
              {summary && (
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('catalog.assurance.ruleVersion', {
                    key: summary.activeRule.ruleKey,
                    version: summary.activeRule.ruleVersion,
                  })}
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('catalog.assurance.description')}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<ScanSearch size={17} />}
            loading={evaluating}
            loadingLabel={t('catalog.assurance.actions.evaluating')}
            onClick={onEvaluate}
          >
            {t('catalog.assurance.actions.evaluate')}
          </ActionButton>
        </Stack>
        <Box
          aria-label={t('catalog.assurance.metrics.label')}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <CatalogMetric
            label={t('catalog.assurance.metrics.open')}
            value={summary?.openCount ?? 0}
            detail={t('catalog.assurance.metrics.openDetail')}
          />
          <CatalogMetric
            label={t('catalog.assurance.metrics.critical')}
            value={summary?.criticalCount ?? 0}
            detail={t('catalog.assurance.metrics.criticalDetail')}
          />
          <CatalogMetric
            label={t('catalog.assurance.metrics.owner')}
            value={summary?.ownerMissingCount ?? 0}
            detail={t('catalog.assurance.metrics.ownerDetail')}
          />
          <CatalogMetric
            label={t('catalog.assurance.metrics.deprecation')}
            value={summary?.deprecationImpactCount ?? 0}
            detail={t('catalog.assurance.metrics.deprecationDetail')}
          />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) 360px' },
          gap: 2,
          minWidth: 0,
        }}
      >
        <EnterpriseDataGrid
          ariaLabel={t('catalog.assurance.queueLabel')}
          rows={findings}
          columns={columns}
          getRowId={(row) => row.findingId}
          loading={loading}
          hideFooter={findings.length <= 20}
          initialState={{ pagination: { paginationModel: { page: 0, pageSize: 20 } } }}
          onRowClick={({ row }) => onSelect(row.findingId)}
        />
        <Box
          component="aside"
          aria-label={t('catalog.assurance.inspector.title')}
          sx={{ minWidth: 0, borderLeft: { xl: 1 }, borderColor: 'divider', pl: { xl: 2 } }}
        >
          {!selected ? (
            <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
              <ScanSearch size={28} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('catalog.assurance.inspector.select')}
              </Typography>
            </Box>
          ) : (
            <Stack gap={1.5}>
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={selected.severity === 'CRITICAL' ? 'error' : 'default'}
                    label={display('severities', selected.severity)}
                  />
                  <Chip
                    size="small"
                    label={t(`catalog.assurance.states.${selected.lifecycleState}`)}
                  />
                </Stack>
                <Typography component="h3" variant="subtitle1" sx={{ mt: 1.25 }}>
                  {t(`catalog.assurance.findings.${selected.findingCode}`)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {selected.entityRef}
                </Typography>
              </Box>
              <Divider />
              <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1 }}>
                {Object.entries(selected.evidence).map(([key, value]) => (
                  <Box key={key} sx={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 1 }}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {key}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="body2"
                      sx={{ m: 0, overflowWrap: 'anywhere' }}
                    >
                      {value === null ? '-' : String(value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Divider />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('catalog.assurance.inspector.hash', {
                  hash: selected.evidenceSha256,
                })}
              </Typography>
              {selected.dispositionReason && (
                <Alert severity="info">
                  {t('catalog.assurance.inspector.disposition', {
                    reason: selected.dispositionReason,
                  })}
                </Alert>
              )}
              {['OPEN', 'ACKNOWLEDGED'].includes(selected.lifecycleState) && (
                <ActionButton intent="secondary" onClick={() => onReview(selected)}>
                  {t('catalog.assurance.actions.recordDisposition')}
                </ActionButton>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Stack>
  );
}
