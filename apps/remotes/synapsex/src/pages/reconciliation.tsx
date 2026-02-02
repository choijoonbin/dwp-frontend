import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { mockCases, mockOpenItems, mockCompanyCodes } from '../data/mock-data';

// ----------------------------------------------------------------------

function pct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ----------------------------------------------------------------------

export const ReconciliationPage = () => {
  const [q, setQ] = useState('');
  const [company, setCompany] = useState<string>('all');

  // Mock reconciliation signals derived from existing mock data
  const derived = useMemo(() => {
    const totalRaw = 200000;
    const totalDocs = 199420;
    const totalOpenItems = mockOpenItems.length;
    const missingDocs = totalRaw - totalDocs;
    const dupEvents = 412;
    const latencyP95 = 88;

    const issues = [
      {
        id: 'iss-001',
        type: 'missing',
        severity: 'high' as const,
        title: 'Missing FI documents after ingestion',
        company: '1000',
        count: missingDocs,
        hint: 'Raw events exist but normalized fi_doc records are missing',
        action: 'Reprocess window',
      },
      {
        id: 'iss-002',
        type: 'duplicate',
        severity: 'medium' as const,
        title: 'Duplicate raw events detected',
        company: '2000',
        count: dupEvents,
        hint: 'Multiple identical event payloads received within short window',
        action: 'Deduplicate',
      },
      {
        id: 'iss-003',
        type: 'latency',
        severity: 'low' as const,
        title: 'Ingestion latency p95 above target',
        company: '1000',
        count: latencyP95,
        hint: 'p95 is over the 60s SLA during peak hours',
        action: 'Scale workers',
      },
    ];

    return {
      totalRaw,
      totalDocs,
      totalOpenItems,
      missingDocs,
      dupEvents,
      latencyP95,
      integrityPct: pct((totalDocs / totalRaw) * 100),
      issues,
      lastSyncAt: new Date().toISOString(),
    };
  }, []);

  const rows = useMemo(() => {
    let list = derived.issues;
    if (company !== 'all') list = list.filter((i) => i.company === company);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((i) => [i.title, i.type, i.company, i.hint].some((v) => v.toLowerCase().includes(s)));
    }
    return list;
  }, [derived.issues, company, q]);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Iconify icon="solar:git-pull-request-bold" width={24} sx={{ color: 'primary.main' }} />
            Reconciliation Report
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Validate ingestion integrity between SAP source events and normalized finance tables.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />}>
            Refresh
          </Button>
          <Button variant="contained" component={Link} to="/action-recon" endIcon={<Iconify icon="solar:arrow-right-up-linear" width={16} />}>
            Action Reconciliation
          </Button>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader
            title="Raw Events (SAP)"
            subheader="Last 24h"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {derived.totalRaw.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              IDoc / API / S3 ingestion
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="FI Documents"
            subheader="Normalized"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {derived.totalDocs.toLocaleString()}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <LinearProgress variant="determinate" value={derived.integrityPct} sx={{ flex: 1, height: 8, borderRadius: 1 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {derived.integrityPct}%
              </Typography>
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Open Items"
            subheader="AR/AP"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {derived.totalOpenItems.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              Used for risk & reminders
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title="Active Cases"
            subheader="agent_case"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {mockCases.length.toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
              Investigations & actions
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Iconify icon="solar:danger-triangle-bold" width={20} sx={{ color: 'warning.main' }} />
                  Integrity Issues
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Exceptions that require attention or reprocessing
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, width: { xs: '100%', sm: 'auto' } }}>
                <TextField
                  size="small"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search issues, company code, hints..."
                  sx={{ width: { xs: '100%', sm: 288 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Iconify icon="solar:magnifer-linear" width={16} sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Button variant="outlined" startIcon={<Iconify icon="solar:filter-bold" />}>
                  Filters
                </Button>
              </Box>
            </Box>
          }
          titleTypographyProps={{ component: 'div' }}
        />
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, fontSize: '0.75rem' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Company:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant={company === 'all' ? 'contained' : 'outlined'}
                onClick={() => setCompany('all')}
                sx={{ minWidth: 'auto', px: 1.5 }}
              >
                All
              </Button>
              {mockCompanyCodes.slice(0, 2).map((c) => (
                <Button
                  key={c.code}
                  size="small"
                  variant={company === c.code ? 'contained' : 'outlined'}
                  onClick={() => setCompany(c.code)}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                >
                  {c.code}
                </Button>
              ))}
            </Stack>
          </Box>

          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 120 }}>Severity</TableCell>
                  <TableCell>Issue</TableCell>
                  <TableCell sx={{ width: 120 }}>Company</TableCell>
                  <TableCell sx={{ width: 140 }} align="right">
                    Count
                  </TableCell>
                  <TableCell sx={{ width: 160 }}>Recommended</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip
                        label={r.severity.toUpperCase()}
                        icon={
                          <Iconify
                            icon={
                              r.severity === 'high'
                                ? 'solar:danger-triangle-bold'
                                : r.severity === 'medium'
                                  ? 'solar:clock-circle-bold'
                                  : 'solar:check-circle-bold'
                            }
                            width={14}
                          />
                        }
                        color={r.severity === 'high' ? 'warning' : r.severity === 'medium' ? 'info' : 'success'}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {r.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                        {r.hint}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {r.company}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {r.count.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.action} variant="outlined" size="small" />
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No issues match the current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Last sync: {new Date(derived.lastSyncAt).toLocaleString()}
            </Typography>
            <Chip label="Audit-ready traceability" icon={<Iconify icon="solar:check-circle-bold" width={14} />} variant="outlined" size="small" />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
