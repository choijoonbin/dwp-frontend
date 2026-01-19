import React, { useMemo } from 'react';
import { Chart, useChart } from '@dwp-frontend/design-system';
import {
  useMonitoringTimeseriesQuery,
  type TimeseriesResponse,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

// ----------------------------------------------------------------------

type MonitoringChartsProps = {
  type: 'pv-uv' | 'api' | 'event';
  from: string; // ISO 8601 date string
  to: string; // ISO 8601 date string
};

/**
 * Convert timeseries data to ApexCharts series format
 */
const convertTimeseriesToSeries = (
  data: TimeseriesResponse | undefined,
  label: string
): { name: string; data: number[] } | null => {
  if (!data || !data.dataPoints || data.dataPoints.length === 0) {
    return null;
  }

  return {
    name: label,
    data: data.dataPoints.map((point) => point.value),
  };
};

/**
 * Get x-axis categories from timeseries data
 */
const getXAxisCategories = (data: TimeseriesResponse | undefined): string[] => {
  if (!data || !data.dataPoints || data.dataPoints.length === 0) {
    return [];
  }

  return data.dataPoints.map((point) => {
    const date = new Date(point.timestamp);
    if (data.interval === 'HOUR') {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
  });
};

export const MonitoringCharts = ({ type, from, to }: MonitoringChartsProps) => {
  const [interval, setInterval] = React.useState<'HOUR' | 'DAY'>('DAY');

  const handleIntervalChange = (_event: React.MouseEvent<HTMLElement>, newInterval: 'HOUR' | 'DAY' | null) => {
    if (newInterval !== null) {
      setInterval(newInterval);
    }
  };

  // PV/UV Chart
  const pvQuery = useMonitoringTimeseriesQuery(
    type === 'pv-uv'
      ? {
          from,
          to,
          interval,
          metric: 'PV',
        }
      : { from: '', to: '', interval: 'DAY', metric: 'PV' }
  );

  const uvQuery = useMonitoringTimeseriesQuery(
    type === 'pv-uv'
      ? {
          from,
          to,
          interval,
          metric: 'UV',
        }
      : { from: '', to: '', interval: 'DAY', metric: 'UV' }
  );

  // API Total/Error Chart
  const apiTotalQuery = useMonitoringTimeseriesQuery(
    type === 'api'
      ? {
          from,
          to,
          interval,
          metric: 'API_TOTAL',
        }
      : { from: '', to: '', interval: 'DAY', metric: 'API_TOTAL' }
  );

  const apiErrorQuery = useMonitoringTimeseriesQuery(
    type === 'api'
      ? {
          from,
          to,
          interval,
          metric: 'API_ERROR',
        }
      : { from: '', to: '', interval: 'DAY', metric: 'API_ERROR' }
  );

  // Event Chart
  const eventQuery = useMonitoringTimeseriesQuery(
    type === 'event'
      ? {
          from,
          to,
          interval,
          metric: 'EVENT',
        }
      : { from: '', to: '', interval: 'DAY', metric: 'EVENT' }
  );

  const chartData = useMemo(() => {
    if (type === 'pv-uv') {
      const pvSeries = convertTimeseriesToSeries(pvQuery.data, 'PV');
      const uvSeries = convertTimeseriesToSeries(uvQuery.data, 'UV');
      const categories = getXAxisCategories(pvQuery.data || uvQuery.data);

      return {
        title: '시간대별 PV/UV',
        series: [pvSeries, uvSeries].filter((s): s is { name: string; data: number[] } => s !== null),
        categories,
        isLoading: pvQuery.isLoading || uvQuery.isLoading,
        error: pvQuery.error || uvQuery.error,
      };
    }

    if (type === 'api') {
      const totalSeries = convertTimeseriesToSeries(apiTotalQuery.data, 'Total');
      const errorSeries = convertTimeseriesToSeries(apiErrorQuery.data, 'Error');
      const categories = getXAxisCategories(apiTotalQuery.data || apiErrorQuery.data);

      return {
        title: '시간대별 API Total / API Error',
        series: [totalSeries, errorSeries].filter((s): s is { name: string; data: number[] } => s !== null),
        categories,
        isLoading: apiTotalQuery.isLoading || apiErrorQuery.isLoading,
        error: apiTotalQuery.error || apiErrorQuery.error,
      };
    }

    if (type === 'event') {
      const eventSeries = convertTimeseriesToSeries(eventQuery.data, 'Events');
      const categories = getXAxisCategories(eventQuery.data);

      return {
        title: '시간대별 Events',
        series: eventSeries ? [eventSeries] : [],
        categories,
        isLoading: eventQuery.isLoading,
        error: eventQuery.error,
      };
    }

    return {
      title: '',
      series: [],
      categories: [],
      isLoading: false,
      error: null,
    };
  }, [type, pvQuery, uvQuery, apiTotalQuery, apiErrorQuery, eventQuery]);

  const chartOptions = useChart({
    chart: {
      type: 'line',
    },
    xaxis: {
      categories: chartData.categories,
    },
    stroke: {
      curve: 'smooth',
    },
    legend: {
      show: true,
      position: 'top',
    },
  });

  if (chartData.error) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{chartData.title}</Typography>
        <Alert severity="error">
          차트 데이터를 불러오는 중 오류가 발생했습니다:{' '}
          {chartData.error instanceof Error ? chartData.error.message : 'Unknown error'}
        </Alert>
      </Stack>
    );
  }

  if (chartData.isLoading) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{chartData.title}</Typography>
        <Skeleton variant="rectangular" height={300} />
      </Stack>
    );
  }

  if (chartData.series.length === 0 || chartData.categories.length === 0) {
    return (
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{chartData.title}</Typography>
          <ToggleButtonGroup value={interval} exclusive onChange={handleIntervalChange} size="small">
            <ToggleButton value="DAY">일별</ToggleButton>
            <ToggleButton value="HOUR">시간별</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            집계 데이터가 없습니다.
          </Typography>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{chartData.title}</Typography>
        <ToggleButtonGroup value={interval} exclusive onChange={handleIntervalChange} size="small">
          <ToggleButton value="DAY">일별</ToggleButton>
          <ToggleButton value="HOUR">시간별</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Chart type="line" series={chartData.series} options={chartOptions} sx={{ height: 300 }} />
    </Stack>
  );
};
