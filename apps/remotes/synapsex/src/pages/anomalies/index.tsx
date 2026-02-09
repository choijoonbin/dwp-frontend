/**
 * Anomaly detection workbench — API with mock fallback
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useRef, useMemo, useState, useEffect } from 'react';
import { Label, Iconify, FilterCard } from '@dwp-frontend/design-system';
import {
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
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { SYNAPSE_ROUTES } from '../../routes';
import { ErrorStateWithRetry } from '../../components/ux';
import { useAnomaliesList } from './hooks/use-anomalies-list';
import { SeverityBadge } from '../../components/finance/severity-badge';
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  type AnomaliesPeriod,
  getDateRangeFromPeriod,
} from './utils/anomalies-date-utils';

// ----------------------------------------------------------------------

type AnomaliesFiltersStorage = {
  q: string;
  severity: string;
  atype: string;
  bukrs: string;
  periodFilter: AnomaliesPeriod;
  useDateRangePreset: boolean;
  dateFrom: string;
  dateTo: string;
};

const ANOMALIES_FILTERS_KEY = 'anomalies';

// ----------------------------------------------------------------------

const ANOMALY_TYPE_KEYS: Record<
  string,
  { labelKey: string; hintKey: string; icon: string; color: 'error' | 'warning' | 'info' | 'default' }
> = {
  duplicate_invoice: {
    labelKey: 'anomalies.typeDuplicateInvoice',
    hintKey: 'anomalies.typeDuplicateInvoiceHint',
    icon: 'solar:copy-bold-duotone',
    color: 'warning',
  },
  bank_change: {
    labelKey: 'anomalies.typeBankChange',
    hintKey: 'anomalies.typeBankChangeHint',
    icon: 'solar:bank-bold-duotone',
    color: 'error',
  },
  policy_violation: {
    labelKey: 'anomalies.typePolicyViolation',
    hintKey: 'anomalies.typePolicyViolationHint',
    icon: 'solar:shield-warning-bold-duotone',
    color: 'info',
  },
  integrity_mismatch: {
    labelKey: 'anomalies.typeIntegrityMismatch',
    hintKey: 'anomalies.typeIntegrityMismatchHint',
    icon: 'solar:danger-triangle-bold-duotone',
    color: 'warning',
  },
  amount_variance: {
    labelKey: 'anomalies.typeAmountVariance',
    hintKey: 'anomalies.typeAmountVarianceHint',
    icon: 'solar:wallet-money-bold-duotone',
    color: 'error',
  },
  timing_anomaly: {
    labelKey: 'anomalies.typeTimingAnomaly',
    hintKey: 'anomalies.typeTimingAnomalyHint',
    icon: 'solar:clock-circle-bold-duotone',
    color: 'default',
  },
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ----------------------------------------------------------------------

/** URL type (DUPLICATE_INVOICE) → UI type (duplicate_invoice) */
const urlTypeToUi = (v: string) => v.toLowerCase();

const getAnomalyTypeMeta = (
  t: (key: string) => string,
  key: string
): { label: string; hint: string; icon: string; color: 'error' | 'warning' | 'info' | 'default' } | undefined => {
  const def = ANOMALY_TYPE_KEYS[key];
  if (!def) return undefined;
  return {
    label: t(def.labelKey),
    hint: t(def.hintKey),
    icon: def.icon,
    color: def.color,
  };
};

export const AnomaliesPage = () => {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlType = searchParams.get('type');
  const urlSeverity = searchParams.get('severity');
  const urlRange = searchParams.get('range');
  const urlCompany = searchParams.get('company');

  const hasUrlParams = Boolean(urlType || urlSeverity || urlRange || urlCompany);
  const stored = getFiltersFromStorage<AnomaliesFiltersStorage>(ANOMALIES_FILTERS_KEY);

  const initial = useMemo(() => {
    if (hasUrlParams) {
      return {
        q: '',
        severity: urlSeverity?.toLowerCase() ?? 'all',
        atype: urlType ? urlTypeToUi(urlType) : 'all',
        bukrs: urlCompany ?? 'all',
        periodFilter: (urlRange as AnomaliesPeriod) ?? '24h',
        useDateRangePreset: true,
        dateFrom: isoToDatetimeLocal(getDateRangeFromPeriod((urlRange as AnomaliesPeriod) ?? '24h').from),
        dateTo: isoToDatetimeLocal(getDateRangeFromPeriod((urlRange as AnomaliesPeriod) ?? '24h').to),
      };
    }
    if (stored) return stored;
    const range = getDateRangeFromPeriod('24h');
    return {
      q: '',
      severity: 'all',
      atype: 'all',
      bukrs: 'all',
      periodFilter: '24h' as AnomaliesPeriod,
      useDateRangePreset: true,
      dateFrom: isoToDatetimeLocal(range.from),
      dateTo: isoToDatetimeLocal(range.to),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial state only
  }, []);

  const [q, setQ] = useState(initial.q);
  const [severity, setSeverity] = useState<string>(initial.severity);
  const [atype, setAtype] = useState<string>(initial.atype);
  const [bukrs, setBukrs] = useState<string>(initial.bukrs);
  const [periodFilter, setPeriodFilter] = useState<AnomaliesPeriod>(initial.periodFilter);
  const [useDateRangePreset, setUseDateRangePreset] = useState(initial.useDateRangePreset);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);

  useEffect(() => {
    if (hasUrlParams && !stored) {
      if (urlType) setAtype(urlTypeToUi(urlType));
      if (urlSeverity) setSeverity(urlSeverity.toLowerCase());
      if (urlCompany) setBukrs(urlCompany);
    }
  }, [urlType, urlSeverity, urlCompany, hasUrlParams, stored]);

  const hasRestoredUrlRef = useRef(false);
  useEffect(() => {
    if (hasRestoredUrlRef.current || hasUrlParams || !stored) return;
    hasRestoredUrlRef.current = true;
    const next = new URLSearchParams();
    if (stored.atype !== 'all') next.set('type', stored.atype.toUpperCase().replace(/-/g, '_'));
    if (stored.severity !== 'all') next.set('severity', stored.severity);
    if (stored.periodFilter !== '24h') next.set('range', stored.periodFilter);
    if (stored.bukrs !== 'all') next.set('company', stored.bukrs);
    if (next.toString()) setSearchParams(next, { replace: true });
  }, [hasUrlParams, stored, setSearchParams]);

  useEffect(() => {
    if (useDateRangePreset) {
      const range = getDateRangeFromPeriod(periodFilter);
      setDateFrom(isoToDatetimeLocal(range.from));
      setDateTo(isoToDatetimeLocal(range.to));
    }
  }, [periodFilter, useDateRangePreset]);

  useEffect(() => {
    saveFiltersToStorage<AnomaliesFiltersStorage>(ANOMALIES_FILTERS_KEY, {
      q,
      severity,
      atype,
      bukrs,
      periodFilter,
      useDateRangePreset,
      dateFrom,
      dateTo,
    });
  }, [q, severity, atype, bukrs, periodFilter, useDateRangePreset, dateFrom, dateTo]);

  const apiType = urlType ?? (atype !== 'all' ? atype.toUpperCase().replace(/-/g, '_') : undefined);
  const apiSeverity = severity !== 'all' ? severity : urlSeverity ?? undefined;

  const { items: rows, kpi, isLoading, error, refetch, companyCodes, filtersApplied } = useAnomaliesList({
    type: apiType,
    severity: apiSeverity,
    range: useDateRangePreset ? periodFilter : undefined,
    from: !useDateRangePreset && dateFrom ? datetimeLocalToIso(dateFrom) : undefined,
    to: !useDateRangePreset && dateTo ? datetimeLocalToIso(dateTo) : undefined,
    filters: {
      searchQuery: q || undefined,
      severity: severity !== 'all' ? severity : undefined,
      anomalyType: atype !== 'all' ? atype : undefined,
      companyCode: bukrs !== 'all' ? bukrs : undefined,
    },
  });

  const handleRefresh = () => {
    const tenantId = getTenantId();
    queryClient.invalidateQueries({ queryKey: ['synapse', 'anomalies', 'list', tenantId] });
    refetch();
  };

  const handleResetFilters = () => {
    setQ('');
    setSeverity('all');
    setAtype('all');
    setBukrs('all');
    setPeriodFilter('24h');
    setUseDateRangePreset(true);
    const range = getDateRangeFromPeriod('24h');
    setDateFrom(isoToDatetimeLocal(range.from));
    setDateTo(isoToDatetimeLocal(range.to));
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    (filtersApplied && Object.keys(filtersApplied).length > 0) ||
    severity !== 'all' ||
    atype !== 'all' ||
    periodFilter !== '24h' ||
    Boolean(urlType || urlRange);

  const sortedRows = [...rows].sort((a, b) => {
    const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const d = (sevRank[a.severity] ?? 2) - (sevRank[b.severity] ?? 2);
    if (d !== 0) return d;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? undefined : t('error.errorState.failedToLoadAnomalies')}
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
              <Iconify icon="solar:danger-triangle-bold" width={24} sx={{ color: 'warning.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('anomalies.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('anomalies.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:file-export-bold" width={16} />}
              onClick={() => {
                const csv = tableToCsv(sortedRows, [
                  { id: 'caseNumber', label: t('cases.case') },
                  { id: 'severity', label: t('cases.severity') },
                  { id: 'anomalyType', label: t('cases.type') },
                  { id: 'companyCode', label: t('commonLabels.company') },
                  { id: 'docNumber', label: t('commonLabels.doc') },
                  { id: 'amount', label: t('cases.amount'), getValue: (r) => `${r.currency} ${r.amount.toLocaleString()}` },
                  { id: 'detectedAt', label: t('commonLabels.detected') },
                  { id: 'confidence', label: t('caseDetail.confidence'), getValue: (r) => `${Math.round(r.confidence * 100)}%` },
                ]);
                downloadCsv(csv, `anomalies-${new Date().toISOString().slice(0, 10)}.csv`);
              }}
            >
              {t('anomalies.exportCsv')}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:tuning-square-2-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              {t('anomalies.thresholds')}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:magic-stick-3-bold" width={18} />}
            >
              {t('anomalies.runScan')}
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('anomalies.totalAnomalies')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {sortedRows.length.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('anomalies.criticalHigh', {
                    critical: kpi.bySev.critical || 0,
                    high: kpi.bySev.high || 0,
                  })}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('anomalies.highRiskBacklog')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {kpi.highRisk.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('anomalies.sortedBySeverityRecency')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('anomalies.avgConfidence')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {Math.round(kpi.avgConfidence * 100)}%
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('anomalies.explainableInDetail')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {t('anomalies.exposureSum')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatMoney(kpi.totalExposure, kpi.currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('anomalies.currencyPerRecord')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
              <Iconify icon="solar:filter-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('anomalies.reviewQueue')}
              </Typography>
            </Stack>

            <FilterCard
              title={t('anomalies.filterTitle')}
              chips={
                hasActiveFilters ? (
                  <>
                    {(filtersApplied?.range ?? urlRange ?? periodFilter !== '24h') && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${t('anomalies.filterRange')}: ${filtersApplied?.range ?? urlRange ?? periodFilter}`}
                        onDelete={() => {
                          setPeriodFilter('24h');
                          setUseDateRangePreset(true);
                          const range = getDateRangeFromPeriod('24h');
                          setDateFrom(isoToDatetimeLocal(range.from));
                          setDateTo(isoToDatetimeLocal(range.to));
                          const next = new URLSearchParams(searchParams);
                          next.delete('range');
                          next.delete('from');
                          next.delete('to');
                          setSearchParams(next);
                        }}
                      />
                    )}
                    {((filtersApplied?.type as string[] | undefined) ?? (atype !== 'all' ? [getAnomalyTypeMeta(t, atype)?.label ?? atype] : [])).map(
                      (s) => (
                        <Chip
                          key={`type-${s}`}
                          size="small"
                          variant="outlined"
                          label={`${t('anomalies.filterType')}: ${s}`}
                          onDelete={() => {
                            setAtype('all');
                            const next = new URLSearchParams(searchParams);
                            next.delete('type');
                            setSearchParams(next);
                          }}
                        />
                      )
                    )}
                    {((filtersApplied?.severity as string[] | undefined) ?? (severity !== 'all' ? [severity] : [])).map(
                      (s) => {
                        const sevLabel =
                          s === 'critical'
                            ? t('cases.filterSeverityCritical')
                            : s === 'high'
                              ? t('cases.filterSeverityHigh')
                              : s === 'medium'
                                ? t('cases.filterSeverityMedium')
                                : s === 'low'
                                  ? t('cases.filterSeverityLow')
                                  : s;
                        return (
                          <Chip
                            key={`severity-${s}`}
                            size="small"
                            variant="outlined"
                            label={`${t('anomalies.filterSeverity')}: ${sevLabel}`}
                            onDelete={() => {
                              setSeverity('all');
                              const next = new URLSearchParams(searchParams);
                              next.delete('severity');
                              setSearchParams(next);
                            }}
                          />
                        );
                      }
                    )}
                  </>
                ) : undefined
              }
              resetLabel={t('anomalies.filterReset')}
              onReset={handleResetFilters}
              searchLabel={t('anomalies.filterSearch')}
              onSearch={handleRefresh}
              sx={{ mb: 2.5 }}
            >
              <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Iconify icon="solar:calendar-bold" width={18} />
                    <Typography variant="subtitle2">{t('anomalies.filterPeriod')}</Typography>
                    <ToggleButtonGroup
                      value={periodFilter}
                      exclusive
                      onChange={(_e, val: AnomaliesPeriod | null) => {
                        if (val !== null) {
                          setPeriodFilter(val);
                          setUseDateRangePreset(true);
                        }
                      }}
                      aria-label={t('anomalies.filterPeriod')}
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
                      <ToggleButton value="90d" aria-label="90d">90d</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <TextField
                      label={t('anomalies.filterDateFrom')}
                      type="datetime-local"
                      size="small"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setUseDateRangePreset(false);
                      }}
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
                      label={t('anomalies.filterDateTo')}
                      type="datetime-local"
                      size="small"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setUseDateRangePreset(false);
                      }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ flex: 1, minWidth: 160 }}
                    />
                  </Stack>
                </Stack>
                <Stack spacing={1}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={t('anomalies.searchPlaceholder')}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
                      <Select
                        fullWidth
                        size="small"
                        value={severity}
                        onChange={(e: SelectChangeEvent) => {
                          const v = e.target.value;
                          setSeverity(v);
                          const next = new URLSearchParams(searchParams);
                          if (v !== 'all') next.set('severity', v);
                          else next.delete('severity');
                          setSearchParams(next);
                        }}
                        displayEmpty
                      >
                        <MenuItem value="all">{t('anomalies.allSeverities')}</MenuItem>
                        <MenuItem value="critical">{t('cases.filterSeverityCritical')}</MenuItem>
                        <MenuItem value="high">{t('cases.filterSeverityHigh')}</MenuItem>
                        <MenuItem value="medium">{t('cases.filterSeverityMedium')}</MenuItem>
                        <MenuItem value="low">{t('cases.filterSeverityLow')}</MenuItem>
                      </Select>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4, lg: 3 }}>
                      <Select
                        fullWidth
                        size="small"
                        value={atype}
                        onChange={(e: SelectChangeEvent) => {
                          const v = e.target.value;
                          setAtype(v);
                          const next = new URLSearchParams(searchParams);
                          if (v !== 'all') next.set('type', v.toUpperCase().replace(/-/g, '_'));
                          else next.delete('type');
                          setSearchParams(next);
                        }}
                        displayEmpty
                      >
                        <MenuItem value="all">{t('anomalies.allTypes')}</MenuItem>
                        {Object.keys(ANOMALY_TYPE_KEYS).map((k) => {
                          const meta = getAnomalyTypeMeta(t, k);
                          return (
                            <MenuItem key={k} value={k}>
                              {meta?.label ?? k}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
                      <Select
                        fullWidth
                        size="small"
                        value={bukrs}
                        onChange={(e: SelectChangeEvent) => {
                          const v = e.target.value;
                          setBukrs(v);
                          const next = new URLSearchParams(searchParams);
                          if (v !== 'all') next.set('company', v);
                          else next.delete('company');
                          setSearchParams(next);
                        }}
                        displayEmpty
                      >
                        <MenuItem value="all">{t('anomalies.allCompanies')}</MenuItem>
                        {companyCodes.map((c) => (
                          <MenuItem key={c.code} value={c.code}>
                            {c.code} — {c.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </Grid>
                  </Grid>
                </Stack>
            </FilterCard>

            {isLoading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('anomalies.loading')}
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 140 }}>{t('cases.case')}</TableCell>
                      <TableCell sx={{ width: 170 }}>{t('cases.type')}</TableCell>
                      <TableCell>{t('anomalies.counterparty')}</TableCell>
                      <TableCell sx={{ width: 160 }}>{t('anomalies.document')}</TableCell>
                      <TableCell sx={{ width: 140 }} align="right">
                        {t('cases.amount')}
                      </TableCell>
                      <TableCell sx={{ width: 120 }} align="right">
                        {t('caseDetail.confidence')}
                      </TableCell>
                      <TableCell sx={{ width: 160 }}>{t('anomalies.sla')}</TableCell>
                      <TableCell sx={{ width: 90 }} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedRows.slice(0, 200).map((c) => {
                      const meta = getAnomalyTypeMeta(t, c.anomalyType);
                      const slaHours = Math.max(
                        0,
                        Math.round(
                          (new Date(c.slaDue).getTime() - Date.now()) / (1000 * 60 * 60)
                        )
                      );
                      const slaColor =
                        slaHours <= 0
                          ? 'error.main'
                          : slaHours <= 6
                            ? 'error.main'
                            : slaHours <= 24
                              ? 'warning.main'
                              : 'text.secondary';
                      const confColor =
                        c.confidence >= 90
                          ? 'success'
                          : c.confidence >= 75
                            ? 'warning'
                            : ('default' as const);

                      return (
                        <TableRow key={c.id} hover>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <SeverityBadge severity={c.severity as 'critical' | 'high' | 'medium' | 'low'} size="sm" />
                              <Link
                                to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', c.id)}
                                style={{ textDecoration: 'none' }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: 600,
                                    color: 'primary.main',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                >
                                  {c.caseNumber}
                                </Typography>
                              </Link>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {c.companyCode} · {c.currency}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={meta?.hint ?? ''} arrow>
                              <Chip
                                icon={
                                  <Iconify
                                    icon={meta?.icon ?? 'solar:danger-triangle-bold'}
                                    width={14}
                                  />
                                }
                                label={meta?.label ?? c.anomalyType}
                                size="small"
                                variant="outlined"
                                color={meta?.color ?? 'default'}
                                sx={{ fontSize: '0.75rem' }}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {c.counterparty}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {c.assignee
                                ? t('anomalies.assignee', { name: c.assignee })
                                : t('anomalies.unassigned')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {c.docNumber}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatMoney(c.amount, c.currency)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Label color={confColor} sx={{ fontSize: '0.75rem' }}>
                              {Math.round(c.confidence <= 1 ? c.confidence * 100 : c.confidence)}%
                            </Label>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" display="block">
                              {new Date(c.slaDue).toLocaleString()}
                            </Typography>
                            <Typography variant="caption" sx={{ color: slaColor }}>
                              {slaHours <= 0
                                ? t('anomalies.slaBreached')
                                : t('anomalies.slaRemaining', { hours: slaHours })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              component={Link}
                              to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', c.id)}
                              size="small"
                              sx={{ color: 'text.secondary' }}
                            >
                              <Iconify icon="solar:arrow-right-up-linear" width={18} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {sortedRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('anomalies.empty')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ mt: 2 }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('anomalies.showingRecords', {
                  shown: Math.min(200, sortedRows.length),
                  total: sortedRows.length.toLocaleString(),
                })}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  icon={<Iconify icon="solar:danger-triangle-bold" width={14} />}
                  label={t('anomalies.explainableByDefault')}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
                  label={t('anomalies.ragCitationsAvailable')}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
