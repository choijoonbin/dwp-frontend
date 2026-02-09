/**
 * Cases worklist — API 기반 (하드코딩 제거)
 * @see docs/job/PROMPT_B_Frontend_MenuByMenu_Cases_First.txt
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useMemo, useState, useEffect } from 'react';
import { Label, Iconify, FilterCard } from '@dwp-frontend/design-system';
import { formatDate, formatCurrency, useTranslation } from '@dwp-frontend/shared-i18n';
import {
  useCodes,
  is403Error,
  tableToCsv,
  downloadCsv,
  getTenantId,
  saveFiltersToStorage,
  getFiltersFromStorage,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/material/ToggleButton';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { SYNAPSE_ROUTES } from '../../routes';
import { useCasesList } from './hooks/use-cases-list';
import { ErrorStateWithRetry } from '../../components/ux';
import { SeverityBadge } from '../../components/finance/severity-badge';
import { TableLoadingSkeleton } from '../../components/ux/table-loading-skeleton';
import {
  type CasesPeriod,
  datetimeLocalToIso,
  isoToDatetimeLocal,
  getDateRangeFromPeriod,
} from './utils/cases-date-utils';

import type { CaseListItem } from './adapters/case-list-adapter';

type CasesFiltersStorage = {
  q: string;
  statusFilter: string;
  severityFilter: string;
  caseTypeFilter: string;
  periodFilter: CasesPeriod;
  dateFrom: string;
  dateTo: string;
  page: number;
};

const CASES_FILTERS_KEY = 'cases';

export const CasesPage = () => {
  const { t } = useTranslation('common');
  const { getLabel: getStatusLabel, codeMap: statusCodeMap } = useCodes('CASE_STATUS');
  const { getLabel: getTypeLabel, codeMap: typeCodeMap } = useCodes('CASE_TYPE');
  const { getLabel: getSeverityLabel, codeMap: severityCodeMap } = useCodes('SEVERITY');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stored = getFiltersFromStorage<CasesFiltersStorage>(CASES_FILTERS_KEY);
  const skipPeriodSyncRef = useRef(!!stored);
  const defaultRange = useMemo(() => getDateRangeFromPeriod(stored?.periodFilter ?? '24h'), []);

  const [q, setQ] = useState(stored?.q ?? '');
  const [page, setPage] = useState(stored?.page ?? 0);
  const [statusFilter, setStatusFilter] = useState<string>(stored?.statusFilter ?? '');
  const [severityFilter, setSeverityFilter] = useState<string>(stored?.severityFilter ?? '');
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>(stored?.caseTypeFilter ?? '');
  const [periodFilter, setPeriodFilter] = useState<CasesPeriod>(stored?.periodFilter ?? '24h');
  const [dateFrom, setDateFrom] = useState(
    stored?.dateFrom ?? isoToDatetimeLocal(defaultRange.from)
  );
  const [dateTo, setDateTo] = useState(stored?.dateTo ?? isoToDatetimeLocal(defaultRange.to));
  // 케이스 검출시간 필터 - 현재 미사용
  // const [detectedFrom, setDetectedFrom] = useState('');
  // const [detectedTo, setDetectedTo] = useState('');

  useEffect(() => {
    if (skipPeriodSyncRef.current) {
      skipPeriodSyncRef.current = false;
      return;
    }
    const range = getDateRangeFromPeriod(periodFilter);
    setDateFrom(isoToDatetimeLocal(range.from));
    setDateTo(isoToDatetimeLocal(range.to));
  }, [periodFilter]);

  useEffect(() => {
    saveFiltersToStorage<CasesFiltersStorage>(CASES_FILTERS_KEY, {
      q,
      statusFilter,
      severityFilter,
      caseTypeFilter,
      periodFilter,
      dateFrom,
      dateTo,
      page,
    });
  }, [q, statusFilter, severityFilter, caseTypeFilter, periodFilter, dateFrom, dateTo, page]);

  const statusOptions = useMemo(
    () =>
      statusCodeMap.size > 0
        ? Array.from(statusCodeMap.entries()).map(([code, label]) => ({ code, label }))
        : [],
    [statusCodeMap]
  );

  const severityOptions = useMemo(
    () =>
      severityCodeMap.size > 0
        ? Array.from(severityCodeMap.entries()).map(([code, label]) => ({ code, label }))
        : [],
    [severityCodeMap]
  );

  const caseTypeOptions = useMemo(
    () =>
      typeCodeMap.size > 0
        ? Array.from(typeCodeMap.entries()).map(([code, label]) => ({ code, label }))
        : [],
    [typeCodeMap]
  );

  // dateFrom/dateTo는 항상 값이 있으므로 칩 섹션을 표시하고, 개별 칩은 각 조건에 따라 렌더
  const hasFilters = Boolean(
    q.trim() ||
      statusFilter ||
      severityFilter ||
      caseTypeFilter ||
      periodFilter !== '24h' ||
      dateFrom ||
      dateTo
  );

  const handleResetFilters = () => {
    setQ('');
    setStatusFilter('');
    setSeverityFilter('');
    setCaseTypeFilter('');
    setPeriodFilter('24h');
    // setDetectedFrom('');
    // setDetectedTo('');
    setPage(0);
  };

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
    q: q.trim() || undefined,
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
    caseType: caseTypeFilter || undefined,
    dateFrom: dateFrom ? datetimeLocalToIso(dateFrom) : undefined,
    dateTo: dateTo ? datetimeLocalToIso(dateTo) : undefined,
    // 케이스 검출시간 필터 - 현재 미사용
    // detectedFrom: detectedFrom ? datetimeLocalToIso(detectedFrom) : undefined,
    // detectedTo: detectedTo ? datetimeLocalToIso(detectedTo) : undefined,
    filters: {
      searchQuery: q.trim() || undefined,
    },
  });

  useEffect(() => {
    setPage(0);
  }, [q, statusFilter, severityFilter, caseTypeFilter, dateFrom, dateTo]);

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
      { id: 'companyCode', label: t('commonLabels.company') },
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

        <FilterCard
          title={t('cases.filterTitle')}
          chips={
            hasFilters ? (
              <>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${t('cases.filterPeriod')}: ${periodFilter}`}
                  onDelete={() => {
                    setPeriodFilter('24h');
                    const range = getDateRangeFromPeriod('24h');
                    setDateFrom(isoToDatetimeLocal(range.from));
                    setDateTo(isoToDatetimeLocal(range.to));
                  }}
                />
                {statusFilter && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${t('cases.status')}: ${getStatusLabel(statusFilter) ?? statusFilter}`}
                    onDelete={() => setStatusFilter('')}
                  />
                )}
                {severityFilter && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${t('cases.severity')}: ${getSeverityLabel(severityFilter) ?? severityFilter}`}
                    onDelete={() => setSeverityFilter('')}
                  />
                )}
                {caseTypeFilter && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${t('cases.type')}: ${getTypeLabel(caseTypeFilter) ?? caseTypeFilter}`}
                    onDelete={() => setCaseTypeFilter('')}
                  />
                )}
                {q.trim() && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${t('cases.filterSearch')}: ${q.trim().slice(0, 20)}${q.trim().length > 20 ? '...' : ''}`}
                    onDelete={() => setQ('')}
                  />
                )}
              </>
            ) : undefined
          }
          resetLabel={t('cases.filterReset')}
          onReset={handleResetFilters}
          searchLabel={t('cases.filterSearch')}
          onSearch={handleRefresh}
        >
          <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', md: 'flex-start' }}
              justifyContent="space-between"
            >
              <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Iconify icon="solar:calendar-bold" width={18} />
                  <Typography variant="subtitle2">{t('cases.filterPeriod')}</Typography>
                  <ToggleButtonGroup
                    value={periodFilter}
                    exclusive
                    onChange={(_e, val: CasesPeriod | null) => val !== null && setPeriodFilter(val)}
                    aria-label={t('cases.filterPeriod')}
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        px: 1,
                        py: 0,
                        minWidth: 36,
                        height: 22,
                        fontSize: '0.75rem',
                        lineHeight: 1,
                      },
                    }}
                  >
                    <ToggleButton value="1h" aria-label="1h">1h</ToggleButton>
                    <ToggleButton value="6h" aria-label="6h">6h</ToggleButton>
                    <ToggleButton value="24h" aria-label="24h">24h</ToggleButton>
                    <ToggleButton value="7d" aria-label="7d">7d</ToggleButton>
                    <ToggleButton value="30d" aria-label="30d">30d</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    label={t('cases.filterDateFrom')}
                    type="datetime-local"
                    size="small"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 160 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ px: 0.5, color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}
                  >
                    ~
                  </Typography>
                  <TextField
                    label={t('cases.filterDateTo')}
                    type="datetime-local"
                    size="small"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 160 }}
                  />
                </Stack>
              </Stack>

              {/* 케이스 검출시간 필터 - 현재 미사용
              <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Iconify icon="solar:clock-circle-bold" width={18} />
                  <Typography variant="subtitle2">{t('cases.filterDetectionPeriod')}</Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <TextField
                    label={t('cases.filterDetectionFrom')}
                    type="datetime-local"
                    size="small"
                    value={detectedFrom}
                    onChange={(e) => setDetectedFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 160 }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ px: 0.5, color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}
                  >
                    ~
                  </Typography>
                  <TextField
                    label={t('cases.filterDetectionTo')}
                    type="datetime-local"
                    size="small"
                    value={detectedTo}
                    onChange={(e) => setDetectedTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 160 }}
                  />
                </Stack>
              </Stack>
              */}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap" useFlexGap>
              <TextField
                placeholder={t('cases.searchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                size="small"
                sx={{ minWidth: 200, maxWidth: 320 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="solar:magnifer-bold" width={18} />
                    </InputAdornment>
                  ),
                }}
              />
          {statusOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('cases.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('cases.status')}
                onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">{t('cases.filterAll')}</MenuItem>
                {statusOptions.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {severityOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('cases.severity')}</InputLabel>
              <Select
                value={severityFilter}
                label={t('cases.severity')}
                onChange={(e: SelectChangeEvent) => setSeverityFilter(e.target.value)}
              >
                <MenuItem value="">{t('cases.filterAll')}</MenuItem>
                {severityOptions.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {caseTypeOptions.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>{t('cases.type')}</InputLabel>
              <Select
                value={caseTypeFilter}
                label={t('cases.type')}
                onChange={(e: SelectChangeEvent) => setCaseTypeFilter(e.target.value)}
              >
                <MenuItem value="">{t('cases.filterAll')}</MenuItem>
                {caseTypeOptions.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
            </Stack>
        </FilterCard>

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
                  <TableCell colSpan={6} sx={{ py: 0, px: 0, border: 0, verticalAlign: 'top' }}>
                    <TableLoadingSkeleton rows={5} columns={6} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Stack alignItems="center" spacing={2}>
                      <Iconify
                        icon="solar:clipboard-list-bold-duotone"
                        width={48}
                        sx={{ color: 'text.disabled' }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {hasFilters ? t('cases.emptyData') : t('cases.empty')}
                      </Typography>
                      {hasFilters && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
                          onClick={handleResetFilters}
                        >
                          {t('cases.filterResetCta')}
                        </Button>
                      )}
                    </Stack>
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
