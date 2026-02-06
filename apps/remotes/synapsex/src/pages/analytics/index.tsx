/**
 * Analytics — KPI cards + trend charts + filters (date range, bukrs, currency)
 * All metrics from backend (no hardcoded)
 */

import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useAnalyticsKpisQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';

function money(amt: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amt);
}

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

type TrendPoint = { date?: string; value?: number; label?: string };

function isTrendArray(v: unknown): v is TrendPoint[] {
  return Array.isArray(v) && v.every((x) => x && typeof x === 'object' && ('value' in x || 'date' in x));
}

export const AnalyticsPage = () => {
  const { t } = useTranslation('common');
  const [windowDays, setWindowDays] = useState(30);
  const [bukrs, setBukrs] = useState('');
  const [currency, setCurrency] = useState('USD');

  const { from, to } = useMemo(() => getDateRange(windowDays), [windowDays]);

  const params = useMemo(
    () => ({
      from,
      to,
      bukrs: bukrs || undefined,
      currency: currency || undefined,
    }),
    [from, to, bukrs, currency]
  );

  const { data, isLoading, error } = useAnalyticsKpisQuery(params);

  const kpis = useMemo(() => {
    const list: { key: string; label: string; value: string | number; icon: string }[] = [];
    if (data?.savingsEstimate != null) {
      list.push({
        key: 'savingsEstimate',
        label: t('analytics.kpi.savingsEstimate'),
        value: money(data.savingsEstimate, currency),
        icon: 'solar:wallet-money-bold',
      });
    }
    if (data?.preventedLossEstimate != null) {
      list.push({
        key: 'preventedLossEstimate',
        label: t('analytics.kpi.preventedLossEstimate'),
        value: money(data.preventedLossEstimate, currency),
        icon: 'solar:shield-check-bold',
      });
    }
    if (data?.medianTimeToTriageHours != null) {
      list.push({
        key: 'medianTimeToTriageHours',
        label: t('analytics.kpi.medianTimeToTriageHours'),
        value: data.medianTimeToTriageHours.toFixed(1),
        icon: 'solar:clock-circle-bold',
      });
    }
    if (data?.automationRate != null) {
      list.push({
        key: 'automationRate',
        label: t('analytics.kpi.automationRate'),
        value: `${(data.automationRate * 100).toFixed(1)}%`,
        icon: 'solar:chart-2-bold',
      });
    }
    return list;
  }, [data, currency, t]);

  const trendMetrics = useMemo(() => {
    const additionalMetrics = data?.additionalMetrics ?? {};
    const entries = Object.entries(additionalMetrics).filter(
      ([, v]) => isTrendArray(v) && (v as TrendPoint[]).length > 0
    );
    return entries as [string, TrendPoint[]][];
  }, [data?.additionalMetrics]);

  const scalarMetrics = useMemo(() => {
    const additionalMetrics = data?.additionalMetrics ?? {};
    return Object.entries(additionalMetrics).filter(
      ([, v]) => v != null && typeof v !== 'object' && !Array.isArray(v)
    ) as [string, number | string][];
  }, [data?.additionalMetrics]);

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <Iconify icon="solar:danger-triangle-bold-duotone" width={48} sx={{ color: 'error.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('analytics.error.failedToLoad')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
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
              <Iconify icon="solar:chart-2-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('analytics.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('analytics.subtitle')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:download-bold" width={18} />}>
              {t('analytics.export')}
            </Button>
          </Stack>
        </Stack>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              {t('analytics.filters')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="analytics-window">{t('analytics.dateRange')}</InputLabel>
                <Select
                  labelId="analytics-window"
                  label={t('analytics.dateRange')}
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                >
                  <MenuItem value={7}>{t('analytics.last7Days')}</MenuItem>
                  <MenuItem value={30}>{t('analytics.last30Days')}</MenuItem>
                  <MenuItem value={90}>{t('analytics.last90Days')}</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t('analytics.company')}
                value={bukrs}
                onChange={(e) => setBukrs(e.target.value)}
                placeholder="e.g., 1000"
                sx={{ minWidth: 140 }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="analytics-currency">{t('analytics.currency')}</InputLabel>
                <Select
                  labelId="analytics-currency"
                  label={t('analytics.currency')}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="KRW">KRW</MenuItem>
                </Select>
              </FormControl>
              <Chip
                label={`${from} → ${to}`}
                size="small"
                variant="outlined"
                icon={<Iconify icon="solar:calendar-bold" width={14} />}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <Grid container spacing={3}>
          {isLoading ? (
            <Grid size={12}>
              <Card variant="outlined">
                <CardContent sx={{ p: 8, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.loading')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : kpis.length === 0 && scalarMetrics.length === 0 ? (
            <Grid size={12}>
              <Card variant="outlined">
                <CardContent sx={{ p: 8, textAlign: 'center' }}>
                  <Iconify icon="solar:chart-2-bold" width={48} sx={{ color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    {t('analytics.noKpiData')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            <>
              {kpis.map((k) => (
                <Grid key={k.key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                        <Iconify icon={k.icon} width={18} sx={{ color: 'primary.main' }} />
                        <Typography variant="caption" color="text.secondary">
                          {k.label}
                        </Typography>
                      </Stack>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {k.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {scalarMetrics.map(([key, val]) => (
                <Grid key={key} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        {typeof val === 'number' ? val.toLocaleString() : String(val)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </>
          )}
        </Grid>

        {/* Trend Charts (from additionalMetrics) */}
        {trendMetrics.length > 0 &&
          trendMetrics.map(([metricKey, points]) => {
            const maxVal = Math.max(...points.map((p) => p.value ?? 0), 1);
            return (
              <Card key={metricKey} variant="outlined">
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    {metricKey.replace(/([A-Z])/g, ' $1').trim()}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: 0.5,
                      height: 120,
                      overflowX: 'auto',
                      pb: 1,
                    }}
                  >
                    {points.slice(0, 30).map((p, i) => (
                      <Box
                        key={i}
                        sx={{
                          flex: '1 1 20px',
                          minWidth: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: `${Math.max(4, ((p.value ?? 0) / maxVal) * 100)}%`,
                            minHeight: 4,
                            bgcolor: 'primary.main',
                            borderRadius: 0.5,
                            mb: 0.5,
                          }}
                        />
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }} noWrap>
                          {p.date ?? p.label ?? ''}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
      </Stack>
    </Box>
  );
};
