import type { SelectChangeEvent } from '@mui/material/Select';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
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

import { SYNAPSE_ROUTES } from '../routes';
import { mockCases, mockActions } from '../data/mock-data';
import { SeverityBadge } from '../components/finance/severity-badge';

import type { SynapseAction } from '../data/mock-data';

// ----------------------------------------------------------------------

const statusMeta: Record<string, { label: string; icon: string; color: 'success' | 'error' | 'warning' }> = {
  completed: { label: 'Completed', icon: 'solar:check-circle-bold', color: 'success' },
  failed: { label: 'Failed', icon: 'solar:close-circle-bold', color: 'error' },
  pending: { label: 'Pending', icon: 'solar:clock-circle-bold', color: 'warning' },
};

const formatMoney = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

// ----------------------------------------------------------------------

/** 조치 이력 보관함 */
export const ArchivePage = () => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [selected, setSelected] = useState<SynapseAction | null>(null);

  const rows = useMemo(
    () =>
      mockActions
        .filter((a) => {
          if (status !== 'all' && a.status !== status) return false;
          if (type !== 'all' && a.type !== type) return false;
          if (q) {
            const s = q.toLowerCase();
            return (
              a.id.toLowerCase().includes(s) ||
              (a.caseId || '').toLowerCase().includes(s) ||
              (a.description || '').toLowerCase().includes(s)
            );
          }
          return true;
        })
        .slice()
        .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)),
    [q, status, type]
  );

  const completedCount = mockActions.filter((a) => a.status === 'executed').length;
  const failedCount = mockActions.filter((a) => a.status === 'failed').length;
  const pendingCount = mockActions.filter((a) => a.status === 'pending').length;

  const uniqueTypes = Array.from(new Set(mockActions.map((a) => a.actionType)));

  const linkedCase = selected?.caseId ? mockCases.find((c) => c.id === selected.caseId) : undefined;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:archive-bold" width={24} sx={{ color: 'primary.main' }} />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Action Archive
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              Review executed actions, outcomes, before/after deltas, and audit-ready artifacts.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
              sx={{ bgcolor: 'transparent' }}
            >
              Export
            </Button>
            <Button variant="contained" size="small" startIcon={<Iconify icon="solar:restart-bold" width={18} />}>
              Replay Simulation
            </Button>
          </Stack>
        </Stack>

        {/* KPIs */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ bgcolor: 'success.lighter', borderColor: 'success.main' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Completed
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {completedCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Executed successfully
                    </Typography>
                  </Box>
                  <Iconify icon="solar:check-circle-bold" width={20} sx={{ color: 'success.main' }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ bgcolor: 'warning.lighter', borderColor: 'warning.main' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Pending
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {pendingCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Awaiting execution/approval
                    </Typography>
                  </Box>
                  <Iconify icon="solar:clock-circle-bold" width={20} sx={{ color: 'warning.main' }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ bgcolor: 'error.lighter', borderColor: 'error.main' }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Failed
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {failedCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Requires attention
                    </Typography>
                  </Box>
                  <Iconify icon="solar:close-circle-bold" width={20} sx={{ color: 'error.main' }} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:filter-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Search & Filters
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Filter by status, action type, and linked case.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search action id, case id, description…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <Iconify icon="solar:magnifer-linear" width={20} sx={{ mr: 1, color: 'text.secondary' }} />
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={status}
                  onChange={(e: SelectChangeEvent) => setStatus(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All statuses</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <Select
                  fullWidth
                  size="small"
                  value={type}
                  onChange={(e: SelectChangeEvent) => setType(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="all">All types</MenuItem>
                  {uniqueTypes.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table */}
        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:bolt-circle-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Action Records
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Click a row to open the audit-ready action detail drawer.
            </Typography>
            <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Action</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Linked Case</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((a) => {
                    const meta = statusMeta[a.status] || statusMeta.pending;
                    return (
                      <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(a)}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {a.id}
                            </Typography>
                            {a.simulation && (
                              <Chip label="Simulated" size="small" variant="outlined" sx={{ fontSize: '0.625rem' }} />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {a.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Label color={meta.color} startIcon={<Iconify icon={meta.icon} width={14} />}>
                            {meta.label}
                          </Label>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{a.type}</Typography>
                        </TableCell>
                        <TableCell>
                          {a.caseId ? (
                            <Link
                              to={`${SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', a.caseId)}`}
                              style={{ textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Stack direction="row" alignItems="center" spacing={0.5}>
                                <Typography
                                  variant="body2"
                                  sx={{ color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                >
                                  {a.caseId}
                                </Typography>
                                <Iconify icon="solar:arrow-right-up-linear" width={14} />
                              </Stack>
                            </Link>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {typeof a.amount === 'number' ? formatMoney(a.amount) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(a.createdAt).toLocaleString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                        <Typography variant="body2" color="text.secondary">
                          No actions match the current filters.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      {/* Detail Drawer */}
      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 560 }, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {selected && (
            <>
              {/* Header */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="h6" noWrap sx={{ flex: 1, fontWeight: 700 }}>
                  {selected.id}
                </Typography>
                <Label
                  color={(statusMeta[selected.status] || statusMeta.pending).color}
                  startIcon={<Iconify icon={(statusMeta[selected.status] || statusMeta.pending).icon} width={14} />}
                >
                  {(statusMeta[selected.status] || statusMeta.pending).label}
                </Label>
                <IconButton size="small" onClick={() => setSelected(null)}>
                  <Iconify icon="solar:close-circle-bold" width={20} />
                </IconButton>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selected.description}
              </Typography>

              <Divider sx={{ my: 3 }} />

              {/* Content */}
              <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
                <Stack spacing={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Execution Summary
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Audit-ready metadata for this action.
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            Type
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {selected.type}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            Created
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {new Date(selected.createdAt).toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            Amount
                          </Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {typeof selected.amount === 'number' ? formatMoney(selected.amount) : '—'}
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary">
                            Simulation
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {selected.simulation ? 'Pre-execution simulation applied' : '—'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {linkedCase && (
                    <Card variant="outlined" sx={{ bgcolor: 'primary.lighter', borderColor: 'primary.main' }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Linked Case
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          The anomaly case that triggered this action.
                        </Typography>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {linkedCase.caseNumber}
                              </Typography>
                              <SeverityBadge severity={linkedCase.severity} size="sm" />
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {linkedCase.title}
                            </Typography>
                          </Box>
                          <Button
                            component={Link}
                            to={`${SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', linkedCase.id.toString())}`}
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                          >
                            Open
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}

                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Before / After
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Mocked delta highlights for demonstration (to be wired to real SAP diffs).
                      </Typography>
                      <Box sx={{ p: 2, bgcolor: 'action.selected', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                          Fields updated
                        </Typography>
                        <Grid container spacing={1.5}>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                                Payment Block
                              </Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.5 }}>
                                None → A (Locked)
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem' }}>
                                Workflow
                              </Typography>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.5 }}>
                                — → Approval Requested
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Chip
                          icon={<Iconify icon="solar:alt-arrow-down-bold" width={14} />}
                          label="Evidence attached"
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<Iconify icon="solar:alt-arrow-down-bold" width={14} />}
                          label="Guardrail checks"
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Stack>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Footer Actions */}
              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
                  sx={{ bgcolor: 'transparent' }}
                >
                  Download Audit Package
                </Button>
                <Button
                  variant="contained"
                  endIcon={<Iconify icon="solar:arrow-right-up-linear" width={18} />}
                >
                  Send to Reconciliation
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};
