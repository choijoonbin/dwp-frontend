import { useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { ApiErrorAlert, useMonitoringSummaryQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type MonitoringCardProps = {
  title: string;
  value: string;
  icon: string;
  color: string;
  deltaPercent?: number;
  deltaValue?: number;
  isLoading?: boolean;
  sparkline?: number[];
};

const getSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return '';
  let path = `M${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
};

const getSparklinePaths = (values: number[]) => {
  const width = 100;
  const height = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 2;
    return { x, y };
  });

  const linePath = getSmoothPath(points);

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return { linePath, areaPath };
};

const Sparkline = ({ color, values }: { color: string; values: number[] }) => {
  const { linePath, areaPath } = getSparklinePaths(values);

  return (
    <Box
      component="svg"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: 48,
        opacity: 1,
        zIndex: 0,
      }}
    >
      <path d={areaPath} fill={alpha(color, 0.05)} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.3} />
    </Box>
  );
};

const DeltaBadge = ({
  deltaPercent,
  deltaValue,
}: {
  deltaPercent?: number;
  deltaValue?: number;
}) => {
  if (deltaPercent === undefined) return null;

  const isPositive = deltaPercent >= 0;
  const badgeColor = isPositive ? '#10b981' : '#ef4444';
  const arrow = isPositive ? '↑' : '↓';
  const statusText = isPositive ? '상승' : '하락';
  const percentText = `${Math.abs(deltaPercent).toFixed(2)}%`;
  const valueText = deltaValue !== undefined ? `${deltaValue >= 0 ? '+' : ''}${deltaValue.toLocaleString()}` : null;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.3,
        borderRadius: 9999,
        bgcolor: alpha(badgeColor, 0.12),
        color: badgeColor,
        border: `1px solid ${alpha(badgeColor, 0.3)}`,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <Box component="span">{arrow}</Box>
      <Box component="span">{statusText}</Box>
      {valueText && <Box component="span">{valueText}</Box>}
      <Box component="span">({percentText})</Box>
    </Box>
  );
};

const MonitoringCard = ({
  title,
  value,
  icon,
  color,
  deltaPercent,
  deltaValue,
  isLoading,
  sparkline = [18, 14, 16, 20, 18, 22, 19, 17, 18],
}: MonitoringCardProps) => (
  <Card
    sx={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 2,
      border: '1px solid',
      borderColor: '#f1f5f9',
      boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
      bgcolor: 'background.paper',
      minHeight: 180,
    }}
  >
    <Box sx={{ height: 4, bgcolor: color }} />
    <Box
      sx={{
        p: 2.5,
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon={icon} width={22} sx={{ color }} />
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            {title}
          </Typography>
        </Stack>
        {isLoading ? (
          <Skeleton variant="text" width={80} height={40} />
        ) : (
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              fontSize: { xs: 30, md: 34 },
              lineHeight: 1,
              fontFamily: '"Inter", "Pretendard", sans-serif',
            }}
          >
            {value}
          </Typography>
        )}
      </Stack>
      {!isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <DeltaBadge deltaPercent={deltaPercent} deltaValue={deltaValue} />
        </Box>
      )}
    </Box>
    <Sparkline color={color} values={sparkline} />
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

  const pvDeltaPercent = data?.pvDeltaPercent ?? data?.pvTrend;
  const uvDeltaPercent = data?.uvDeltaPercent ?? data?.uvTrend;
  const eventDeltaPercent = data?.eventDeltaPercent ?? data?.eventsTrend;
  const apiErrorDeltaPercent = data?.apiErrorDeltaPercent ?? data?.apiErrorRateTrend;

  const comparePeriod = data?.comparePeriod;
  const pvDeltaValue = data && comparePeriod?.pv !== undefined ? data.pv - comparePeriod.pv : undefined;
  const uvDeltaValue = data && comparePeriod?.uv !== undefined ? data.uv - comparePeriod.uv : undefined;
  const eventDeltaValue = data && comparePeriod?.events !== undefined ? data.events - comparePeriod.events : undefined;
  const apiErrorDeltaValue =
    data && comparePeriod?.apiErrorRate !== undefined ? data.apiErrorRate - comparePeriod.apiErrorRate : undefined;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="페이지뷰 PV"
          value={(data?.pv ?? 0).toLocaleString()}
          icon="lucide:eye"
          color="#3b82f6"
          deltaPercent={pvDeltaPercent}
          deltaValue={pvDeltaValue}
          isLoading={isLoading}
          sparkline={[14, 12, 16, 28, 22, 26, 20, 18, 21, 17, 19, 23]}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="고유 방문자 UV"
          value={(data?.uv ?? 0).toLocaleString()}
          icon="lucide:user"
          color="#10b981"
          deltaPercent={uvDeltaPercent}
          deltaValue={uvDeltaValue}
          isLoading={isLoading}
          sparkline={[10, 11, 13, 16, 14, 15, 12, 13, 11, 12, 14, 13]}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="이벤트 Events"
          value={(data?.events ?? 0).toLocaleString()}
          icon="lucide:zap"
          color="#8b5cf6"
          deltaPercent={eventDeltaPercent}
          deltaValue={eventDeltaValue}
          isLoading={isLoading}
          sparkline={[8, 10, 12, 11, 14, 13, 15, 12, 14, 13, 12, 16]}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="API 에러율 Error Rate"
          value={`${(data?.apiErrorRate ?? 0).toFixed(2)}%`}
          icon="lucide:alert-triangle"
          color="#ef4444"
          deltaPercent={apiErrorDeltaPercent}
          deltaValue={apiErrorDeltaValue}
          isLoading={isLoading}
          sparkline={[6, 8, 9, 7, 10, 12, 9, 8, 7, 9, 11, 13]}
        />
      </Grid>
    </Grid>
  );
};
