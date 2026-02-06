import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

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


function getStatusMeta(
  status: Channel['status'],
  t: (key: string) => string
): { label: string; icon: string; color: 'success' | 'warning' | 'error' } {
  if (status === 'healthy')
    return {
      label: t('integrations.healthy'),
      icon: 'solar:check-circle-bold',
      color: 'success',
    };
  if (status === 'degraded')
    return {
      label: t('integrations.degraded'),
      icon: 'solar:danger-triangle-bold',
      color: 'warning',
    };
  return {
    label: t('integrations.down'),
    icon: 'solar:danger-triangle-bold',
    color: 'error',
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
  const { t } = useTranslation('common');
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
            {t('integrations.title')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('integrations.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />}>
            {t('integrations.reprocessQueue')}
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:plug-circle-bold" />}>
            {t('integrations.addIntegration')}
          </Button>
        </Stack>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        <Card>
          <CardHeader
            title={t('integrations.channelHealth')}
            subheader={t('integrations.aggregatedFromHeartbeats')}
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
              {channelStats.healthPct}%
            </Typography>
            <LinearProgress variant="determinate" value={channelStats.healthPct} sx={{ mb: 1.5, height: 8, borderRadius: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
              <span>{channelStats.healthy} {t('integrations.healthy')}</span>
              <span>{channelStats.degraded} {t('integrations.degraded')}</span>
              <span>{channelStats.down} {t('integrations.down')}</span>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={t('integrations.throughput')}
            subheader={t('integrations.recordsPerMin')}
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
              {channels.reduce((s, c) => s + c.throughputPerMin, 0).toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('integrations.includesBatchRealtime')}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={t('integrations.maxLag')}
            subheader={t('integrations.worstChannelDelay')}
            titleTypographyProps={{ variant: 'subtitle2', fontWeight: 500 }}
            subheaderTypographyProps={{ variant: 'caption' }}
          />
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
              {Math.max(...channels.map((c) => c.lagSeconds))}s
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('integrations.autoEscalateHint')}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Integration Channels */}
      <Card>
        <CardHeader
          title={t('integrations.integrationChannels')}
          subheader={t('integrations.integrationChannelsDesc')}
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          subheaderTypographyProps={{ variant: 'body2' }}
        />
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
            {channels.map((c) => {
              const meta = getStatusMeta(c.status, t);
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
                          {t('integrations.lastHeartbeat')}: {new Date(c.lastHeartbeat).toLocaleString()}
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
                        {t('integrations.lag')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {c.lagSeconds}s
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {t('integrations.throughput')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {c.throughputPerMin.toLocaleString()}/min
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {t('integrations.type')}
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
          title={t('integrations.ingestionIssues')}
          subheader={t('integrations.ingestionIssuesDesc')}
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          subheaderTypographyProps={{ variant: 'body2' }}
        />
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
            <TextField
              size="small"
              placeholder={t('integrations.searchPlaceholder')}
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
                <MenuItem value="all">{t('integrations.allChannels')}</MenuItem>
                {channels.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={<Iconify icon="solar:filter-bold" />}>
              {t('integrations.advancedFilters')}
            </Button>
          </Box>

          <TableContainer sx={{ borderRadius: 1, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('integrations.time')}</TableCell>
                  <TableCell>{t('integrations.channel')}</TableCell>
                  <TableCell>{t('integrations.severity')}</TableCell>
                  <TableCell>{t('integrations.issue')}</TableCell>
                  <TableCell align="right">{t('integrations.actions')}</TableCell>
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
                          {t('integrations.retry')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('integrations.noIssuesMatch')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('integrations.showingCount', { shown: Math.min(200, filtered.length), total: filtered.length.toLocaleString() })}
            </Typography>
            <Chip
              label={t('integrations.ingestionObservable')}
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
