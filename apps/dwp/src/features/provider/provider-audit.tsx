import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Ban, KeyRound, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getProviderAuditInsights,
  listProviderAuditEvents,
  listProviderTenants,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type { GridColDef } from '@mui/x-data-grid';
import type { ProviderAuditEvent } from '@dwp-frontend/shared-utils';

import {
  formatProviderDate,
  parseProviderJson,
  ProviderError,
  ProviderLoading,
  ProviderSectionHeading,
} from './provider-ui';

function AuditEventDialog({ event, onClose }: { event: ProviderAuditEvent; onClose: () => void }) {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('audit.detail.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack gap={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {[
              [t('audit.columns.time'), formatProviderDate(event.occurredAt)],
              [t('audit.columns.category'), t(`audit.categories.${event.eventCategory}`)],
              [t('audit.columns.operator'), event.operatorName ?? '-'],
              [t('audit.columns.tenant'), event.tenantKey ?? t('audit.global')],
              [t('audit.columns.action'), display('auditActions', event.action)],
              [t('audit.columns.outcome'), t(`audit.outcomes.${event.outcome}`)],
              [
                t('audit.detail.target'),
                `${display('targetTypes', event.targetType)} / ${event.targetId}`,
              ],
              [t('audit.columns.correlation'), event.correlationId ?? '-'],
            ].map(([label, value]) => (
              <Box key={label} minWidth={0}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {t('audit.detail.rawCode')}
            </Typography>
            <Box
              component="code"
              sx={{ display: 'block', p: 1.5, bgcolor: 'action.hover', overflowWrap: 'anywhere' }}
            >
              {event.action}
            </Box>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              {t('audit.detail.snapshot')}
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                maxHeight: 320,
                overflow: 'auto',
                bgcolor: 'action.hover',
                border: 1,
                borderColor: 'divider',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {JSON.stringify(parseProviderJson(event.redactedSnapshot), null, 2)}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('actions.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function ProviderAudit() {
  const { t } = useTranslation('provider');
  const display = useDisplayDictionary();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedEventId = searchParams.get('event');
  const requestedQuery = searchParams.get('query') ?? '';
  const requestedTenantId = searchParams.get('tenantId') ?? 'ALL';
  const [tenantId, setTenantId] = useState(requestedTenantId);
  const [outcome, setOutcome] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState(() => requestedEventId ?? requestedQuery);
  const [selected, setSelected] = useState<ProviderAuditEvent | null>(null);
  const events = useQuery({
    queryKey: ['provider', 'audit', tenantId],
    queryFn: () => listProviderAuditEvents(tenantId === 'ALL' ? undefined : tenantId),
  });
  const insights = useQuery({
    queryKey: ['provider', 'audit-insights'],
    queryFn: getProviderAuditInsights,
  });
  const tenants = useQuery({
    queryKey: ['provider', 'tenants', 'audit'],
    queryFn: () => listProviderTenants({ page: 0, size: 100 }),
  });
  const visibleEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (events.data ?? []).filter((event) => {
      if (outcome !== 'ALL' && event.outcome !== outcome) return false;
      if (category !== 'ALL' && event.eventCategory !== category) return false;
      if (!normalized) return true;
      return [
        event.action,
        event.targetType,
        event.targetId,
        event.operatorName,
        event.tenantKey,
        event.correlationId,
      ].some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [category, events.data, outcome, query]);

  useEffect(() => {
    if (!events.data) return;
    if (!requestedEventId) {
      setSelected(null);
      return;
    }
    const event = events.data.find((item) => item.auditEventId === requestedEventId);
    setSelected(event ?? null);
    setQuery(requestedEventId);
  }, [events.data, requestedEventId]);

  useEffect(() => {
    if (requestedEventId) return;
    setQuery(requestedQuery);
    setTenantId(requestedTenantId);
  }, [requestedEventId, requestedQuery, requestedTenantId]);

  const updateFilterUrl = (nextQuery: string, nextTenantId: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    if (nextQuery.trim()) next.set('query', nextQuery.trim());
    else next.delete('query');
    if (nextTenantId !== 'ALL') next.set('tenantId', nextTenantId);
    else next.delete('tenantId');
    setSearchParams(next, { replace: true });
  };

  const selectEvent = (event: ProviderAuditEvent) => {
    const next = new URLSearchParams(searchParams);
    next.set('event', event.auditEventId);
    setSearchParams(next);
  };
  const closeEvent = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    setSearchParams(next, { replace: true });
    setSelected(null);
    setQuery('');
  };

  const columns = useMemo<GridColDef<ProviderAuditEvent>[]>(
    () => [
      {
        field: 'occurredAt',
        headerName: t('audit.columns.time'),
        width: 175,
        valueFormatter: (value?: string | null) => formatProviderDate(value),
      },
      {
        field: 'action',
        headerName: t('audit.columns.action'),
        minWidth: 245,
        flex: 1.2,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={750} noWrap>
              {display('auditActions', row.action)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {display('targetTypes', row.targetType)} / {row.targetId}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'eventCategory',
        headerName: t('audit.columns.category'),
        minWidth: 155,
        flex: 0.65,
        valueFormatter: (value: string) => t(`audit.categories.${value}`, { defaultValue: value }),
      },
      {
        field: 'tenantKey',
        headerName: t('audit.columns.tenant'),
        minWidth: 130,
        flex: 0.55,
        valueFormatter: (value?: string | null) => value ?? t('audit.global'),
      },
      {
        field: 'operatorName',
        headerName: t('audit.columns.operator'),
        minWidth: 165,
        flex: 0.7,
        valueFormatter: (value?: string | null) => value ?? '-',
      },
      {
        field: 'outcome',
        headerName: t('audit.columns.outcome'),
        width: 105,
        renderCell: ({ value }) => (
          <Chip
            size="small"
            variant="outlined"
            color={value === 'SUCCESS' ? 'success' : value === 'FAILED' ? 'error' : 'warning'}
            label={t(`audit.outcomes.${String(value)}`, { defaultValue: String(value) })}
          />
        ),
      },
    ],
    [display, t]
  );

  if (events.isLoading || insights.isLoading || tenants.isLoading) return <ProviderLoading />;
  if (events.isError || insights.isError || tenants.isError)
    return <ProviderError error={events.error ?? insights.error ?? tenants.error} />;
  if (!insights.data) return null;

  const metrics = [
    { label: t('audit.metrics.events'), value: insights.data.events24Hours, icon: KeyRound },
    { label: t('audit.metrics.failed'), value: insights.data.failed24Hours, icon: ShieldAlert },
    { label: t('audit.metrics.denied'), value: insights.data.denied24Hours, icon: Ban },
    {
      label: t('audit.metrics.privileged'),
      value: insights.data.privilegedAccess24Hours,
      icon: KeyRound,
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
          title={t('audit.title')}
          description={t('audit.description')}
          action={
            <Tooltip title={t('actions.refresh')}>
              <IconButton aria-label={t('actions.refresh')} onClick={() => void events.refetch()}>
                <RefreshCw size={18} />
              </IconButton>
            </Tooltip>
          }
        />
        {requestedEventId && events.data && !selected && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('audit.deepLinkNotFound', { id: requestedEventId })}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', lg: 'row' }} gap={1} sx={{ mt: 1.5, mb: 1 }}>
          <TextField
            size="small"
            label={t('audit.search')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              updateFilterUrl(event.target.value, tenantId);
            }}
            sx={{ minWidth: { lg: 320 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label={t('fields.tenant')}
            value={tenantId}
            onChange={(event) => {
              setTenantId(event.target.value);
              updateFilterUrl(query, event.target.value);
            }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="ALL">{t('audit.allTenants')}</MenuItem>
            {(tenants.data?.content ?? []).map((tenant) => (
              <MenuItem key={tenant.tenantId} value={tenant.tenantId}>
                {tenant.displayName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('audit.columns.category')}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="ALL">{t('audit.allCategories')}</MenuItem>
            {insights.data.categories.map((item) => (
              <MenuItem key={item.key} value={item.key}>
                {t(`audit.categories.${item.key}`, { defaultValue: item.key })} ({item.count})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('audit.columns.outcome')}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            sx={{ minWidth: 145 }}
          >
            <MenuItem value="ALL">{t('audit.allOutcomes')}</MenuItem>
            {['SUCCESS', 'FAILED', 'DENIED'].map((value) => (
              <MenuItem key={value} value={value}>
                {t(`audit.outcomes.${value}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <EnterpriseDataGrid
          ariaLabel={t('audit.title')}
          rows={visibleEvents}
          columns={columns}
          getRowId={(row) => row.auditEventId}
          onRowClick={({ row }) => selectEvent(row)}
          loading={events.isFetching}
          hideFooter
          maxVisibleRows={14}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Box>

      {selected && <AuditEventDialog event={selected} onClose={closeEvent} />}
    </Stack>
  );
}
