import { merge } from 'es-toolkit';
import React, { useMemo } from 'react';
import { Chart, useChart } from '@dwp-frontend/design-system';
import {
  type TimeseriesResponse,
  useMonitoringSummaryQuery,
  useMonitoringTimeseriesQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import {
  getChartLineColorForKpi,
  type MonitoringKpiCardKey,
} from './monitoring-kpi-cards';

// ----------------------------------------------------------------------

type MonitoringChartsProps = {
  type: 'pv-uv' | 'api' | 'event';
  from: string; // ISO 8601 date string
  to: string; // ISO 8601 date string
  /** KPI 카드 클릭 시 우측 차트 메트릭 고정 (Traffic / Latency / Error) */
  forcedRightMetric?: 'API_TOTAL' | 'API_5XX' | 'LATENCY_P95';
  /** 선택된 KPI 카드 → 선 색상을 해당 카드(테마)에 맞춤. Availability/Error 모두 Error 차트이면 카드별 다른 색 적용 */
  activeKpi?: MonitoringKpiCardKey | null;
  /** 가용성 도트 클릭 시 저장된 timestamp. Error 차트 X축 강조선·해제 연동 */
  activeTimestamp?: string | null;
  /** 차트 빈 공간 클릭 시 콜백 (강조 해제용) */
  onChartBackgroundClick?: () => void;
  /** 좌측 PV/UV 차트에서 포인트 클릭 시 해당 시간대로 API 히스토리 필터 (from, to ISO) */
  onPvUvRangeSelect?: (fromIso: string, toIso: string) => void;
};

const DEFAULT_AVAILABILITY_ERROR_RATE_THRESHOLD = 5; // availabilityErrorRateThreshold 없을 때 fallback (%)

/** 우측 차트 선 색상: KPI 미선택 시 메트릭별 기본 색상 (카드 색상과 동일 hex) */
function getApiChartSeriesColorFallback(
  effectiveRightMetric: 'LATENCY_P95' | 'API_TOTAL' | 'API_5XX'
): string {
  switch (effectiveRightMetric) {
    case 'LATENCY_P95':
      return '#10b981';
    case 'API_TOTAL':
      return '#8b5cf6';
    case 'API_5XX':
      return '#EF4444';
    default:
      return '#3b82f6';
  }
}

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
 * Backend returns labels in format: "YYYY-MM-DD" (DAY) or "YYYY-MM-DD HH:mm" (HOUR)
 */
const getXAxisCategories = (data: TimeseriesResponse | undefined): string[] => {
  if (!data || !data.dataPoints || data.dataPoints.length === 0) {
    return [];
  }

  return data.dataPoints.map((point) => {
    // Backend labels are already formatted strings, use them directly
    // For DAY interval: "2026-01-19" -> "01/19"
    // For HOUR interval: "2026-01-20 11:00" -> "11:00"
    const timestamp = point.timestamp;
    
    if (data.interval === 'HOUR') {
      // Extract time part from "YYYY-MM-DD HH:mm" format
      const timeMatch = timestamp.match(/\d{2}:\d{2}/);
      return timeMatch ? timeMatch[0] : timestamp;
    }
    
    // Extract date part from "YYYY-MM-DD" format -> "MM/DD"
    const dateMatch = timestamp.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      return `${dateMatch[2]}/${dateMatch[3]}`;
    }
    
    // Fallback: try to parse as Date
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    } catch {
      return timestamp;
    }
  });
};

/** 포인트 timestamp 문자열에 interval만큼 더한 ISO 반환 (API 필터용) */
const addIntervalToTimestamp = (
  timestampStr: string,
  interval: 'HOUR' | 'DAY'
): string => {
  try {
    const d = new Date(timestampStr);
    if (Number.isNaN(d.getTime())) return timestampStr;
    if (interval === 'HOUR') d.setHours(d.getHours() + 1);
    else d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 19);
  } catch {
    return timestampStr;
  }
};

/** "YYYY-MM-DD" 또는 "YYYY-MM-DD HH:mm" / "YYYY-MM-DDTHH:mm:ssZ" 등에서 YYYY-MM-DD 추출 */
const parseDateStr = (s: string): string | null => {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** statusHistory를 날짜별로 묶은 맵. 키: YYYY-MM-DD, 값: 해당 일자의 버킷 목록 */
const buildStatusHistoryByDate = (
  items: { timestamp: string; status: string }[]
): Map<string, { timestamp: string; status: string }[]> => {
  const map = new Map<string, { timestamp: string; status: string }[]>();
  for (const it of items) {
    const d = parseDateStr(it.timestamp);
    if (!d) continue;
    const list = map.get(d) ?? [];
    list.push(it);
    map.set(d, list);
  }
  return map;
};

/** status === 'DOWN'인 버킷의 [시작, 종료] epoch ms. 종료는 다음 버킷 시작 또는 이전 구간 길이로 추정 */
const computeDowntimeRanges = (
  items: { timestamp: string; status: string }[]
): { x: number; x2: number }[] => {
  const out: { x: number; x2: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.status !== 'DOWN') continue;
    const start = new Date(items[i]!.timestamp).getTime();
    if (Number.isNaN(start)) continue;
    let end: number;
    if (i + 1 < items.length) {
      end = new Date(items[i + 1]!.timestamp).getTime();
    } else if (i >= 1) {
      const prevStart = new Date(items[i - 1]!.timestamp).getTime();
      end = start + (start - prevStart);
    } else {
      end = start + 6 * 60 * 60 * 1000;
    }
    if (Number.isNaN(end) || end <= start) continue;
    out.push({ x: start, x2: end });
  }
  return out;
};

/** Timeseries → [timestamp(ms), value][] (datetime 축용) */
const convertTimeseriesToSeriesDatetime = (
  data: TimeseriesResponse | undefined,
  label: string
): { name: string; data: [number, number][] } | null => {
  if (!data?.dataPoints?.length) return null;
  const arr: [number, number][] = data.dataPoints.map((p) => {
    const s = p.timestamp.includes('T') ? p.timestamp : p.timestamp.replace(' ', 'T');
    const t = new Date(s).getTime();
    return [Number.isNaN(t) ? 0 : t, p.value];
  });
  return { name: label, data: arr };
};

export const MonitoringCharts = ({
  type,
  from,
  to,
  forcedRightMetric,
  activeKpi,
  activeTimestamp,
  onChartBackgroundClick,
  onPvUvRangeSelect,
}: MonitoringChartsProps) => {
  const theme = useTheme();
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

  // 우측 차트: Traffic | Latency | Error (KPI 순서). 기본 Traffic, KPI 클릭 시 forcedRightMetric
  type RightChartMetric = 'LATENCY_P95' | 'API_TOTAL' | 'API_5XX';
  const [rightChartMetric, setRightChartMetric] = React.useState<RightChartMetric>('LATENCY_P95');
  const effectiveRightMetric: RightChartMetric = forcedRightMetric ?? rightChartMetric;

  const rightChartQuery = useMonitoringTimeseriesQuery(
    type === 'api'
      ? { from, to, interval, metric: effectiveRightMetric }
      : { from: '', to: '', interval: 'DAY', metric: 'API_TOTAL' }
  );

  const summaryQuery = useMonitoringSummaryQuery(
    type === 'api' ? { from, to } : { from: '', to: '' }
  );
  const summaryData = summaryQuery.data;

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
        title: '시간대별 PV / UV',
        series: [pvSeries, uvSeries].filter((s): s is { name: string; data: number[] } => s !== null),
        categories,
        isLoading: pvQuery.isLoading || uvQuery.isLoading,
        error: pvQuery.error || uvQuery.error,
      };
    }

    if (type === 'api') {
      const titleByMetric = {
        API_TOTAL: '시간대별 API / Traffic',
        LATENCY_P95: '시간대별 API / Latency',
        API_5XX: '시간대별 API / Error',
      };
      const labelMap = {
        API_TOTAL: 'Traffic',
        API_5XX: 'Error',
        LATENCY_P95: 'Latency',
      };
      const data = rightChartQuery.data;
      const categories = getXAxisCategories(data);
      const rawThreshold = summaryData?.kpi?.availability?.availabilityErrorRateThreshold;
      const errorRateThreshold =
        typeof rawThreshold === 'number' && !Number.isNaN(rawThreshold)
          ? rawThreshold
          : DEFAULT_AVAILABILITY_ERROR_RATE_THRESHOLD;

      let downtimeIndices: number[] | undefined;
      let downtimeRanges: { x: number; x2: number }[] | undefined;
      let useDatetimeAxis = false;
      let singleSeries: { name: string; data: number[] } | { name: string; data: [number, number][] } | null =
        convertTimeseriesToSeries(data, labelMap[effectiveRightMetric]);

      if (effectiveRightMetric === 'API_5XX') {
        const statusHistory = summaryData?.kpi?.availability?.statusHistory ?? [];
        const points = data?.dataPoints ?? [];
        const useTimeRangeMatching =
          statusHistory.length > 0 && points.length > 0;

        const ranges = useTimeRangeMatching ? computeDowntimeRanges(statusHistory) : [];
        const dtSeries = convertTimeseriesToSeriesDatetime(data, labelMap.API_5XX);
        const useTier1 = ranges.length > 0 && dtSeries != null;

        if (useTier1) {
          downtimeRanges = ranges;
          useDatetimeAxis = true;
          singleSeries = dtSeries;
        } else if (useTimeRangeMatching) {
          const byDate = buildStatusHistoryByDate(statusHistory);
          let canParseAny = false;
          const indices: number[] = [];
          for (let i = 0; i < points.length; i++) {
            const d = parseDateStr(points[i]!.timestamp);
            if (!d) continue;
            canParseAny = true;
            const items = byDate.get(d);
            if (items?.some((x) => x.status === 'DOWN')) indices.push(i);
          }
          if (!canParseAny) {
            const rates = data?.valuesErrorRate ?? [];
            rates.forEach((rate, i) => {
              if ((rate ?? 0) > errorRateThreshold) indices.push(i);
            });
          }
          downtimeIndices = indices;
        } else {
          const indices: number[] = [];
          const rates = data?.valuesErrorRate ?? [];
          rates.forEach((rate, i) => {
            if ((rate ?? 0) > errorRateThreshold) indices.push(i);
          });
          downtimeIndices = indices;
        }
      }

      const seriesColor = activeKpi
        ? getChartLineColorForKpi(
            activeKpi,
            summaryData?.kpi?.availability,
            summaryData?.kpi?.latency,
            summaryData?.kpi?.traffic
          )
        : getApiChartSeriesColorFallback(effectiveRightMetric);
      const seriesWithColor = singleSeries
        ? [{ ...singleSeries, color: seriesColor }]
        : [];

      return {
        title: titleByMetric[effectiveRightMetric],
        series: seriesWithColor,
        categories: useDatetimeAxis ? [] : categories,
        isLoading: rightChartQuery.isLoading,
        error: rightChartQuery.error,
        downtimeIndices,
        downtimeRanges,
        useDatetimeAxis,
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
  }, [type, pvQuery, uvQuery, rightChartQuery, effectiveRightMetric, eventQuery, activeKpi, summaryData?.kpi?.availability, summaryData?.kpi?.latency, summaryData?.kpi?.traffic]);

  const useDatetimeAxis = (chartData as { useDatetimeAxis?: boolean }).useDatetimeAxis === true;

  const baseChartOptions = useMemo(
    () => ({
      chart: {
        type: 'line' as const,
      },
      xaxis: useDatetimeAxis
        ? { type: 'datetime' as const }
        : { categories: chartData.categories },
      stroke: {
        curve: 'smooth' as const,
      },
      legend: {
        show: true,
        position: 'top' as const,
      },
    }),
    [chartData.categories, useDatetimeAxis]
  );

  const pvUvSelectionOptions = useMemo(() => {
    if (
      type !== 'pv-uv' ||
      !onPvUvRangeSelect ||
      !pvQuery.data?.dataPoints?.length
    ) {
      return {};
    }
    const dataPoints = pvQuery.data.dataPoints;
    return {
      chart: {
        events: {
          dataPointSelection: (
            _chart: unknown,
            _opts: unknown,
            config: { dataPointIndex?: number }
          ) => {
            const i = config.dataPointIndex ?? 0;
            if (i < 0 || i >= dataPoints.length) return;
            const fromTimestamp = dataPoints[i].timestamp;
            const toTimestamp = addIntervalToTimestamp(fromTimestamp, interval);
            const fromIso = fromTimestamp.includes('T')
              ? fromTimestamp
              : fromTimestamp.replace(' ', 'T');
            const toIso = toTimestamp.includes('T')
              ? toTimestamp
              : toTimestamp.replace(' ', 'T');
            onPvUvRangeSelect(fromIso, toIso);
          },
        },
      },
    };
  }, [type, onPvUvRangeSelect, pvQuery.data, interval]);

  /** 장애 영역(Red Area): Availability/Error 카드 클릭 또는 우측 토글 'Error' 선택 시에만 노출. Traffic/Latency 모드에서는 미노출 */
  const shouldShowDowntimeArea =
    type === 'api' && (effectiveRightMetric === 'API_5XX');

  const apiErrorAnnotationsOptions = useMemo(() => {
    if (!shouldShowDowntimeArea) {
      return { annotations: { xaxis: [] } };
    }
    const downtimeRanges = (chartData as { downtimeRanges?: { x: number; x2: number }[] }).downtimeRanges;
    const downtimeIndices = (chartData as { downtimeIndices?: number[] }).downtimeIndices;
    const categories = chartData.categories;

    if (useDatetimeAxis && Array.isArray(downtimeRanges) && downtimeRanges.length > 0) {
      const xaxis = downtimeRanges.map((r) => ({
        x: r.x,
        x2: r.x2,
        fillColor: theme.palette.error.main,
        opacity: 0.2,
      }));
      return { annotations: { xaxis } };
    }
    if (!downtimeIndices?.length || !categories?.length) {
      return { annotations: { xaxis: [] } };
    }
    const xaxis = downtimeIndices.map((i) => ({
      x: categories[i] ?? '',
      x2: categories[Math.min(i + 1, categories.length - 1)] ?? categories[i],
      fillColor: theme.palette.error.main,
      opacity: 0.2,
    }));
    return { annotations: { xaxis } };
  }, [shouldShowDowntimeArea, chartData, theme.palette.error.main, useDatetimeAxis]);

  /** Latency 메트릭 시 Y축·툴팁에 ms 단위 명시 */
  const latencyUnitOptions = useMemo(() => {
    if (type !== 'api' || effectiveRightMetric !== 'LATENCY_P95') return {};
    return {
      yaxis: { title: { text: '지연 시간 (ms)' } },
      tooltip: {
        y: {
          formatter: (val: number) => (val != null && !Number.isNaN(val) ? `${Number(val).toLocaleString()} ms` : ''),
        },
      },
    };
  }, [type, effectiveRightMetric]);

  const chartOptions = useChart(
    merge(
      merge(
        merge(
          baseChartOptions,
          type === 'pv-uv' && Object.keys(pvUvSelectionOptions).length > 0 ? pvUvSelectionOptions : {}
        ),
        apiErrorAnnotationsOptions
      ),
      latencyUnitOptions
    )
  );

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

  const hasSeries = chartData.series.length > 0;
  const hasCategoriesOrDatetime =
    chartData.categories.length > 0 || useDatetimeAxis;
  if (!hasSeries || !hasCategoriesOrDatetime) {
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

  const handleRightChartMetricChange = (
    _event: React.MouseEvent<HTMLElement>,
    value: RightChartMetric | null
  ) => {
    if (value !== null) setRightChartMetric(value);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography variant="h6">{chartData.title}</Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          {type === 'api' && (
            <ToggleButtonGroup
              value={effectiveRightMetric}
              exclusive
              onChange={handleRightChartMetricChange}
              size="small"
            >
              <ToggleButton value="LATENCY_P95">Latency</ToggleButton>
              <ToggleButton value="API_TOTAL">Traffic</ToggleButton>
              <ToggleButton value="API_5XX">Error</ToggleButton>
            </ToggleButtonGroup>
          )}
          <ToggleButtonGroup value={interval} exclusive onChange={handleIntervalChange} size="small">
            <ToggleButton value="DAY">일별</ToggleButton>
            <ToggleButton value="HOUR">시간별</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      <Chart type="line" series={chartData.series} options={chartOptions} sx={{ height: 300 }} />
    </Stack>
  );
};
