import { merge } from 'es-toolkit';
import React, { useMemo } from 'react';
import { Chart, useChart } from '@dwp-frontend/design-system';
import {
  type TimeseriesResponse,
  useMonitoringTimeseriesQuery,
  type MonitoringSummaryResponse,
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
  /** KPI 카드 클릭 시 우측 차트 메트릭 고정 (Availability / Traffic / Latency / Error) */
  forcedRightMetric?: 'AVAILABILITY' | 'API_TOTAL' | 'API_5XX' | 'LATENCY_P95';
  /** 선택된 KPI 카드 → 선 색상을 해당 카드(테마)에 맞춤. Availability/Error 모두 Error 차트이면 카드별 다른 색 적용 */
  activeKpi?: MonitoringKpiCardKey | null;
  /** 가용성 도트 클릭 시 저장된 timestamp. Error 차트 X축 강조선·해제 연동 */
  activeTimestamp?: string | null;
  /** 차트 빈 공간 클릭 시 콜백 (강조 해제용) */
  onChartBackgroundClick?: () => void;
  /** 좌측 PV/UV 차트에서 포인트 클릭 시 해당 시간대로 API 히스토리 필터 (from, to ISO) */
  onPvUvRangeSelect?: (fromIso: string, toIso: string) => void;
  /** Summary API 응답 (Page에서 1회 fetch, type=api일 때 Error 차트 등에 사용) */
  summaryData?: MonitoringSummaryResponse | null;
};

/** 우측 차트 선 색상: KPI 미선택 시 메트릭별 기본 색상 (카드 색상과 동일 hex) */
function getApiChartSeriesColorFallback(
  effectiveRightMetric: 'AVAILABILITY' | 'LATENCY_P95' | 'API_TOTAL' | 'API_5XX'
): string {
  switch (effectiveRightMetric) {
    case 'AVAILABILITY':
      return '#3b82f6';
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

/** 시간 단위 interval이면 X축에 HH:mm 표시, 그 외는 MM/DD */
const isTimeLikeInterval = (interval: string | undefined): boolean =>
  /^(HOUR|1m|5m|30m|1h)$/i.test(String(interval ?? ''));

/**
 * Get x-axis categories from timeseries data
 * Backend returns labels: "YYYY-MM-DD" (DAY/1d) or "YYYY-MM-DD HH:mm" / ISO (1m, 30m, 1h, HOUR)
 * 시간별(1m|30m|1h|HOUR)이면 HH:mm, 일별(1d|6h|DAY)이면 MM/DD
 */
const getXAxisCategories = (data: TimeseriesResponse | undefined): string[] => {
  if (!data || !data.dataPoints || data.dataPoints.length === 0) {
    return [];
  }

  const useTime = isTimeLikeInterval(data.interval);

  return data.dataPoints.map((point) => {
    const timestamp = point.timestamp;

    if (useTime) {
      const timeMatch = timestamp.match(/\d{2}:\d{2}/);
      if (timeMatch) return timeMatch[0];
      try {
        const d = new Date(timestamp.replace(/\s+/, 'T'));
        if (!Number.isNaN(d.getTime())) {
          const h = String(d.getHours()).padStart(2, '0');
          const m = String(d.getMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        }
      } catch {
        // fallthrough
      }
      return timestamp;
    }

    const dateMatch = timestamp.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) return `${dateMatch[2]}/${dateMatch[3]}`;
    try {
      const date = new Date(timestamp.replace(/\s+/, 'T'));
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
      }
    } catch {
      // fallthrough
    }
    return timestamp;
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

/** timestamp 문자열 → UTC epoch ms. 공백→T, 타임존 없으면 Z 붙여 UTC로 해석 (statusHistory와 동일) */
const parseTimestampToEpoch = (s: string): number => {
  const normalized = s.trim().replace(/\s+/g, 'T');
  const iso = /[Z+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** status === 'DOWN'인 버킷의 [시작, 종료] epoch ms. 종료는 다음 버킷 시작 또는 이전 구간 길이로 추정 */
const computeDowntimeRanges = (
  items: { timestamp: string; status: string }[]
): { x: number; x2: number }[] => {
  const out: { x: number; x2: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.status !== 'DOWN') continue;
    const start = parseTimestampToEpoch(items[i]!.timestamp);
    if (start === 0) continue;
    let end: number;
    if (i + 1 < items.length) {
      end = parseTimestampToEpoch(items[i + 1]!.timestamp);
    } else if (i >= 1) {
      const prevStart = parseTimestampToEpoch(items[i - 1]!.timestamp);
      end = start + (start - prevStart);
    } else {
      end = start + 6 * 60 * 60 * 1000;
    }
    if (end <= start) continue;
    out.push({ x: start, x2: end });
  }
  return out;
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
  summaryData,
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

  // 우측 차트: Availability | Latency | Traffic | Error (맨 앞 Availability). Availability는 summary statusHistory 사용, 일별/시간별 제외
  type RightChartMetric = 'AVAILABILITY' | 'LATENCY_P95' | 'API_TOTAL' | 'API_5XX';
  const [rightChartMetric, setRightChartMetric] = React.useState<RightChartMetric>('AVAILABILITY');
  const effectiveRightMetric: RightChartMetric = forcedRightMetric ?? rightChartMetric;

  const rightChartQuery = useMonitoringTimeseriesQuery(
    type === 'api' && effectiveRightMetric !== 'AVAILABILITY'
      ? { from, to, interval, metric: effectiveRightMetric }
      : { from: '', to: '', interval: 'DAY', metric: 'API_TOTAL' }
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
        title: '시간대별 PV / UV',
        series: [pvSeries, uvSeries].filter((s): s is { name: string; data: number[] } => s !== null),
        categories,
        isLoading: pvQuery.isLoading || uvQuery.isLoading,
        error: pvQuery.error || uvQuery.error,
      };
    }

    if (type === 'api') {
      const titleByMetric = {
        AVAILABILITY: '시간대별 API / Availability',
        API_TOTAL: '시간대별 API / Traffic',
        LATENCY_P95: '시간대별 API / Latency',
        API_5XX: '시간대별 API / Error',
      };
      const labelMap = {
        AVAILABILITY: 'API Error Count',
        API_TOTAL: 'Traffic',
        API_5XX: 'Error',
        LATENCY_P95: 'Latency',
      };

      // Availability: summary statusHistory 기준. apiErrorCount·apiCount 각각 별도 선. 빨간 영역(downtime)+도트 클릭 시 파란 강조선
      if (effectiveRightMetric === 'AVAILABILITY') {
        const statusHistory = summaryData?.kpi?.availability?.statusHistory ?? [];
        const errorData: [number, number][] = statusHistory.map((item) => {
          const t = new Date(item.timestamp).getTime();
          return [Number.isNaN(t) ? 0 : t, item.apiErrorCount ?? 0];
        });
        const countData: [number, number][] = statusHistory.map((item) => {
          const t = new Date(item.timestamp).getTime();
          return [Number.isNaN(t) ? 0 : t, item.apiCount ?? 0];
        });
        const seriesColor = activeKpi
          ? getChartLineColorForKpi(
              activeKpi,
              summaryData?.kpi?.availability,
              summaryData?.kpi?.latency,
              summaryData?.kpi?.traffic
            )
          : getApiChartSeriesColorFallback('AVAILABILITY');
        // 순서: 1행 성공(API Count), 2행 실패(API Error Count). 마우스 오버/범례 동일
        const seriesWithColor: Array<{ name: string; data: [number, number][]; color?: string }> = [];
        if (countData.length > 0) {
          seriesWithColor.push({
            name: 'API Count',
            data: countData,
            color: theme.palette.success.main,
          });
        }
        if (errorData.length > 0) {
          seriesWithColor.push({
            name: 'API Error Count',
            data: errorData,
            color: seriesColor,
          });
        }
        const downtimeRanges = computeDowntimeRanges(statusHistory);
        const hasData = errorData.length > 0 || countData.length > 0;
        return {
          title: titleByMetric.AVAILABILITY,
          series: seriesWithColor,
          categories: [],
          isLoading: false,
          error: null,
          downtimeIndices: undefined,
          downtimeRanges,
          useDatetimeAxis: hasData,
        };
      }

      const data = rightChartQuery.data;
      const categories = getXAxisCategories(data);
      const singleSeries: { name: string; data: number[] } | null = convertTimeseriesToSeries(
        data,
        labelMap[effectiveRightMetric]
      );

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
        categories,
        isLoading: rightChartQuery.isLoading,
        error: rightChartQuery.error,
        downtimeIndices: undefined,
        downtimeRanges: undefined,
        useDatetimeAxis: false,
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
  }, [type, pvQuery, uvQuery, rightChartQuery, effectiveRightMetric, eventQuery, activeKpi, summaryData, theme]);

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

  /** PV/UV 차트 툴팁: 시간 대신 일자(MM/DD) 표시 (API/Error 차트와 동일) */
  const pvUvTooltipOptions = useMemo(() => {
    if (type !== 'pv-uv') return {};
    const src = pvQuery.data || uvQuery.data;
    const dataPoints = src?.dataPoints ?? [];
    if (dataPoints.length === 0) return {};
    return {
      tooltip: {
        x: {
          formatter: (val: number | string, opts?: { dataPointIndex?: number }) => {
            const i = opts?.dataPointIndex ?? 0;
            const ts = dataPoints[i]?.timestamp;
            if (!ts) return String(val);
            const d = parseDateStr(ts);
            return d ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : String(val);
          },
        },
      },
    };
  }, [type, pvQuery.data, uvQuery.data]);

  /** 장애 영역(Red Area): 가용성 차트에서만 노출. 도트 클릭 시 파란 강조선: Availability 차트에서만 */
  const shouldShowDowntimeArea =
    type === 'api' && effectiveRightMetric === 'AVAILABILITY';

  const apiAvailabilityAnnotationsOptions = useMemo(() => {
    const xaxis: Array<{
      x: number | string;
      x2?: number | string;
      fillColor?: string;
      borderColor?: string;
      opacity?: number;
      strokeDashArray?: number;
    }> = [];

    if (shouldShowDowntimeArea) {
      const downtimeRanges = (chartData as { downtimeRanges?: { x: number; x2: number }[] }).downtimeRanges;
      if (useDatetimeAxis && Array.isArray(downtimeRanges) && downtimeRanges.length > 0) {
        downtimeRanges.forEach((r) => {
          xaxis.push({
            x: r.x,
            x2: r.x2,
            fillColor: theme.palette.error.main,
            opacity: 0.2,
          });
        });
      }
    }

    // 도트 클릭 시 해당 시간 파란 강조선 (가용성 차트만). x만 주면 세로선, parseTimestampToEpoch로 차트 데이터와 동일 해석
    if (
      type === 'api' &&
      effectiveRightMetric === 'AVAILABILITY' &&
      activeTimestamp
    ) {
      const ts = parseTimestampToEpoch(activeTimestamp);
      if (ts > 0) {
        xaxis.push({
          x: ts,
          borderColor: theme.palette.primary.main,
          strokeDashArray: 0,
          opacity: 1,
        });
      }
    }

    return { annotations: { xaxis } };
  }, [
    shouldShowDowntimeArea,
    type,
    effectiveRightMetric,
    activeTimestamp,
    chartData,
    theme.palette.error.main,
    theme.palette.primary.main,
    useDatetimeAxis,
  ]);

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
          merge(
            baseChartOptions,
            type === 'pv-uv' && Object.keys(pvUvSelectionOptions).length > 0 ? pvUvSelectionOptions : {}
          ),
          apiAvailabilityAnnotationsOptions
        ),
        pvUvTooltipOptions
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
          {(type !== 'api' || effectiveRightMetric !== 'AVAILABILITY') && (
            <ToggleButtonGroup value={interval} exclusive onChange={handleIntervalChange} size="small">
              <ToggleButton value="DAY">일별</ToggleButton>
              <ToggleButton value="HOUR">시간별</ToggleButton>
            </ToggleButtonGroup>
          )}
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
              <ToggleButton value="AVAILABILITY">Availability</ToggleButton>
              <ToggleButton value="LATENCY_P95">Latency</ToggleButton>
              <ToggleButton value="API_TOTAL">Traffic</ToggleButton>
              <ToggleButton value="API_5XX">Error</ToggleButton>
            </ToggleButtonGroup>
          )}
          {type === 'api' && effectiveRightMetric !== 'AVAILABILITY' && (
            <ToggleButtonGroup value={interval} exclusive onChange={handleIntervalChange} size="small">
              <ToggleButton value="DAY">일별</ToggleButton>
              <ToggleButton value="HOUR">시간별</ToggleButton>
            </ToggleButtonGroup>
          )}
          {type !== 'api' && (
            <ToggleButtonGroup value={interval} exclusive onChange={handleIntervalChange} size="small">
              <ToggleButton value="DAY">일별</ToggleButton>
              <ToggleButton value="HOUR">시간별</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
      </Stack>
      <Chart type="line" series={chartData.series} options={chartOptions} sx={{ height: 300 }} />
    </Stack>
  );
};
