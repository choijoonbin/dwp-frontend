import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useMonitoringSummaryQuery, ApiErrorAlert } from '@dwp-frontend/shared-utils';

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
 * Get current time in Korea timezone (KST, UTC+9)
 * Returns Date object adjusted to KST
 */
const getKoreaTime = (): Date => {
  const now = new Date();
  // Get UTC time
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  // Add 9 hours for KST (UTC+9)
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  return kst;
};

/**
 * Format date to ISO 8601 string in KST timezone (YYYY-MM-DDTHH:mm:ss)
 */
const formatKSTToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

/**
 * Convert ISO 8601 datetime string (KST) to UTC ISO string
 * Backend expects UTC time, so we need to convert KST to UTC
 * 
 * Example: Input "2026-01-20T18:16:00" (KST) -> Output "2026-01-20T09:16:00" (UTC)
 */
const kstIsoToUtcIso = (kstIsoString: string): string => {
  if (!kstIsoString) return '';
  const [datePart, timePart] = kstIsoString.split('T');
  if (!datePart || !timePart) return '';
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);
  
  // Create a Date object treating the input as KST (UTC+9)
  // Convert KST to UTC by subtracting 9 hours
  const kstDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds || 0));
  const utcDate = new Date(kstDate.getTime() - 9 * 60 * 60 * 1000);
  
  // Format as ISO string (UTC)
  const utcYear = utcDate.getUTCFullYear();
  const utcMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(utcDate.getUTCDate()).padStart(2, '0');
  const utcHours = String(utcDate.getUTCHours()).padStart(2, '0');
  const utcMinutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const utcSeconds = String(utcDate.getUTCSeconds()).padStart(2, '0');
  
  return `${utcYear}-${utcMonth}-${utcDay}T${utcHours}:${utcMinutes}:${utcSeconds}`;
};

/**
 * Convert period preset to date range in KST timezone
 * Returns ISO 8601 format without milliseconds (YYYY-MM-DDTHH:mm:ss) in KST
 */
const getDateRangeFromPeriod = (period: '1h' | '24h' | '7d' | '30d'): { from: string; to: string } => {
  const nowKST = getKoreaTime();
  const to = formatKSTToISO(nowKST);
  let fromKST: Date;

  switch (period) {
    case '1h':
      fromKST = new Date(nowKST.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      fromKST = new Date(nowKST.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      fromKST = new Date(nowKST.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      fromKST = new Date(nowKST.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      fromKST = new Date(nowKST.getTime() - 24 * 60 * 60 * 1000);
  }

  return {
    from: formatKSTToISO(fromKST),
    to,
  };
};

export const MonitoringKPICards = ({ dateFrom, dateTo }: MonitoringKPICardsProps) => {
  // Use period-based date range if explicit dates not provided
  // Memoize to prevent infinite re-renders
  // dateFrom and dateTo are already in UTC ISO format (from monitoring.tsx)
  // If not provided, use 24h period and convert KST to UTC
  const { from, to } = useMemo(() => {
    if (dateFrom && dateTo) {
      // dateFrom and dateTo are already in UTC ISO format from monitoring.tsx
      return {
        from: dateFrom,
        to: dateTo,
      };
    }
    // If not provided, get 24h period in KST and convert to UTC
    const kstRange = getDateRangeFromPeriod('24h');
    return {
      from: kstIsoToUtcIso(kstRange.from),
      to: kstIsoToUtcIso(kstRange.to),
    };
  }, [dateFrom, dateTo]);

  const { data, isLoading, error, refetch } = useMonitoringSummaryQuery({
    from,
    to,
    // TODO: Add comparison period when BE supports it
    // compareFrom: ...,
    // compareTo: ...,
  });

  if (error) {
    return <ApiErrorAlert error={error} onRetry={() => refetch()} />;
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
