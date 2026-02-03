/**
 * Action Archive — Executed/failed actions timeline
 */

import type { SelectChangeEvent } from '@mui/material/Select';

import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { is403Error } from '@dwp-frontend/shared-utils';
import { Label, Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
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

import { SYNAPSE_ROUTES } from '../../routes';
import { ErrorStateWithRetry } from '../../components/ux';
import { useArchiveList } from './hooks/use-archive-list';

import type { ArchiveListItem } from './adapters/archive-list-adapter';

// ----------------------------------------------------------------------

const statusMeta: Record<string, { label: string; icon: string; color: 'success' | 'error' | 'warning' }> = {
  completed: { label: 'Completed', icon: 'solar:check-circle-bold', color: 'success' },
  executed: { label: 'Executed', icon: 'solar:check-circle-bold', color: 'success' },
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

export const ArchivePage = () => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [selected, setSelected] = useState<ArchiveListItem | null>(null);

  const {
    items,
    isLoading,
    error,
    refetch,
    completedCount,
    failedCount,
    pendingCount,
    linkedCases,
  } = useArchiveList();

  const rows = useMemo(() => {
    let list = items;
    if (status !== 'all') {
      const s = status === 'completed' ? ['executed', 'completed'] : [status];
      list = list.filter((a) => s.includes(a.status));
    }
    if (type !== 'all') list = list.filter((a) => a.type === type);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(
        (a) =>
          a.id.toLowerCase().includes(s) ||
          (a.caseId ?? '').toLowerCase().includes(s) ||
          (a.description ?? '').toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }, [items, q, status, type]);

  const uniqueTypes = Array.from(new Set(items.map((a) => a.actionType)));
  const linkedCase = selected?.caseId ? linkedCases.find((c) => c.id === selected.caseId) : undefined;

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? '권한 부족' : 'Failed to load archive'}
        message={error instanceof Error ? error.message : 'Unknown error'}
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
          </Stack>
        </Stack>

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

        <Card variant="outlined">
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Iconify icon="solar:filter-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Search & Filters
              </Typography>
            </Stack>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, lg: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search action id, case id, description…"
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

            {isLoading ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Loading archive...
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Linked Case</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Executed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((a) => {
                      const meta = statusMeta[a.status] ?? statusMeta.pending;
                      return (
                        <TableRow
                          key={a.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setSelected(a)}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {a.id}
                            </Typography>
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
                                to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', a.caseId)}
                                style={{ textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  <Typography
                                    variant="body2"
                                    sx={{ color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                  >
                                    {linkedCases.find((c) => c.id === a.caseId)?.caseNumber ?? a.caseId}
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
                              {a.executedAt
                                ? new Date(a.executedAt).toLocaleString()
                                : new Date(a.createdAt).toLocaleString()}
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
            )}
          </CardContent>
        </Card>
      </Stack>

      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 560 }, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {selected && (
            <>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="h6" noWrap sx={{ flex: 1, fontWeight: 700 }}>
                  {selected.id}
                </Typography>
                <Label
                  color={(statusMeta[selected.status] ?? statusMeta.pending).color}
                  startIcon={
                    <Iconify
                      icon={(statusMeta[selected.status] ?? statusMeta.pending).icon}
                      width={14}
                    />
                  }
                >
                  {(statusMeta[selected.status] ?? statusMeta.pending).label}
                </Label>
                <IconButton size="small" onClick={() => setSelected(null)}>
                  <Iconify icon="solar:close-circle-bold" width={20} />
                </IconButton>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selected.description}
              </Typography>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
                <Stack spacing={3}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: 2.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Execution Summary
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
                            Executed
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {selected.executedAt
                              ? new Date(selected.executedAt).toLocaleString()
                              : new Date(selected.createdAt).toLocaleString()}
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
                            Outcome
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {selected.outcome ?? selected.status}
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
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Box>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {linkedCase.caseNumber}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {linkedCase.title}
                            </Typography>
                          </Box>
                          <Button
                            component={Link}
                            to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', linkedCase.id)}
                            size="small"
                            endIcon={<Iconify icon="solar:arrow-right-up-linear" width={14} />}
                          >
                            Open
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}
                </Stack>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Stack direction="row" justifyContent="space-between" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Iconify icon="solar:download-minimalistic-bold" width={18} />}
                  sx={{ bgcolor: 'transparent' }}
                >
                  Download Audit Package
                </Button>
              </Stack>
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
};
