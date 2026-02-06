/**
 * Entities (거래처) 목록 페이지 — API 연동 + 검색 필터 + mock fallback
 */

import { Link, useNavigate } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';
import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useCodes, useEntitiesListQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { mockEntities } from '../../data/mock-data';
import { EntitiesFilterBar } from './components/entities-filter-bar';

import type { EntityFilters } from './types';

const DEFAULT_FILTERS: EntityFilters = {
  type: '',
  country: '',
  q: '',
};

export const EntitiesPage = () => {
  const { t } = useTranslation('common');
  const { getLabel: getTypeLabel } = useCodes('ENTITY_TYPE');
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EntityFilters>(DEFAULT_FILTERS);

  const params = useMemo(
    () => ({
      type: filters.type || undefined,
      country: filters.country || undefined,
      q: filters.q?.trim() || undefined,
      page: 0,
      size: 20,
    }),
    [filters]
  );

  const { data: apiData, isLoading, error, refetch } = useEntitiesListQuery(params);
  const items = Array.isArray(apiData) ? apiData : mockEntities;

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  if (error && (!apiData || apiData.length === 0)) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify
              icon="solar:danger-triangle-bold-duotone"
              width={48}
              sx={{ color: 'error.main', mb: 2 }}
            />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('error.errorState.failedToLoadEntities')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : t('error.errorState.unknownError')}
            </Typography>
            <Button variant="outlined" onClick={() => refetch()} startIcon={<Iconify icon="solar:refresh-bold" width={18} />}>
              {t('error.errorState.retry')}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:users-group-rounded-bold-duotone" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('entities.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('entities.subtitle')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
            sx={{ bgcolor: 'transparent' }}
          >
            {t('entities.export')}
          </Button>
        </Stack>

        <EntitiesFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
        />

        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>{t('entities.table.code')}</TableCell>
                    <TableCell>{t('entities.table.name')}</TableCell>
                    <TableCell>{t('entities.table.type')}</TableCell>
                    <TableCell>{t('entities.table.country')}</TableCell>
                    <TableCell>{t('entities.table.risk')}</TableCell>
                    <TableCell align="right">{t('entities.table.openItems')}</TableCell>
                    <TableCell align="right">{t('entities.table.balance')}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('entities.loading')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                        <Stack alignItems="center" spacing={1}>
                          <Iconify
                            icon="solar:users-group-rounded-bold-duotone"
                            width={48}
                            sx={{ color: 'text.disabled' }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {t('entities.empty')}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((entity) => (
                      <TableRow
                        key={entity.id}
                        hover
                        onClick={() => navigate(`${SYNAPSE_ROUTES.ENTITIES}/${entity.id}`)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {entity.code}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {entity.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getTypeLabel(entity.type) || entity.type}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{entity.country}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color:
                                entity.riskScore >= 70
                                  ? 'error.main'
                                  : entity.riskScore >= 50
                                    ? 'warning.main'
                                    : 'text.primary',
                            }}
                          >
                            {entity.riskScore}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {(entity as { openItemsCount?: number }).openItemsCount ??
                              (entity as { openItemsTotal?: number }).openItemsTotal ??
                              0}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {(entity as { openItemsTotal?: number }).openItemsTotal?.toLocaleString() ??
                              (entity as { totalBalance?: number }).totalBalance?.toLocaleString() ??
                              '-'}
                          </Typography>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            component={Link}
                            to={`${SYNAPSE_ROUTES.ENTITIES}/${entity.id}`}
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={16} />}
                            sx={{ textDecoration: 'none' }}
                          >
                            {t('entities.open')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
