/**
 * Workbench Queue — AgentCase 리스트, 페이징, 300px 고정
 * API: useCasesListQuery (GET /api/synapse/cases)
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useCasesListQuery } from '@dwp-frontend/shared-utils';
import { Iconify, varAlpha } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import ListItemButton from '@mui/material/ListItemButton';

import { SYNAPSE_ROUTES } from '../../../routes';
import { StatusBadge } from '../../../components/finance/status-badge';
import { caseListDtoToUi } from '../../cases/adapters/case-list-adapter';
import { SeverityBadge } from '../../../components/finance/severity-badge';
import { ErrorStateWithRetry } from '../../../components/ux/error-state-with-retry';
import { TableLoadingSkeleton } from '../../../components/ux/table-loading-skeleton';

import type { CaseListItem } from '../../cases/adapters/case-list-adapter';

const PAGE_SIZE = 20;

export type WorkbenchStatusFilter = 'all' | 'OPEN' | 'IN_PROGRESS';

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
  const [statusFilter, setStatusFilter] = useState<WorkbenchStatusFilter>('all');

  const queryParams = useMemo(
    () => ({
      page,
      size: PAGE_SIZE,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    [page, statusFilter]
  );
  const query = useCasesListQuery(queryParams);
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
      <Box
        sx={{
          height: 'var(--workbench-panel-header-height, 56px)',
          minHeight: 'var(--workbench-panel-header-height, 56px)',
          pt: 0,
          px: 2,
          pb: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>
          {t('workbench.queueTitle')}
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={t('workbench.filterAll')}
            color={statusFilter === 'all' ? 'primary' : 'default'}
            variant={statusFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => {
              setStatusFilter('all');
              setPage(0);
            }}
            sx={{ height: 24, fontSize: '0.75rem' }}
          />
          <Chip
            size="small"
            label={t('workbench.filterOpen')}
            color={statusFilter === 'OPEN' ? 'primary' : 'default'}
            variant={statusFilter === 'OPEN' ? 'filled' : 'outlined'}
            onClick={() => {
              setStatusFilter('OPEN');
              setPage(0);
            }}
            sx={{ height: 24, fontSize: '0.75rem' }}
          />
          <Chip
            size="small"
            label={t('workbench.filterInProgress')}
            color={statusFilter === 'IN_PROGRESS' ? 'primary' : 'default'}
            variant={statusFilter === 'IN_PROGRESS' ? 'filled' : 'outlined'}
            onClick={() => {
              setStatusFilter('IN_PROGRESS');
              setPage(0);
            }}
            sx={{ height: 24, fontSize: '0.75rem' }}
          />
        </Stack>
      </Box>

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

        {!query.isLoading && !query.error && items.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('workbench.queueHint')}
            </Typography>
            <Link to={SYNAPSE_ROUTES.CASES} style={{ textDecoration: 'none' }}>
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600, mt: 1 }}>
                {t('workbench.openCases')} →
              </Typography>
            </Link>
          </Box>
        )}

        {!query.isLoading && !query.error && items.length > 0 && (
          <>
            <List disablePadding sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {items.map((item) => (
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
                      <SeverityBadge severity={item.severity} size="sm" />
                      <StatusBadge status={item.status} size="sm" />
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
              ))}
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
