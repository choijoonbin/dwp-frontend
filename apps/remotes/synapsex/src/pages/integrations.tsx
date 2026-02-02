import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
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
import LinearProgress from '@mui/material/LinearProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';

import { SeverityBadge } from '../components/finance/severity-badge';

// ----------------------------------------------------------------------

type Channel = {
  id: string;
  name: string;
  type: 's3' | 'jco' | 'idoc' | 'api' | 'milvus' | 'postgres';
  status: 'healthy' | 'degraded' | 'down';
  lastHeartbeat: string;
  lagSeconds: number;
  throughputPerMin: number;
};

type IngestionIssue = {
  id: string;
  channelId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  details: string;
  at: string;
};

const channels: Channel[] = [
  {
    id: 'sap-s3',
    name: 'SAP Extract via S3',
    type: 's3',
    status: 'healthy',
    lastHeartbeat: new Date(Date.now() - 2 * 60_000).toISOString(),
    lagSeconds: 120,
    throughputPerMin: 2400,
  },
  {
    id: 'sap-jco',
    name: 'SAP RFC (JCo)',
    type: 'jco',
    status: 'degraded',
    lastHeartbeat: new Date(Date.now() - 8 * 60_000).toISOString(),
    lagSeconds: 520,
    throughputPerMin: 380,
  },
  {
    id: 'sap-idoc',
    name: 'IDoc Listener',
    type: 'idoc',
    status: 'healthy',
    lastHeartbeat: new Date(Date.now() - 3 * 60_000).toISOString(),
    lagSeconds: 210,
    throughputPerMin: 1100,
  },
  {
    id: 'milvus',
    name: 'Milvus Vector Store',
    type: 'milvus',
    status: 'healthy',
    lastHeartbeat: new Date(Date.now() - 1 * 60_000).toISOString(),
    lagSeconds: 0,
    throughputPerMin: 0,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL (Self-healing schema)',
    type: 'postgres',
    status: 'healthy',
    lastHeartbeat: new Date(Date.now() - 1 * 60_000).toISOString(),
    lagSeconds: 0,
    throughputPerMin: 0,
  },
];

const issues: IngestionIssue[] = [
  {
    id: 'iss_001',
    channelId: 'sap-jco',
    severity: 'high',
    title: 'RFC latency spike',
    details: 'Avg response time exceeded 2s (p95). Consider failover to S3 batch for non-urgent loads.',
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: 'iss_002',
    channelId: 'sap-jco',
    severity: 'medium',
    title: 'Transient auth errors',
    details: '3 retries succeeded after token refresh. Validate rotation schedule.',
    at: new Date(Date.now() - 42 * 60_000).toISOString(),
  },
  {
    id: 'iss_003',
    channelId: 'sap-idoc',
    severity: 'low',
    title: 'Out-of-order message',
    details: 'Received IDoc sequence gap; ingestion reconciled via dedupe keys.',
    at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  },
];

function statusMeta(status: Channel['status']) {
  if (status === 'healthy')
    return {
      label: 'Healthy',
      icon: 'solar:check-circle-bold',
      color: 'success' as const,
    };
  if (status === 'degraded')
    return {
      label: 'Degraded',
      icon: 'solar:danger-triangle-bold',
      color: 'warning' as const,
    };
  return {
    label: 'Down',
    icon: 'solar:danger-triangle-bold',
    color: 'error' as const,
  };
}

function iconByType(type: Channel['type']) {
  switch (type) {
    case 's3':
      return 'solar:cloud-bold';
    case 'jco':
      return 'solar:cable-bold';
    case 'idoc':
      return 'solar:plug-circle-bold';
    case 'api':
      return 'solar:activity-bold';
    case 'milvus':
      return 'solar:database-bold';
    case 'postgres':
      return 'solar:database-bold';
    default:
      return 'solar:database-bold';
  }
}

// ----------------------------------------------------------------------

export const IntegrationsPage = () => {
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState<string>('all');

  const filtered = useMemo(() => {
    let rows = issues;
    if (channel !== 'all') rows = rows.filter((i) => i.channelId === channel);
    if (q.trim()) {
      const qq = q.toLowerCase();
      rows = rows.filter((i) => i.title.toLowerCase().includes(qq) || i.details.toLowerCase().includes(qq));
    }
    return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [q, channel]);

  const channelStats = useMemo(() => {
    const totals = {
      healthy: channels.filter((c) => c.status === 'healthy').length,
      degraded: channels.filter((c) => c.status === 'degraded').length,
      down: channels.filter((c) => c.status === 'down').length,
    };
    return {
      ...totals,
      total: channels.length,
      healthPct: Math.round((totals.healthy / channels.length) * 100),
    };
  }, []);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
            Integrations & Data Ops
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Monitor ingestion channels (S3/JCo/IDoc/API) and data pipeline health for audit-grade operations.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />}>
            Reprocess Queue
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:plug-circle-bold" />}>
            Add Integration
          </Button>
        </Stack>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader
            title="Channel health"
            subheader="Aggregated from heartbeats"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
              {channelStats.healthPct}%
            </Typography>
            <LinearProgress variant="determinate" value={channelStats.healthPct} sx={{ mb: 1.5, height: 8, borderRadius: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
              <span>{channelStats.healthy} healthy</span>
              <span>{channelStats.degraded} degraded</span>
              <span>{channelStats.down} down</span>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Throughput"
            subheader="Records per minute"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
              {channels.reduce((s, c) => s + c.throughputPerMin, 0).toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Includes batch + realtime channels
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Max lag"
            subheader="Worst channel delay"
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
              {Math.max(...channels.map((c) => c.lagSeconds))}s
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Auto-escalate if lag exceeds policy thresholds
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Integration Channels */}
      <Card>
        <CardHeader
          title="Integration Channels"
          subheader="Realtime heartbeat, lag and readiness indicators."
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          subheaderTypographyProps={{ variant: 'body2' }}
        />
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            {channels.map((c) => {
              const meta = statusMeta(c.status);
              return (
                <Box
                  key={c.id}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1,
                          border: 1,
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Iconify icon={iconByType(c.type)} width={18} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                          {c.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Last heartbeat: {new Date(c.lastHeartbeat).toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={meta.label}
                      icon={<Iconify icon={meta.icon} width={14} />}
                      color={meta.color}
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Lag
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {c.lagSeconds}s
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Throughput
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {c.throughputPerMin.toLocaleString()}/min
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        Type
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, textTransform: 'uppercase' }}>
                        {c.type}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Ingestion Issues */}
      <Card>
        <CardHeader
          title="Ingestion Issues"
          subheader="Operational incidents that impact traceability and reconciliation."
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          subheaderTypographyProps={{ variant: 'body2' }}
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
            <TextField
              size="small"
              placeholder="Search issues…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ flex: 1, maxWidth: { md: 260 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="solar:magnifer-linear" width={16} sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <MenuItem value="all">All channels</MenuItem>
                {channels.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<Iconify icon="solar:filter-bold" />}>
              Advanced filters
            </Button>
          </Box>

          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Channel</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Issue</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.slice(0, 200).map((i) => {
                  const c = channels.find((x) => x.id === i.channelId);
                  return (
                    <TableRow key={i.id} hover>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {new Date(i.at).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>{c?.name ?? i.channelId}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={i.severity} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {i.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {i.details}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />}>
                          Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
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

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Showing {Math.min(200, filtered.length)} of {filtered.length.toLocaleString()} issues
            </Typography>
            <Chip
              label="ingestion-observable"
              icon={<Iconify icon="solar:database-bold" width={14} />}
              variant="outlined"
              size="small"
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
