import { Link } from 'react-router-dom';
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
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { mockActions, mockCompanyCodes } from '../data/mock-data';

// ----------------------------------------------------------------------

const statusMeta: Record<string, { label: string; icon: string; color: 'success' | 'warning' | 'error' }> = {
  confirmed: { label: 'Confirmed', icon: 'solar:check-circle-bold', color: 'success' },
  pending: { label: 'Pending', icon: 'solar:clock-circle-bold', color: 'warning' },
  failed: { label: 'Failed', icon: 'solar:close-circle-bold', color: 'error' },
};

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ----------------------------------------------------------------------

export const ActionReconciliationPage = () => {
  const [q, setQ] = useState('');
  const [company, setCompany] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const rows = useMemo(() => {
    const base = mockActions
      .map((a, idx) => {
        const s = idx % 10 === 0 ? 'failed' : idx % 3 === 0 ? 'pending' : 'confirmed';
        const sapRef = `SAP-${a.id.slice(0, 8).toUpperCase()}`;
        return { ...a, sapRef, sapStatus: s };
      })
      .filter((r) => {
        const compOk = company === 'all' || r.companyCode === company;
        const stOk = status === 'all' || r.sapStatus === status;
        const qOk = !q || [r.id, r.caseId, r.actionType, r.sapRef].some((v) => v.toLowerCase().includes(q.toLowerCase()));
        return compOk && stOk && qOk;
      });
    return base.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [q, company, status]);

  const summary = useMemo(() => {
    const total = rows.length;
    const by = rows.reduce(
      (acc, r) => {
        acc[r.sapStatus] = (acc[r.sapStatus] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return { total, by };
  }, [rows]);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Action Reconciliation
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Verify whether autonomous actions were applied in SAP, and manage retries for partial or failed executions.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />}>
            Refresh Status
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:arrow-right-up-linear" width={16} />}>
            Open Retry Queue
          </Button>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader title="Confirmed" subheader="Applied in SAP" titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }} subheaderTypographyProps={{ variant: 'caption' }} />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {(summary.by.confirmed || 0).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Pending" subheader="Awaiting callback / workflow" titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }} subheaderTypographyProps={{ variant: 'caption' }} />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {(summary.by.pending || 0).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Failed" subheader="Needs retry / investigation" titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }} subheaderTypographyProps={{ variant: 'caption' }} />
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {(summary.by.failed || 0).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardHeader
          title={
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:link-circle-bold" width={20} sx={{ color: 'primary.main' }} />
              SAP Action Verification
            </Typography>
          }
          subheader="Cross-check agent actions against SAP execution status."
          titleTypographyProps={{ component: 'div' }}
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: { lg: 'center' }, justifyContent: { lg: 'space-between' } }}>
            <TextField
              size="small"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by action id, case id, type, SAP ref..."
              sx={{ flex: 1, maxWidth: { lg: 560 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="solar:magnifer-linear" width={16} sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" spacing={1}>
              <Iconify icon="solar:filter-bold" width={16} sx={{ color: 'text.secondary', alignSelf: 'center' }} />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select value={company} onChange={(e) => setCompany(e.target.value)}>
                  <MenuItem value="all">All companies</MenuItem>
                  {mockCompanyCodes.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <MenuItem value="all">All statuses</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Box>

          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', mt: 2, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 160 }}>Action</TableCell>
                  <TableCell sx={{ width: 140 }}>SAP Ref</TableCell>
                  <TableCell sx={{ width: 160 }}>Type</TableCell>
                  <TableCell sx={{ width: 220 }}>Case</TableCell>
                  <TableCell sx={{ width: 120 }}>Company</TableCell>
                  <TableCell sx={{ width: 160 }}>Amount</TableCell>
                  <TableCell sx={{ width: 140 }}>SAP Status</TableCell>
                  <TableCell align="right" sx={{ width: 140 }}>
                    Ops
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 200).map((r) => {
                  const meta = statusMeta[r.sapStatus];
                  return (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {r.id.slice(0, 10)}…
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {r.sapRef}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={r.actionType} variant="outlined" size="small" />
                      </TableCell>
                      <TableCell>
                        <Link to={`/cases/${r.caseId}`} style={{ textDecoration: 'none' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'primary.main', display: 'inline-flex', alignItems: 'center', gap: 0.5, '&:hover': { textDecoration: 'underline' } }}>
                            {r.caseId}
                            <Iconify icon="solar:arrow-right-up-linear" width={14} />
                          </Typography>
                        </Link>
                      </TableCell>
                      <TableCell>{r.companyCode}</TableCell>
                      <TableCell>{fmtMoney(r.amount || 0, r.currency || 'USD')}</TableCell>
                      <TableCell>
                        <Chip label={meta.label} icon={<Iconify icon={meta.icon} width={14} />} color={meta.color} variant="outlined" size="small" />
                      </TableCell>
                      <TableCell align="right">
                        {r.sapStatus === 'failed' ? (
                          <Button size="small" variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />}>
                            Retry
                          </Button>
                        ) : (
                          <Button size="small" variant="outlined" startIcon={<Iconify icon="solar:shield-warning-bold" />}>
                            Inspect
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No actions match the current filters.
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
              Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} actions
            </Typography>
            <Chip label="Contract-ready reconciliation" icon={<Iconify icon="solar:check-circle-bold" width={14} />} variant="outlined" size="small" />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
