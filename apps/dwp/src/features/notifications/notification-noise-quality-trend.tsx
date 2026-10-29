import { useTranslation } from 'react-i18next';

import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  NotificationNoiseTimeRange,
  NotificationNoiseTrendPoint,
} from './notification-noise-quality-model';

const TREND_MARKER_RADIUS = `${foundationTokens.radius.control / 2}px`;

function highMutePattern(color: string) {
  return `repeating-linear-gradient(135deg, transparent 0 3px, ${alpha(color, 0.35)} 3px 5px)`;
}

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
  const totalVolume = points.reduce((sum, point) => sum + point.volume, 0);
  const highMuteCount = points.filter(
    (point) => point.muteRate != null && point.muteRate >= 0.25
  ).length;
  const pointLabel = (point: NotificationNoiseTrendPoint) =>
    `${formatDate(
      point.bucketStart,
      {
        dateStyle: 'medium',
        ...(range === 'LAST_24_HOURS' ? { timeStyle: 'short' as const } : {}),
      },
      supportedLocale
    )} · ${t('noiseQuality.types.sent')} ${formatNumber(point.volume, {}, supportedLocale)} · ${t(
      'noiseQuality.types.muted'
    )} ${trendRate(point.muteRate, supportedLocale)} · ${t(
      'noiseQuality.types.deduplicated'
    )} ${trendRate(point.deduplicationRate, supportedLocale)} · ${t(
      'noiseQuality.types.actionConversion'
    )} ${trendRate(point.actionConversionRate, supportedLocale)}`;
  return (
    <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Typography component="h3" variant="subtitle2">
        {t('admin.overview.trendTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
        {t('noiseQuality.trend.summary', {
          total: formatNumber(totalVolume, {}, supportedLocale),
          risky: highMuteCount,
        })}
      </Typography>
      <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
        <Stack direction="row" gap={0.5} alignItems="center">
          <Box
            aria-hidden="true"
            sx={{
              width: 14,
              height: 8,
              borderRadius: TREND_MARKER_RADIUS,
              bgcolor: 'primary.main',
            }}
          />
          <Typography variant="caption">{t('noiseQuality.trend.normalLegend')}</Typography>
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center">
          <Box
            aria-hidden="true"
            sx={{
              width: 14,
              height: 8,
              borderRadius: TREND_MARKER_RADIUS,
              bgcolor: 'warning.main',
              backgroundImage: (theme) => highMutePattern(theme.palette.common.black),
            }}
          />
          <Typography variant="caption">{t('noiseQuality.trend.highMuteLegend')}</Typography>
        </Stack>
      </Stack>
      <Box
        role="group"
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
          <Tooltip key={point.bucketStart} title={pointLabel(point)}>
            <Box
              role="img"
              tabIndex={0}
              aria-label={pointLabel(point)}
              data-mute-risk={point.muteRate != null && point.muteRate >= 0.25 ? 'high' : 'normal'}
              sx={{
                flex: '1 0 16px',
                minWidth: 16,
                textAlign: 'center',
                borderRadius: foundationTokens.radius.compact,
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  height: Math.max(6, Math.round((point.volume / maximum) * 54)),
                  bgcolor:
                    point.muteRate != null && point.muteRate >= 0.25
                      ? 'warning.main'
                      : 'primary.main',
                  backgroundImage:
                    point.muteRate != null && point.muteRate >= 0.25
                      ? (theme) => highMutePattern(theme.palette.common.black)
                      : 'none',
                  borderRadius: foundationTokens.radius.compact,
                }}
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Box
        component="details"
        sx={{
          mt: 1,
          borderTop: 1,
          borderColor: 'divider',
          '& > summary': { cursor: 'pointer', py: 1, color: 'text.secondary' },
        }}
      >
        <Typography component="summary" variant="caption" fontWeight="fontWeightBold">
          {t('noiseQuality.trend.exactData')}
        </Typography>
        <Box
          role="region"
          tabIndex={0}
          aria-label={t('noiseQuality.trend.tableScrollLabel')}
          sx={{ overflowX: 'auto' }}
        >
          <Table
            size="small"
            aria-label={t('noiseQuality.trend.tableLabel')}
            sx={{ minWidth: 620 }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.overview.columns.time')}</TableCell>
                <TableCell align="right">{t('noiseQuality.types.sent')}</TableCell>
                <TableCell align="right">{t('noiseQuality.types.muted')}</TableCell>
                <TableCell align="right">{t('noiseQuality.types.deduplicated')}</TableCell>
                <TableCell align="right">{t('noiseQuality.types.actionConversion')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.bucketStart}>
                  <TableCell>
                    {formatDate(
                      point.bucketStart,
                      {
                        dateStyle: 'medium',
                        ...(range === 'LAST_24_HOURS' ? { timeStyle: 'short' as const } : {}),
                      },
                      supportedLocale
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {formatNumber(point.volume, {}, supportedLocale)}
                  </TableCell>
                  <TableCell align="right">{trendRate(point.muteRate, supportedLocale)}</TableCell>
                  <TableCell align="right">
                    {trendRate(point.deduplicationRate, supportedLocale)}
                  </TableCell>
                  <TableCell align="right">
                    {trendRate(point.actionConversionRate, supportedLocale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
