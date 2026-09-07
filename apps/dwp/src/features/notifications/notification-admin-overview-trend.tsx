import { useTranslation } from 'react-i18next';
import { type NotificationAdminTrendPoint } from '@dwp-frontend/shared-utils/api/notification-api';
import { EmptyState } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const OVERVIEW_TREND_SERIES = [
  { key: 'created', color: 'primary.main' },
  { key: 'actionable', color: 'warning.main' },
  { key: 'failed', color: 'error.main' },
  { key: 'muted', color: 'text.disabled' },
] as const;

export function NotificationAdminOverviewTrend({
  points,
}: {
  points: NotificationAdminTrendPoint[];
}) {
  const { t } = useTranslation('notifications');
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => OVERVIEW_TREND_SERIES.map(({ key }) => Number(point[key]) || 0))
  );

  if (points.length === 0) {
    return (
      <EmptyState
        title={t('admin.overview.emptyTrendTitle')}
        description={t('admin.overview.emptyTrendDescription')}
        size="compact"
      />
    );
  }

  return (
    <Box>
      <Stack
        direction="row"
        gap={{ xs: 1.25, sm: 2 }}
        flexWrap="wrap"
        aria-label={t('admin.overview.legendLabel')}
      >
        {OVERVIEW_TREND_SERIES.map(({ key, color }) => (
          <Stack key={key} direction="row" gap={0.65} alignItems="center">
            <Box
              aria-hidden="true"
              sx={{ width: 9, height: 9, borderRadius: 'shape.borderRadius', bgcolor: color }}
            />
            <Typography variant="caption" color="text.secondary">
              {t(`admin.overview.columns.${key}`)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        tabIndex={0}
        aria-label={t('admin.overview.trendChartScrollLabel')}
        sx={{ mt: 1.5, overflowX: 'auto', pb: 0.5 }}
      >
        <Box
          role="img"
          aria-label={t('admin.overview.trendChartLabel')}
          sx={{
            minWidth: Math.max(620, points.length * 82),
            height: 190,
            display: 'grid',
            gridTemplateColumns: `repeat(${points.length}, minmax(68px, 1fr))`,
            gap: 1.25,
            position: 'relative',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {[25, 50, 75].map((position) => (
            <Box
              key={position}
              aria-hidden="true"
              sx={{
                position: 'absolute',
                insetInline: 0,
                bottom: `${position}%`,
                borderTop: 1,
                borderColor: 'divider',
                opacity: 0.55,
              }}
            />
          ))}
          {points.map((point) => {
            const time = formatDate(point.bucket, { month: 'short', day: 'numeric' });
            return (
              <Stack
                key={point.bucket}
                role="group"
                aria-label={t('admin.overview.trendPointLabel', {
                  time,
                  created: formatNumber(point.created),
                  actionable: formatNumber(point.actionable),
                  failed: formatNumber(point.failed),
                  muted: formatNumber(point.muted),
                })}
                justifyContent="flex-end"
                alignItems="center"
                minWidth={0}
                zIndex={1}
              >
                <Stack
                  direction="row"
                  gap={0.5}
                  alignItems="flex-end"
                  justifyContent="center"
                  sx={{ height: 148, width: 1 }}
                >
                  {OVERVIEW_TREND_SERIES.map(({ key, color }) => {
                    const value = point[key];
                    return (
                      <Box
                        key={key}
                        aria-hidden="true"
                        title={`${t(`admin.overview.columns.${key}`)} ${formatNumber(value)}`}
                        sx={{
                          width: { xs: 7, sm: 9 },
                          maxWidth: '18%',
                          height: value === 0 ? 0 : `${Math.max(4, (value / maximum) * 100)}%`,
                          minHeight: value === 0 ? 0 : 3,
                          borderRadius: 'shape.borderRadius',
                          bgcolor: color,
                          transition: (theme) =>
                            theme.transitions.create('height', {
                              duration: theme.transitions.duration.shorter,
                            }),
                          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                        }}
                      />
                    );
                  })}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: 0.75 }}>
                  {time}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
