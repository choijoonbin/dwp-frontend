import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookmarkPlus,
  Copy,
  Download,
  FileJson2,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAuditExport,
  deleteAuditSavedSearch,
  downloadAuditExport,
  listAuditEvents,
  listAuditSavedSearches,
  saveAuditSearch,
  usePermissions,
  useToast,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemButton from '@mui/material/ListItemButton';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError } from './admin-ui';
import {
  OutcomeChip,
  RiskScore,
  SeverityChip,
  actorLabel,
  fallbackAction,
  targetLabel,
} from './audit-ui';

import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import type {
  AuditCategory,
  AuditEvent,
  AuditOutcome,
  AuditSavedSearch,
  AuditSeverity,
  AuditWindow,
} from '@dwp-frontend/shared-utils';

const WINDOWS: AuditWindow[] = ['H24', 'D7', 'D30', 'D90'];
const CATEGORIES: AuditCategory[] = [
  'ALL',
  'ADMIN_CHANGE',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'DATA_ACCESS',
  'DATA_EXPORT',
  'PROVISIONING',
  'AI_ACTION',
  'POLICY_DENIED',
  'SYSTEM_EVENT',
];
const SEVERITIES: AuditSeverity[] = ['ALL', 'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const OUTCOMES: AuditOutcome[] = ['ALL', 'SUCCESS', 'DENIED', 'FAILED'];

function JsonState({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          minHeight: 120,
          maxHeight: 260,
          overflow: 'auto',
          m: 0,
          mt: 0.75,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'action.hover',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '128px minmax(0, 1fr)', gap: 2, py: 0.9 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
      >
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

export function AuditExplorer() {
  const { t } = useTranslation('admin');
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [window, setWindow] = useState<AuditWindow>('D7');
  const [category, setCategory] = useState<AuditCategory>('ALL');
  const [severity, setSeverity] = useState<AuditSeverity>('ALL');
  const [outcome, setOutcome] = useState<AuditOutcome>('ALL');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [sourceService, setSourceService] = useState('');
  const [actor, setActor] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [actorInput, setActorInput] = useState('');
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 50 });
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportReason, setExportReason] = useState('');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'JSONL'>('CSV');
  const [savedSearchId, setSavedSearchId] = useState('');
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState('');
  const [savedSearchShared, setSavedSearchShared] = useState(false);

  const savedSearchesQuery = useQuery({
    queryKey: ['audit-control', 'saved-searches'],
    queryFn: listAuditSavedSearches,
  });

  const filters = {
    window,
    category,
    severity,
    outcome,
    sourceService,
    actor,
    query,
    page: pagination.page,
    size: pagination.pageSize,
  };
  const eventsQuery = useQuery({
    queryKey: ['audit-control', 'events', filters],
    queryFn: () => listAuditEvents(filters),
    placeholderData: (previous) => previous,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const job = await createAuditExport({
        window,
        category,
        severity,
        outcome,
        sourceService,
        actor,
        query,
        format: exportFormat,
        reason: exportReason,
      });
      const blob = await downloadAuditExport(job.exportJobId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dwp-audit-${job.exportJobId}.${exportFormat === 'CSV' ? 'csv' : 'jsonl'}`;
      anchor.click();
      URL.revokeObjectURL(url);
      return job;
    },
    onSuccess: (job) => {
      setExportOpen(false);
      setExportReason('');
      toast.success(t('auditControl.export.completed', { count: job.rowCount }));
    },
    onError: () => toast.error(t('auditControl.export.failed')),
  });

  const saveSearchMutation = useMutation({
    mutationFn: () =>
      saveAuditSearch({
        name: savedSearchName.trim(),
        shared: savedSearchShared,
        window,
        category,
        severity,
        outcome,
        query,
      }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['audit-control', 'saved-searches'] });
      setSavedSearchId(saved.savedSearchId);
      setSaveSearchOpen(false);
      setSavedSearchName('');
      setSavedSearchShared(false);
      toast.success(t('auditControl.savedSearches.saved'));
    },
    onError: () => toast.error(t('auditControl.savedSearches.saveFailed')),
  });

  const deleteSearchMutation = useMutation({
    mutationFn: deleteAuditSavedSearch,
    onSuccess: async () => {
      setSavedSearchId('');
      await queryClient.invalidateQueries({ queryKey: ['audit-control', 'saved-searches'] });
      toast.success(t('auditControl.savedSearches.deleted'));
    },
    onError: () => toast.error(t('auditControl.savedSearches.deleteFailed')),
  });

  const applySavedSearch = (saved: AuditSavedSearch) => {
    setSavedSearchId(saved.savedSearchId);
    setWindow(saved.criteria.window ?? 'D7');
    setCategory(saved.criteria.category ?? 'ALL');
    setSeverity(saved.criteria.severity ?? 'ALL');
    setOutcome(saved.criteria.outcome ?? 'ALL');
    setSourceService(saved.criteria.sourceService ?? '');
    setActor(saved.criteria.actor ?? '');
    setSourceInput(saved.criteria.sourceService ?? '');
    setActorInput(saved.criteria.actor ?? '');
    setQueryInput(saved.criteria.query ?? '');
    setQuery(saved.criteria.query ?? '');
    setPagination((current) => ({ ...current, page: 0 }));
  };

  const columns = useMemo<GridColDef<AuditEvent>[]>(
    () => [
      {
        field: 'occurredAt',
        headerName: t('auditControl.events.columns.time'),
        minWidth: 174,
        flex: 0.8,
        renderCell: ({ row }) =>
          formatDate(row.occurredAt, { dateStyle: 'short', timeStyle: 'medium' }),
      },
      {
        field: 'severity',
        headerName: t('auditControl.events.columns.severity'),
        width: 110,
        renderCell: ({ row }) => <SeverityChip severity={row.severity} />,
      },
      {
        field: 'riskScore',
        headerName: t('auditControl.events.columns.risk'),
        width: 112,
        renderCell: ({ row }) => <RiskScore value={row.riskScore} />,
      },
      {
        field: 'action',
        headerName: t('auditControl.events.columns.activity'),
        minWidth: 230,
        flex: 1.15,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 0.75 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {fallbackAction(row.action)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {t(`auditControl.category.${row.category}`)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'actorDisplayName',
        headerName: t('auditControl.events.columns.actor'),
        minWidth: 150,
        flex: 0.75,
        valueGetter: (_, row) => actorLabel(row),
      },
      {
        field: 'targetDisplayName',
        headerName: t('auditControl.events.columns.target'),
        minWidth: 170,
        flex: 0.85,
        valueGetter: (_, row) => targetLabel(row),
      },
      {
        field: 'sourceService',
        headerName: t('auditControl.events.columns.source'),
        minWidth: 170,
        flex: 0.75,
      },
      {
        field: 'outcome',
        headerName: t('auditControl.events.columns.outcome'),
        width: 106,
        renderCell: ({ row }) => <OutcomeChip outcome={row.outcome} />,
      },
    ],
    [t]
  );

  const copy = async (value?: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(t('auditControl.detail.copied'));
  };

  return (
    <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          bgcolor: 'background.paper',
        }}
      >
        <TextField
          select
          size="small"
          label={t('auditControl.savedSearches.label')}
          value={savedSearchId}
          onChange={(event) => {
            const saved = savedSearchesQuery.data?.find(
              (item) => item.savedSearchId === event.target.value
            );
            if (saved) applySavedSearch(saved);
            else setSavedSearchId('');
          }}
          sx={{ width: { xs: 1, sm: 320 } }}
        >
          <MenuItem value="">{t('auditControl.savedSearches.current')}</MenuItem>
          {(savedSearchesQuery.data ?? []).map((saved) => (
            <MenuItem key={saved.savedSearchId} value={saved.savedSearchId}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                {saved.shared && <Users size={14} aria-hidden="true" />}
                <Typography variant="body2" noWrap>
                  {saved.name}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" gap={0.5}>
          <Tooltip title={t('auditControl.savedSearches.save')}>
            <IconButton
              aria-label={t('auditControl.savedSearches.save')}
              onClick={() => setSaveSearchOpen(true)}
            >
              <BookmarkPlus size={18} />
            </IconButton>
          </Tooltip>
          {savedSearchesQuery.data?.find((item) => item.savedSearchId === savedSearchId)
            ?.editable && (
            <Tooltip title={t('auditControl.savedSearches.delete')}>
              <IconButton
                color="error"
                aria-label={t('auditControl.savedSearches.delete')}
                disabled={deleteSearchMutation.isPending}
                onClick={() => deleteSearchMutation.mutate(savedSearchId)}
              >
                <Trash2 size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
          {t('auditControl.savedSearches.description')}
        </Typography>
      </Box>
      <Divider />
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          setPagination((current) => ({ ...current, page: 0 }));
          setQuery(queryInput.trim());
        }}
        sx={{
          p: 2,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'auto repeat(3, minmax(130px, 0.45fr)) minmax(220px, 1fr) auto',
          },
          gap: 1.25,
          alignItems: 'center',
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={window}
          onChange={(_, value: AuditWindow | null) => {
            if (value) {
              setWindow(value);
              setPagination((current) => ({ ...current, page: 0 }));
            }
          }}
          aria-label={t('auditControl.filters.window')}
        >
          {WINDOWS.map((item) => (
            <ToggleButton key={item} value={item}>
              {t(`auditControl.windows.${item}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          select
          size="small"
          label={t('auditControl.filters.category')}
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as AuditCategory);
            setPagination((current) => ({ ...current, page: 0 }));
          }}
        >
          {CATEGORIES.map((item) => (
            <MenuItem key={item} value={item}>
              {t(`auditControl.category.${item}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('auditControl.filters.severity')}
          value={severity}
          onChange={(event) => {
            setSeverity(event.target.value as AuditSeverity);
            setPagination((current) => ({ ...current, page: 0 }));
          }}
        >
          {SEVERITIES.map((item) => (
            <MenuItem key={item} value={item}>
              {t(`auditControl.severity.${item}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('auditControl.filters.outcome')}
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value as AuditOutcome);
            setPagination((current) => ({ ...current, page: 0 }));
          }}
        >
          {OUTCOMES.map((item) => (
            <MenuItem key={item} value={item}>
              {t(`auditControl.outcome.${item}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder={t('auditControl.filters.searchPlaceholder')}
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
        <Stack direction="row" gap={0.5} justifyContent="flex-end">
          <Tooltip title={t('auditControl.filters.apply')}>
            <IconButton type="submit" aria-label={t('auditControl.filters.apply')}>
              <Filter size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('auditControl.filters.advanced')}>
            <IconButton
              aria-label={t('auditControl.filters.advanced')}
              onClick={(event) => {
                setSourceInput(sourceService);
                setActorInput(actor);
                setAdvancedAnchor(event.currentTarget);
              }}
            >
              <SlidersHorizontal size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('common.actions.refresh')}>
            <IconButton
              aria-label={t('common.actions.refresh')}
              onClick={() => void eventsQuery.refetch()}
            >
              <RefreshCw size={18} />
            </IconButton>
          </Tooltip>
          {hasPermission('ADMIN.AUDIT_EXPORT', 'EXPORT') && (
            <Tooltip title={t('auditControl.export.open')}>
              <IconButton
                aria-label={t('auditControl.export.open')}
                onClick={() => setExportOpen(true)}
              >
                <Download size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>
      <Divider />

      <Popover
        open={Boolean(advancedAnchor)}
        anchorEl={advancedAnchor}
        onClose={() => setAdvancedAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: { xs: 'calc(100vw - 32px)', sm: 380 }, p: 2 } } }}
      >
        <Typography component="h2" variant="subtitle1">
          {t('auditControl.filters.advanced')}
        </Typography>
        <Stack gap={1.5} sx={{ mt: 1.5 }}>
          <TextField
            size="small"
            label={t('auditControl.filters.sourceService')}
            value={sourceInput}
            onChange={(event) => setSourceInput(event.target.value)}
            inputProps={{ maxLength: 120 }}
          />
          <TextField
            size="small"
            label={t('auditControl.filters.actor')}
            value={actorInput}
            onChange={(event) => setActorInput(event.target.value)}
            inputProps={{ maxLength: 160 }}
          />
          <Stack direction="row" justifyContent="flex-end" gap={1}>
            <Button
              color="inherit"
              onClick={() => {
                setSourceService('');
                setActor('');
                setSourceInput('');
                setActorInput('');
                setPagination((current) => ({ ...current, page: 0 }));
              }}
            >
              {t('auditControl.filters.clear')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setSourceService(sourceInput.trim());
                setActor(actorInput.trim());
                setPagination((current) => ({ ...current, page: 0 }));
                setAdvancedAnchor(null);
              }}
            >
              {t('auditControl.filters.apply')}
            </Button>
          </Stack>
        </Stack>
      </Popover>

      {eventsQuery.isError ? (
        <AdminPanelError message={t('auditControl.loadError')} />
      ) : desktop ? (
        <EnterpriseDataGrid
          ariaLabel={t('auditControl.events.label')}
          rows={eventsQuery.data?.content ?? []}
          columns={columns}
          getRowId={(row) => row.eventId}
          loading={eventsQuery.isLoading}
          rowHeight={58}
          paginationMode="server"
          rowCount={eventsQuery.data?.totalElements ?? 0}
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[25, 50, 100]}
          onRowClick={({ row }) => setSelected(row)}
          sx={{
            border: 0,
            borderRadius: 0,
            minHeight: 520,
            '& .MuiDataGrid-row': { cursor: 'pointer' },
          }}
        />
      ) : (
        <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
          {(eventsQuery.data?.content ?? []).map((event) => (
            <Box component="li" key={event.eventId}>
              <ListItemButton
                onClick={() => setSelected(event)}
                sx={{ display: 'block', p: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography component="p" variant="subtitle2">
                    {fallbackAction(event.action)}
                  </Typography>
                  <SeverityChip severity={event.severity} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {actorLabel(event)} / {targetLabel(event)}
                </Typography>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mt: 1 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(event.occurredAt, { dateStyle: 'short', timeStyle: 'short' })}
                  </Typography>
                  <RiskScore value={event.riskScore} />
                </Stack>
              </ListItemButton>
            </Box>
          ))}
        </Box>
      )}

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100%' } } }}
      >
        {selected && (
          <Box sx={{ minHeight: 1, display: 'flex', flexDirection: 'column' }}>
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              gap={2}
              sx={{ p: 2.5 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" gap={1} alignItems="center">
                  <SeverityChip severity={selected.severity} />
                  <OutcomeChip outcome={selected.outcome} />
                </Stack>
                <Typography component="h2" variant="h5" sx={{ mt: 1.5 }}>
                  {fallbackAction(selected.action)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {selected.sourceService} / {selected.sourceModule}
                </Typography>
              </Box>
              <IconButton aria-label={t('common.actions.close')} onClick={() => setSelected(null)}>
                <X size={20} />
              </IconButton>
            </Stack>
            <Divider />
            <Box sx={{ p: 2.5, overflowY: 'auto' }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography component="h3" variant="subtitle1">
                  {t('auditControl.detail.context')}
                </Typography>
                <RiskScore value={selected.riskScore} />
              </Stack>
              <DetailRow
                label={t('auditControl.detail.occurredAt')}
                value={formatDate(selected.occurredAt, { dateStyle: 'medium', timeStyle: 'long' })}
              />
              <DetailRow
                label={t('auditControl.events.columns.actor')}
                value={actorLabel(selected)}
              />
              <DetailRow
                label={t('auditControl.events.columns.target')}
                value={`${selected.targetType} / ${targetLabel(selected)}`}
              />
              <DetailRow
                label={t('auditControl.detail.roles')}
                value={selected.actorRoles.join(', ') || '—'}
              />
              <DetailRow
                label={t('auditControl.detail.retention')}
                value={selected.retentionClass}
              />
              <Divider sx={{ my: 2 }} />
              <Typography component="h3" variant="subtitle1">
                {t('auditControl.detail.traceability')}
              </Typography>
              {[
                ['correlation', selected.correlationId],
                ['trace', selected.traceId],
                ['eventId', selected.eventId],
              ].map(([key, value]) => (
                <Stack key={key} direction="row" alignItems="center" gap={1}>
                  <Box sx={{ flex: 1 }}>
                    <DetailRow label={t(`auditControl.detail.${key}`)} value={value} />
                  </Box>
                  {value && (
                    <Tooltip title={t('auditControl.detail.copy')}>
                      <IconButton size="small" onClick={() => void copy(value)}>
                        <Copy size={15} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              ))}
              <DetailRow label={t('auditControl.detail.hash')} value={selected.recordHash} />
              <Divider sx={{ my: 2 }} />
              <Typography component="h3" variant="subtitle1" sx={{ mb: 1.5 }}>
                {t('auditControl.detail.change')}
              </Typography>
              {selected.changedFields.length > 0 && (
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 1.5 }}>
                  {selected.changedFields.map((field) => (
                    <Typography
                      key={field}
                      component="span"
                      variant="caption"
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        bgcolor: 'action.selected',
                        color: 'primary.main',
                        borderRadius: 0.5,
                      }}
                    >
                      {field}
                    </Typography>
                  ))}
                </Stack>
              )}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                <JsonState label={t('auditControl.detail.before')} value={selected.beforeState} />
                <JsonState label={t('auditControl.detail.after')} value={selected.afterState} />
              </Box>
              <Box sx={{ mt: 2 }}>
                <JsonState label={t('auditControl.detail.metadata')} value={selected.metadata} />
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog open={exportOpen} onClose={() => setExportOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('auditControl.export.title')}</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.secondary' }}>
              <ShieldCheck size={18} />
              <Typography variant="body2">
                {t('auditControl.export.scope', {
                  window: t(`auditControl.windows.${window}`),
                  count: eventsQuery.data?.totalElements ?? 0,
                })}
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              value={exportFormat}
              onChange={(_, value: 'CSV' | 'JSONL' | null) => value && setExportFormat(value)}
              size="small"
            >
              <ToggleButton value="CSV">
                <Download size={16} /> {t('auditControl.export.formats.CSV')}
              </ToggleButton>
              <ToggleButton value="JSONL">
                <FileJson2 size={16} /> {t('auditControl.export.formats.JSONL')}
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField
              autoFocus
              required
              multiline
              minRows={3}
              label={t('auditControl.export.reason')}
              value={exportReason}
              onChange={(event) => setExportReason(event.target.value)}
              inputProps={{ maxLength: 500 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setExportOpen(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            startIcon={<Download size={17} />}
            disabled={!exportReason.trim() || exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            {t('auditControl.export.download')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={saveSearchOpen}
        onClose={() => setSaveSearchOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('auditControl.savedSearches.saveTitle')}</DialogTitle>
        <DialogContent>
          <Stack gap={1.5} sx={{ pt: 1 }}>
            <TextField
              autoFocus
              required
              label={t('auditControl.savedSearches.name')}
              value={savedSearchName}
              onChange={(event) => setSavedSearchName(event.target.value)}
              inputProps={{ maxLength: 160 }}
            />
            {hasPermission('ADMIN.AUDIT_CONFIGURE', 'MANAGE') && (
              <FormControlLabel
                control={
                  <Switch
                    checked={savedSearchShared}
                    onChange={(event) => setSavedSearchShared(event.target.checked)}
                  />
                }
                label={t('auditControl.savedSearches.shared')}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {t('auditControl.savedSearches.upsertHint')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setSaveSearchOpen(false)}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            startIcon={<BookmarkPlus size={17} />}
            disabled={!savedSearchName.trim() || saveSearchMutation.isPending}
            onClick={() => saveSearchMutation.mutate()}
          >
            {t('common.actions.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
