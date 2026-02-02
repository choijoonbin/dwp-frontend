import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
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
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { mockCases, mockActions } from '../data/mock-data';

// ----------------------------------------------------------------------

function money(amt: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amt);
}

function severityPill(sev: string) {
  const map: Record<string, { color: 'error' | 'warning' | 'info' | 'success' }> = {
    critical: { color: 'error' },
    high: { color: 'warning' },
    medium: { color: 'info' },
    low: { color: 'success' },
  };
  return map[sev] ?? { color: 'default' };
}

function SlidersPill() {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        width: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1,
        bgcolor: 'action.disabledBackground',
        fontSize: '0.625rem',
      }}
    >
      A/B
    </Box>
  );
}

// ----------------------------------------------------------------------

export const AnalyticsPage = () => {
  const [q, setQ] = useState('');
  const [window, setWindow] = useState<'7d' | '30d' | '90d'>('30d');
  const [currency, setCurrency] = useState('USD');

  const derived = useMemo(() => {
    const allCases = mockCases;
    const allActions = mockActions;

    const actionSuccess = allActions.filter((a) => a.status === 'completed').length;
    const actionTotal = allActions.length;
    const successRate = actionTotal > 0 ? (actionSuccess / actionTotal) * 100 : 0;

    const critical = allCases.filter((c) => c.severity === 'critical').length;
    const high = allCases.filter((c) => c.severity === 'high').length;

    // rough savings estimate (mock)
    const savings = allActions.reduce((acc, a) => acc + (a.estimatedImpact?.amount ?? 0), 0);

    const byType = allCases.reduce<Record<string, number>>(
      (acc, c) => {
        acc[c.anomalyType] = (acc[c.anomalyType] ?? 0) + 1;
        return acc;
      },
      {}
    );

    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => ({ type: k, count: v }));

    const rows = allCases
      .filter((c) => {
        if (!q) return true;
        const s = `${c.id} ${c.title} ${c.anomalyType} ${c.companyCode}`.toLowerCase();
        return s.includes(q.toLowerCase());
      })
      .slice(0, 80)
      .map((c) => ({
        id: c.id,
        title: c.title,
        type: c.anomalyType,
        severity: c.severity,
        company: c.companyCode,
        createdAt: c.createdAt,
        status: c.status,
      }));

    return {
      successRate,
      critical,
      high,
      savings,
      topTypes,
      rows,
    };
  }, [q]);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Impact Analytics
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Outcome and effectiveness metrics for enterprise adoption, audits, and executive reporting.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:download-bold" />}>
            Export
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:magic-stick-bold" />}>
            Generate Executive Summary
          </Button>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:chart-2-bold" width={16} sx={{ color: 'primary.main' }} />
                Action Success Rate
              </Typography>
            }
            titleTypographyProps={{ variant: 'subtitle2' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {derived.successRate.toFixed(0)}%
            </Typography>
            <LinearProgress variant="determinate" value={derived.successRate} sx={{ height: 8, mt: 1, borderRadius: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Includes retries; excludes simulation-only runs.
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:chart-2-bold" width={16} sx={{ color: 'primary.main' }} />
                Estimated Savings
              </Typography>
            }
            titleTypographyProps={{ variant: 'subtitle2' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {money(derived.savings, currency)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Based on policy savings heuristics (mock).
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:chart-2-bold" width={16} sx={{ color: 'primary.main' }} />
                Critical Backlog
              </Typography>
            }
            titleTypographyProps={{ variant: 'subtitle2' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {derived.critical}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Cases requiring immediate approval or action.
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:chart-2-bold" width={16} sx={{ color: 'primary.main' }} />
                High Severity
              </Typography>
            }
            titleTypographyProps={{ variant: 'subtitle2' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {derived.high}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Tracked for SLA & escalation.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardHeader
          title={
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:chart-2-bold" width={20} sx={{ color: 'primary.main' }} />
              Risk Drivers & Case Outcomes
            </Typography>
          }
          subheader="Top anomaly categories and representative cases (mocked). Use this view to justify ROI and tune policies."
          titleTypographyProps={{ component: 'div' }}
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' }, justifyContent: { md: 'space-between' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', md: 'auto' } }}>
              <TextField
                size="small"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search cases, types, company codes..."
                sx={{ width: { xs: '100%', md: 340 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="solar:magnifer-linear" width={16} sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Chip label={window.toUpperCase()} icon={<Iconify icon="solar:filter-bold" width={14} />} variant="outlined" size="small" />
            </Box>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <Select value={window} onChange={(e) => setWindow(e.target.value as '7d' | '30d' | '90d')}>
                  <MenuItem value="7d">Last 7 days</MenuItem>
                  <MenuItem value="30d">Last 30 days</MenuItem>
                  <MenuItem value="90d">Last 90 days</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="KRW">KRW</MenuItem>
                </Select>
              </FormControl>
              <Button variant="outlined" startIcon={<SlidersPill />}>
                Compare Baseline
              </Button>
            </Stack>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mt: 2 }}>
            <Box sx={{ borderRadius: 1, border: 1, borderColor: 'divider', p: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Top Risk Drivers
              </Typography>
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {derived.topTypes.map((t) => {
                  const total = derived.topTypes.reduce((a, b) => a + b.count, 0);
                  const pct = total > 0 ? (t.count / total) * 100 : 0;
                  return (
                    <Box key={t.type} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.type.replace(/_/g, ' ')}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 1 }} />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', width: 60, textAlign: 'right' }}>
                        {t.count}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
                <span>Signals are explainable and policy-citable.</span>
                <Chip label="Evidence-first" icon={<Iconify icon="solar:magic-stick-bold" width={14} />} variant="outlined" size="small" />
              </Box>
            </Box>

            <Box sx={{ borderRadius: 1, border: 1, borderColor: 'divider', p: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Adoption Health
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 1.5 }}>
                <Box sx={{ borderRadius: 1, border: 1, borderColor: 'divider', p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Avg approval time
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                    18m
                  </Typography>
                </Box>
                <Box sx={{ borderRadius: 1, border: 1, borderColor: 'divider', p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Escalations
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                    {Math.max(3, Math.floor(derived.critical / 5))}
                  </Typography>
                </Box>
                <Box sx={{ borderRadius: 1, border: 1, borderColor: 'divider', p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Policy overrides
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                    12
                  </Typography>
                </Box>
                <Box sx={{ borderRadius: 1, border: 1, borderColor: 'divider', p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Trust index
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                    82
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Use this panel to drive rollout decisions (pilot → standard → strict) and governance adjustments.
              </Typography>
            </Box>
          </Box>

          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', mt: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>Case ID</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell sx={{ width: 180 }}>Type</TableCell>
                  <TableCell sx={{ width: 120 }}>Severity</TableCell>
                  <TableCell sx={{ width: 90 }}>Company</TableCell>
                  <TableCell sx={{ width: 150 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {derived.rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {r.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </Typography>
                        <Chip label={new Date(r.createdAt).toLocaleDateString()} variant="outlined" size="small" sx={{ fontSize: '0.625rem' }} />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {r.type.replace(/_/g, ' ')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.severity} color={severityPill(r.severity).color} variant="outlined" size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{r.company}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.status} variant="outlined" size="small" />
                    </TableCell>
                  </TableRow>
                ))}
                {derived.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No cases match your search.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mock analytics view. Wire to real metrics once ingestion + actions are connected.
            </Typography>
            <Chip label="Executive-ready" icon={<Iconify icon="solar:chart-2-bold" width={14} />} variant="outlined" size="small" />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
