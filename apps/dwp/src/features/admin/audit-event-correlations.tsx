import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Braces,
  CircleAlert,
  Copy,
  GitBranch,
  Layers3,
  Network,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  getEventCorrelationDetail,
  listEventCorrelations,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionIconButton,
  DetailInspector,
  EnterpriseDataGrid,
  EntityTimeline,
  FilterBar,
  FormField,
  LocalErrorState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';

import { useSystemCodeOptions } from '../../components/use-system-code-options';
import { RiskScore, SeverityChip, useAuditActionLabel } from './audit-ui';

import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import type {
  AuditWindow,
  EventClassification,
  EventCorrelation,
  EventDomain,
  EventEnvelope,
} from '@dwp-frontend/shared-utils';

const WINDOWS: AuditWindow[] = ['H24', 'D7', 'D30', 'D90'];
const DOMAINS: EventDomain[] = [
  'IDENTITY_ACCESS',
  'PEOPLE_WORKFORCE',
  'PLATFORM_WORKSPACE',
  'PROVIDER_OPERATIONS',
  'AI_AUTOMATION',
  'DATA_GOVERNANCE',
];
const CLASSIFICATIONS: EventClassification[] = ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

function EnvelopeEvidence({ event }: { event: EventEnvelope }) {
  const { t } = useTranslation('admin');
  const auditActionLabel = useAuditActionLabel();
  const states = [
    { key: 'before', label: t('auditControl.correlation.detail.before'), value: event.beforeState },
    { key: 'after', label: t('auditControl.correlation.detail.after'), value: event.afterState },
    {
      key: 'metadata',
      label: t('auditControl.correlation.detail.metadata'),
      value: event.metadata,
    },
  ].filter((entry) => Object.keys(entry.value).length > 0);

  return (
    <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider', pt: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="p" variant="subtitle2">
            {auditActionLabel(event.eventType)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.correlation.detail.envelopeVersion', {
              eventId: event.eventId,
              version: event.schemaVersion,
            })}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          color={event.classification === 'RESTRICTED' ? 'error' : 'default'}
          label={t(`auditControl.correlation.classification.${event.classification}`)}
        />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1.5,
          mt: 2,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.correlation.detail.subject')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {event.subjectDisplayName || event.subjectId}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.correlation.detail.actor')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {event.actorDisplayName || event.actorId || event.actorType}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.correlation.detail.causation')}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {event.causationId || t('auditControl.correlation.detail.rootEvent')}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('auditControl.correlation.detail.integrity')}
          </Typography>
          <Typography variant="body2" noWrap title={event.recordHash}>
            {event.recordHash.slice(0, 12)}...
          </Typography>
        </Box>
      </Box>
      {states.map((entry) => (
        <Box key={entry.key} sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {entry.label}
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 0.5,
              p: 1.25,
              maxHeight: 180,
              overflow: 'auto',
              border: 1,
              borderColor: 'divider',
              bgcolor: 'action.hover',
              fontFamily: 'monospace',
              fontSize: 11.5,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {JSON.stringify(entry.value, null, 2)}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function AuditEventCorrelations() {
  const { t } = useTranslation('admin');
  const auditActionLabel = useAuditActionLabel();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'));
  const toast = useToast();
  const [window, setWindow] = useState<AuditWindow>('D7');
  const [domain, setDomain] = useState<EventDomain | 'ALL'>('ALL');
  const [classification, setClassification] = useState<EventClassification | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const windows = useSystemCodeOptions('PLATFORM.AUDIT.WINDOW', WINDOWS);
  const domains = useSystemCodeOptions('PLATFORM.EVENT_ENVELOPE.DOMAIN', DOMAINS);
  const classifications = useSystemCodeOptions(
    'PLATFORM.EVENT_ENVELOPE.CLASSIFICATION',
    CLASSIFICATIONS
  );
  const filters = {
    window,
    domain,
    classification,
    query,
    page: pagination.page,
    size: pagination.pageSize,
  };
  const correlationsQuery = useQuery({
    queryKey: ['audit-control', 'event-correlations', filters],
    queryFn: () => listEventCorrelations(filters),
    placeholderData: (previous) => previous,
  });
  const detailQuery = useQuery({
    queryKey: ['audit-control', 'event-correlation', selectedId],
    queryFn: () => getEventCorrelationDetail(selectedId ?? ''),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (!desktop || selectedId || !correlationsQuery.data?.content[0]) return;
    setSelectedId(correlationsQuery.data.content[0].correlationId);
  }, [correlationsQuery.data?.content, desktop, selectedId]);

  useEffect(() => {
    setSelectedEventId(detailQuery.data?.events.at(-1)?.eventId ?? null);
  }, [detailQuery.data]);

  const columns = useMemo<GridColDef<EventCorrelation>[]>(
    () => [
      {
        field: 'lastOccurredAt',
        headerName: t('auditControl.correlation.columns.lastSeen'),
        width: 168,
        renderCell: ({ row }) =>
          formatDate(row.lastOccurredAt, { dateStyle: 'short', timeStyle: 'short' }),
      },
      {
        field: 'latestEventType',
        headerName: t('auditControl.correlation.columns.flow'),
        minWidth: 230,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.5 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {auditActionLabel(row.latestEventType)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t('auditControl.correlation.flowMeta', {
                events: row.eventCount,
                services: row.serviceCount,
              })}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'domains',
        headerName: t('auditControl.correlation.columns.domains'),
        minWidth: 190,
        flex: 0.8,
        renderCell: ({ row }) => (
          <Stack direction="row" gap={0.5} sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Chip
              size="small"
              variant="outlined"
              label={t(`auditControl.correlation.domain.${row.domains[0]}`)}
            />
            {row.domains.length > 1 && <Chip size="small" label={`+${row.domains.length - 1}`} />}
          </Stack>
        ),
      },
      {
        field: 'classifications',
        headerName: t('auditControl.correlation.columns.classification'),
        width: 124,
        renderCell: ({ row }) => {
          const value = row.classifications.includes('RESTRICTED')
            ? 'RESTRICTED'
            : row.classifications.includes('CONFIDENTIAL')
              ? 'CONFIDENTIAL'
              : 'INTERNAL';
          return (
            <Chip
              size="small"
              color={
                value === 'RESTRICTED' ? 'error' : value === 'CONFIDENTIAL' ? 'warning' : 'default'
              }
              variant="outlined"
              label={t(`auditControl.correlation.classification.${value}`)}
            />
          );
        },
      },
      {
        field: 'maxRiskScore',
        headerName: t('auditControl.correlation.columns.risk'),
        width: 108,
        renderCell: ({ row }) => <RiskScore value={row.maxRiskScore} />,
      },
    ],
    [auditActionLabel, t]
  );

  const pageRows = correlationsQuery.data?.content ?? [];
  const distinctServices = new Set(pageRows.flatMap((row) => row.sourceServices)).size;
  const selectedEvent = detailQuery.data?.events.find((event) => event.eventId === selectedEventId);
  const selectedIndex = pageRows.findIndex((row) => row.correlationId === selectedId);

  const selectCorrelation = (id: string) => {
    setSelectedId(id);
    setSelectedEventId(null);
  };

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        sx={(muiTheme) => ({
          px: 2.25,
          py: 2,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          bgcolor: alpha(muiTheme.palette.primary.main, 0.035),
          borderBottom: 1,
          borderColor: 'divider',
        })}
      >
        <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 36,
              height: 36,
              flex: '0 0 36px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            <GitBranch size={19} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="subtitle1">
              {t('auditControl.correlation.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {t('auditControl.correlation.description')}
            </Typography>
          </Box>
        </Stack>
        <ActionIconButton
          label={t('common.actions.refresh')}
          loading={correlationsQuery.isFetching}
          onClick={() => void correlationsQuery.refetch()}
        >
          <RefreshCw size={18} />
        </ActionIconButton>
      </Box>

      <OperationalKpiStrip
        ariaLabel={t('auditControl.correlation.summaryLabel')}
        items={[
          {
            key: 'flows',
            value: formatNumber(correlationsQuery.data?.totalElements ?? 0),
            label: t('auditControl.correlation.kpi.flows'),
            detail: t('auditControl.correlation.kpi.flowsDetail'),
          },
          {
            key: 'crossDomain',
            value: formatNumber(pageRows.filter((row) => row.domainCount > 1).length),
            label: t('auditControl.correlation.kpi.crossDomain'),
            detail: t('auditControl.correlation.kpi.visiblePage'),
            tone: 'info',
          },
          {
            key: 'attention',
            value: formatNumber(pageRows.filter((row) => row.attentionRequired).length),
            label: t('auditControl.correlation.kpi.attention'),
            detail: t('auditControl.correlation.kpi.visiblePage'),
            tone: 'critical',
          },
          {
            key: 'services',
            value: formatNumber(distinctServices),
            label: t('auditControl.correlation.kpi.services'),
            detail: t('auditControl.correlation.kpi.visiblePage'),
          },
        ]}
      />

      <Box sx={{ px: 2 }}>
        <FilterBar
          ariaLabel={t('auditControl.correlation.filters.label')}
          searchLabel={t('auditControl.correlation.filters.search')}
          searchPlaceholder={t('auditControl.correlation.filters.searchPlaceholder')}
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPagination((current) => ({ ...current, page: 0 }));
          }}
          filters={
            <>
              <FormField
                select
                size="small"
                label={t('auditControl.filters.window')}
                value={window}
                onChange={(event) => {
                  setWindow(event.target.value as AuditWindow);
                  setPagination((current) => ({ ...current, page: 0 }));
                }}
                sx={{ minWidth: 112 }}
              >
                {windows.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`auditControl.windows.${value}`)}
                  </MenuItem>
                ))}
              </FormField>
              <FormField
                select
                size="small"
                label={t('auditControl.correlation.filters.domain')}
                value={domain}
                onChange={(event) => {
                  setDomain(event.target.value as EventDomain | 'ALL');
                  setPagination((current) => ({ ...current, page: 0 }));
                }}
                sx={{ minWidth: 174 }}
              >
                <MenuItem value="ALL">{t('auditControl.correlation.filters.allDomains')}</MenuItem>
                {domains.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`auditControl.correlation.domain.${value}`)}
                  </MenuItem>
                ))}
              </FormField>
              <FormField
                select
                size="small"
                label={t('auditControl.correlation.filters.classification')}
                value={classification}
                onChange={(event) => {
                  setClassification(event.target.value as EventClassification | 'ALL');
                  setPagination((current) => ({ ...current, page: 0 }));
                }}
                sx={{ minWidth: 146 }}
              >
                <MenuItem value="ALL">
                  {t('auditControl.correlation.filters.allClassifications')}
                </MenuItem>
                {classifications.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`auditControl.correlation.classification.${value}`)}
                  </MenuItem>
                ))}
              </FormField>
            </>
          }
          activeFilters={[
            ...(domain === 'ALL'
              ? []
              : [
                  {
                    key: 'domain',
                    label: t(`auditControl.correlation.domain.${domain}`),
                    onRemove: () => setDomain('ALL'),
                  },
                ]),
            ...(classification === 'ALL'
              ? []
              : [
                  {
                    key: 'classification',
                    label: t(`auditControl.correlation.classification.${classification}`),
                    onRemove: () => setClassification('ALL'),
                  },
                ]),
          ]}
          resetLabel={t('auditControl.filters.clear')}
          onReset={() => {
            setDomain('ALL');
            setClassification('ALL');
            setQuery('');
          }}
          resultLabel={t('auditControl.correlation.resultCount', {
            count: correlationsQuery.data?.totalElements ?? 0,
          })}
        />
      </Box>

      {correlationsQuery.isError ? (
        <LocalErrorState
          title={t('auditControl.correlation.loadErrorTitle')}
          description={t('auditControl.correlation.loadError')}
          retryLabel={t('common.actions.retry')}
          onRetry={() => void correlationsQuery.refetch()}
          retrying={correlationsQuery.isFetching}
          size="page"
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: desktop && selectedId ? 'minmax(0, 1fr) 440px' : 'minmax(0, 1fr)',
            minHeight: 560,
          }}
        >
          {desktop ? (
            <EnterpriseDataGrid
              ariaLabel={t('auditControl.correlation.tableLabel')}
              rows={pageRows}
              columns={columns}
              getRowId={(row) => row.correlationId}
              loading={correlationsQuery.isLoading}
              rowHeight={62}
              paginationMode="server"
              rowCount={correlationsQuery.data?.totalElements ?? 0}
              paginationModel={pagination}
              onPaginationModelChange={setPagination}
              pageSizeOptions={[10, 25, 50, 100]}
              onRowClick={({ row }) => selectCorrelation(row.correlationId)}
              rowSelectionModel={
                selectedId ? { type: 'include', ids: new Set([selectedId]) } : undefined
              }
              sx={{
                border: 0,
                borderRadius: 0,
                minHeight: 560,
                '& .MuiDataGrid-row': { cursor: 'pointer' },
              }}
            />
          ) : (
            <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {pageRows.map((row) => (
                <Box
                  component="li"
                  key={row.correlationId}
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemButton
                    onClick={() => selectCorrelation(row.correlationId)}
                    sx={{ p: 2 }}
                  >
                    <Box sx={{ minWidth: 0, width: 1 }}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography component="p" variant="subtitle2" noWrap>
                          {auditActionLabel(row.latestEventType)}
                        </Typography>
                        <SeverityChip severity={row.maxSeverity} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                        {row.latestSubjectDisplayName || row.latestSubjectId}
                      </Typography>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                        sx={{ mt: 1 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {t('auditControl.correlation.flowMeta', {
                            events: row.eventCount,
                            services: row.serviceCount,
                          })}
                        </Typography>
                        <RiskScore value={row.maxRiskScore} />
                      </Stack>
                    </Box>
                  </ListItemButton>
                </Box>
              ))}
            </Box>
          )}

          <DetailInspector
            open={Boolean(selectedId)}
            variant={desktop ? 'inline' : 'drawer'}
            width={440}
            title={t('auditControl.correlation.detail.title')}
            subtitle={detailQuery.data?.summary.latestSubjectDisplayName || selectedId || undefined}
            closeLabel={t('common.actions.close')}
            onClose={() => setSelectedId(null)}
            previousLabel={t('auditControl.correlation.detail.previous')}
            nextLabel={t('auditControl.correlation.detail.next')}
            previousDisabled={selectedIndex <= 0}
            nextDisabled={selectedIndex < 0 || selectedIndex >= pageRows.length - 1}
            onPrevious={() =>
              selectedIndex > 0 && selectCorrelation(pageRows[selectedIndex - 1].correlationId)
            }
            onNext={() =>
              selectedIndex >= 0 &&
              selectedIndex < pageRows.length - 1 &&
              selectCorrelation(pageRows[selectedIndex + 1].correlationId)
            }
            status={
              detailQuery.data?.summary.attentionRequired ? (
                <Chip
                  size="small"
                  color="error"
                  variant="outlined"
                  icon={<CircleAlert size={14} />}
                  label={t('auditControl.correlation.attentionRequired')}
                />
              ) : (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<ShieldCheck size={14} />}
                  label={t('auditControl.correlation.controlled')}
                />
              )
            }
          >
            {detailQuery.isError ? (
              <LocalErrorState
                title={t('auditControl.correlation.loadErrorTitle')}
                description={t('auditControl.correlation.detail.loadError')}
                retryLabel={t('common.actions.retry')}
                onRetry={() => void detailQuery.refetch()}
                size="compact"
              />
            ) : detailQuery.data ? (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('auditControl.correlation.detail.correlationId')}
                    </Typography>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                      {detailQuery.data.summary.correlationId}
                    </Typography>
                  </Box>
                  <ActionIconButton
                    label={t('auditControl.detail.copy')}
                    onClick={async () => {
                      await navigator.clipboard.writeText(detailQuery.data.summary.correlationId);
                      toast.success(t('auditControl.detail.copied'));
                    }}
                  >
                    <Copy size={17} />
                  </ActionIconButton>
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
                  {detailQuery.data.summary.domains.map((value) => (
                    <Chip
                      key={value}
                      size="small"
                      variant="outlined"
                      icon={<Network size={14} />}
                      label={t(`auditControl.correlation.domain.${value}`)}
                    />
                  ))}
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<Layers3 size={14} />}
                    label={t('auditControl.correlation.eventCount', {
                      count: detailQuery.data.summary.eventCount,
                    })}
                  />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>
                  {t('auditControl.correlation.detail.timeline')}
                </Typography>
                <EntityTimeline
                  ariaLabel={t('auditControl.correlation.detail.timeline')}
                  selectedId={selectedEventId ?? undefined}
                  items={detailQuery.data.events.map((event) => ({
                    id: event.eventId,
                    title: auditActionLabel(event.eventType),
                    summary: `${event.subjectDisplayName || event.subjectId} / ${t(
                      `auditControl.correlation.domain.${event.domain}`
                    )}`,
                    timestamp: formatDate(event.occurredAt, {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    }),
                    source: event.sourceService,
                    status: t(`auditControl.outcome.${event.outcome}`),
                    icon: event.causationId ? <GitBranch size={15} /> : <Braces size={15} />,
                  }))}
                  onSelect={(item) => setSelectedEventId(item.id)}
                />
                {selectedEvent && <EnvelopeEvidence event={selectedEvent} />}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('auditControl.correlation.detail.loading')}
              </Typography>
            )}
          </DetailInspector>
        </Box>
      )}
    </Box>
  );
}
