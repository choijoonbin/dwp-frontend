import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  Database,
  GitBranch,
  History,
  Languages,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate as formatLocalizedDate } from '@dwp-frontend/shared-i18n';
import {
  useToast,
  getReferenceSet,
  listReferenceSets,
  listReferenceSetAuditEvents,
  createReferenceSet,
  updateReferenceSet,
  retireReferenceSet,
  activateReferenceSet,
  createReferenceItem,
  updateReferenceItem,
  retireReferenceItem,
  activateReferenceItem,
} from '@dwp-frontend/shared-utils';
import { ActionButton, EnterpriseDataGrid, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading, LifecycleChip } from './admin-ui';
import { ConfirmActionDialog, ReferenceItemDialog, ReferenceSetDialog } from './reference-dialogs';

import type { ReactNode } from 'react';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  PlatformAuditEvent,
  ReferenceItem,
  ReferenceLifecycle,
  ReferenceSetDetail,
  CreateReferenceSetRequest,
  CreateReferenceItemRequest,
  UpdateReferenceSetRequest,
  UpdateReferenceItemRequest,
} from '@dwp-frontend/shared-utils';

type SetDialogMode = 'create' | 'edit' | null;
type ItemDialogState = { mode: 'create' } | { mode: 'edit'; item: ReferenceItem } | null;
type DetailView = 'values' | 'activity';
type ItemFilter = 'ALL' | ReferenceLifecycle;
type PendingAction =
  | { kind: 'activate-set' }
  | { kind: 'retire-set' }
  | { kind: 'activate-item'; item: ReferenceItem }
  | { kind: 'retire-item'; item: ReferenceItem }
  | null;

const REQUIRED_LOCALES = ['ko', 'en'] as const;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function preferredLabel(item: ReferenceItem, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  const baseLocale = normalizedLocale.split('-')[0];
  return (
    item.labels.find((label) => label.locale.toLowerCase() === normalizedLocale)?.label ??
    item.labels.find((label) => label.locale.toLowerCase().split('-')[0] === baseLocale)?.label ??
    item.labels.find((label) => label.locale.toLowerCase().startsWith('en'))?.label ??
    item.labels[0]?.label ??
    item.code
  );
}

function hasLocale(item: ReferenceItem, locale: string): boolean {
  return item.labels.some((label) => label.locale.toLowerCase().split('-')[0] === locale);
}

function isAvailableNow(item: ReferenceItem, now = Date.now()): boolean {
  if (item.lifecycleState !== 'ACTIVE') return false;
  const start = item.validFrom ? Date.parse(item.validFrom) : Number.NEGATIVE_INFINITY;
  const end = item.validTo ? Date.parse(item.validTo) : Number.POSITIVE_INFINITY;
  return start <= now && now < end;
}

function validityState(
  item: ReferenceItem,
  now = Date.now()
): 'always' | 'scheduled' | 'expired' | 'bounded' {
  if (item.validFrom && Date.parse(item.validFrom) > now) return 'scheduled';
  if (item.validTo && Date.parse(item.validTo) <= now) return 'expired';
  if (item.validFrom || item.validTo) return 'bounded';
  return 'always';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return formatLocalizedDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string): string {
  return formatLocalizedDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OperationalMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 2,
        py: 1.75,
        borderTop: { xs: 1, lg: 0 },
        borderLeft: { xs: 0, lg: 1 },
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.75} color="text.secondary">
        {icon}
        <Typography variant="caption" fontWeight={700}>
          {label}
        </Typography>
      </Stack>
      <Typography component="p" variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
        {detail}
      </Typography>
    </Box>
  );
}

export function ReferenceDataManager() {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<DetailView>('values');
  const [itemFilter, setItemFilter] = useState<ItemFilter>('ALL');
  const [itemQuery, setItemQuery] = useState('');
  const deferredItemQuery = useDeferredValue(itemQuery);
  const [setDialogMode, setSetDialogMode] = useState<SetDialogMode>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const setsQuery = useQuery({
    queryKey: ['admin', 'reference-sets', deferredQuery],
    queryFn: () => listReferenceSets(deferredQuery),
  });
  const sets = useMemo(() => setsQuery.data?.content ?? [], [setsQuery.data]);

  useEffect(() => {
    if (sets.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !sets.some((set) => set.setKey === selectedKey)) {
      setSelectedKey(sets[0].setKey);
    }
  }, [selectedKey, sets]);

  useEffect(() => {
    setItemFilter('ALL');
    setItemQuery('');
  }, [selectedKey]);

  const detailQuery = useQuery({
    queryKey: ['admin', 'reference-set', selectedKey],
    queryFn: () => getReferenceSet(selectedKey!),
    enabled: Boolean(selectedKey),
  });
  const detail = detailQuery.data;

  const activityQuery = useQuery({
    queryKey: ['admin', 'reference-set-activity', selectedKey],
    queryFn: () => listReferenceSetAuditEvents(selectedKey!),
    enabled: Boolean(selectedKey) && detailView === 'activity',
  });
  const activities = activityQuery.data?.content ?? [];

  const catalogSummary = useMemo(
    () => ({
      catalogs: sets.length,
      values: sets.reduce((total, set) => total + set.itemCount, 0),
      active: sets.filter((set) => set.lifecycleState === 'ACTIVE').length,
      draft: sets.filter((set) => set.lifecycleState === 'DRAFT').length,
    }),
    [sets]
  );

  const detailSummary = useMemo(() => {
    const items = detail?.items ?? [];
    const translatedLabels = items.reduce(
      (total, item) =>
        total + REQUIRED_LOCALES.filter((required) => hasLocale(item, required)).length,
      0
    );
    return {
      available: items.filter((item) => isAvailableNow(item)).length,
      draft: items.filter((item) => item.lifecycleState === 'DRAFT').length,
      scheduled: items.filter((item) => item.validFrom || item.validTo).length,
      roots: items.filter((item) => !item.parentCode).length,
      translationCoverage:
        items.length === 0
          ? 0
          : Math.round((translatedLabels / (items.length * REQUIRED_LOCALES.length)) * 100),
    };
  }, [detail]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredItemQuery.trim().toLowerCase();
    return (detail?.items ?? []).filter((item) => {
      if (itemFilter !== 'ALL' && item.lifecycleState !== itemFilter) return false;
      if (!normalizedQuery) return true;
      return (
        item.code.toLowerCase().includes(normalizedQuery) ||
        item.labels.some((label) => label.label.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [deferredItemQuery, detail, itemFilter]);

  const acceptDetail = async (next: ReferenceSetDetail, message: string) => {
    setSelectedKey(next.setKey);
    queryClient.setQueryData(['admin', 'reference-set', next.setKey], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'reference-sets'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'reference-set-activity', next.setKey] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
    toast.success(message);
  };

  const run = async (operation: () => Promise<ReferenceSetDetail>, successMessage: string) => {
    setBusy(true);
    try {
      await acceptDetail(await operation(), successMessage);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSet = async (request: CreateReferenceSetRequest) => {
    const completed = await run(
      () => createReferenceSet(request),
      t('referenceData.toasts.setCreated')
    );
    if (completed) setSetDialogMode(null);
  };

  const updateSet = async (request: UpdateReferenceSetRequest) => {
    if (!detail) return;
    const completed = await run(
      () => updateReferenceSet(detail.setKey, request),
      t('referenceData.toasts.setUpdated')
    );
    if (completed) setSetDialogMode(null);
  };

  const saveItem = async (request: CreateReferenceItemRequest) => {
    if (!detail) return;
    const completed = await run(
      () => createReferenceItem(detail.setKey, request),
      t('referenceData.toasts.itemCreated')
    );
    if (completed) setItemDialog(null);
  };

  const updateItem = async (request: UpdateReferenceItemRequest) => {
    if (!detail || itemDialog?.mode !== 'edit') return;
    const completed = await run(
      () => updateReferenceItem(detail.setKey, itemDialog.item.code, request),
      t('referenceData.toasts.itemUpdated')
    );
    if (completed) setItemDialog(null);
  };

  const confirmAction = async () => {
    if (!detail || !pendingAction) return;
    let completed = false;
    if (pendingAction.kind === 'activate-set') {
      completed = await run(
        () => activateReferenceSet(detail.setKey, detail.version),
        t('referenceData.toasts.setActivated')
      );
    } else if (pendingAction.kind === 'retire-set') {
      completed = await run(
        () => retireReferenceSet(detail.setKey, detail.version),
        t('referenceData.toasts.setRetired')
      );
    } else if (pendingAction.kind === 'activate-item') {
      completed = await run(
        () =>
          activateReferenceItem(detail.setKey, pendingAction.item.code, pendingAction.item.version),
        t('referenceData.toasts.itemActivated')
      );
    } else {
      completed = await run(
        () =>
          retireReferenceItem(detail.setKey, pendingAction.item.code, pendingAction.item.version),
        t('referenceData.toasts.itemRetired')
      );
    }
    if (completed) setPendingAction(null);
  };

  const formatValidity = useCallback(
    (item: ReferenceItem) => {
      if (item.validFrom && item.validTo) {
        return `${formatDate(item.validFrom)} – ${formatDate(item.validTo)}`;
      }
      if (item.validFrom) {
        return t('referenceData.validity.from', { date: formatDate(item.validFrom) });
      }
      if (item.validTo) {
        return t('referenceData.validity.until', { date: formatDate(item.validTo) });
      }
      return t('referenceData.validity.noLimit');
    },
    [t]
  );

  const columns = useMemo<GridColDef<ReferenceItem>[]>(
    () => [
      {
        field: 'code',
        headerName: t('referenceData.columns.value'),
        minWidth: 190,
        flex: 1.15,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {preferredLabel(row, locale)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {row.code}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('referenceData.columns.state'),
        width: 104,
        renderCell: ({ row }) => <LifecycleChip state={row.lifecycleState} />,
      },
      {
        field: 'validity',
        headerName: t('referenceData.columns.validity'),
        minWidth: 180,
        flex: 0.9,
        sortable: false,
        renderCell: ({ row }) => {
          const state = validityState(row);
          return (
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {formatValidity(row)}
              </Typography>
              <Typography
                variant="caption"
                color={state === 'expired' ? 'error.main' : 'text.secondary'}
              >
                {t(`referenceData.validity.${state}`)}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: 'labels',
        headerName: t('referenceData.columns.locales'),
        width: 118,
        sortable: false,
        renderCell: ({ row }) => (
          <Stack direction="row" gap={0.5}>
            {REQUIRED_LOCALES.map((required) => (
              <Chip
                key={required}
                label={required.toUpperCase()}
                size="small"
                color={hasLocale(row, required) ? 'success' : 'default'}
                variant={hasLocale(row, required) ? 'filled' : 'outlined'}
                sx={{ height: 22, '& .MuiChip-label': { px: 0.75 } }}
              />
            ))}
          </Stack>
        ),
      },
      {
        field: 'parentCode',
        headerName: t('referenceData.columns.hierarchy'),
        minWidth: 120,
        flex: 0.65,
        renderCell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
            <GitBranch size={15} strokeWidth={1.8} aria-hidden="true" />
            <Typography variant="body2" noWrap>
              {row.parentCode || t('referenceData.hierarchy.root')}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'updatedAt',
        headerName: t('referenceData.columns.updated'),
        minWidth: 132,
        flex: 0.7,
        renderCell: ({ row }) =>
          row.updatedAt ? (
            <Typography variant="body2" noWrap>
              {formatDate(row.updatedAt)}
            </Typography>
          ) : (
            '—'
          ),
      },
      {
        field: 'actions',
        headerName: '',
        width: 92,
        sortable: false,
        filterable: false,
        align: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" justifyContent="flex-end" sx={{ width: 1 }}>
            <Tooltip title={t('referenceData.actions.editItem')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('referenceData.actions.editNamed', { code: row.code })}
                  disabled={
                    detail?.lifecycleState === 'RETIRED' || row.lifecycleState === 'RETIRED'
                  }
                  onClick={() => setItemDialog({ mode: 'edit', item: row })}
                >
                  <Pencil size={17} strokeWidth={1.8} />
                </IconButton>
              </span>
            </Tooltip>
            {row.lifecycleState === 'DRAFT' ? (
              <Tooltip title={t('referenceData.actions.activateItem')}>
                <span>
                  <IconButton
                    size="small"
                    color="success"
                    aria-label={t('referenceData.actions.activateNamed', { code: row.code })}
                    disabled={detail?.lifecycleState !== 'ACTIVE'}
                    onClick={() => setPendingAction({ kind: 'activate-item', item: row })}
                  >
                    <CheckCircle2 size={17} strokeWidth={1.8} />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title={t('referenceData.actions.retireItem')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('referenceData.actions.retireNamed', { code: row.code })}
                    disabled={
                      row.lifecycleState === 'RETIRED' || detail?.lifecycleState === 'RETIRED'
                    }
                    onClick={() => setPendingAction({ kind: 'retire-item', item: row })}
                  >
                    <Archive size={17} strokeWidth={1.8} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [detail?.lifecycleState, formatValidity, locale, t]
  );

  if (setsQuery.isLoading) {
    return <AdminPanelLoading label={t('referenceData.loading')} />;
  }
  if (setsQuery.isError) {
    return <AdminPanelError message={errorMessage(setsQuery.error, t('common.operationError'))} />;
  }

  const confirmCopy = pendingAction
    ? pendingAction.kind === 'activate-set'
      ? {
          title: t('referenceData.confirm.activateSetTitle'),
          message: t('referenceData.confirm.activateSetMessage'),
          confirmLabel: t('referenceData.actions.activate'),
          destructive: false,
        }
      : pendingAction.kind === 'retire-set'
        ? {
            title: t('referenceData.confirm.retireSetTitle'),
            message: t('referenceData.confirm.retireSetMessage'),
            confirmLabel: t('referenceData.actions.retire'),
            destructive: true,
          }
        : pendingAction.kind === 'activate-item'
          ? {
              title: t('referenceData.confirm.activateItemTitle', {
                code: pendingAction.item.code,
              }),
              message: t('referenceData.confirm.activateItemMessage'),
              confirmLabel: t('referenceData.actions.activate'),
              destructive: false,
            }
          : {
              title: t('referenceData.confirm.retireItemTitle', {
                code: pendingAction.item.code,
              }),
              message: t('referenceData.confirm.retireItemMessage'),
              confirmLabel: t('referenceData.actions.retire'),
              destructive: true,
            }
    : null;

  const activityLabel = (event: PlatformAuditEvent) => {
    switch (event.action) {
      case 'reference-set.seeded':
        return t('referenceData.activity.actions.seeded');
      case 'reference-set.created':
        return t('referenceData.activity.actions.setCreated');
      case 'reference-set.updated':
        return t('referenceData.activity.actions.setUpdated');
      case 'reference-set.activated':
        return t('referenceData.activity.actions.setActivated');
      case 'reference-set.retired':
        return t('referenceData.activity.actions.setRetired');
      case 'reference-item.created':
        return t('referenceData.activity.actions.itemCreated');
      case 'reference-item.updated':
        return t('referenceData.activity.actions.itemUpdated');
      case 'reference-item.activated':
        return t('referenceData.activity.actions.itemActivated');
      case 'reference-item.retired':
        return t('referenceData.activity.actions.itemRetired');
      default:
        return event.action;
    }
  };

  return (
    <>
      <Box
        component="section"
        aria-label={t('referenceData.overview.title')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '1.4fr repeat(4, minmax(120px, 1fr))' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                borderRadius: 1,
              }}
            >
              <Database size={19} strokeWidth={1.8} aria-hidden="true" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                {t('referenceData.overview.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('referenceData.overview.description')}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <OperationalMetric
          icon={<Database size={15} strokeWidth={1.8} />}
          label={t('referenceData.overview.catalogs')}
          value={catalogSummary.catalogs}
          detail={t('referenceData.overview.catalogsDetail')}
        />
        <OperationalMetric
          icon={<CircleGauge size={15} strokeWidth={1.8} />}
          label={t('referenceData.overview.values')}
          value={catalogSummary.values}
          detail={t('referenceData.overview.valuesDetail')}
        />
        <OperationalMetric
          icon={<ShieldCheck size={15} strokeWidth={1.8} />}
          label={t('referenceData.overview.published')}
          value={catalogSummary.active}
          detail={t('referenceData.overview.publishedDetail')}
        />
        <OperationalMetric
          icon={<Pencil size={15} strokeWidth={1.8} />}
          label={t('referenceData.overview.drafts')}
          value={catalogSummary.draft}
          detail={t('referenceData.overview.draftsDetail')}
        />
      </Box>

      <Box
        sx={{
          minHeight: 660,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '316px minmax(0, 1fr)' },
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          component="aside"
          aria-label={t('referenceData.referenceSets')}
          sx={{
            minWidth: 0,
            borderRight: { xs: 0, md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Box>
              <Typography component="h2" variant="subtitle1" fontWeight={700}>
                {t('referenceData.referenceSets')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('referenceData.catalogListHelp')}
              </Typography>
            </Box>
            <Tooltip title={t('referenceData.actions.newSet')}>
              <IconButton
                size="small"
                aria-label={t('referenceData.actions.newSet')}
                onClick={() => setSetDialogMode('create')}
              >
                <Plus size={18} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <FormField
              fullWidth
              size="small"
              label={t('referenceData.searchSets')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ maxHeight: { xs: 300, md: 664 }, overflowY: 'auto', px: 1, pb: 1 }}>
            {sets.length ? (
              sets.map((set) => (
                <ListItemButton
                  key={set.setKey}
                  selected={set.setKey === selectedKey}
                  onClick={() => setSelectedKey(set.setKey)}
                  sx={{
                    minHeight: 94,
                    py: 1.25,
                    px: 1.5,
                    alignItems: 'flex-start',
                    borderRadius: 1,
                    mb: 0.5,
                    borderLeft: 3,
                    borderLeftColor: set.setKey === selectedKey ? 'primary.main' : 'transparent',
                  }}
                >
                  <Box sx={{ minWidth: 0, width: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography component="p" variant="subtitle2" noWrap>
                        {set.name}
                      </Typography>
                      <LifecycleChip state={set.lifecycleState} />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block', mt: 0.25 }}
                    >
                      {set.setKey}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('referenceData.itemCount', { count: set.itemCount })}
                      </Typography>
                      <Box
                        sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {t('referenceData.revisionShort', { revision: set.revision })}
                      </Typography>
                    </Stack>
                  </Box>
                </ListItemButton>
              ))
            ) : (
              <Box sx={{ py: 7, px: 2, textAlign: 'center' }}>
                <Database size={28} strokeWidth={1.5} color={theme.palette.text.disabled} />
                <Typography component="p" variant="subtitle2" sx={{ mt: 1.5 }}>
                  {t('referenceData.noSets')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('referenceData.empty.catalogDescription')}
                </Typography>
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setSetDialogMode('create')}
                  sx={{ mt: 2 }}
                >
                  {t('referenceData.actions.createSet')}
                </ActionButton>
              </Box>
            )}
          </Box>
        </Box>

        <Box component="section" aria-label={t('referenceData.setDetail')} sx={{ minWidth: 0 }}>
          {detailQuery.isLoading ? (
            <AdminPanelLoading label={t('referenceData.loadingSet')} />
          ) : detailQuery.isError ? (
            <AdminPanelError
              message={errorMessage(detailQuery.error, t('common.operationError'))}
            />
          ) : detail ? (
            <>
              <Box
                sx={{
                  minHeight: 118,
                  px: { xs: 2, md: 2.5 },
                  py: 2,
                  display: 'flex',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ minWidth: 0, maxWidth: 720 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography component="h2" variant="h6" fontWeight={700}>
                      {detail.name}
                    </Typography>
                    <LifecycleChip state={detail.lifecycleState} />
                    <Chip
                      size="small"
                      variant="outlined"
                      color={detail.lifecycleState === 'ACTIVE' ? 'success' : 'default'}
                      icon={
                        detail.lifecycleState === 'ACTIVE' ? (
                          <ShieldCheck size={14} />
                        ) : (
                          <CircleGauge size={14} />
                        )
                      }
                      label={
                        detail.lifecycleState === 'ACTIVE'
                          ? t('referenceData.runtime.published')
                          : t('referenceData.runtime.notPublished')
                      }
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {detail.description || t('referenceData.noDescription')}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.75 }}
                  >
                    {t('referenceData.revision', { key: detail.setKey, revision: detail.revision })}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
                  <Tooltip title={t('common.actions.refresh')}>
                    <IconButton
                      aria-label={t('referenceData.actions.refreshSet')}
                      onClick={() => void detailQuery.refetch()}
                    >
                      <RefreshCw size={18} strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('referenceData.actions.editSet')}>
                    <span>
                      <IconButton
                        aria-label={t('referenceData.actions.editSet')}
                        disabled={detail.lifecycleState === 'RETIRED'}
                        onClick={() => setSetDialogMode('edit')}
                      >
                        <Pencil size={18} strokeWidth={1.8} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <ActionButton
                    intent="secondary"
                    size="small"
                    startIcon={<Plus size={17} />}
                    disabled={detail.lifecycleState === 'RETIRED'}
                    onClick={() => setItemDialog({ mode: 'create' })}
                  >
                    {t('referenceData.actions.newItem')}
                  </ActionButton>
                  {detail.lifecycleState === 'DRAFT' ? (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<CheckCircle2 size={17} />}
                      disabled={detail.items.length === 0}
                      onClick={() => setPendingAction({ kind: 'activate-set' })}
                    >
                      {t('referenceData.actions.activate')}
                    </ActionButton>
                  ) : (
                    <Tooltip title={t('referenceData.actions.retireSet')}>
                      <span>
                        <IconButton
                          aria-label={t('referenceData.actions.retireSet')}
                          disabled={detail.lifecycleState === 'RETIRED'}
                          onClick={() => setPendingAction({ kind: 'retire-set' })}
                        >
                          <Archive size={18} strokeWidth={1.8} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </Box>

              <Box
                aria-label={t('referenceData.health.title')}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(5, minmax(0, 1fr))',
                  },
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.primary.main, 0.025),
                }}
              >
                <OperationalMetric
                  icon={<ShieldCheck size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.available')}
                  value={detailSummary.available}
                  detail={t('referenceData.health.availableDetail')}
                />
                <OperationalMetric
                  icon={<Pencil size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.draft')}
                  value={detailSummary.draft}
                  detail={t('referenceData.health.draftDetail')}
                />
                <OperationalMetric
                  icon={<CalendarClock size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.timeBound')}
                  value={detailSummary.scheduled}
                  detail={t('referenceData.health.timeBoundDetail')}
                />
                <OperationalMetric
                  icon={<Languages size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.translation')}
                  value={`${detailSummary.translationCoverage}%`}
                  detail={t('referenceData.health.translationDetail')}
                />
                <OperationalMetric
                  icon={<GitBranch size={15} strokeWidth={1.8} />}
                  label={t('referenceData.health.roots')}
                  value={detailSummary.roots}
                  detail={t('referenceData.health.rootsDetail')}
                />
              </Box>

              <Tabs
                value={detailView}
                onChange={(_event, value: DetailView) => setDetailView(value)}
                aria-label={t('referenceData.detailViews')}
                sx={{ px: { xs: 1, md: 2 }, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab value="values" label={t('referenceData.tabs.values')} />
                <Tab
                  value="activity"
                  icon={<History size={16} />}
                  iconPosition="start"
                  label={t('referenceData.tabs.activity')}
                />
              </Tabs>

              {detailView === 'values' && (
                <>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    gap={1.5}
                    sx={{
                      px: { xs: 1.5, md: 2 },
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={itemFilter}
                      onChange={(_event, value: ItemFilter | null) => value && setItemFilter(value)}
                      aria-label={t('referenceData.filters.lifecycle')}
                    >
                      <ToggleButton value="ALL">{t('referenceData.filters.all')}</ToggleButton>
                      <ToggleButton value="ACTIVE">{t('common.lifecycle.ACTIVE')}</ToggleButton>
                      <ToggleButton value="DRAFT">{t('common.lifecycle.DRAFT')}</ToggleButton>
                      <ToggleButton value="RETIRED">{t('common.lifecycle.RETIRED')}</ToggleButton>
                    </ToggleButtonGroup>
                    <FormField
                      size="small"
                      value={itemQuery}
                      onChange={(event) => setItemQuery(event.target.value)}
                      placeholder={t('referenceData.searchItems')}
                      aria-label={t('referenceData.searchItems')}
                      sx={{ width: { xs: 1, sm: 260 } }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search size={16} strokeWidth={1.8} />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>
                  {desktop ? (
                    <EnterpriseDataGrid
                      ariaLabel={t('referenceData.referenceItems')}
                      rows={filteredItems}
                      columns={columns}
                      getRowId={(row) => row.code}
                      rowHeight={64}
                      minVisibleRows={filteredItems.length === 0 ? 4 : 1}
                      maxVisibleRows={8}
                      hideFooter={filteredItems.length <= 25}
                      initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                      slots={{
                        noRowsOverlay: () => (
                          <Box
                            sx={{
                              height: 1,
                              display: 'grid',
                              placeItems: 'center',
                              textAlign: 'center',
                              p: 3,
                            }}
                          >
                            <Box>
                              <Database
                                size={26}
                                strokeWidth={1.5}
                                color={theme.palette.text.disabled}
                              />
                              <Typography component="p" variant="subtitle2" sx={{ mt: 1 }}>
                                {itemQuery || itemFilter !== 'ALL'
                                  ? t('referenceData.empty.noMatchingItems')
                                  : t('referenceData.noItems')}
                              </Typography>
                              {!itemQuery && itemFilter === 'ALL' && (
                                <ActionButton
                                  intent="quiet"
                                  size="small"
                                  startIcon={<Plus size={16} />}
                                  onClick={() => setItemDialog({ mode: 'create' })}
                                  sx={{ mt: 1 }}
                                >
                                  {t('referenceData.actions.createItem')}
                                </ActionButton>
                              )}
                            </Box>
                          </Box>
                        ),
                      }}
                      sx={{ border: 0, borderRadius: 0 }}
                    />
                  ) : (
                    <Box
                      component="ul"
                      aria-label={t('referenceData.referenceItems')}
                      sx={{ listStyle: 'none', p: 0, m: 0 }}
                    >
                      {filteredItems.length ? (
                        filteredItems.map((item) => (
                          <Box
                            component="li"
                            key={item.code}
                            sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
                          >
                            <Stack
                              direction="row"
                              alignItems="flex-start"
                              justifyContent="space-between"
                              gap={2}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography component="h3" variant="subtitle2">
                                  {preferredLabel(item, locale)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.code}
                                </Typography>
                              </Box>
                              <LifecycleChip state={item.lifecycleState} />
                            </Stack>
                            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatValidity(item)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.parentCode
                                  ? t('referenceData.parentSummary', { code: item.parentCode })
                                  : t('referenceData.hierarchy.root')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('referenceData.itemSummary', {
                                  order: item.sortOrder,
                                  count: item.labels.length,
                                })}
                              </Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                              <Tooltip title={t('referenceData.actions.editItem')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    aria-label={t('referenceData.actions.editNamed', {
                                      code: item.code,
                                    })}
                                    disabled={
                                      detail.lifecycleState === 'RETIRED' ||
                                      item.lifecycleState === 'RETIRED'
                                    }
                                    onClick={() => setItemDialog({ mode: 'edit', item })}
                                  >
                                    <Pencil size={17} strokeWidth={1.8} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              {item.lifecycleState === 'DRAFT' ? (
                                <Tooltip title={t('referenceData.actions.activateItem')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      aria-label={t('referenceData.actions.activateNamed', {
                                        code: item.code,
                                      })}
                                      disabled={detail.lifecycleState !== 'ACTIVE'}
                                      onClick={() =>
                                        setPendingAction({ kind: 'activate-item', item })
                                      }
                                    >
                                      <CheckCircle2 size={17} strokeWidth={1.8} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <Tooltip title={t('referenceData.actions.retireItem')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      aria-label={t('referenceData.actions.retireNamed', {
                                        code: item.code,
                                      })}
                                      disabled={
                                        item.lifecycleState === 'RETIRED' ||
                                        detail.lifecycleState === 'RETIRED'
                                      }
                                      onClick={() =>
                                        setPendingAction({ kind: 'retire-item', item })
                                      }
                                    >
                                      <Archive size={17} strokeWidth={1.8} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </Stack>
                          </Box>
                        ))
                      ) : (
                        <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('referenceData.empty.noMatchingItems')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </>
              )}

              {detailView === 'activity' && (
                <Box component="section" aria-label={t('referenceData.activity.title')}>
                  <Box
                    sx={{
                      px: { xs: 2, md: 2.5 },
                      py: 1.5,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography component="h3" variant="subtitle2">
                      {t('referenceData.activity.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('referenceData.activity.description')}
                    </Typography>
                  </Box>
                  {activityQuery.isLoading ? (
                    <AdminPanelLoading label={t('referenceData.activity.loading')} />
                  ) : activityQuery.isError ? (
                    <AdminPanelError
                      message={errorMessage(activityQuery.error, t('common.operationError'))}
                    />
                  ) : activities.length ? (
                    <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                      {activities.map((event) => (
                        <Box
                          component="li"
                          key={event.auditEventId}
                          sx={{
                            minHeight: 74,
                            px: { xs: 2, md: 2.5 },
                            py: 1.5,
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '36px minmax(0, 1fr)',
                              sm: '36px minmax(0, 1fr) auto auto',
                            },
                            alignItems: 'center',
                            columnGap: 1.5,
                            rowGap: 0.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: alpha(theme.palette.primary.main, 0.08),
                              color: 'primary.main',
                              borderRadius: 1,
                            }}
                          >
                            <History size={16} strokeWidth={1.8} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {activityLabel(event)}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ display: 'block' }}
                            >
                              {event.targetId} ·{' '}
                              {event.actorType === 'SERVICE'
                                ? t('referenceData.activity.systemActor')
                                : t('referenceData.activity.userActor', { id: event.actorId })}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            color={event.outcome === 'SUCCESS' ? 'success' : 'error'}
                            variant="outlined"
                            label={t(`referenceData.activity.outcomes.${event.outcome}`)}
                            sx={{ gridColumn: { xs: '2', sm: 'auto' }, justifySelf: 'start' }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ gridColumn: { xs: '2', sm: 'auto' }, whiteSpace: 'nowrap' }}
                          >
                            {formatDateTime(event.occurredAt)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        minHeight: 260,
                        display: 'grid',
                        placeItems: 'center',
                        textAlign: 'center',
                        p: 3,
                      }}
                    >
                      <Box>
                        <History size={28} strokeWidth={1.5} color={theme.palette.text.disabled} />
                        <Typography component="p" variant="subtitle2" sx={{ mt: 1 }}>
                          {t('referenceData.activity.empty')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {t('referenceData.activity.emptyDescription')}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </>
          ) : (
            <Box
              sx={{
                minHeight: 520,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                p: 3,
              }}
            >
              <Box>
                <Database size={32} strokeWidth={1.5} color={theme.palette.text.disabled} />
                <Typography component="p" variant="subtitle1" sx={{ mt: 1.5 }}>
                  {t('referenceData.selectSet')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('referenceData.empty.selectDescription')}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <ReferenceSetDialog
        open={Boolean(setDialogMode)}
        value={setDialogMode === 'edit' ? detail : null}
        busy={busy}
        onClose={() => setSetDialogMode(null)}
        onCreate={saveSet}
        onUpdate={updateSet}
      />
      <ReferenceItemDialog
        open={Boolean(itemDialog)}
        value={itemDialog?.mode === 'edit' ? itemDialog.item : null}
        busy={busy}
        onClose={() => setItemDialog(null)}
        onCreate={saveItem}
        onUpdate={updateItem}
      />
      {confirmCopy && (
        <ConfirmActionDialog
          open
          {...confirmCopy}
          busy={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
    </>
  );
}
