import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useOptimizationQuery, useOpenItemsListQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
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
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../routes';
import { SeverityBadge } from '../components/finance/severity-badge';

// ----------------------------------------------------------------------

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type Mode = 'ar' | 'ap';

type OpenItemLike = { id: string; docNumber: string; entityId: string; entityName: string; amount: number; currency: string; daysPastDue: number };

const getRecommendation = (
  t: (key: string) => string
): ((item: OpenItemLike) => { label: string; action: 'remind' | 'review' | 'hold'; color: 'error' | 'warning' | 'info' | 'success' }) =>
  (item: OpenItemLike) => {
    if (item.daysPastDue > 60) return { label: t('optimization.recommendation.escalateDunning'), action: 'remind', color: 'error' };
    if (item.daysPastDue > 30) return { label: t('optimization.recommendation.sendReminder'), action: 'remind', color: 'warning' };
    if (item.amount > 500000) return { label: t('optimization.recommendation.highValueReview'), action: 'review', color: 'info' };
    return { label: t('optimization.recommendation.autoFollowUp'), action: 'remind', color: 'success' };
  };

// ----------------------------------------------------------------------

const BUCKET_LABELS: Record<string, string> = {
  current: 'optimization.bucket.current',
  '1-30': 'optimization.bucket.1-30',
  '31-90': 'optimization.bucket.31-90',
  '90+': 'optimization.bucket.90+',
};

export const OptimizationPage = () => {
  const { t } = useTranslation('common');
  const recommendationFor = getRecommendation(t);
  const [mode, setMode] = useState<Mode>('ar');
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState<string>('all');
  const [bucket, setBucket] = useState<string>('all');

  const { data: optimizationData, isLoading: optimizationLoading, error: optimizationError } =
    useOptimizationQuery(mode);

  const { data: openItemsData, isLoading: openItemsLoading, error: openItemsError } =
    useOpenItemsListQuery({
      limit: 500,
      itemType: mode === 'ar' ? 'AR' : 'AP',
    });
  const openItems = useMemo(() => openItemsData ?? [], [openItemsData]);

  const totals = useMemo(() => {
    if (optimizationData) {
      const currency = optimizationData.buckets[0]?.currency ?? optimizationData.overdueSummary?.currency ?? 'KRW';
      const totalAmount = optimizationData.buckets.reduce((acc, b) => acc + b.totalAmount, 0);
      const overdueAmount = optimizationData.overdueSummary?.overdueAmount ?? 0;
      const recommendationsCount = optimizationData.alertRecommendations?.length ?? 0;
      return {
        sum: totalAmount,
        overdue: overdueAmount,
        currency,
        recommendationsCount,
        buckets: optimizationData.buckets,
        overdueSummary: optimizationData.overdueSummary,
        alertRecommendations: optimizationData.alertRecommendations ?? [],
      };
    }
    return null;
  }, [optimizationData]);

  const rows = useMemo(() => {
    const filtered = openItems
      .filter((i) => (mode === 'ar' ? i.type === 'AR' : i.type === 'AP'))
      .filter((i) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (i.docNumber ?? '').toLowerCase().includes(q) || (i.entityId ?? '').toLowerCase().includes(q) || (i.entityName ?? '').toLowerCase().includes(q);
      })
      .filter((i) => {
        if (bucket === 'all') return true;
        if (bucket === '0-30') return i.daysPastDue >= 0 && i.daysPastDue <= 30;
        if (bucket === '31-60') return i.daysPastDue >= 31 && i.daysPastDue <= 60;
        if (bucket === '60+') return i.daysPastDue > 60;
        return true;
      })
      .filter((i) => {
        if (risk === 'all') return true;
        const rec = recommendationFor(i);
        if (risk === 'critical') return rec.color === 'error';
        if (risk === 'high') return rec.color === 'warning';
        if (risk === 'medium') return rec.color === 'info';
        if (risk === 'low') return rec.color === 'success';
        return true;
      });

    return filtered;
  }, [openItems, mode, search, risk, bucket, recommendationFor]);

  const tableTotals = useMemo(() => {
    const sum = rows.reduce((acc, r) => acc + r.amount, 0);
    const overdue = rows.filter((r) => r.daysPastDue > 0).reduce((acc, r) => acc + r.amount, 0);
    const highValue = rows.filter((r) => r.amount > 500000).length;
    return { sum, overdue, highValue };
  }, [rows]);

  const getEntityName = (id: string, entityName?: string) => entityName || id;

  const isLoading = optimizationLoading || openItemsLoading;
  const error = optimizationError ?? openItemsError;

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error" sx={{ mb: 1 }}>
          {t('optimization.error.failedToLoadOpenItems')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Iconify icon="solar:chart-2-bold" width={24} sx={{ color: 'primary.main' }} />
            {t('optimization.title')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('optimization.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:magic-stick-bold" />}>
            {t('optimization.buttons.autoRecommend')}
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:plain-2-bold" />}>
            {t('optimization.buttons.sendBulkReminders')}
          </Button>
        </Stack>
      </Box>

      {/* KPIs - optimization API */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:dollar-bold" width={16} sx={{ color: 'text.secondary' }} />
                {t('optimization.kpi.totalExposure')}
              </Typography>
            }
            subheader={t('optimization.kpiDesc.currentSelection')}
            titleTypographyProps={{ variant: 'subtitle2' }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {totals
                ? formatMoney(totals.sum, totals.currency)
                : formatMoney(tableTotals.sum, 'USD')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:clock-circle-bold" width={16} sx={{ color: 'text.secondary' }} />
                {t('optimization.kpi.overdueAmount')}
              </Typography>
            }
            subheader={t('optimization.kpiDesc.onlyOverdue')}
            titleTypographyProps={{ variant: 'subtitle2' }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {totals
                ? formatMoney(totals.overdue, totals.currency)
                : formatMoney(tableTotals.overdue, 'USD')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:shield-warning-bold" width={16} sx={{ color: 'text.secondary' }} />
                {t('optimization.kpi.highValueItems')}
              </Typography>
            }
            subheader={t('optimization.kpiDesc.>500kApproval')}
            titleTypographyProps={{ variant: 'subtitle2' }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {totals
                ? totals.recommendationsCount.toLocaleString()
                : tableTotals.highValue.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Buckets - optimization API */}
      {totals?.buckets && totals.buckets.length > 0 && (
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:pie-chart-2-bold" width={16} sx={{ color: 'text.secondary' }} />
                {t('optimization.filters.bucket')}
              </Typography>
            }
            titleTypographyProps={{ variant: 'subtitle2' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              {totals.buckets.map((b) => (
                <Box
                  key={b.bucketKey}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.neutral',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t(BUCKET_LABELS[b.bucketKey] ?? b.bucketKey)}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {formatMoney(b.totalAmount, b.currency)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {b.itemCount}건
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Alert Recommendations - optimization API */}
      {totals?.alertRecommendations && totals.alertRecommendations.length > 0 && (
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:magic-stick-3-bold" width={16} sx={{ color: 'text.secondary' }} />
                {t('optimization.buttons.autoRecommend')}
              </Typography>
            }
            titleTypographyProps={{ variant: 'subtitle2' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Stack spacing={1}>
              {totals.alertRecommendations.map((rec, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2">{rec.reason}</Typography>
                  <Chip
                    label={`${rec.recommendationType} · ${rec.affectedCount}건`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardHeader
          title={
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:filter-bold" width={16} sx={{ color: 'text.secondary' }} />
              {t('optimization.filters.worklistFilters')}
            </Typography>
          }
          titleTypographyProps={{ variant: 'subtitle2' }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: { lg: 'center' }, gap: 2 }}>
            <Tabs value={mode} onChange={(_, v) => setMode(v as Mode)}>
              <Tab label={t('optimization.filters.arReceivables')} value="ar" />
              <Tab label={t('optimization.filters.apPayables')} value="ap" />
            </Tabs>
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('optimization.filters.searchPlaceholder')}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="solar:magnifer-linear" width={16} sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select value={bucket} onChange={(e) => setBucket(e.target.value)}>
                  <MenuItem value="all">{t('optimization.filters.all')}</MenuItem>
                  <MenuItem value="0-30">0–30</MenuItem>
                  <MenuItem value="31-60">31–60</MenuItem>
                  <MenuItem value="60+">60+</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
                  <MenuItem value="all">{t('optimization.filters.allRisks')}</MenuItem>
                  <MenuItem value="critical">{t('severityLabels.critical')}</MenuItem>
                  <MenuItem value="high">{t('severityLabels.high')}</MenuItem>
                  <MenuItem value="medium">{t('severityLabels.medium')}</MenuItem>
                  <MenuItem value="low">{t('severityLabels.low')}</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader
          title={
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:buildings-2-bold" width={16} sx={{ color: 'text.secondary' }} />
              {t('optimization.worklist.title')}
            </Typography>
          }
          subheader={t('optimization.worklist.subtitle')}
          titleTypographyProps={{ variant: 'subtitle2' }}
          subheaderTypographyProps={{ variant: 'caption' }}
        />
        <CardContent sx={{ pt: 0 }}>
          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 140 }}>{t('optimization.table.openItem')}</TableCell>
                  <TableCell>{t('optimization.table.entity')}</TableCell>
                  <TableCell sx={{ width: 140 }}>{t('optimization.table.amount')}</TableCell>
                  <TableCell sx={{ width: 120 }}>{t('optimization.table.overdue')}</TableCell>
                  <TableCell>{t('optimization.table.recommendation')}</TableCell>
                  <TableCell sx={{ width: 160 }}>{t('optimization.table.next')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('optimization.table.loading')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('optimization.table.empty')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                rows.slice(0, 200).map((item) => {
                  const rec = recommendationFor(item);
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Link to={`${SYNAPSE_ROUTES.OPEN_ITEMS}?openItemId=${encodeURIComponent(item.id)}`} style={{ textDecoration: 'none' }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                            {item.docNumber}
                          </Typography>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {getEntityName(item.entityId, item.entityName)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                              {item.entityId}
                            </Typography>
                          </Box>
                          <Link to={`${SYNAPSE_ROUTES.ENTITIES}/${encodeURIComponent(item.entityId)}`} style={{ color: 'inherit' }}>
                            <Iconify icon="solar:arrow-right-up-linear" width={16} sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }} />
                          </Link>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {formatMoney(item.amount, item.currency)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.daysPastDue > 0 ? (
                          <>
                            <SeverityBadge severity={item.daysPastDue > 60 ? 'critical' : item.daysPastDue > 30 ? 'high' : 'medium'} size="sm" />
                            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                              {item.daysPastDue}d
                            </Typography>
                          </>
                        ) : (
                          <Chip label={t('optimization.table.notDue')} variant="outlined" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={rec.label} color={rec.color} variant="outlined" size="small" />
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                          {t('optimization.table.ref', { docNumber: item.docNumber })}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined">
                            {rec.action === 'hold'
                              ? t('optimization.table.setBlock')
                              : rec.action === 'review'
                                ? t('optimization.table.requestApproval')
                                : t('optimization.table.send')}
                          </Button>
                          <Button size="small" variant="text">
                            {t('optimization.table.createCase')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('optimization.table.showingItems', {
                shown: Math.min(200, rows.length),
                total: rows.length.toLocaleString(),
              })}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={t('optimization.table.guardrailsApplied')} icon={<Iconify icon="solar:shield-warning-bold" width={14} />} variant="outlined" size="small" />
              <Chip label={t('optimization.table.agentSuggestions')} icon={<Iconify icon="solar:magic-stick-bold" width={14} />} variant="outlined" size="small" />
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
