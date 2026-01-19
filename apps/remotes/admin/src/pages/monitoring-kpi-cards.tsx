import { Iconify } from '@dwp-frontend/design-system';
import { useMonitoringSummaryQuery } from '@dwp-frontend/shared-utils';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type KPICardProps = {
  title: string;
  value: string | number;
  icon: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  trend?: {
    value: number;
    label: string;
  };
  isLoading?: boolean;
};

const KPICard = ({ title, value, icon, color = 'primary', trend, isLoading }: KPICardProps) => (
  <Card sx={{ p: 3 }}>
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          {title}
        </Typography>
        <Iconify
          icon={icon}
          width={24}
          sx={{
            color: (theme) =>
              color === 'primary'
                ? theme.palette.primary.main
                : color === 'success'
                  ? theme.palette.success.main
                  : color === 'warning'
                    ? theme.palette.warning.main
                    : color === 'error'
                      ? theme.palette.error.main
                      : theme.palette.info.main,
          }}
        />
      </Stack>
      {isLoading ? (
        <Skeleton variant="text" width="60%" height={48} />
      ) : (
        <Typography variant="h3">{typeof value === 'number' ? value.toLocaleString() : value}</Typography>
      )}
      {trend && !isLoading && (
        <Typography variant="caption" sx={{ color: trend.value >= 0 ? 'success.main' : 'error.main' }}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}% {trend.label}
        </Typography>
      )}
    </Stack>
  </Card>
);

type MonitoringKPICardsProps = {
  dateFrom?: string;
  dateTo?: string;
};

/**
 * Convert period preset to date range
 */
const getDateRangeFromPeriod = (period: '1h' | '24h' | '7d' | '30d'): { from: string; to: string } => {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (period) {
    case '1h':
      from = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return {
    from: from.toISOString(),
    to,
  };
};

export const MonitoringKPICards = ({ dateFrom, dateTo }: MonitoringKPICardsProps) => {
  // Use period-based date range if explicit dates not provided
  const { from, to } = dateFrom && dateTo
    ? { from: new Date(dateFrom).toISOString(), to: new Date(dateTo).toISOString() }
    : getDateRangeFromPeriod('24h');

  const { data, isLoading, error } = useMonitoringSummaryQuery({
    from,
    to,
    // TODO: Add comparison period when BE supports it
    // compareFrom: ...,
    // compareTo: ...,
  });

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        모니터링 데이터를 불러오는 중 오류가 발생했습니다: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KPICard
          title="PV (페이지뷰)"
          value={data?.pv ?? 0}
          icon="solar:chart-bold"
          color="primary"
          trend={data?.pvTrend !== undefined ? { value: data.pvTrend, label: 'vs 전일' } : undefined}
          isLoading={isLoading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KPICard
          title="UV (고유방문자)"
          value={data?.uv ?? 0}
          icon="solar:users-group-rounded-bold"
          color="success"
          trend={data?.uvTrend !== undefined ? { value: data.uvTrend, label: 'vs 전일' } : undefined}
          isLoading={isLoading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KPICard
          title="Events"
          value={data?.events ?? 0}
          icon="solar:graph-up-bold"
          color="info"
          trend={data?.eventsTrend !== undefined ? { value: data.eventsTrend, label: 'vs 전일' } : undefined}
          isLoading={isLoading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <KPICard
          title="API Error Rate (%)"
          value={`${data?.apiErrorRate?.toFixed(1) ?? '0.0'}%`}
          icon="solar:danger-triangle-bold"
          color="error"
          trend={data?.apiErrorRateTrend !== undefined ? { value: data.apiErrorRateTrend, label: 'vs 전일' } : undefined}
          isLoading={isLoading}
        />
      </Grid>
    </Grid>
  );
};
