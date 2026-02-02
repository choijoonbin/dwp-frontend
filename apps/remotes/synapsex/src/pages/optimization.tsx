import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

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

import { SeverityBadge } from '../components/finance/severity-badge';
import { mockEntities, mockOpenItems, type OpenItem } from '../data/mock-data';

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

function recommendationFor(item: OpenItem): { label: string; action: 'remind' | 'review' | 'hold'; color: 'error' | 'warning' | 'info' | 'success' } {
  // Very lightweight mock heuristic for UI.
  if (item.daysPastDue > 60) return { label: 'Escalate & propose dunning', action: 'remind', color: 'error' };
  if (item.daysPastDue > 30) return { label: 'Send reminder + confirm promise date', action: 'remind', color: 'warning' };
  if (item.amount > 500000) return { label: 'High-value review + approval required', action: 'review', color: 'info' };
  return { label: 'Auto-follow-up eligible', action: 'remind', color: 'success' };
}

// ----------------------------------------------------------------------

export const OptimizationPage = () => {
  const [mode, setMode] = useState<Mode>('ar');
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState<string>('all');
  const [bucket, setBucket] = useState<string>('all');

  const rows = useMemo(() => {
    const filtered = mockOpenItems
      .filter((i) => (mode === 'ar' ? i.type === 'AR' : i.type === 'AP'))
      .filter((i) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return i.docNumber.toLowerCase().includes(q) || i.entityId.toLowerCase().includes(q) || i.entityName.toLowerCase().includes(q);
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
  }, [mode, search, risk, bucket]);

  const totals = useMemo(() => {
    const sum = rows.reduce((acc, r) => acc + r.amount, 0);
    const overdue = rows.filter((r) => r.daysPastDue > 0).reduce((acc, r) => acc + r.amount, 0);
    const highValue = rows.filter((r) => r.amount > 500000).length;
    return { sum, overdue, highValue };
  }, [rows]);

  const getEntityName = (id: string) => mockEntities.find((e) => e.id === id)?.name || id;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Iconify icon="solar:chart-2-bold" width={24} sx={{ color: 'primary.main' }} />
            AR/AP Optimization
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Prioritize open items, apply guardrails, and execute consistent follow-up at enterprise scale.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:magic-stick-bold" />}>
            Auto-recommend (mock)
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:plain-2-bold" />}>
            Send Bulk Reminders
          </Button>
        </Stack>
      </Box>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:dollar-bold" width={16} sx={{ color: 'text.secondary' }} />
                Total Exposure
              </Typography>
            }
            subheader="Current selection"
            titleTypographyProps={{ variant: 'subtitle2' }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {formatMoney(totals.sum, 'USD')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:clock-circle-bold" width={16} sx={{ color: 'text.secondary' }} />
                Overdue Amount
              </Typography>
            }
            subheader="Only overdue items"
            titleTypographyProps={{ variant: 'subtitle2' }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {formatMoney(totals.overdue, 'USD')}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardHeader
            title={
              <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Iconify icon="solar:shield-warning-bold" width={16} sx={{ color: 'text.secondary' }} />
                High-value Items
              </Typography>
            }
            subheader="> 500K requires approval"
            titleTypographyProps={{ variant: 'subtitle2' }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {totals.highValue.toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Controls */}
      <Card>
        <CardHeader
          title={
            <Typography variant="subtitle2" sx={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Iconify icon="solar:filter-bold" width={16} sx={{ color: 'text.secondary' }} />
              Worklist Filters
            </Typography>
          }
          titleTypographyProps={{ variant: 'subtitle2' }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: { lg: 'center' }, gap: 2 }}>
            <Tabs value={mode} onChange={(_, v) => setMode(v as Mode)}>
              <Tab label="AR (Receivables)" value="ar" />
              <Tab label="AP (Payables)" value="ap" />
            </Tabs>
            <TextField
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by document, entity, reference..."
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
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="0-30">0–30</MenuItem>
                  <MenuItem value="31-60">31–60</MenuItem>
                  <MenuItem value="60+">60+</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select value={risk} onChange={(e) => setRisk(e.target.value)}>
                  <MenuItem value="all">All risks</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
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
              Optimization Worklist
            </Typography>
          }
          subheader="Recommendations are mocked; production will be driven by the Agent + policy profiles."
          titleTypographyProps={{ variant: 'subtitle2' }}
          subheaderTypographyProps={{ variant: 'caption' }}
        />
        <CardContent sx={{ pt: 0 }}>
          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 140 }}>Open Item</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell sx={{ width: 140 }}>Amount</TableCell>
                  <TableCell sx={{ width: 120 }}>Overdue</TableCell>
                  <TableCell>Recommendation</TableCell>
                  <TableCell sx={{ width: 160 }}>Next</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(0, 200).map((item) => {
                  const rec = recommendationFor(item);
                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Link to={`/open-items?openItemId=${encodeURIComponent(item.id)}`} style={{ textDecoration: 'none' }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                            {item.docNumber}
                          </Typography>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {getEntityName(item.entityId)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                              {item.entityId}
                            </Typography>
                          </Box>
                          <Link to={`/entities/${encodeURIComponent(item.entityId)}`} style={{ color: 'inherit' }}>
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
                          <Chip label="Not due" variant="outlined" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={rec.label} color={rec.color} variant="outlined" size="small" />
                        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                          Ref: {item.docNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined">
                            {rec.action === 'hold' ? 'Set Block' : rec.action === 'review' ? 'Request Approval' : 'Send'}
                          </Button>
                          <Button size="small" variant="text">
                            Create case
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No items match the current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Showing {Math.min(200, rows.length)} of {rows.length.toLocaleString()} items
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label="Guardrails applied" icon={<Iconify icon="solar:shield-warning-bold" width={14} />} variant="outlined" size="small" />
              <Chip label="Agent suggestions" icon={<Iconify icon="solar:magic-stick-bold" width={14} />} variant="outlined" size="small" />
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
