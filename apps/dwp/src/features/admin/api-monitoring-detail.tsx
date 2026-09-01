import { useTranslation } from 'react-i18next';
import { Copy, FileSearch, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getApiHistoryTrace } from '@dwp-frontend/shared-utils';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import {
  apiMonitoringBytes,
  apiMonitoringDuration,
  apiMonitoringErrorMessage,
  apiMonitoringEventTimestamp,
  apiMonitoringOutcomeColor,
} from './api-monitoring-model';

function CopyValue({ value, label }: { value?: string | null; label: string }) {
  if (!value) return <Typography variant="body2">—</Typography>;

  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
      <Typography
        variant="body2"
        sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
      <Tooltip title={label}>
        <IconButton
          size="small"
          aria-label={label}
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          <Copy size={15} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

export function ApiMonitoringTraceDrawer({
  historyId,
  onClose,
}: {
  historyId: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const detailQuery = useQuery({
    queryKey: ['admin', 'api-history', 'detail', historyId],
    queryFn: () => getApiHistoryTrace(historyId!),
    enabled: Boolean(historyId),
  });
  const detail = detailQuery.data;

  return (
    <Drawer
      anchor="right"
      open={Boolean(historyId)}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: '100%', sm: 540 }, maxWidth: '100%' } },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ minHeight: 64, px: 2.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box>
          <Typography component="h2" variant="subtitle1">
            {t('apiMonitoring.detail.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('apiMonitoring.detail.subtitle')}
          </Typography>
        </Box>
        <Tooltip title={t('common.actions.close')}>
          <IconButton aria-label={t('common.actions.close')} onClick={onClose}>
            <X size={19} />
          </IconButton>
        </Tooltip>
      </Stack>
      {detailQuery.isLoading && (
        <ManagementPanelLoading label={t('apiMonitoring.detail.loading')} />
      )}
      {detailQuery.isError && (
        <ManagementPanelError
          message={apiMonitoringErrorMessage(
            detailQuery.error,
            t('apiMonitoring.detail.loadError')
          )}
        />
      )}
      {detail && (
        <Box sx={{ overflowY: 'auto' }}>
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                label={detail.selected.statusCode}
                size="small"
                color={apiMonitoringOutcomeColor(detail.selected.outcome)}
                variant="outlined"
              />
              <Chip label={detail.selected.httpMethod} size="small" variant="outlined" />
              <Chip label={detail.selected.observationPoint} size="small" variant="outlined" />
            </Stack>
            <Typography
              component="p"
              variant="subtitle1"
              sx={{ mt: 1.5, overflowWrap: 'anywhere' }}
            >
              {detail.selected.routeTemplate}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {apiMonitoringEventTimestamp(detail.selected.occurredAt)} /{' '}
              {apiMonitoringDuration(detail.selected.durationMs)}
            </Typography>
          </Box>
          <Divider />
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: '140px minmax(0, 1fr)',
              gap: 0,
              m: 0,
              px: 2.5,
              '& > dt, & > dd': { m: 0, py: 1.25, borderBottom: 1, borderColor: 'divider' },
            }}
          >
            {[
              [t('apiMonitoring.detail.fields.service'), detail.selected.serviceName],
              [t('apiMonitoring.detail.fields.instance'), detail.selected.serviceInstance ?? '—'],
              [
                t('apiMonitoring.detail.fields.actor'),
                detail.selected.actorId ?? detail.selected.actorType,
              ],
              [t('apiMonitoring.detail.fields.auth'), detail.selected.authType],
              [
                t('apiMonitoring.detail.fields.requestSize'),
                apiMonitoringBytes(detail.selected.requestSizeBytes),
              ],
              [
                t('apiMonitoring.detail.fields.responseSize'),
                apiMonitoringBytes(detail.selected.responseSizeBytes),
              ],
              [t('apiMonitoring.detail.fields.client'), detail.selected.userAgentFamily ?? '—'],
              [t('apiMonitoring.detail.fields.error'), detail.selected.errorType ?? '—'],
            ].map(([term, value]) => (
              <Box key={term} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {term}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {value}
                </Typography>
              </Box>
            ))}
            <Typography component="dt" variant="caption" color="text.secondary">
              {t('apiMonitoring.detail.fields.correlation')}
            </Typography>
            <Box component="dd">
              <CopyValue
                value={detail.selected.correlationId}
                label={t('apiMonitoring.detail.copyCorrelation')}
              />
            </Box>
            <Typography component="dt" variant="caption" color="text.secondary">
              {t('apiMonitoring.detail.fields.trace')}
            </Typography>
            <Box component="dd">
              <CopyValue
                value={detail.selected.traceId}
                label={t('apiMonitoring.detail.copyTrace')}
              />
            </Box>
          </Box>
          <Box sx={{ px: 2.5, py: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
              <Typography component="h3" variant="subtitle2">
                {t('apiMonitoring.detail.traceTitle')}
              </Typography>
              <Chip label={detail.trace.length} size="small" variant="outlined" />
            </Stack>
            <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5 }}>
              {detail.trace.map((hop, index) => (
                <Box
                  component="li"
                  key={hop.historyId}
                  sx={{
                    position: 'relative',
                    pl: 3.5,
                    pb: 2,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 8,
                      top: 10,
                      bottom: index === detail.trace.length - 1 ? 'auto' : -2,
                      width: 1,
                      height: index === detail.trace.length - 1 ? 0 : '100%',
                      bgcolor: 'divider',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: 4,
                      top: 6,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      bgcolor: hop.statusCode >= 500 ? 'error.main' : 'success.main',
                      boxShadow: (theme) => `0 0 0 4px ${theme.palette.background.paper}`,
                    },
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <Typography variant="subtitle2">{hop.serviceName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {apiMonitoringDuration(hop.durationMs)}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.25, overflowWrap: 'anywhere' }}
                  >
                    {hop.observationPoint} / {hop.httpMethod} / {hop.statusCode} /{' '}
                    {hop.routeTemplate}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          {detail.selected.correlationId && (
            <Box sx={{ px: 2.5, pb: 2.5 }}>
              <ActionButton
                fullWidth
                intent="secondary"
                startIcon={<FileSearch size={17} />}
                onClick={() => {
                  navigate(
                    `/admin/governance/audit-events?mode=events&query=${encodeURIComponent(detail.selected.correlationId!)}`
                  );
                  onClose();
                }}
              >
                {t('apiMonitoring.detail.openAuditEvidence')}
              </ActionButton>
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  );
}
