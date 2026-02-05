/**
 * Cases worklist — API with mock fallback
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useQueryClient } from '@tanstack/react-query';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { formatCurrency, formatDate } from '@dwp-frontend/shared-i18n';
import {
  is403Error,
  tableToCsv,
  downloadCsv,
  getTenantId,
  useCodes,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { useCasesList } from './hooks/use-cases-list';
import { ErrorStateWithRetry } from '../../components/ux';
import { SeverityBadge } from '../../components/finance/severity-badge';

import type { CaseListItem } from './adapters/case-list-adapter';

// ----------------------------------------------------------------------

export const CasesPage = () => {
  const { t } = useTranslation('common');
  const { getLabel: getStatusLabel } = useCodes('CASE_STATUS');
  const { getLabel: getTypeLabel } = useCodes('CASE_TYPE');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const {
    items: rows,
    isLoading,
    error,
    refetch,
    totalCount,
    totalPages,
    triageBacklogCount,
  } = useCasesList({
    page,
    size: 20,
    filters: {
      searchQuery: q || undefined,
    },
  });

  useEffect(() => {
    setPage(0);
  }, [q]);

  const handleRowClick = (row: CaseListItem) => {
    navigate(`${SYNAPSE_ROUTES.CASES}/${row.id}`);
  };

  const handleRefresh = () => {
    const tenantId = getTenantId();
    queryClient.invalidateQueries({ queryKey: ['synapse', 'cases', 'list', tenantId] });
    refetch();
  };

  const handleExportCsv = () => {
    const csv = tableToCsv(rows, [
      { id: 'caseNumber', label: t('cases.case') },
      { id: 'severity', label: t('cases.severity') },
      { id: 'status', label: t('cases.status'), getValue: (r) => getStatusLabel(r.status) || r.status },
      { id: 'anomalyType', label: t('cases.type'), getValue: (r) => getTypeLabel(r.anomalyType) || r.anomalyType },
      { id: 'companyCode', label: 'Company' },
      { id: 'amount', label: t('cases.amount'), getValue: (r) => formatCurrency(r.amount, r.currency) },
      { id: 'detectedAt', label: t('cases.lastDetected') },
    ]);
    downloadCsv(csv, `cases-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? undefined : t('error.errorState.failedToLoadCases')}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        is403={is403Error(error)}
      />
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
              <Iconify icon="solar:clipboard-list-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('cases.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('cases.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
              onClick={handleRefresh}
            >
              {t('cases.refresh')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:file-export-bold" width={16} />}
              onClick={handleExportCsv}
            >
              {t('cases.exportCsv')}
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('cases.totalCases')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {totalCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('cases.triageBacklog')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {triageBacklogCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <TextField
          placeholder={t('cases.searchPlaceholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          sx={{ maxWidth: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="solar:magnifer-bold" width={18} />
              </InputAdornment>
            ),
          }}
        />

        <TableContainer component={Card} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('cases.case')}</TableCell>
                <TableCell>{t('cases.severity')}</TableCell>
                <TableCell>{t('cases.status')}</TableCell>
                <TableCell>{t('cases.type')}</TableCell>
                <TableCell align="right">{t('cases.amount')}</TableCell>
                <TableCell>{t('cases.lastDetected')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    {t('cases.loading')}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }} color="text.secondary">
                    {t('cases.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(row)}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.caseNumber}
                        </Typography>
                        {row.isNew && (
                          <Label variant="soft" color="primary" sx={{ px: 0.75, py: 0.25 }}>
                            {t('cases.new')}
                          </Label>
                        )}
                        {row.isUpdated && !row.isNew && (
                          <Label variant="soft" color="info" sx={{ px: 0.75, py: 0.25 }}>
                            {t('cases.updated')}
                          </Label>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={row.severity} />
                    </TableCell>
                    <TableCell>
                      <Label variant="soft" color="default">
                        {getStatusLabel(row.status) || row.status}
                      </Label>
                    </TableCell>
                    <TableCell>{getTypeLabel(row.anomalyType) || row.anomalyType || '-'}</TableCell>
                    <TableCell align="right">{formatCurrency(row.amount, row.currency)}</TableCell>
                    <TableCell>
                      {(row.lastDetectedAt ?? row.updatedAt ?? row.detectedAt)
                        ? formatDate(row.lastDetectedAt ?? row.updatedAt ?? row.detectedAt)
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {t('cases.pageOf', { current: page + 1, total: totalPages })}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('cases.previous')}
              </Button>
              <Button
                size="small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('cases.next')}
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
