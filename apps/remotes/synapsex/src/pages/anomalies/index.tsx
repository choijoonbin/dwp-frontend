/**
 * Anomaly detection workbench — API with mock fallback
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Label, Iconify } from '@dwp-frontend/design-system';

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
import TableContainer from '@mui/material/TableContainer';

import { SYNAPSE_ROUTES } from '../../routes';
import { useAnomaliesList } from './hooks/use-anomalies-list';
import { SeverityBadge } from '../../components/finance/severity-badge';

// ----------------------------------------------------------------------

const anomalyTypeMeta: Record<
  string,
  { label: string; icon: string; hint: string; color: 'error' | 'warning' | 'info' | 'default' }
> = {
  duplicate_invoice: {
    label: 'Duplicate Invoice',
    icon: 'solar:copy-bold-duotone',
    hint: 'Potential duplicate invoice or repeated posting pattern',
    color: 'warning',
  },
  bank_change: {
    label: 'Bank Change Risk',
    icon: 'solar:bank-bold-duotone',
    hint: 'Payment risk after vendor bank account changes',
    color: 'error',
  },
  policy_violation: {
    label: 'Policy Violation',
    icon: 'solar:shield-warning-bold-duotone',
    hint: 'Violation of finance policy / approval matrix',
    color: 'info',
  },
  integrity_mismatch: {
    label: 'Integrity Mismatch',
    icon: 'solar:danger-triangle-bold-duotone',
    hint: 'Header/line mismatch, FX/tax inconsistency, or missing references',
    color: 'warning',
  },
  amount_variance: {
    label: 'Amount Variance',
    icon: 'solar:wallet-money-bold-duotone',
    hint: 'Outlier amount compared to historical baseline',
    color: 'error',
  },
  timing_anomaly: {
    label: 'Timing Anomaly',
    icon: 'solar:clock-circle-bold-duotone',
    hint: 'Off-hours / holiday activity or suspicious timing',
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

export const AnomaliesPage = () => {
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState<string>('all');
  const [atype, setAtype] = useState<string>('all');
  const [bukrs, setBukrs] = useState<string>('all');

  const { items: rows, kpi, isLoading, error, refetch, companyCodes } = useAnomaliesList({
    filters: {
      searchQuery: q || undefined,
      severity: severity !== 'all' ? severity : undefined,
      anomalyType: atype !== 'all' ? atype : undefined,
      companyCode: bukrs !== 'all' ? bukrs : undefined,
    },
  });

  const sortedRows = [...rows].sort((a, b) => {
    const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const d = (sevRank[a.severity] ?? 2) - (sevRank[b.severity] ?? 2);
    if (d !== 0) return d;
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });

  if (error) {
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
              Failed to load anomalies
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : 'Unknown error'}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => refetch()}
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
            >
              Retry
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
              <Iconify icon="solar:danger-triangle-bold" width={24} sx={{ color: 'warning.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Anomaly Detection
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              High-signal anomaly workbench across FI/AP/AR/GL transactions, optimized for review and
              escalation.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:tuning-square-2-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              Thresholds
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:magic-stick-3-bold" width={18} />}
            >
              Run Scan
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Total anomalies
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {sortedRows.length.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Critical {kpi.bySev.critical || 0} · High {kpi.bySev.high || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  High-risk backlog
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {kpi.highRisk.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Sorted by severity then recency
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Avg confidence
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {Math.round(kpi.avgConfidence * 100)}%
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Explainable-by-default in case detail
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Exposure (sum)
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatMoney(kpi.totalExposure, kpi.currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  Currency displayed per record currency
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
                Review queue
              </Typography>
            </Stack>

            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 12, lg: 5 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search case #, vendor/customer, document #, type…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <Iconify
                          icon="solar:magnifer-linear"
                          width={20}
                          sx={{ mr: 1, color: 'text.secondary' }}
                        />
                      ),
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
                <Select
                  fullWidth
                  size="small"
                  value={severity}
                  onChange={(e: SelectChangeEvent) => setSeverity(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All severities</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, lg: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={atype}
                  onChange={(e: SelectChangeEvent) => setAtype(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All types</MenuItem>
                  {Object.entries(anomalyTypeMeta).map(([k, v]) => (
                    <MenuItem key={k} value={k}>
                      {v.label}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
                <Select
                  fullWidth
                  size="small"
                  value={bukrs}
                  onChange={(e: SelectChangeEvent) => setBukrs(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All companies</MenuItem>
                  {companyCodes.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>

            {isLoading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Loading anomalies...
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 140 }}>Case</TableCell>
                      <TableCell sx={{ width: 170 }}>Type</TableCell>
                      <TableCell>Counterparty</TableCell>
                      <TableCell sx={{ width: 160 }}>Document</TableCell>
                      <TableCell sx={{ width: 140 }} align="right">
                        Amount
                      </TableCell>
                      <TableCell sx={{ width: 120 }} align="right">
                        Confidence
                      </TableCell>
                      <TableCell sx={{ width: 160 }}>SLA</TableCell>
                      <TableCell sx={{ width: 90 }} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedRows.slice(0, 200).map((c) => {
                      const meta = anomalyTypeMeta[c.anomalyType];
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
                              Assignee: {c.assignee ?? 'Unassigned'}
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
                              {slaHours <= 0 ? 'SLA breached' : `${slaHours}h remaining`}
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
                            No anomalies match the current filters.
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
                Showing {Math.min(200, sortedRows.length)} of {sortedRows.length.toLocaleString()}{' '}
                records
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  icon={<Iconify icon="solar:danger-triangle-bold" width={14} />}
                  label="Explainable-by-default"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<Iconify icon="solar:magic-stick-3-bold" width={14} />}
                  label="RAG citations available"
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
