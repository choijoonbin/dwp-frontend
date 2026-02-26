import type { Theme, SxProps } from '@mui/material/styles';

import { Link } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useRef, useMemo, useState, useEffect } from 'react';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';
import { useCodes, useCasesListQuery, useWorkbenchReactiveStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import ToggleButton from '@mui/material/ToggleButton';
import ListItemButton from '@mui/material/ListItemButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { SYNAPSE_ROUTES } from '../../../routes';
import { PanelHeader } from '../../workbench/components/PanelHeader';
import { StatusBadge } from '../../../components/finance/status-badge';
import { caseListDtoToUi } from '../../cases/adapters/case-list-adapter';
import { SeverityBadge } from '../../../components/finance/severity-badge';
import { ErrorStateWithRetry } from '../../../components/ux/error-state-with-retry';
import { TableLoadingSkeleton } from '../../../components/ux/table-loading-skeleton';

import type { CaseListItem } from '../../cases/adapters/case-list-adapter';

const PAGE_SIZE = 20;
const CORE_STATUS_ORDER = ['PENDING_EXPLANATION', 'IN_REVIEW', 'NEW', 'RESOLVED'];
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

type QueueFilter = { kind: 'all' } | { kind: 'status'; value: string } | { kind: 'severity'; value: string };
type FilterMode = 'status' | 'severity';

export type WorkbenchNewQueuePanelProps = {
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  sx?: SxProps<Theme>;
};

function sortByOrder(values: string[], order: string[]): string[] {
  return [...values].sort((a, b) => {
    const ai = order.indexOf(a.toUpperCase());
    const bi = order.indexOf(b.toUpperCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

function formatAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '-';
  return `${Math.abs(amount).toLocaleString()} ${currency || ''}`.trim();
}

function formatDetectedAt(detectedAt: string): string {
  if (!detectedAt) return '-';
  const d = new Date(detectedAt);
  if (Number.isNaN(d.getTime())) return '-';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

export function WorkbenchNewQueuePanel({
  selectedCaseId,
  onSelectCase,
  getGlassPanelSx,
  sx,
}: WorkbenchNewQueuePanelProps) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('status');
  const [filter, setFilter] = useState<QueueFilter>({ kind: 'all' });
  const [moreAnchorEl, setMoreAnchorEl] = useState<HTMLElement | null>(null);
  const moreOpen = Boolean(moreAnchorEl);

  const query = useCasesListQuery({ page, size: PAGE_SIZE });
  const { getLabel: getStatusLabel } = useCodes('CASE_STATUS');

  const { items, totalPages } = useMemo(() => {
    if (!query.data) return { items: [] as CaseListItem[], totalPages: 1 };
    const raw = query.data.items ?? query.data.content ?? query.data.data ?? [];
    const list = raw.map(caseListDtoToUi);
    const total = query.data.total ?? query.data.totalElements ?? raw.length;
    return { items: list, totalPages: query.data.totalPages ?? (Math.ceil(total / PAGE_SIZE) || 1) };
  }, [query.data]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = String(item.status ?? '').toUpperCase();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const severityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = String(item.severity ?? '').toUpperCase();
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const allStatuses = useMemo(() => sortByOrder(Array.from(statusCounts.keys()), CORE_STATUS_ORDER), [statusCounts]);
  const coreStatuses = useMemo(
    () => CORE_STATUS_ORDER.filter((status) => statusCounts.has(status)),
    [statusCounts]
  );
  const moreStatuses = useMemo(
    () => allStatuses.filter((status) => !coreStatuses.includes(status)),
    [allStatuses, coreStatuses]
  );
  const severities = useMemo(() => sortByOrder(Array.from(severityCounts.keys()), SEVERITY_ORDER), [severityCounts]);

  const visibleItems = useMemo(() => {
    if (filter.kind === 'all') return items;
    if (filter.kind === 'status') return items.filter((item) => String(item.status).toUpperCase() === filter.value);
    return items.filter((item) => String(item.severity).toUpperCase() === filter.value);
  }, [filter, items]);

  const isAnalyzing = useWorkbenchReactiveStore((s) => s.isAnalyzing);
  const removeAnalyzing = useWorkbenchReactiveStore((s) => s.removeAnalyzing);
  const emptyRefetchDoneRef = useRef(false);

  useEffect(() => {
    items.forEach((item) => {
      const statusUpper = String(item.status ?? '').toUpperCase();
      if (statusUpper && statusUpper !== 'IN_PROGRESS' && statusUpper !== 'ANALYZING') {
        removeAnalyzing(item.id);
      }
    });
  }, [items, removeAnalyzing]);

  useEffect(() => {
    if (items.length > 0 || query.isLoading || query.isFetching) return undefined;
    if (emptyRefetchDoneRef.current) return undefined;
    const timerId = window.setTimeout(() => {
      emptyRefetchDoneRef.current = true;
      query.refetch();
    }, 2500);
    return () => window.clearTimeout(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when empty; query in deps causes unnecessary effect runs
  }, [items.length, query.isLoading, query.isFetching, query.refetch]);

  return (
    <Box
      sx={{
        ...getGlassPanelSx(theme),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRadius: 0,
        borderRight: `1px solid ${varAlpha(theme.vars.palette.dividerChannel, 0.12)}`,
        ...sx,
      }}
    >
      <PanelHeader
        title={t('workbench.queueTitle')}
        sx={{ overflow: 'hidden', alignItems: 'center', py: 0, height: 56, minHeight: 56 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filterMode}
          onChange={(_, value: FilterMode | null) => {
            if (!value) return;
            setFilterMode(value);
            setFilter({ kind: 'all' });
            setPage(0);
          }}
          sx={{
            flexShrink: 0,
            '& .MuiToggleButton-root': {
              px: 0.75,
              py: 0.125,
              fontSize: '0.72rem',
              minHeight: 24,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            },
          }}
        >
          <ToggleButton value="status">{t('workbench.queueFilterStatus', 'Status')}</ToggleButton>
          <ToggleButton value="severity">{t('workbench.queueFilterSeverity', 'Severity')}</ToggleButton>
        </ToggleButtonGroup>
      </PanelHeader>

      <Box
        sx={{
          px: 1.5,
          py: 0,
          height: 44,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          '&::-webkit-scrollbar': { height: 6 },
        }}
      >
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ width: 'max-content', pr: 0.5 }}>
            <Chip
              size="small"
              label={`${t('workbench.filterAll')} (${items.length})`}
              color={filter.kind === 'all' ? 'primary' : 'default'}
              variant={filter.kind === 'all' ? 'filled' : 'outlined'}
              onClick={() => {
                setFilter({ kind: 'all' });
                setPage(0);
              }}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                '& .MuiChip-label': { px: 0.875, lineHeight: '22px' },
              }}
            />

            {filterMode === 'status' &&
              coreStatuses.map((status) => {
                const selected = filter.kind === 'status' && filter.value === status;
                const count = statusCounts.get(status) ?? 0;
                return (
                  <Chip
                    key={status}
                    size="small"
                    variant={selected ? 'filled' : 'outlined'}
                    color={selected ? 'primary' : 'default'}
                    onClick={() => {
                      setFilter({ kind: 'status', value: status });
                      setPage(0);
                    }}
                    label={`${getStatusLabel(status)} (${count})`}
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      '& .MuiChip-label': { px: 0.875, lineHeight: '22px' },
                    }}
                  />
                );
              })}

            {filterMode === 'status' && moreStatuses.length > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${t('workbench.filterMore', 'More')} +${moreStatuses.length}`}
                onClick={(event) => setMoreAnchorEl(event.currentTarget)}
                sx={{
                  height: 22,
                  fontSize: '0.72rem',
                  '& .MuiChip-label': { px: 0.875, lineHeight: '22px' },
                }}
              />
            )}

            {filterMode === 'severity' &&
              severities.map((severity) => {
                const selected = filter.kind === 'severity' && filter.value === severity;
                const count = severityCounts.get(severity) ?? 0;
                return (
                  <Chip
                    key={severity}
                    size="small"
                    variant={selected ? 'filled' : 'outlined'}
                    color={selected ? 'primary' : 'default'}
                    onClick={() => {
                      setFilter({ kind: 'severity', value: severity });
                      setPage(0);
                    }}
                    label={`${severity} (${count})`}
                    sx={{
                      height: 22,
                      fontSize: '0.72rem',
                      '& .MuiChip-label': { px: 0.875, lineHeight: '22px' },
                    }}
                  />
                );
              })}
          </Stack>
      </Box>

      <Menu
        open={moreOpen}
        anchorEl={moreAnchorEl}
        onClose={() => setMoreAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {moreStatuses.map((status) => (
          <MenuItem
            key={status}
            onClick={() => {
              setFilter({ kind: 'status', value: status });
              setPage(0);
              setMoreAnchorEl(null);
            }}
          >
            {getStatusLabel(status)} ({statusCounts.get(status) ?? 0})
          </MenuItem>
        ))}
      </Menu>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {query.isLoading && (
          <Box sx={{ p: 2 }}>
            <TableLoadingSkeleton rows={5} columns={1} />
          </Box>
        )}

        {query.error && (
          <ErrorStateWithRetry
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => query.refetch()}
          />
        )}

        {!query.isLoading && !query.error && visibleItems.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {filter.kind === 'all'
                ? t('workbench.queueHint')
                : t('workbench.noMatchingCases', '선택한 배지와 일치하는 케이스가 없습니다.')}
            </Typography>
            {filter.kind === 'all' && (
              <Link to={SYNAPSE_ROUTES.CASES} style={{ textDecoration: 'none' }}>
                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600, mt: 1 }}>
                  {t('workbench.openCases')} →
                </Typography>
              </Link>
            )}
          </Box>
        )}

        {!query.isLoading && !query.error && visibleItems.length > 0 && (
          <>
            <List disablePadding sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {visibleItems.map((item) => {
                const analyzing = isAnalyzing(item.id);
                return (
                  <ListItemButton
                    key={item.id}
                    selected={selectedCaseId === item.id}
                    onClick={() => onSelectCase?.(item.id)}
                    sx={{
                      py: 1.25,
                      px: 2,
                      borderBottom: 1,
                      borderColor: 'divider',
                      '&.Mui-selected': { bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08) },
                    }}
                  >
                    <Box sx={{ width: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                        <SeverityBadge severity={item.severity} size="sm" sx={{ fontSize: '0.68rem' }} />
                        {analyzing ? (
                          <Chip
                            size="small"
                            label={t('workbench.analyzingLabel')}
                            sx={{ height: 22, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <StatusBadge status={item.status} label={getStatusLabel(item.status)} size="sm" sx={{ fontSize: '0.68rem' }} />
                        )}
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.caseNumber}
                        </Typography>
                      </Box>
                      <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
                        {[
                          item.counterparty || '-',
                          formatAmount(item.amount ?? 0, item.currency ?? ''),
                          formatDetectedAt(item.detectedAt ?? item.lastDetectedAt ?? ''),
                        ].join(' · ')}
                      </Typography>
                    </Box>
                    <Iconify icon="solar:alt-arrow-right-linear" width={16} sx={{ color: 'text.disabled', ml: 0.5 }} />
                  </ListItemButton>
                );
              })}
            </List>

            {totalPages > 1 && (
              <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Pagination
                  size="small"
                  count={totalPages}
                  page={page + 1}
                  onChange={(_, p) => setPage(p - 1)}
                  showFirstButton
                  showLastButton
                  sx={{ '& .MuiPagination-ul': { justifyContent: 'center' } }}
                />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
