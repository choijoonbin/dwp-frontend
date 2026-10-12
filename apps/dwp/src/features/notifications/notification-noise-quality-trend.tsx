import { useTranslation } from 'react-i18next';

import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import type {
  NotificationNoiseTimeRange,
  NotificationNoiseTrendPoint,
} from './notification-noise-quality-model';

function trendRate(value: number | null, locale: 'en' | 'ko') {
  return value == null
    ? '-'
    : `${formatNumber(value * 100, { maximumFractionDigits: 1 }, locale)}%`;
}

export function NotificationNoiseQualityTrend({
  points,
  range,
  locale,
}: {
  points: readonly NotificationNoiseTrendPoint[];
  range: NotificationNoiseTimeRange;
  locale: string;
}) {
  const { t } = useTranslation('notifications');
  if (points.length === 0) return null;
  const maximum = Math.max(...points.map((point) => point.volume), 1);
  const supportedLocale = resolveSupportedLocale(locale);
  return (
    <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Typography component="h3" variant="subtitle2">
        {t('admin.overview.trendTitle')}
      </Typography>
      <Box
        role="img"
        aria-label={t('admin.overview.trendChartLabel')}
        sx={{
          mt: 1,
          display: 'flex',
          gap: 0.5,
          alignItems: 'flex-end',
          minHeight: 78,
          overflowX: 'auto',
        }}
      >
        {points.map((point) => (
          <Tooltip
            key={point.bucketStart}
            title={`${formatDate(
              point.bucketStart,
              {
                dateStyle: 'medium',
                ...(range === 'LAST_24_HOURS' ? { timeStyle: 'short' as const } : {}),
              },
              supportedLocale
            )} · ${t('noiseQuality.types.sent')} ${formatNumber(point.volume, {}, supportedLocale)} · ${t('noiseQuality.types.muted')} ${trendRate(point.muteRate, supportedLocale)} · ${t('noiseQuality.types.deduplicated')} ${trendRate(point.deduplicationRate, supportedLocale)} · ${t('noiseQuality.types.actionConversion')} ${trendRate(point.actionConversionRate, supportedLocale)}`}
          >
            <Box sx={{ flex: '1 0 16px', minWidth: 16, textAlign: 'center' }}>
              <Box
                sx={{
                  height: Math.max(6, Math.round((point.volume / maximum) * 54)),
                  bgcolor:
                    point.muteRate != null && point.muteRate >= 0.25
                      ? 'warning.main'
                      : 'primary.main',
                  borderRadius: foundationTokens.radius.compact,
                }}
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
