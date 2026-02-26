/**
 * Workbench Queue — AgentCase 리스트, 페이징, 300px 고정
 * API: useCasesListQuery (GET /api/synapse/cases)
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { Link } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useRef, useMemo, useState, useEffect } from 'react';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';
import { useCodes, useCasesListQuery, useWorkbenchReactiveStore } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';

import { PanelHeader } from './PanelHeader';
import { SYNAPSE_ROUTES } from '../../../routes';
import { StatusBadge } from '../../../components/finance/status-badge';
import { caseListDtoToUi } from '../../cases/adapters/case-list-adapter';
import { SeverityBadge } from '../../../components/finance/severity-badge';
import { ErrorStateWithRetry } from '../../../components/ux/error-state-with-retry';
import { TableLoadingSkeleton } from '../../../components/ux/table-loading-skeleton';

import type { CaseListItem } from '../../cases/adapters/case-list-adapter';

const PAGE_SIZE = 20;
type QueueBadgeFilter = 'all' | `status:${string}` | `severity:${string}`;

export type WorkbenchQueuePanelProps = {
  selectedCaseId?: string | null;
  onSelectCase?: (caseId: string) => void;
  getGlassPanelSx: (theme: Theme) => Record<string, unknown>;
  sx?: SxProps<Theme>;
};

export const WorkbenchQueuePanel = ({
  selectedCaseId,
  onSelectCase,
  getGlassPanelSx,
  sx,
}: WorkbenchQueuePanelProps) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [badgeFilter, setBadgeFilter] = useState<QueueBadgeFilter>('all');

  const queryParams = useMemo(
    () => ({
      page,
      size: PAGE_SIZE,
    }),
    [page]
  );
  const query = useCasesListQuery(queryParams);
  const { getLabel: getStatusLabel } = useCodes('CASE_STATUS');
  const { items, totalPages } = useMemo(() => {
    if (!query.data) {
      return { items: [] as CaseListItem[], totalCount: 0, totalPages: 1 };
    }
    const raw = query.data.items ?? query.data.content ?? query.data.data ?? [];
    const list = raw.map(caseListDtoToUi);
    const total = query.data.total ?? query.data.totalElements ?? raw.length;
    return {
      items: list,
      totalCount: total,
      totalPages: query.data.totalPages ?? (Math.ceil(total / PAGE_SIZE) || 1),
    };
  }, [query.data]);
  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => String(item.status)).filter(Boolean))),
    [items]
  );
  const severityOptions = useMemo(
    () => Array.from(new Set(items.map((item) => String(item.severity)).filter(Boolean))),
    [items]
  );
  const visibleItems = useMemo(() => {
    if (badgeFilter === 'all') return items;
    if (badgeFilter.startsWith('status:')) {
      const status = badgeFilter.slice('status:'.length);
      return items.filter((item) => item.status === status);
    }
    if (badgeFilter.startsWith('severity:')) {
      const severity = badgeFilter.slice('severity:'.length);
      return items.filter((item) => item.severity === severity);
    }
    return items;
  }, [badgeFilter, items]);

  const isAnalyzing = useWorkbenchReactiveStore((s) => s.isAnalyzing);
  const removeAnalyzing = useWorkbenchReactiveStore((s) => s.removeAnalyzing);
  const emptyRefetchDoneRef = useRef(false);

  useEffect(() => {
    items.forEach((item) => {
      if (item.status && item.status !== 'IN_PROGRESS') {
        removeAnalyzing(item.id);
      }
    });
  }, [items, removeAnalyzing]);

  /** 테스트 데이터 생성 직후 워크벤치 진입 시 Detect가 비동기면 케이스가 아직 없을 수 있음 → 목록이 비었을 때 한 번만 지연 재요청 */
  useEffect(() => {
    if (items.length > 0 || query.isLoading || query.isFetching) return undefined;
    if (emptyRefetchDoneRef.current) return undefined;
    const timerId = window.setTimeout(() => {
      emptyRefetchDoneRef.current = true;
      query.refetch();
    }, 2500);
    return () => window.clearTimeout(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when empty; query in deps would cause unnecessary effect runs
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
      <PanelHeader title={t('workbench.queueTitle')}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            '&::-webkit-scrollbar': { height: 6 },
          }}
        >
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ width: 'max-content', pr: 0.5 }}>
          <Chip
            size="small"
            label={t('workbench.filterAll')}
            color={badgeFilter === 'all' ? 'primary' : 'default'}
            variant={badgeFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => {
              setBadgeFilter('all');
              setPage(0);
            }}
            sx={{ height: 20, fontSize: '0.68rem' }}
          />
          {statusOptions.map((status) => {
            const key = `status:${status}` as const;
            const selected = badgeFilter === key;
            return (
              <Box
                key={key}
                onClick={() => {
                  setBadgeFilter(key);
                  setPage(0);
                }}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 1,
                  px: 0.25,
                  py: 0.125,
                  ...(selected && {
                    outline: `1px solid ${theme.palette.primary.main}`,
                    outlineOffset: 0,
                  }),
                }}
              >
                <StatusBadge status={status} label={getStatusLabel(status)} size="sm" sx={{ height: 20, fontSize: '0.68rem' }} />
              </Box>
            );
          })}
          {severityOptions.map((severity) => {
            const key = `severity:${severity}` as const;
            const selected = badgeFilter === key;
            return (
              <Box
                key={key}
                onClick={() => {
                  setBadgeFilter(key);
                  setPage(0);
                }}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 1,
                  px: 0.25,
                  py: 0.125,
                  ...(selected && {
                    outline: `1px solid ${theme.palette.primary.main}`,
                    outlineOffset: 0,
                  }),
                }}
              >
                <SeverityBadge severity={severity as CaseListItem['severity']} size="sm" sx={{ height: 20, fontSize: '0.68rem' }} />
              </Box>
            );
          })}
          </Stack>
        </Box>
      </PanelHeader>

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
              {badgeFilter === 'all'
                ? t('workbench.queueHint')
                : t('workbench.noMatchingCases', '선택한 배지와 일치하는 케이스가 없습니다.')}
            </Typography>
            {badgeFilter === 'all' && (
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
                      '&.Mui-selected': {
                        bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
                      },
                    }}
                  >
                    <Box sx={{ width: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
                        {analyzing ? (
                          <Chip
                            size="small"
                            label={t('workbench.analyzingLabel')}
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              animation: 'workbench-analyzing-pulse 1.5s ease-in-out infinite',
                              '@keyframes workbench-analyzing-pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.7 },
                              },
                            }}
                          />
                        ) : (
                          <>
                            <SeverityBadge severity={item.severity} size="sm" sx={{ fontSize: '0.68rem' }} />
                            <StatusBadge status={item.status} label={getStatusLabel(item.status)} size="sm" sx={{ fontSize: '0.68rem' }} />
                          </>
                        )}
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {item.caseNumber}
                        </Typography>
                      </Box>
                      <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>
                        {item.title || item.description || item.id}
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
};
