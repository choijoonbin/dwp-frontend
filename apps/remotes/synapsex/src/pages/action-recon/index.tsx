/**
 * Action Reconciliation — Outcomes dashboard + failure breakdown + row deep links
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Label, Iconify } from '@dwp-frontend/design-system';
import { is403Error, 
  useActionReconQuery,
  useRetryActionReconMutation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
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
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { ErrorStateWithRetry } from '../../components/ux';

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusMeta: Record<string, { labelKey: string; icon: string; color: 'success' | 'warning' | 'error' }> = {
  success: { labelKey: 'actionRecon.statusMeta.success', icon: 'solar:check-circle-bold', color: 'success' },
  pending: { labelKey: 'actionRecon.statusMeta.pending', icon: 'solar:clock-circle-bold', color: 'warning' },
  failed: { labelKey: 'actionRecon.statusMeta.failed', icon: 'solar:close-circle-bold', color: 'error' },
};

export const ActionReconciliationPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const { data, isLoading, error, refetch } = useActionReconQuery();
  const retryMutation = useRetryActionReconMutation();

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.actionId?.toLowerCase().includes(s) ||
        r.caseId?.toLowerCase().includes(s) ||
        r.actionType?.toLowerCase().includes(s) ||
        r.failureReason?.toLowerCase().includes(s)
    );
  }, [data?.rows, q]);

  const failureReasons = data?.failureReasons ?? [];
  const impactSummary = data?.impactSummary;

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? undefined : t('error.errorState.failedToLoadActionReconciliation')}
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
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:link-circle-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('actionRecon.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t('actionRecon.subtitle')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
            onClick={() => navigate(SYNAPSE_ROUTES.RECONCILIATION)}
          >
            {t('actionRecon.reconciliationRuns')}
          </Button>
        </Stack>

        {/* KPI Cards */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('actionRecon.successRate')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {data ? `${Math.round((data.successRate ?? 0) * 100)}%` : '-'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('actionRecon.success')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                  {(data?.successCount ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('actionRecon.failed')}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                  {(data?.failedCount ?? 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Failure Breakdown */}
        {failureReasons.length > 0 && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                {t('actionRecon.failureBreakdown')}
              </Typography>
              <Stack spacing={2}>
                {failureReasons.map((fr, i) => (
                  <Box
                    key={i}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {fr.reason}
                      </Typography>
                      <Chip label={t('actionRecon.failedCount', { count: fr.count })} size="small" color="error" variant="outlined" />
                    </Stack>
                    {fr.actionIds && fr.actionIds.length > 0 && (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                        {fr.actionIds.slice(0, 5).map((aid) => (
                          <Button
                            key={aid}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                            onClick={() => navigate(`${SYNAPSE_ROUTES.ACTIONS}?actionId=${aid}`)}
                          >
                            {aid.slice(0, 8)}…
                          </Button>
                        ))}
                        {fr.actionIds.length > 5 && (
                          <Typography variant="caption" color="text.secondary">
                            {t('actionRecon.more', { count: fr.actionIds.length - 5 })}
                          </Typography>
                        )}
                      </Stack>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Impact Summary */}
        {impactSummary && (impactSummary.byActionType || impactSummary.totalAmount != null) && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                {t('actionRecon.impactSummary')}
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {impactSummary.byActionType &&
                  Object.entries(impactSummary.byActionType).map(([type, v]) => (
                    <Chip
                      key={type}
                      label={`${type}: ${v.count}${v.amount != null ? ` · ${fmtMoney(v.amount, 'USD')}` : ''}`}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                {impactSummary.totalAmount != null && (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('actionRecon.total')}: {fmtMoney(impactSummary.totalAmount, 'USD')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Rows Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('actionRecon.actionOutcomes')}
              </Typography>
              <TextField
                size="small"
                placeholder={t('actionRecon.searchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                sx={{ width: 280 }}
                InputProps={{
                  startAdornment: (
                    <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                  ),
                }}
                />
            </Stack>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('actionRecon.table.action')}</TableCell>
                    <TableCell>{t('actionRecon.table.case')}</TableCell>
                    <TableCell>{t('actionRecon.table.type')}</TableCell>
                    <TableCell>{t('actionRecon.table.status')}</TableCell>
                    <TableCell align="right">{t('actionRecon.table.amount')}</TableCell>
                    <TableCell>{t('actionRecon.table.failureReason')}</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
<Typography variant="body2" color="text.secondary">
                        {t('actionRecon.loading')}
                      </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
<Typography variant="body2" color="text.secondary">
                        {t('actionRecon.empty')}
                      </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const meta = statusMeta[r.status] ?? statusMeta.pending;
                      return (
                        <TableRow key={r.actionId} hover>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {r.actionId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`${SYNAPSE_ROUTES.CASES}/${r.caseId}`}
                              style={{ textDecoration: 'none' }}
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 500,
                                  color: 'primary.main',
                                  '&:hover': { textDecoration: 'underline' },
                                }}
                              >
                                {r.caseId}
                                <Iconify icon="solar:arrow-right-up-linear" width={12} sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                              </Typography>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Chip label={r.actionType ?? '-'} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell>
                            <Label color={meta.color} startIcon={<Iconify icon={meta.icon} width={14} />} sx={{ fontSize: '0.75rem' }}>
                              {t(meta.labelKey)}
                            </Label>
                          </TableCell>
                          <TableCell align="right">
                            {r.amount != null ? fmtMoney(r.amount, r.currency ?? 'USD') : '-'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {r.failureReason ?? '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {r.status === 'failed' && (
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  startIcon={<Iconify icon="solar:refresh-bold" width={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    retryMutation.mutate(r.actionId);
                                  }}
                                  disabled={retryMutation.isPending}
                                >
                                  {t('actionRecon.retry')}
                                </Button>
                              )}
                              <Button
                                size="small"
                                endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`${SYNAPSE_ROUTES.ACTIONS}?q=${encodeURIComponent(r.actionId ?? '')}`);
                                }}
                              >
                                {t('actionRecon.action')}
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
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};
