import { useTranslation } from 'react-i18next';
import { AlertTriangle, BellRing, Clock3, ShieldCheck } from 'lucide-react';
import { formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { NotificationAdminMetric } from '@dwp-frontend/shared-utils/api/notification-api';

function metricColor(
  metric: NotificationAdminMetric
): 'text.secondary' | 'success.main' | 'warning.main' | 'error.main' {
  if (metric.state === 'CRITICAL') return 'error.main';
  if (metric.state === 'ATTENTION') return 'warning.main';
  if (metric.state === 'HEALTHY') return 'success.main';
  return 'text.secondary';
}

function metricIcon(metric: NotificationAdminMetric) {
  if (metric.key === 'active-contracts') return <ShieldCheck size={18} aria-hidden />;
  if (metric.key === 'notifications-24h') return <BellRing size={18} aria-hidden />;
  if (metric.key === 'queued-deliveries') return <Clock3 size={18} aria-hidden />;
  return <AlertTriangle size={18} aria-hidden />;
}

export function NotificationAdminMetricGrid({
  metrics,
  labels,
  ariaLabel,
}: {
  metrics: NotificationAdminMetric[];
  labels: Record<string, string>;
  ariaLabel: string;
}) {
  const { t } = useTranslation('notifications');
  const units: Record<string, string> = {
    'active-contracts': t('admin.overview.units.contracts'),
    'notifications-24h': t('admin.overview.units.notifications'),
    'queued-deliveries': t('admin.overview.units.jobs'),
    'failed-deliveries': t('admin.overview.units.jobs'),
  };
  return (
    <Box
      component="section"
      aria-label={ariaLabel}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        borderBlock: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {metrics.map((metric) => {
        const color = metricColor(metric);
        return (
          <Box
            component="article"
            key={metric.key}
            sx={{
              position: 'relative',
              minWidth: 0,
              minHeight: 104,
              p: 1.5,
              overflow: 'hidden',
              borderRight: 1,
              borderColor: 'divider',
              '&:last-child': { borderRight: 0 },
              '&:nth-of-type(2n)': { borderRight: { xs: 0, md: 1 } },
              '&:nth-of-type(n+3)': { borderTop: { xs: 1, md: 0 }, borderColor: 'divider' },
              '&::before': {
                position: 'absolute',
                inset: '0 auto 0 0',
                width: 3,
                bgcolor: color,
                content: '""',
              },
              '@media (forced-colors: active)': {
                borderColor: 'CanvasText',
                '&::before': { bgcolor: 'CanvasText' },
              },
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 24,
                height: 24,
                display: 'grid',
                placeItems: 'center',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                color,
                bgcolor: 'action.hover',
                '@media (forced-colors: active)': { bgcolor: 'Canvas', color: 'CanvasText' },
              }}
            >
              {metricIcon(metric)}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ pr: 4.5, fontWeight: 'fontWeightMedium' }}
            >
              {labels[metric.key] ?? metric.label}
            </Typography>
            <Typography
              component="p"
              variant="h4"
              sx={{
                mt: 0.5,
                color,
                fontVariantNumeric: 'tabular-nums',
                overflowWrap: 'anywhere',
              }}
            >
              {metric.state === 'UNKNOWN' ? '-' : formatNumber(metric.value)}
              <Box
                component="span"
                sx={{ ml: 0.5, color: 'text.secondary', typography: 'caption' }}
              >
                {units[metric.key] ?? metric.unit ?? ''}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color, display: 'block', mt: 0.25 }}>
              {metric.state === 'UNKNOWN'
                ? t('preferences.status.runtime.UNKNOWN')
                : metric.state === 'CRITICAL'
                  ? t('admin.severity.CRITICAL')
                  : t(`admin.contractHealth.${metric.state}`)}
            </Typography>
            {metric.baseline != null && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {t('admin.overview.baseline', { value: formatNumber(metric.baseline) })}
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
