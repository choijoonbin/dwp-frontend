import { useMemo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  ApiErrorAlert,
  type TimeseriesResponse,
  useMonitoringSummaryQuery,
  useMonitoringTimeseriesQuery,
  getTimeseriesIntervalFromRange,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

// ----------------------------------------------------------------------

type MonitoringCardProps = {
  title: string;
  /** 메인 지표 (예: "99.92%", "240ms", "12.3 RPS", "2.77%") */
  mainValue: string;
  icon: string;
  color: string;
  /** 서브 행 (예: "Downtime: 5m", "p50: 45 / p99: 620", "PV: 47 / UV: 2") */
  subRow?: string;
  /** 메인 옆 인라인 표시 (예: -1.1% → "(-1.1%)") */
  deltaPercent?: number;
  /** 메인 옆 인라인 표시 (예: +30 → "(+30)") */
  deltaValue?: number;
  /** true면 상승 시 빨간색 ▲ (에러율 등), false면 상승 시 녹색 */
  deltaPositiveIsBad?: boolean;
  isLoading?: boolean;
  sparkline?: number[] | null;
  /** Error 카드 전용: Budget 소진율 0-100, Progress Bar 표시 */
  budgetPercent?: number;
  /** Error Budget 소진 비율 0–1 (80% 이상이면 Bar 빨간색, 1.0 이상이면 100% cap + 강렬한 Red) */
  consumedRatio?: number;
  /** consumedRatio >= 1.0일 때 Bar 100% 고정 + 강렬한 Red 시각적 경고 */
  isOverConsumed?: boolean;
  /** Error 카드: 잔여량(0-100). 설정 시 바는 잔여량 게이지로 표시, Green/Yellow/Red 및 "Remaining: X%" 병기 */
  remainingPercent?: number;
  /** 스파크라인 선 두께 (에러 카드 Spike 가시성 등) */
  sparklineStrokeWidth?: number;
  /** 메인 수치 아래 Trend 행 (예: 전일 대비 +0.5pp) */
  trendText?: string;
  /** trendText를 위험(Red) 스타일로 표시 */
  trendTextDanger?: boolean;
  /** 에러율 3% 초과 시 카드 상단 Red + 경고 아이콘 */
  isDanger?: boolean;
  /** 가용성 카드: successRate < criticalThreshold 일 때 [Critical] + Red 테마 */
  slaCritical?: boolean;
  /** 가용성 카드: criticalThreshold ≤ successRate < sloTarget 일 때 [Below SLO] + Yellow 테마 */
  slaWarning?: boolean;
  /** 가용성 카드: Warning 배지 문구 (예: "Below SLO") */
  warningBadgeLabel?: string;
  /** 가용성 카드: 우측 상단 SLO 칩 (예: "SLO 99.9%") */
  sloTargetChip?: string;
  /** true면 SLO 칩을 타이틀 행 우측에만 두고 메인 수치는 다음 행(Error 카드). false/미지정이면 우측 컬럼에 칩+메인 수치(이전 레이아웃, Availability/Latency) */
  sloChipInTitleRow?: boolean;
  /** 가용성 카드: Downtime & Uptime 한 줄 또는 둘째 줄 */
  subRow2?: string;
  /** 서브 행을 커스텀 노드로 대체 (예: Latency p99 툴팁·강조) */
  subRowNode?: React.ReactNode;
  /** 스파크라인 최고점 높이 비율(0~1). 가용성 카드에서 텍스트와 겹치지 않도록 0.6 등으로 제한 */
  sparklineMaxPeakRatio?: number;
  /** true면 스파크라인 값이 전부 0일 때도 바닥에 평평한 선(Zero-filling) 표시 */
  sparklineZeroFill?: boolean;
  onClick?: () => void;
  /** 클릭 시 활성 상태 → Border 컬러 강조 */
  isActive?: boolean;
  /** 가용성 등급에 맞춘 변동률 색상(미지정 시 방향별 Red/Green) */
  deltaColor?: string;
  /** 변동률 숫자 표기 시 단위 (예: "ms") */
  deltaUnit?: string;
  /** 메인 수치 옆 보조 UI (가용성 카드: SLO 대비 소형 Progress Bar 등) */
  mainValueSupplement?: React.ReactNode;
};

const sampleValues = (values: number[], maxPoints = 12): number[] => {
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => values[Math.round(index * step)] ?? 0);
};

const extractValues = (data?: TimeseriesResponse): number[] =>
  data?.dataPoints?.map((point) => point.value) ?? [];

const buildRateValues = (
  total?: TimeseriesResponse,
  error?: TimeseriesResponse
): number[] => {
  if (!total?.dataPoints?.length || !error?.dataPoints?.length) return [];
  const totalMap = new Map(total.dataPoints.map((point) => [point.timestamp, point.value]));
  const errorMap = new Map(error.dataPoints.map((point) => [point.timestamp, point.value]));
  const timestamps =
    total.dataPoints.length >= error.dataPoints.length
      ? total.dataPoints.map((point) => point.timestamp)
      : error.dataPoints.map((point) => point.timestamp);

  return timestamps.map((timestamp) => {
    const totalValue = totalMap.get(timestamp) ?? 0;
    const errorValue = errorMap.get(timestamp) ?? 0;
    return totalValue > 0 ? (errorValue / totalValue) * 100 : 0;
  });
};

const buildSparkline = (values: number[], maxPoints = 12): number[] | null => {
  if (values.length === 0) return null;
  const sampled = sampleValues(values, maxPoints);
  const hasSignal = sampled.some((value) => value !== 0);
  return hasSignal ? sampled : null;
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

/** 스파크라인 path. x는 도트 중심과 1:1 (0~100). n=48일 때 i번째 포인트 x = (i/(n-1))*100. */
const getSparklinePaths = (values: number[], maxPeakRatio = 1) => {
  const width = 100;
  const height = 40;
  const safe = values.map((v) => (v == null || Number.isNaN(v) ? 0 : v));
  if (safe.length === 0) return { linePath: '', areaPath: '' };
  const max = Math.max(...safe);
  const min = Math.min(...safe);
  const range = max - min || 1;
  const effectiveHeight = (height - 6) * Math.max(0.2, Math.min(1, maxPeakRatio));
  const n = safe.length;

  const points = safe.map((value, index) => {
    const x = n > 1 ? (index / (n - 1)) * width : 0;
    const y = height - ((value - min) / range) * effectiveHeight - 2;
    return { x, y };
  });

  const linePath =
    points.length === 1 ? `M0,${points[0].y} L${width},${points[0].y}` : getSmoothPath(points);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return { linePath, areaPath };
};

/** 배경 스파크라인. 부모가 높이를 주면 100% 채움 (카드 하단 40% 영역 등). maxPeakRatio로 선 최고점 제한. strokeWidth로 Spike 가시성 조정. zeroFill이면 전부 0일 때도 바닥에 평평한 선 표시. */
const Sparkline = ({
  color,
  values,
  maxPeakRatio = 1,
  strokeWidth = 2,
  zeroFill = false,
}: {
  color: string;
  values: number[];
  /** 0~1. 1=전체 높이, 0.6=최고점이 컨테이너 높이의 60%로 제한되어 상단 텍스트와 겹치지 않음 */
  maxPeakRatio?: number;
  /** 선 두께 (에러 카드 Spike 등 강조 시 3) */
  strokeWidth?: number;
  /** true면 전부 0일 때도 바닥에 평평한 선(Zero-filling) 표시 */
  zeroFill?: boolean;
}) => {
  if (values.length === 0) return null;
  if (!zeroFill && values.every((value) => value === 0)) {
    return null;
  }

  const { linePath, areaPath } = getSparklinePaths(values, maxPeakRatio);
  if (!linePath || !areaPath) return null;

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
        height: '100%',
        opacity: 1,
        zIndex: 0,
      }}
    >
      <path d={areaPath} fill={alpha(color, 0.08)} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeOpacity={0.4} />
    </Box>
  );
};

/** 메인 값 옆 인라인 델타 (예: "(-1.1%)", "(+968ms)"). deltaUnit 있으면 숫자 뒤에 단위 붙임. colorOverride 시 등급 색상 일치 */
const InlineDelta = ({
  deltaPercent,
  deltaValue,
  deltaPositiveIsBad,
  colorOverride,
  deltaUnit,
}: {
  deltaPercent?: number;
  deltaValue?: number;
  deltaPositiveIsBad?: boolean;
  colorOverride?: string;
  /** 숫자 표기 시 단위 (예: "ms") */
  deltaUnit?: string;
}) => {
  if (deltaPercent === undefined && deltaValue === undefined) return null;
  const usePercent = deltaPercent !== undefined;
  const value = usePercent ? (deltaPercent ?? 0) : (deltaValue ?? 0);
  const isPositive = value >= 0;
  const isBad = deltaPositiveIsBad ? isPositive : !isPositive;
  const color = colorOverride ?? (isBad ? '#ef4444' : '#10b981');
  const text = usePercent
    ? `(${isPositive ? '+' : ''}${(deltaPercent ?? 0).toFixed(1)}%)`
    : `(${isPositive ? '+' : ''}${deltaValue}${deltaUnit ?? ''})`;
  const ArrowIcon = isPositive ? '▲' : '▼';

  return (
    <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color, ml: 0.5, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      {ArrowIcon}
      {text}
    </Typography>
  );
};

const ERROR_DANGER_COLOR = '#EF4444';
const WARNING_AMBER_COLOR = '#f59e0b';
const ERROR_BUDGET_DANGER_THRESHOLD = 80; // % 이상 소진 시 Bar 빨간색
const AVAILABILITY_SUCCESS_COLOR = '#22c55e';
const NO_DATA_GRAY = '#9ca3af';

type StatusHistoryItem = { timestamp: string; status: string; availability: number };

/** statusHistory 항목 기준 색상: UP=녹색, WARNING=황색, DOWN=적색, NO_DATA=회색 */
const statusToColor = (status: string): string => {
  switch (status) {
    case 'UP':
      return AVAILABILITY_SUCCESS_COLOR;
    case 'WARNING':
      return WARNING_AMBER_COLOR;
    case 'DOWN':
      return ERROR_DANGER_COLOR;
    case 'NO_DATA':
    default:
      return NO_DATA_GRAY;
  }
};


/** ISO-8601 UTC → KST 툴팁용 단축 포맷 "HH:mm" 또는 "MM-DD HH:mm" (한 줄 표시용) */
const formatHealthDotTooltipTimeShort = (iso: string, sameDayRef?: Date): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    const f = new Intl.DateTimeFormat('ko-KR', opts);
    const parts = f.formatToParts(d);
    const m = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const h = parts.find((p) => p.type === 'hour')?.value ?? '';
    const min = parts.find((p) => p.type === 'minute')?.value ?? '';
    if (sameDayRef) {
      const refParts = f.formatToParts(sameDayRef);
      const refM = refParts.find((p) => p.type === 'month')?.value ?? '';
      const refDay = refParts.find((p) => p.type === 'day')?.value ?? '';
      if (m === refM && day === refDay) return `${h}:${min}`;
    }
    return `${m}-${day} ${h}:${min}`;
  } catch {
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }
};

const MAX_DOTS = 48; // 단일 행 유지: 최대 도트 개수 (40~50 범위)

/** statusHistory 또는 values 배열을 최대 MAX_DOTS개로 샘플링 (단일 행 유지). Single Source용. */
const sampleDots = <T,>(items: T[], maxDots: number): T[] => {
  if (items.length <= maxDots) return items;
  const step = (items.length - 1) / (maxDots - 1);
  return Array.from({ length: maxDots }, (_, index) => items[Math.round(index * step)] ?? items[0]!);
};

/** 가용성 카드 Timeline. Single Source: statusHistory 우선 else values(48). 도트·차트 1:1. nowrap, flex:1, gap 최소, hover scale(1.5)/opacity 0.3. */
const AvailabilityHealthBar = ({
  values,
  statusHistory,
  sloTarget,
  criticalThreshold,
  downtimeCaption,
  uptimeCaption,
  showCaption = true,
  activeTimestamp,
  onDotClick,
}: {
  values: number[];
  statusHistory?: StatusHistoryItem[];
  sloTarget: number;
  criticalThreshold: number;
  downtimeCaption: string;
  uptimeCaption?: string;
  /** false면 캡션 행 미표시 (Row1에 별도 배치 시 사용) */
  showCaption?: boolean;
  /** 도트 클릭 시 Error 차트 연동 강조용. 선택된 도트의 timestamp */
  activeTimestamp?: string;
  /** 도트 클릭 콜백. statusHistory 있을 때만 사용. prevTimestamp 없으면 직전 도트 없음 */
  onDotClick?: (payload: { timestamp: string; prevTimestamp: string | null }) => void;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const useHistory = statusHistory != null && statusHistory.length > 0;
  const dotColorByValue = (v: number) =>
    v >= sloTarget ? AVAILABILITY_SUCCESS_COLOR : v >= criticalThreshold ? WARNING_AMBER_COLOR : ERROR_DANGER_COLOR;
  const captionLine = uptimeCaption ? `${downtimeCaption} | ${uptimeCaption}` : downtimeCaption;

  /** 부모에서 이미 Single Source 기반으로 샘플링·통일됨. 재샘플링 없이 1:1 사용 */
  const dotItems = useHistory ? statusHistory : values;
  const firstTs = useHistory && statusHistory[0] ? new Date(statusHistory[0].timestamp) : undefined;

  // 툴팁: "[15:00] 가용성 93.8%" 또는 "[MM-DD HH:mm] 가용성 93.8%" + 상태 색상 점
  const getHistoryTooltip = (item: StatusHistoryItem) => {
    const timeStr = formatHealthDotTooltipTimeShort(item.timestamp, firstTs);
    const statusColor = statusToColor(item.status);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: statusColor,
            flexShrink: 0,
          }}
        />
        <Typography variant="caption" sx={{ color: 'common.white', fontSize: '0.75rem' }}>
          [{timeStr}] 가용성 {item.availability.toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  const getValueTooltip = (v: number) => {
    const statusColor = dotColorByValue(v);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: statusColor,
            flexShrink: 0,
          }}
        />
        <Typography variant="caption" sx={{ color: 'common.white', fontSize: '0.75rem' }}>
          [가용성] {v.toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  const tooltipSx = {
    tooltip: {
      sx: {
        bgcolor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        borderRadius: 1,
        px: 1.5,
        py: 1,
      },
    },
    arrow: { sx: { color: 'rgba(0, 0, 0, 0.8)' } },
  };

  return (
    <Box sx={{ position: 'relative', zIndex: 2 }}>
      {showCaption && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', mb: 0.5 }}>
          {captionLine}
        </Typography>
      )}
      <Stack
        direction="row"
        spacing={0}
        sx={{
          flexWrap: 'nowrap',
          overflow: 'hidden',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 0.125,
        }}
      >
        {useHistory
          ? (dotItems as StatusHistoryItem[]).map((item, i) => {
              const isHovered = hoveredIndex === i;
              const isActive = activeTimestamp != null && item.timestamp === activeTimestamp;
              const color = statusToColor(item.status);
              const prevTimestamp = i > 0 ? (dotItems as StatusHistoryItem[])[i - 1]!.timestamp : null;
              const handleClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                onDotClick?.({ timestamp: item.timestamp, prevTimestamp });
              };
              return (
                <Box
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={handleClick}
                  role={onDotClick ? 'button' : undefined}
                  sx={{
                    flex: '1 1 0',
                    minWidth: 4,
                    aspectRatio: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: hoveredIndex != null && !isHovered ? 0.3 : 1,
                    transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
                    cursor: onDotClick ? 'pointer' : 'default',
                  }}
                >
                  <Tooltip title={getHistoryTooltip(item)} placement="top" arrow componentsProps={tooltipSx}>
                    <Box
                      component="span"
                      sx={{
                        width: '100%',
                        height: '100%',
                        maxWidth: 10,
                        maxHeight: 10,
                        borderRadius: 0.25,
                        bgcolor: color,
                        display: 'block',
                        transform: isHovered ? 'scale(1.5)' : 'scale(1)',
                        zIndex: isHovered ? 10 : 1,
                        position: 'relative',
                        boxShadow: isActive ? `0 0 0 2px ${color}` : 'none',
                      }}
                    />
                  </Tooltip>
                </Box>
              );
            })
          : (dotItems as number[]).map((v, i) => {
              const isHovered = hoveredIndex === i;
              const color = dotColorByValue(v);
              return (
                <Box
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  sx={{
                    flex: '1 1 0',
                    minWidth: 4,
                    aspectRatio: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: hoveredIndex != null && !isHovered ? 0.3 : 1,
                    transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
                  }}
                >
                  <Tooltip title={getValueTooltip(v)} placement="top" arrow componentsProps={tooltipSx}>
                    <Box
                      component="span"
                      sx={{
                        width: '100%',
                        height: '100%',
                        maxWidth: 10,
                        maxHeight: 10,
                        borderRadius: 0.25,
                        bgcolor: color,
                        display: 'block',
                        cursor: 'default',
                        transform: isHovered ? 'scale(1.5)' : 'scale(1)',
                        zIndex: isHovered ? 10 : 1,
                        position: 'relative',
                      }}
                    />
                  </Tooltip>
                </Box>
              );
            })}
      </Stack>
    </Box>
  );
};

/** 가용성 카드 Top Cause: 텍스트 중심 경량 칩 (배경 박스 없음). 클릭 시 API 히스토리 탭 이동 */
const TopCauseInsight = ({
  topCause,
  onPathClick,
}: {
  topCause: { path?: string; statusGroup?: string; count?: number } | null | undefined;
  onPathClick?: (path: string) => void;
}) => {
  const hasPath = topCause?.path != null;
  const pathText = topCause?.path ?? '';
  const countText = topCause?.count != null ? `${topCause.count}` : '0';

  const handleClick = () => {
    if (hasPath && topCause.path && onPathClick) {
      onPathClick(topCause.path);
    }
  };

  if (!hasPath) return null;

  return (
    <Box
      component="button"
      type="button"
      onClick={handleClick}
      sx={{
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        border: 'none',
        borderRadius: 0,
        py: 0,
        px: 0,
        bgcolor: 'transparent',
        transition: 'opacity 0.2s ease-in-out',
        '&:hover': {
          opacity: 1,
          '& .top-cause-path': {
            textDecoration: 'underline',
            color: 'primary.main',
          },
        },
      }}
      title={`${pathText} (${countText}건)`}
    >
      <Iconify icon="solar:danger-triangle-bold" width={12} sx={{ color: WARNING_AMBER_COLOR, flexShrink: 0 }} />
      <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'text.secondary' }}>
        Top Cause:
      </Typography>
      <Typography
        className="top-cause-path"
        component="span"
        variant="caption"
        sx={{
          fontSize: '0.7rem',
          fontWeight: 400,
          color: 'text.primary',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textDecoration: 'none',
          transition: 'color 0.2s ease-in-out',
        }}
      >
        {pathText}
      </Typography>
      <Typography component="span" variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', flexShrink: 0 }}>
        ({countText}건)
      </Typography>
    </Box>
  );
};

const MonitoringCard = ({
  title,
  mainValue,
  icon,
  color,
  subRow,
  deltaPercent,
  deltaValue,
  deltaPositiveIsBad,
  isLoading,
  sparkline,
  budgetPercent,
  consumedRatio,
  isOverConsumed,
  remainingPercent,
  trendText,
  trendTextDanger,
  isDanger,
  slaCritical,
  slaWarning,
  warningBadgeLabel,
  sloTargetChip,
  sloChipInTitleRow,
  subRow2,
  subRowNode,
  sparklineMaxPeakRatio,
  sparklineStrokeWidth,
  sparklineZeroFill,
  onClick,
  isActive,
  deltaColor,
  deltaUnit,
  mainValueSupplement,
}: MonitoringCardProps) => {
  /** 등급별 색상: Critical → Red, Warning → Amber, 그외 → color. 상단바·아이콘·메인·변동률·테두리 일관 적용 */
  const topBarColor =
    isDanger || slaCritical ? ERROR_DANGER_COLOR : slaWarning ? WARNING_AMBER_COLOR : color;
  const cardIcon = isDanger
    ? 'solar:bell-bold'
    : slaCritical
      ? 'solar:danger-triangle-bold'
      : slaWarning
        ? 'solar:warning-circle-bold'
        : icon;
  const useRemainingGauge = remainingPercent !== undefined;
  const barValue = useRemainingGauge
    ? Math.min(100, Math.max(0, remainingPercent))
    : consumedRatio != null
      ? Math.min(100, Math.max(0, consumedRatio * 100))
      : budgetPercent != null
        ? Math.min(100, Math.max(0, budgetPercent))
        : undefined;
  const barIsDanger = !useRemainingGauge && barValue != null && (barValue >= ERROR_BUDGET_DANGER_THRESHOLD || isOverConsumed);
  const remainingBarColor =
    useRemainingGauge && barValue != null
      ? barValue <= 0
        ? ERROR_DANGER_COLOR
        : barValue >= ERROR_BUDGET_REMAINING_HIGH_THRESHOLD
          ? '#22c55e'
          : barValue >= ERROR_BUDGET_REMAINING_LOW_THRESHOLD
            ? WARNING_AMBER_COLOR
            : ERROR_DANGER_COLOR
      : undefined;
  const barColor = remainingBarColor ?? (isOverConsumed ? ERROR_DANGER_COLOR : barIsDanger ? ERROR_DANGER_COLOR : color);

  const content = (
    <>
      <Box sx={{ height: 4, bgcolor: topBarColor }} />
      <Box
        sx={{
          p: 2.5,
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          ...(sparkline ? { pb: 6 } : {}),
        }}
      >
        <Stack direction="row" alignItems="center" sx={{ position: 'relative' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon={cardIcon} width={22} sx={{ color: topBarColor }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              {title}
            </Typography>
          </Stack>
          {sloChipInTitleRow && sloTargetChip && (
            <Chip
              label={sloTargetChip}
              size="small"
              sx={{
                height: 22,
                typography: 'caption',
                fontWeight: 600,
                bgcolor: alpha(color, 0.12),
                color: 'text.secondary',
                border: '1px solid',
                borderColor: alpha(color, 0.3),
              }}
            />
          )}
          {!sloChipInTitleRow && sloTargetChip && (
            <Chip
              label={sloTargetChip}
              size="small"
              sx={{
                height: 22,
                typography: 'caption',
                fontWeight: 600,
                bgcolor: alpha(color, 0.12),
                color: 'text.secondary',
                border: '1px solid',
                borderColor: alpha(color, 0.3),
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          )}
          {!sloChipInTitleRow && (isLoading ? (
            <Skeleton variant="text" width={80} height={40} sx={{ ml: 'auto' }} />
          ) : (
            <Stack direction="column" alignItems="flex-end" spacing={0.25} sx={{ ml: 'auto' }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: 28, md: 32 },
                  lineHeight: 1,
                  fontFamily: '"Inter", "Pretendard", sans-serif',
                  color: slaCritical ? ERROR_DANGER_COLOR : slaWarning ? WARNING_AMBER_COLOR : undefined,
                }}
              >
                {mainValue}
              </Typography>
              {mainValueSupplement}
            </Stack>
          ))}
        </Stack>
        {!sloChipInTitleRow && !isLoading && (
          <Stack direction="column" alignItems="flex-end" spacing={0.75}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" justifyContent="flex-end" gap={1}>
              {slaCritical && (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    typography: 'caption',
                    fontWeight: 700,
                    bgcolor: alpha(ERROR_DANGER_COLOR, 0.08),
                    color: ERROR_DANGER_COLOR,
                    border: '1px solid',
                    borderColor: alpha(ERROR_DANGER_COLOR, 0.35),
                  }}
                >
                  Critical
                </Box>
              )}
              {slaWarning && warningBadgeLabel && !slaCritical && (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    typography: 'caption',
                    fontWeight: 700,
                    bgcolor: alpha(WARNING_AMBER_COLOR, 0.12),
                    color: WARNING_AMBER_COLOR,
                    border: '1px solid',
                    borderColor: alpha(WARNING_AMBER_COLOR, 0.4),
                  }}
                >
                  {warningBadgeLabel}
                </Box>
              )}
              <InlineDelta
                deltaPercent={deltaPercent}
                deltaValue={deltaValue}
                deltaPositiveIsBad={deltaPositiveIsBad}
                colorOverride={deltaColor}
                deltaUnit={deltaUnit}
              />
            </Stack>
            {trendText !== undefined && trendText !== '' && (
              <Typography
                variant="caption"
                sx={{
                  color: trendTextDanger ? ERROR_DANGER_COLOR : 'text.secondary',
                  fontWeight: trendTextDanger ? 600 : undefined,
                }}
              >
                {trendText}
              </Typography>
            )}
          </Stack>
        )}
        {sloChipInTitleRow && (isLoading ? (
          <Box sx={{ alignSelf: 'flex-end' }}>
            <Skeleton variant="text" width={80} height={40} />
          </Box>
        ) : (
          <Stack direction="column" alignItems="flex-end" spacing={0.75} sx={{ alignSelf: 'flex-end' }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                fontSize: { xs: 28, md: 32 },
                lineHeight: 1,
                fontFamily: '"Inter", "Pretendard", sans-serif',
                color: slaCritical ? ERROR_DANGER_COLOR : slaWarning ? WARNING_AMBER_COLOR : undefined,
              }}
            >
              {mainValue}
            </Typography>
            <Stack direction="row" alignItems="center" flexWrap="wrap" justifyContent="flex-end" gap={1}>
              {slaCritical && (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    typography: 'caption',
                    fontWeight: 700,
                    bgcolor: alpha(ERROR_DANGER_COLOR, 0.08),
                    color: ERROR_DANGER_COLOR,
                    border: '1px solid',
                    borderColor: alpha(ERROR_DANGER_COLOR, 0.35),
                  }}
                >
                  Critical
                </Box>
              )}
              {slaWarning && warningBadgeLabel && !slaCritical && (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    typography: 'caption',
                    fontWeight: 700,
                    bgcolor: alpha(WARNING_AMBER_COLOR, 0.12),
                    color: WARNING_AMBER_COLOR,
                    border: '1px solid',
                    borderColor: alpha(WARNING_AMBER_COLOR, 0.4),
                  }}
                >
                  {warningBadgeLabel}
                </Box>
              )}
              <InlineDelta
                deltaPercent={deltaPercent}
                deltaValue={deltaValue}
                deltaPositiveIsBad={deltaPositiveIsBad}
                colorOverride={deltaColor}
                deltaUnit={deltaUnit}
              />
            </Stack>
            {trendText !== undefined && trendText !== '' && (
              <Typography
                variant="caption"
                sx={{
                  color: trendTextDanger ? ERROR_DANGER_COLOR : 'text.secondary',
                  fontWeight: trendTextDanger ? 600 : undefined,
                }}
              >
                {trendText}
              </Typography>
            )}
          </Stack>
        ))}
        {/* Error 카드: 하단에 4xx · 5xx 배치 */}
        {!isLoading && title === 'Error' && (subRowNode != null || (subRow !== undefined && subRow !== '')) && (
          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              bgcolor: 'background.paper',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              alignSelf: 'flex-start',
            }}
          >
            {subRowNode != null
              ? subRowNode
              : subRow !== undefined && subRow !== '' && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={subRow}>
                    {subRow}
                  </Typography>
                )}
          </Box>
        )}
        {/* Error 카드가 아닌 경우에만 subRow를 여기에 표시 */}
        {!isLoading && title !== 'Error' && (subRowNode != null || (subRow !== undefined && subRow !== '') || (subRow2 !== undefined && subRow2 !== '')) && (
          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              bgcolor: 'background.paper',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              width: '100%',
            }}
          >
            {subRowNode != null
              ? subRowNode
              : subRow !== undefined && subRow !== '' && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={subRow}>
            {subRow}
          </Typography>
        )}
            {subRow2 !== undefined && subRow2 !== '' && (
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={subRow2}>
                {subRow2}
              </Typography>
            )}
          </Box>
        )}
        {/* Error 카드: 3행에 Error Budget 배치 (4xx/5xx 아래) */}
        {!isLoading && barValue !== undefined && (
          <Box sx={{ mt: title === 'Error' ? 0.5 : 0.75 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
              {useRemainingGauge
                ? `Error Budget Remaining: ${Math.round(barValue)}%`
                : 'Error Budget'}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={useRemainingGauge ? barValue : barValue}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: alpha(barColor, 0.12),
                '& .MuiLinearProgress-bar': {
                  bgcolor: barColor,
                  ...(isOverConsumed ? { opacity: 1, boxShadow: `0 0 8px ${alpha(ERROR_DANGER_COLOR, 0.5)}` } : {}),
                },
              }}
            />
          </Box>
        )}
      </Box>
      {sparkline && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '35%',
            maxHeight: 60,
            zIndex: 0,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <Sparkline
            color={topBarColor}
            values={sparkline}
            maxPeakRatio={sparklineMaxPeakRatio}
            strokeWidth={sparklineStrokeWidth}
            zeroFill={sparklineZeroFill}
          />
        </Box>
      )}
    </>
  );

  const cardSx = {
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: 2,
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
    bgcolor: 'background.paper',
    minHeight: 180,
    ...(isActive ? { border: `2px solid ${topBarColor}`, boxShadow: `0 0 0 1px ${alpha(topBarColor, 0.3)}` } : {}),
    ...((isDanger || slaCritical) && !isActive ? { borderTop: `4px solid ${ERROR_DANGER_COLOR}` } : {}),
    ...(slaWarning && !slaCritical && !isActive ? { borderTop: `4px solid ${WARNING_AMBER_COLOR}` } : {}),
    ...(onClick
      ? {
          cursor: 'pointer',
          ...(!isActive ? { border: '1px solid transparent' } : {}),
          '&:hover': {
            bgcolor: 'action.hover',
            ...(!isActive ? { borderColor: alpha(topBarColor, 0.4) } : {}),
          },
        }
      : {}),
  };

  if (onClick) {
    return (
      <Card role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()} sx={cardSx}>
        {content}
      </Card>
    );
  }
  return <Card sx={cardSx}>{content}</Card>;
};

export type MonitoringKpiCardKey = 'availability' | 'latency' | 'traffic' | 'error';

/** 가용성 KPI 일부 필드 (차트 선 색상 판정용) */
export type AvailabilityKpiForColor = {
  successRate?: number;
  successRatePercent?: number;
  sloTargetSuccessRate?: number;
  criticalThreshold?: number;
};

/** 지연 시간 KPI 일부 필드 (차트 선 색상 판정용). 숫자가 높을수록 위험(> 사용). 스펙: sloTarget/criticalThreshold(ms) */
export type LatencyKpiForColor = {
  p95Ms?: number;
  sloTarget?: number;
  criticalThreshold?: number;
  sloTargetMs?: number;
  criticalThresholdMs?: number;
};

/** Traffic 차트 선 색상: currentRps(폴백 rpsAvg) 기준, 스펙 §4.3 */
type TrafficKpiForColor = {
  rpsAvg?: number;
  currentRps?: number;
  sloTarget?: number;
  sloTargetRps?: number;
  criticalThreshold?: number;
  criticalThresholdRps?: number;
  loadPercentage?: number;
};

/**
 * 활성 KPI 카드와 동일한 색상을 우측 차트 선에 반영.
 * Availability는 criticalThreshold/sloTarget 기반, Latency는 p95 기반, Traffic은 rpsAvg 기반.
 */
export const getChartLineColorForKpi = (
  activeKpi: MonitoringKpiCardKey | null | undefined,
  availability?: AvailabilityKpiForColor | null,
  latency?: LatencyKpiForColor | null,
  traffic?: TrafficKpiForColor | null
): string => {
  if (!activeKpi) return '#3b82f6';
  switch (activeKpi) {
    case 'availability': {
      const rate = availability?.successRate ?? availability?.successRatePercent;
      const sloTarget = availability?.sloTargetSuccessRate ?? DEFAULT_SLO_TARGET;
      const criticalThreshold = availability?.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD;
      if (rate != null && rate < criticalThreshold) return ERROR_DANGER_COLOR;
      if (rate != null && rate < sloTarget) return WARNING_AMBER_COLOR;
      return '#3b82f6';
    }
    case 'latency': {
      const p95 = latency?.p95Ms;
      const sloMs = latency?.sloTarget ?? latency?.sloTargetMs ?? DEFAULT_LATENCY_SLO_MS;
      const criticalMs = latency?.criticalThreshold ?? latency?.criticalThresholdMs ?? DEFAULT_LATENCY_CRITICAL_MS;
      if (p95 != null && p95 > criticalMs) return ERROR_DANGER_COLOR;
      if (p95 != null && p95 > sloMs) return WARNING_AMBER_COLOR;
      return '#10b981';
    }
    case 'traffic': {
      const currentRps = traffic?.currentRps ?? traffic?.rpsAvg ?? 0;
      const slo = traffic?.sloTarget ?? traffic?.sloTargetRps ?? DEFAULT_TRAFFIC_SLO_RPS;
      const critical = traffic?.criticalThreshold ?? traffic?.criticalThresholdRps ?? DEFAULT_TRAFFIC_CRITICAL_RPS;
      if (currentRps >= critical) return ERROR_DANGER_COLOR;
      if (currentRps >= slo) return WARNING_AMBER_COLOR;
      return TRAFFIC_PURPLE;
    }
    case 'error':
      return ERROR_DANGER_COLOR;
    default:
      return '#3b82f6';
  }
};

type MonitoringKPICardsProps = {
  dateFrom?: string;
  dateTo?: string;
  /** 현재 드릴다운된 KPI → 해당 카드 Border 강조 */
  activeKpi?: MonitoringKpiCardKey | null;
  /** 가용성 도트 클릭 시 해당 timestamp (연동용). 도트·Error 차트 강조 */
  activeTimestamp?: string | null;
  /** 가용성 도트 클릭 콜백. statusHistory 있을 때만 동작. prevTimestamp=직전 도트 시간 */
  onAvailabilityDotClick?: (payload: { timestamp: string; prevTimestamp: string | null }) => void;
  /** KPI 카드 클릭 시 API 히스토리 탭 이동 + 드릴다운 필터 적용 */
  onKpiClick?: (cardKey: MonitoringKpiCardKey) => void;
  /** topCause.path 클릭 시 API 히스토리 탭 이동 + path 필터 + 스크롤 */
  onTopCausePathClick?: (path: string) => void;
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

/** Fallback: kpi null/수치 없음 시 가용성 100.0%, 기타 0 (스펙·기획 가이드) */
const AVAILABILITY_FALLBACK_MAIN = '100.00%';
const AVAILABILITY_FALLBACK_SUB = 'Downtime: 0m';

const DEFAULT_SLO_TARGET = 99.9; // 스펙 Fallback
const DEFAULT_CRITICAL_THRESHOLD = 99.0; // 스펙 Fallback AVAILABILITY_CRITICAL_THRESHOLD

/** uptimeMinutes → "29d 23h 36m" 형식 (스펙: 가동 시간 분) */
const formatUptimeMinutes = (totalMinutes: number): string => {
  if (totalMinutes < 0) return '0m';
  const d = Math.floor(totalMinutes / (60 * 24));
  const h = Math.floor((totalMinutes % (60 * 24)) / 60);
  const m = Math.floor(totalMinutes % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
};

/**
 * 가용성 상태 판정 (우선순위 순).
 * 1) Critical(최우선): successRate < criticalThreshold → Red + [Critical].
 * 2) Warning: successRate < sloTarget → Yellow + [Below SLO].
 * 3) Normal: 그 외 → Blue, 배지 없음.
 * DB 설정 오류로 criticalThreshold > sloTarget 이어도 Critical을 먼저 판정하여 위험 신호가 누락되지 않음.
 */
const formatAvailabilityCard = (kpi: {
  successRate?: number;
  successRatePercent?: number;
  sloTargetSuccessRate?: number;
  criticalThreshold?: number;
  downtimeMinutes?: number;
  uptimeMinutes?: number;
  uptime?: string;
  delta?: { successRatePp?: number };
} | undefined) => {
  if (!kpi) {
    return {
      main: AVAILABILITY_FALLBACK_MAIN,
      sub: AVAILABILITY_FALLBACK_SUB,
      deltaPercent: undefined,
      isSlaCritical: false,
      isSlaWarning: false,
      warningBadgeLabel: undefined,
      sloTargetChip: `SLO ${DEFAULT_SLO_TARGET}%`,
      sloTargetNum: DEFAULT_SLO_TARGET,
      criticalThresholdNum: DEFAULT_CRITICAL_THRESHOLD,
      downtimeCaption: 'Downtime: 0m',
      uptimeCaption: undefined as string | undefined,
    };
  }
  const rate = kpi.successRate ?? kpi.successRatePercent;
  const sloTarget = kpi.sloTargetSuccessRate ?? DEFAULT_SLO_TARGET;
  const criticalThreshold = kpi.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD;
  const main = rate !== undefined && rate !== null ? `${rate.toFixed(2)}%` : AVAILABILITY_FALLBACK_MAIN;
  const downtimeStr = kpi.downtimeMinutes !== undefined && kpi.downtimeMinutes !== null ? `Downtime: ${kpi.downtimeMinutes}m` : AVAILABILITY_FALLBACK_SUB;
  const uptimeStr =
    kpi.uptimeMinutes !== undefined && kpi.uptimeMinutes !== null
      ? `Uptime: ${formatUptimeMinutes(kpi.uptimeMinutes)}`
      : kpi.uptime
        ? `Uptime: ${kpi.uptime}`
          : undefined;
  const sub = uptimeStr ? `${downtimeStr} & ${uptimeStr}` : downtimeStr;
  const deltaPercent = kpi.delta?.successRatePp;
  const isSlaCritical = rate !== undefined && rate !== null && rate < criticalThreshold;
  const isSlaWarning =
    !isSlaCritical && rate !== undefined && rate !== null && sloTarget !== undefined && sloTarget !== null && rate < sloTarget;
  const warningBadgeLabel = isSlaWarning ? 'Below SLO' : undefined;
  const sloTargetChip = `SLO ${sloTarget}%`;
  return {
    main,
    sub,
    deltaPercent,
    isSlaCritical,
    isSlaWarning,
    warningBadgeLabel,
    sloTargetChip,
    sloTargetNum: sloTarget,
    criticalThresholdNum: criticalThreshold,
    downtimeCaption: kpi.downtimeMinutes !== undefined && kpi.downtimeMinutes !== null ? `Downtime: ${kpi.downtimeMinutes}m` : 'Downtime: 0m',
    uptimeCaption: uptimeStr,
  };
};

const DEFAULT_LATENCY_SLO_MS = 500;
const DEFAULT_LATENCY_CRITICAL_MS = 1500;

/**
 * Latency 상태 판정 (숫자가 높을수록 위험 → > 사용).
 * Critical: p95 > criticalThresholdMs (1500ms 초과)
 * Below SLO: p95 > sloTargetMs (500ms 초과)
 * Normal: 그 외
 */
const formatLatencyCard = (kpi: {
  p95Ms?: number;
  p50Ms?: number;
  p99Ms?: number;
  p50Latency?: number;
  p99Latency?: number;
  avgLatency?: number;
  sloTarget?: number;
  criticalThreshold?: number;
  sloTargetMs?: number;
  criticalThresholdMs?: number;
  prevAvgLatency?: number;
  delta?: { p95Ms?: number; p99Ms?: number; p95MsPercent?: number };
} | undefined) => {
  if (!kpi) {
    return {
      main: '0ms',
      sub: 'p50: 0 / p99: 0',
      p50Ms: 0,
      p99Ms: 0,
      p99OverCritical: false,
      deltaPercent: undefined,
      deltaValue: undefined,
      isSlaCritical: false,
      isSlaWarning: false,
      warningBadgeLabel: undefined,
      sloTargetChip: `SLO < ${DEFAULT_LATENCY_SLO_MS}ms`,
    };
  }
  const p95 = kpi.p95Ms !== undefined && kpi.p95Ms !== null ? kpi.p95Ms : 0;
  const p50 = kpi.p50Ms ?? kpi.p50Latency;
  const p99 = kpi.p99Ms ?? kpi.p99Latency;
  const p50Val = p50 !== undefined && p50 !== null ? p50 : 0;
  const p99Val = p99 !== undefined && p99 !== null ? p99 : 0;
  const sloTargetMs = kpi.sloTarget ?? kpi.sloTargetMs ?? DEFAULT_LATENCY_SLO_MS;
  const criticalThresholdMs = kpi.criticalThreshold ?? kpi.criticalThresholdMs ?? DEFAULT_LATENCY_CRITICAL_MS;

  const main = `${p95}ms`;
  const sub = `p50: ${p50Val} / p99: ${p99Val}`;
  const isSlaCritical = p95 > criticalThresholdMs;
  const isSlaWarning = !isSlaCritical && p95 > sloTargetMs;
  const warningBadgeLabel = isSlaWarning ? 'Below SLO' : undefined;
  const sloTargetChip = `SLO < ${sloTargetMs}ms`;
  const p99OverCritical = p99Val > criticalThresholdMs;

  const deltaValue = kpi.delta?.p95Ms;
  const currentAvg = kpi.avgLatency ?? p95;
  const prevAvg = kpi.prevAvgLatency;
  const deltaPercent =
    kpi.delta?.p95MsPercent ??
    (prevAvg != null && prevAvg !== 0 && currentAvg != null
      ? ((currentAvg - prevAvg) / prevAvg) * 100
      : undefined);

  return {
    main,
    sub,
    p50Ms: p50Val,
    p99Ms: p99Val,
    p99OverCritical,
    deltaPercent,
    deltaValue,
    isSlaCritical,
    isSlaWarning,
    warningBadgeLabel,
    sloTargetChip,
  };
};

const TRAFFIC_PURPLE = '#8b5cf6';
/** RPS 기준 상태 색상: sloTarget 미만 Purple, 이상 Yellow, critical 이상 Red. BE 미제공 시 사용할 기본값 */
const DEFAULT_TRAFFIC_SLO_RPS = 100;
const DEFAULT_TRAFFIC_CRITICAL_RPS = 200;

const COUNT_UP_DURATION_MS = 600;

/** 로딩 완료 후 0 → target 으로 카운트업. 소수점 자릿수 지정 가능. */
const useCountUp = (
  target: number,
  enabled: boolean,
  decimals = 1
): number => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setDisplay(0);
      return () => { /* no-op cleanup */ };
    }
    const start = performance.now();
    const startVal = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / COUNT_UP_DURATION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      const value = startVal + (target - startVal) * eased;
      setDisplay(value);
      if (t < 1) requestAnimationFrame(tick);
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, enabled, decimals]);

  return Number(display.toFixed(decimals));
};

/** 1,000 이상이면 1.2K 형태로 포맷 */
const formatCompactNumber = (n: number): { display: string; full: string } => {
  const full = n.toLocaleString();
  if (n >= 1000) {
    const truncated = (n / 1000).toFixed(1).replace(/\.0$/, '');
    return { display: `${truncated}K`, full };
  }
  return { display: full, full };
};

/** Traffic: 메인 지표 currentRps(폴백 rpsAvg), 상태·loadPercentage·SLO 스펙 §4.3 반영 */
const formatTrafficCard = (
  kpi: {
    rpsAvg?: number;
    rpsPeak?: number;
    peakRps?: number;
    currentRps?: number;
    sloTarget?: number;
    sloTargetRps?: number;
    criticalThreshold?: number;
    criticalThresholdRps?: number;
    loadPercentage?: number;
    delta?: { pvDeltaPercent?: number; rpsDeltaPercent?: number };
  } | undefined,
  pv: number,
  uv: number,
  deltaPercent?: number
) => {
  const currentRps = kpi?.currentRps ?? kpi?.rpsAvg;
  const rpsPeak = kpi?.rpsPeak ?? kpi?.peakRps;
  const sloTargetRps = kpi?.sloTarget ?? kpi?.sloTargetRps ?? DEFAULT_TRAFFIC_SLO_RPS;
  const criticalThresholdRps =
    kpi?.criticalThreshold ?? kpi?.criticalThresholdRps ?? DEFAULT_TRAFFIC_CRITICAL_RPS;
  const loadPercentageFromBe = kpi?.loadPercentage;
  const pvF = formatCompactNumber(pv);
  const uvF = formatCompactNumber(uv);
  const isEmpty = currentRps === undefined && rpsPeak === undefined;
  const effectiveDelta =
    kpi?.delta?.rpsDeltaPercent ?? deltaPercent ?? kpi?.delta?.pvDeltaPercent;
  const sloTargetChip = `Target < ${sloTargetRps} RPS`;
  const loadPct =
    loadPercentageFromBe != null
      ? Math.round(loadPercentageFromBe)
      : criticalThresholdRps > 0
        ? Math.round((currentRps ?? 0) / criticalThresholdRps * 100)
        : 0;
  return {
    rpsAvg: isEmpty ? 0 : (currentRps ?? 0),
    rpsPeak: rpsPeak ?? 0,
    sloTargetRps,
    criticalThresholdRps,
    loadPercentage: loadPct,
    sloTargetChip,
    pvFormatted: pvF,
    uvFormatted: uvF,
    deltaPercent: effectiveDelta,
    isEmpty,
  };
};

/** 트래픽 카드 배경 스파크라인: 하단 28% 제한, bottom 밀착, 텍스트와 겹치지 않음 */
const TRAFFIC_SPARKLINE_GRADIENT_ID = 'traffic-sparkline-gradient';

const TrafficSparklineLayer = ({
  values,
  color,
  maxPeakRatio = 0.6,
}: {
  values: number[] | null;
  color: string;
  maxPeakRatio?: number;
}) => {
  const flatLine = values == null || values.length === 0 || values.every((v) => v === 0);
  const points: number[] = flatLine ? Array.from({ length: 12 }, () => 0) : sampleValues(values ?? [], 12);
  const safePoints = points.length >= 2 ? points : [0, 0];
  const { linePath, areaPath } = getSparklinePaths(safePoints, maxPeakRatio);
  const isRed = color === ERROR_DANGER_COLOR;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        maxHeight: '28%',
        height: '28%',
        zIndex: 0,
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        sx={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id={TRAFFIC_SPARKLINE_GRADIENT_ID} x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={isRed ? 0.12 : 0.1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${TRAFFIC_SPARKLINE_GRADIENT_ID})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeOpacity={isRed ? 0.6 : 0.45} />
      </Box>
    </Box>
  );
};

/** Traffic 전용 카드: currentRps 메인 지표, 상태·Load% 스펙 §4.3 */
const TrafficCard = ({
  rpsAvg,
  rpsPeak,
  loadPercentage: loadPercentageProp,
  sloTargetChip,
  sloTargetRps,
  criticalThresholdRps,
  pvFormatted,
  uvFormatted,
  deltaPercent,
  isEmpty,
  sparklineValues,
  isLoading,
  isActive,
  onClick,
}: {
  rpsAvg?: number;
  rpsPeak?: number;
  /** 부하율(%). BE 제공 시 우선, 없으면 FE 계산 */
  loadPercentage?: number;
  sloTargetChip: string;
  sloTargetRps: number;
  criticalThresholdRps: number;
  pvFormatted: { display: string; full: string };
  uvFormatted: { display: string; full: string };
  deltaPercent?: number;
  isEmpty: boolean;
  sparklineValues: number[] | null;
  isLoading: boolean;
  isActive: boolean;
  onClick?: () => void;
}) => {
  const currentRps = rpsAvg ?? 0;
  const isCritical = currentRps >= criticalThresholdRps;
  const isWarning = currentRps >= sloTargetRps && !isCritical;
  const rpsColor = isCritical ? ERROR_DANGER_COLOR : isWarning ? WARNING_AMBER_COLOR : TRAFFIC_PURPLE;
  const warningBadgeLabel = isCritical ? 'Over Capacity' : isWarning ? 'Below SLO' : undefined;

  const countUpEnabled = !isLoading && !isEmpty;
  const rpsAnimated = useCountUp(rpsAvg ?? 0, countUpEnabled, 1);
  const rpsDisplay = (countUpEnabled ? rpsAnimated : rpsAvg ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const loadPercentage =
    loadPercentageProp ??
    (criticalThresholdRps > 0 ? Math.round((currentRps / criticalThresholdRps) * 100) : 0);
  const peakStr =
    rpsPeak != null
      ? rpsPeak.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
      : '-';
  const footerLine = `PV ${pvFormatted.display} · UV ${uvFormatted.display} · Peak ${peakStr} (Load ${loadPercentage}%)`;

  const content = (
    <>
      <Box sx={{ height: 4, bgcolor: rpsColor }} />
      <Box
        sx={{
          p: 2.5,
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          ...(sparklineValues && sparklineValues.length > 0 ? { pb: 6 } : {}),
        }}
      >
        {/* 1행: 가용성/Latency와 동일 — Stack alignItems=center, SLO 칩 절대 중앙, 우측 메인값 ml:auto */}
        <Stack direction="row" alignItems="center" sx={{ position: 'relative' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon="solar:chart-2-bold" width={22} sx={{ color: rpsColor }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
              Traffic
            </Typography>
          </Stack>
          {sloTargetChip && (
            <Chip
              label={sloTargetChip}
              size="small"
              sx={{
                height: 22,
                typography: 'caption',
                fontWeight: 600,
                bgcolor: alpha(rpsColor, 0.12),
                color: 'text.secondary',
                border: '1px solid',
                borderColor: alpha(rpsColor, 0.3),
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          )}
          {isLoading ? (
            <Skeleton variant="text" width={80} height={40} sx={{ ml: 'auto' }} />
          ) : (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ ml: 'auto' }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: 28, md: 32 },
                  lineHeight: 1,
                  fontFamily: '"Inter", "Pretendard", sans-serif',
                  color: isEmpty ? 'text.secondary' : rpsColor,
                }}
              >
                {rpsDisplay}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase' }}>
                RPS
              </Typography>
            </Stack>
          )}
        </Stack>
        {/* 2행: 가용성/Latency와 동일 — 배지(향후 노출 시 동일 스타일) + InlineDelta, trendText */}
        {!isLoading && (
          <Stack direction="column" alignItems="flex-end" spacing={0.75}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" justifyContent="flex-end" gap={1}>
              {isCritical && (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    typography: 'caption',
                    fontWeight: 700,
                    bgcolor: alpha(ERROR_DANGER_COLOR, 0.08),
                    color: ERROR_DANGER_COLOR,
                    border: '1px solid',
                    borderColor: alpha(ERROR_DANGER_COLOR, 0.35),
                  }}
                >
                  Over Capacity
                </Box>
              )}
              {isWarning && warningBadgeLabel && !isCritical && (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 0.5,
                    typography: 'caption',
                    fontWeight: 700,
                    bgcolor: alpha(WARNING_AMBER_COLOR, 0.12),
                    color: WARNING_AMBER_COLOR,
                    border: '1px solid',
                    borderColor: alpha(WARNING_AMBER_COLOR, 0.4),
                  }}
                >
                  {warningBadgeLabel}
                </Box>
              )}
              <InlineDelta
                deltaPercent={deltaPercent}
                deltaPositiveIsBad={false}
                colorOverride={undefined}
              />
            </Stack>
          </Stack>
        )}
        {/* 3행: 가용성 subRow와 동일 — PV · UV · Peak 한 줄, 좌측 정렬 */}
        {!isLoading && (
          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              bgcolor: 'background.paper',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              alignSelf: 'flex-start',
            }}
          >
            <Tooltip title={`PV ${pvFormatted.full}, UV ${uvFormatted.full}`}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                }}
              >
                {footerLine}
              </Typography>
            </Tooltip>
          </Box>
        )}
      </Box>
      {sparklineValues && sparklineValues.length > 0 && (
        <TrafficSparklineLayer values={sparklineValues} color={rpsColor} maxPeakRatio={0.6} />
      )}
    </>
  );

  const cardSx = {
    position: 'relative' as const,
    overflow: 'hidden',
    borderRadius: 2,
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
    bgcolor: 'background.paper',
    minHeight: 180,
    ...(isActive
      ? {
          border: `2px solid ${rpsColor}`,
          boxShadow: `0 0 0 1px ${alpha(rpsColor, 0.3)}`,
        }
      : {}),
    ...(onClick ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}),
  };

  if (onClick) {
    return (
      <Card role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()} sx={cardSx}>
        {content}
      </Card>
    );
  }
  return <Card sx={cardSx}>{content}</Card>;
};

const ERROR_BUDGET_REMAINING_LOW_THRESHOLD = 20; // 잔여량 < 20% → Red
const ERROR_BUDGET_REMAINING_HIGH_THRESHOLD = 80; // 잔여량 >= 80% → Green, 20~80% → Yellow
const ERROR_SLO_TARGET_RATE = 0.5; // Target < 0.5%

/** Error: 메인 errorRate(≈rate5xx) | errorBudgetRemaining·burnRate 스펙 §4.4 반영 */
const formatErrorCard = (
  kpi: {
    count4xx?: number;
    count5xx?: number;
    errorCounts?: { count4xx?: number; count5xx?: number };
    rate5xx?: number;
    errorRate?: number;
    consumedRatio?: number;
    budget?: { consumedRatio?: number };
    errorBudgetRemaining?: number;
    burnRate?: number;
    errorBudgetWeekBurnPercent?: number;
    errorBudgetMonthBurnPercent?: number;
    delta?: { rate5xxPp?: number };
  } | undefined,
  apiErrorRate?: number,
  rate5xxPp?: number
) => {
  const mainRate = kpi?.errorRate ?? kpi?.rate5xx ?? apiErrorRate;
  const main = mainRate !== undefined && mainRate !== null ? `${mainRate.toFixed(2)}%` : '0.00%';
  const budgetConsumed = kpi?.budget?.consumedRatio;
  const consumedRatio =
    kpi?.consumedRatio ??
    (budgetConsumed != null ? budgetConsumed : undefined) ??
    (kpi?.errorBudgetMonthBurnPercent != null ? kpi.errorBudgetMonthBurnPercent / 100 : undefined) ??
    (kpi?.errorBudgetWeekBurnPercent != null ? kpi.errorBudgetWeekBurnPercent / 100 : undefined);
  const remainingFromBe = kpi?.errorBudgetRemaining;
  const remainingPercent =
    remainingFromBe != null
      ? Math.round(Math.max(0, remainingFromBe))
      : consumedRatio != null
        ? Math.round((1 - Math.min(1, consumedRatio)) * 100)
        : undefined;
  const burnRate = kpi?.burnRate;
  const trendPp = rate5xxPp ?? kpi?.delta?.rate5xxPp;
  const trendText =
    trendPp !== undefined && trendPp !== null
      ? `전일 대비 ${trendPp >= 0 ? '+' : ''}${trendPp.toFixed(1)}pp`
      : undefined;
  const trendTextDanger = trendPp != null && trendPp > 0;
  const count4xx = kpi?.errorCounts?.count4xx ?? kpi?.count4xx ?? 0;
  const count5xx = kpi?.errorCounts?.count5xx ?? kpi?.count5xx ?? 0;
  const subRow = `4xx: ${count4xx} · 5xx: ${count5xx}`;
  const isDanger = mainRate != null && mainRate > 3;
  const isOverConsumed = consumedRatio != null && consumedRatio >= 1;
  const isBudgetExhausted = remainingPercent != null && remainingPercent <= 0;
  const isBudgetLow =
    (remainingPercent != null &&
      remainingPercent <= ERROR_BUDGET_REMAINING_LOW_THRESHOLD &&
      !isBudgetExhausted) ||
    (burnRate != null && burnRate >= 1.0 && !isBudgetExhausted);
  const slaCritical = isBudgetExhausted;
  const slaWarning = isBudgetLow;
  const warningBadgeLabel = isBudgetExhausted ? 'Budget Exhausted' : isBudgetLow ? 'Budget Low' : undefined;
  const sloTargetChip = `Target < ${ERROR_SLO_TARGET_RATE}%`;
  return {
    main,
    consumedRatio,
    remainingPercent: remainingPercent ?? 100,
    trendText,
    trendTextDanger,
    subRow,
    isDanger,
    isOverConsumed,
    slaCritical,
    slaWarning,
    warningBadgeLabel,
    sloTargetChip,
  };
};

export const MonitoringKPICards = ({
  dateFrom,
  dateTo,
  activeKpi,
  activeTimestamp,
  onAvailabilityDotClick,
  onKpiClick,
  onTopCausePathClick,
}: MonitoringKPICardsProps) => {
  const { from, to } = useMemo(() => {
    if (dateFrom && dateTo) return { from: dateFrom, to: dateTo };
    const kstRange = getDateRangeFromPeriod('24h');
    return {
      from: kstIsoToUtcIso(kstRange.from),
      to: kstIsoToUtcIso(kstRange.to),
    };
  }, [dateFrom, dateTo]);

  const { data, isLoading, error, refetch } = useMonitoringSummaryQuery({ from, to });

  /** 차트: from/to 기준 interval(1m|5m|1h|1d) 적용. Peak RPS는 BE TRAFFIC_PEAK_WINDOW_SECONDS 기준 rpsPeak 사용. */
  const sparklineInterval = useMemo(
    () => getTimeseriesIntervalFromRange(from, to),
    [from, to]
  );

  const apiTotalTimeseriesQuery = useMonitoringTimeseriesQuery({ from, to, interval: sparklineInterval, metric: 'API_TOTAL' });
  const apiErrorTimeseriesQuery = useMonitoringTimeseriesQuery({ from, to, interval: sparklineInterval, metric: 'API_ERROR' });
  const latencyTimeseriesQuery = useMonitoringTimeseriesQuery({
    from,
    to,
    interval: sparklineInterval,
    metric: 'LATENCY_P95',
  });

  /** 트래픽 카드 배경 차트: 시간대별 API_TOTAL(초당 요청 수 추이) 사용 */
  const trafficSparkline = useMemo(
    () => buildSparkline(extractValues(apiTotalTimeseriesQuery.data)),
    [apiTotalTimeseriesQuery.data]
  );
  const latencySparkline = useMemo(
    () => buildSparkline(extractValues(latencyTimeseriesQuery.data)),
    [latencyTimeseriesQuery.data]
  );
  /** 에러 카드 배경: API_ERROR 건수 시계열(Spike 가시성), 전부 0이면 Zero-filling으로 바닥에 평평히 표시 */
  const errorSparkline = useMemo(() => {
    const values = extractValues(apiErrorTimeseriesQuery.data);
    const built = buildSparkline(values);
    return built ?? Array.from({ length: 12 }, () => 0);
  }, [apiErrorTimeseriesQuery.data]);
  /** 폴백: statusHistory 없을 때 Timeseries 기반 48샘플 (도트·차트 공통) */
  const availabilityFallback48 = useMemo(() => {
    const errRates = buildRateValues(apiTotalTimeseriesQuery.data, apiErrorTimeseriesQuery.data);
    if (!errRates.length) return [];
    return sampleValues(errRates.map((r) => 100 - r), 48);
  }, [apiTotalTimeseriesQuery.data, apiErrorTimeseriesQuery.data]);

  /** 도트용 Single Source: statusHistory 우선, 없으면 fallback 48. */
  const availabilityDotHistory = useMemo(() => {
    const history = data?.kpi?.availability?.statusHistory;
    if (history == null || history.length === 0) return undefined;
    return sampleDots(history, MAX_DOTS);
  }, [data?.kpi?.availability?.statusHistory]);

  const availabilityDotValues = useMemo(
    () => (availabilityDotHistory != null ? [] : availabilityFallback48),
    [availabilityDotHistory, availabilityFallback48]
  );

  /** 스파크라인용: 도트와 1:1 동일 소스. 도트가 있으면 차트 데이터도 항상 있음. undefined/NaN → 0으로 정규화. */
  const availabilityChartData = useMemo(() => {
    if (availabilityDotHistory != null) {
      return availabilityDotHistory.map((s) =>
        typeof s.availability === 'number' && !Number.isNaN(s.availability) ? s.availability : 0
      );
    }
    if (availabilityDotValues.length > 0) return availabilityDotValues;
    return null;
  }, [availabilityDotHistory, availabilityDotValues]);

  if (error) {
    return <ApiErrorAlert error={error} onRetry={() => refetch()} />;
  }

  const kpi = data?.kpi;
  const pv = data?.pv ?? 0;
  const uv = data?.uv ?? 0;
  const apiErrorRate = data?.apiErrorRate;
  const apiErrorDeltaPercent = data?.apiErrorDeltaPercent ?? data?.apiErrorRateTrend;
  const rate5xxPp = data?.rate5xxPp ?? kpi?.error?.delta?.rate5xxPp;

  const trafficDeltaPercent = data?.pvDeltaPercent ?? kpi?.traffic?.delta?.pvDeltaPercent;

  const avail = formatAvailabilityCard(kpi?.availability);
  const latency = formatLatencyCard(kpi?.latency);
  const traffic = formatTrafficCard(kpi?.traffic, pv, uv, trafficDeltaPercent);
  const errorCard = formatErrorCard(kpi?.error, apiErrorRate, rate5xxPp);

  const availRateNum = kpi?.availability?.successRate ?? kpi?.availability?.successRatePercent;
  const availSloProgressColor =
    avail.isSlaCritical ? ERROR_DANGER_COLOR : avail.isSlaWarning ? WARNING_AMBER_COLOR : AVAILABILITY_SUCCESS_COLOR;
  const availSloProgressValue =
    availRateNum != null && avail.sloTargetNum != null && avail.sloTargetNum > 0
      ? Math.min(100, (availRateNum / avail.sloTargetNum) * 100)
      : undefined;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="Availability"
          mainValue={avail.main}
          subRowNode={
            <Box>
              {/* Row 1: Downtime/Uptime(좌) | Top Cause(우) - 양끝 정렬 */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                  mb: 2,
                  minHeight: 20,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', flexShrink: 0 }}>
                  {avail.uptimeCaption ? `${avail.downtimeCaption} | ${avail.uptimeCaption}` : avail.downtimeCaption}
                </Typography>
                <TopCauseInsight topCause={kpi?.availability?.topCause} onPathClick={onTopCausePathClick} />
              </Box>
              {/* Row 2: 도트 시작/끝 = 스파크라인 시작/끝과 일치 (동일 Drawing Area = 카드 전체 너비) */}
              <Box
                sx={{
                  width: (t) => `calc(100% + 2 * ${t.spacing(3.25)})`,
                  marginLeft: (t) => t.spacing(-3.25),
                  marginRight: (t) => t.spacing(-3.25),
                }}
              >
                <AvailabilityHealthBar
                  values={availabilityDotValues}
                  statusHistory={availabilityDotHistory}
                  sloTarget={avail.sloTargetNum}
                  criticalThreshold={avail.criticalThresholdNum}
                  downtimeCaption={avail.downtimeCaption}
                  uptimeCaption={avail.uptimeCaption}
                  showCaption={false}
                  activeTimestamp={activeTimestamp ?? undefined}
                  onDotClick={onAvailabilityDotClick}
                />
              </Box>
            </Box>
          }
          deltaPercent={avail.deltaPercent}
          icon="solar:check-circle-bold"
          color={
            avail.isSlaCritical
              ? ERROR_DANGER_COLOR
              : avail.isSlaWarning
                ? WARNING_AMBER_COLOR
                : '#3b82f6'
          }
          deltaColor={
            avail.isSlaCritical
              ? ERROR_DANGER_COLOR
              : avail.isSlaWarning
                ? WARNING_AMBER_COLOR
                : undefined
          }
          isLoading={isLoading}
          slaCritical={avail.isSlaCritical}
          slaWarning={avail.isSlaWarning}
          warningBadgeLabel={avail.warningBadgeLabel}
          sloTargetChip={avail.sloTargetChip}
          sparkline={availabilityChartData}
          sparklineMaxPeakRatio={0.6}
          sparklineZeroFill
          mainValueSupplement={
            availSloProgressValue !== undefined ? (
              <LinearProgress
                variant="determinate"
                value={availSloProgressValue}
                sx={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: alpha(availSloProgressColor, 0.12),
                  '& .MuiLinearProgress-bar': { bgcolor: availSloProgressColor },
                }}
              />
            ) : undefined
          }
          isActive={activeKpi === 'availability'}
          onClick={onKpiClick ? () => onKpiClick('availability') : undefined}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="Latency"
          mainValue={latency.main}
          subRow={latency.sub}
          subRowNode={
            <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', display: 'block' }} component="span">
              p50: {latency.p50Ms} /{' '}
              <Tooltip title="상위 1% 사용자가 경험하는 최악의 지연 시간입니다">
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    color: latency.p99OverCritical ? ERROR_DANGER_COLOR : 'text.secondary',
                    cursor: 'help',
                  }}
                >
                  p99: {latency.p99Ms}ms
                </Typography>
              </Tooltip>
            </Typography>
          }
          deltaPercent={latency.deltaPercent}
          deltaValue={latency.deltaValue}
          deltaPositiveIsBad
          icon="solar:clock-circle-bold"
          color={
            latency.isSlaCritical
              ? ERROR_DANGER_COLOR
              : latency.isSlaWarning
                ? WARNING_AMBER_COLOR
                : '#10b981'
          }
          deltaColor={
            latency.isSlaCritical
              ? ERROR_DANGER_COLOR
              : latency.isSlaWarning
                ? WARNING_AMBER_COLOR
                : undefined
          }
          slaCritical={latency.isSlaCritical}
          slaWarning={latency.isSlaWarning}
          warningBadgeLabel={latency.warningBadgeLabel}
          sloTargetChip={latency.sloTargetChip}
          sparkline={latencySparkline}
          sparklineMaxPeakRatio={0.6}
          deltaUnit="ms"
          isLoading={isLoading}
          isActive={activeKpi === 'latency'}
          onClick={onKpiClick ? () => onKpiClick('latency') : undefined}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <TrafficCard
          isEmpty={traffic.isEmpty}
          rpsAvg={traffic.rpsAvg}
          rpsPeak={traffic.rpsPeak}
          loadPercentage={traffic.loadPercentage}
          sloTargetChip={traffic.sloTargetChip}
          sloTargetRps={traffic.sloTargetRps}
          criticalThresholdRps={traffic.criticalThresholdRps}
          pvFormatted={traffic.pvFormatted}
          uvFormatted={traffic.uvFormatted}
          deltaPercent={traffic.deltaPercent}
          sparklineValues={trafficSparkline}
          isLoading={isLoading}
          isActive={activeKpi === 'traffic'}
          onClick={onKpiClick ? () => onKpiClick('traffic') : undefined}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MonitoringCard
          title="Error"
          mainValue={errorCard.main}
          subRow={errorCard.subRow}
          deltaPercent={apiErrorDeltaPercent}
          deltaPositiveIsBad
          trendText={errorCard.trendText}
          trendTextDanger={errorCard.trendTextDanger}
          consumedRatio={errorCard.consumedRatio}
          isOverConsumed={errorCard.isOverConsumed}
          remainingPercent={errorCard.remainingPercent}
          isDanger={errorCard.isDanger}
          slaCritical={errorCard.slaCritical}
          slaWarning={errorCard.slaWarning}
          warningBadgeLabel={errorCard.warningBadgeLabel}
          sloTargetChip={errorCard.sloTargetChip}
          icon="solar:danger-triangle-bold"
          color={
            errorCard.slaCritical
              ? ERROR_DANGER_COLOR
              : errorCard.slaWarning
                ? WARNING_AMBER_COLOR
                : '#3b82f6'
          }
          isLoading={isLoading}
          sparkline={errorSparkline}
          sparklineStrokeWidth={3}
          sparklineMaxPeakRatio={0.6}
          sparklineZeroFill
          isActive={activeKpi === 'error'}
          onClick={onKpiClick ? () => onKpiClick('error') : undefined}
        />
      </Grid>
    </Grid>
  );
};
