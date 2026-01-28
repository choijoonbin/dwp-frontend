import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MonitoringTabs } from './monitoring-tabs';
import { AuraInsightBar } from './aura-insight-bar';
import { MonitoringCharts } from './monitoring-charts';
import { MonitoringFilterBar } from './monitoring-filter-bar';
import { MonitoringKPICards, type MonitoringKpiCardKey } from './monitoring-kpi-cards';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'monitoring_period';

/**
 * Load period from localStorage, default to '24h'
 */
const loadPeriodFromStorage = (): '1h' | '24h' | '7d' | '30d' => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1h' || saved === '24h' || saved === '7d' || saved === '30d') {
      return saved;
    }
  } catch {
    // Ignore localStorage errors
  }
  return '24h';
};

/**
 * Save period to localStorage
 */
const savePeriodToStorage = (period: '1h' | '24h' | '7d' | '30d') => {
  try {
    localStorage.setItem(STORAGE_KEY, period);
  } catch {
    // Ignore localStorage errors
  }
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
 * Note: This returns a string that represents KST time but without timezone indicator
 * The backend should interpret this as KST or convert accordingly
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
 * Convert ISO 8601 datetime string (KST) to datetime-local input format (YYYY-MM-DDTHH:mm)
 * Assumes input is in KST timezone
 */
const isoToDatetimeLocal = (isoString: string): string => isoString.slice(0, 16); // 'YYYY-MM-DDTHH:mm'

/**
 * Convert datetime-local input format to ISO 8601
 * datetime-local input provides time without timezone info
 * 
 * The input value from datetime-local is in format "YYYY-MM-DDTHH:mm"
 * We treat this as KST time and convert to UTC for backend (backend expects UTC)
 * 
 * Example: Input "2026-01-20T17:44" (KST) -> Output "2026-01-20T08:44:00" (UTC)
 */
const datetimeLocalToIso = (localString: string): string => {
  if (!localString) return '';
  // Add seconds if not present
  const withSeconds = localString.length === 16 ? `${localString}:00` : localString;
  
  // Parse as KST time components
  const [datePart, timePart] = withSeconds.split('T');
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
  
  // Return UTC time in ISO format (backend expects UTC)
  return `${utcYear}-${utcMonth}-${utcDay}T${utcHours}:${utcMinutes}:${utcSeconds}`;
};

const API_HISTORY_TAB_INDEX = 3;
const PAGE_VIEWS_TAB_INDEX = 0;

export const MonitoringPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [activeKpi, setActiveKpi] = useState<MonitoringKpiCardKey | null>(null);
  const [chartTimeRange, setChartTimeRange] = useState<{ from: string; to: string } | null>(null);
  const [filters, setFilters] = useState(() => {
    const savedPeriod = loadPeriodFromStorage();
    const dateRange = getDateRangeFromPeriod(savedPeriod);
    return {
      period: savedPeriod,
      dateFrom: isoToDatetimeLocal(dateRange.from),
      dateTo: isoToDatetimeLocal(dateRange.to),
      route: '',
      menu: '',
      path: '',
      userId: '',
      apiName: '',
      apiUrl: '',
      statusCode: '',
    };
  });

  // Update dateFrom/dateTo when period changes; clear 좌측 차트 시간대 필터
  useEffect(() => {
    const dateRange = getDateRangeFromPeriod(filters.period);
    setFilters((prev) => ({
      ...prev,
      dateFrom: isoToDatetimeLocal(dateRange.from),
      dateTo: isoToDatetimeLocal(dateRange.to),
    }));
    setChartTimeRange(null);
    savePeriodToStorage(filters.period);
  }, [filters.period]);

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters };
      if (newFilters.period && newFilters.period !== prev.period) {
        const dateRange = getDateRangeFromPeriod(newFilters.period);
        updated.dateFrom = isoToDatetimeLocal(dateRange.from);
        updated.dateTo = isoToDatetimeLocal(dateRange.to);
        savePeriodToStorage(newFilters.period);
      }
      return updated;
    });
    if (newFilters.dateFrom != null || newFilters.dateTo != null) setChartTimeRange(null);
  };

  const handleTabChange = (tab: number) => {
    setActiveTab(tab);
    if (tab !== API_HISTORY_TAB_INDEX) setActiveKpi(null);
    // Page Views 탭은 path/keyword 미지원. Top Cause 등으로 설정된 path가 그대로 전달되면
    // page-views API 호출 시 결과 없음 발생 → 전환 시 path 초기화.
    if (tab === PAGE_VIEWS_TAB_INDEX) {
      setFilters((prev) => (prev.path ? { ...prev, path: '' } : prev));
    }
  };

  const handleReset = () => {
    setActiveKpi(null);
    setChartTimeRange(null);
    const defaultPeriod = '24h';
    const dateRange = getDateRangeFromPeriod(defaultPeriod);
    setFilters({
      period: defaultPeriod,
      dateFrom: isoToDatetimeLocal(dateRange.from),
      dateTo: isoToDatetimeLocal(dateRange.to),
      route: '',
      menu: '',
      path: '',
      userId: '',
      apiName: '',
      apiUrl: '',
      statusCode: '',
    });
    savePeriodToStorage(defaultPeriod);
  };

  // Memoize date range to prevent infinite re-renders
  // Use period-based calculation if dateFrom/dateTo are empty, otherwise use provided dates
  // Backend expects UTC, so convert KST to UTC
  const chartDateRange = useMemo(() => {
    if (filters.dateFrom && filters.dateTo) {
      return {
        from: datetimeLocalToIso(filters.dateFrom),
        to: datetimeLocalToIso(filters.dateTo),
      };
    }
    // getDateRangeFromPeriod returns KST, convert to UTC for backend
    const kstRange = getDateRangeFromPeriod(filters.period);
    return {
      from: kstIsoToUtcIso(kstRange.from),
      to: kstIsoToUtcIso(kstRange.to),
    };
  }, [filters.dateFrom, filters.dateTo, filters.period]);

  // TopCause 클릭 시 path로 스크롤하는 공통 함수 (클릭마다 실행 보장)
  const scrollToApiPath = useCallback((path: string) => {
    let attemptCount = 0;
    const maxAttempts = 10;
    const attemptInterval = 200;

    const scrollToPath = () => {
      attemptCount += 1;
      const tableRow = document.querySelector(`[data-api-path="${path}"]`);
      if (tableRow) {
        // MonitoringTabs 영역으로 먼저 스크롤
        const tabsSection = document.querySelector('[data-testid="page-admin-monitoring"]')?.querySelector('div[role="tabpanel"]');
        if (tabsSection) {
          (tabsSection as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // 약간의 지연 후 해당 행으로 정확히 스크롤
        setTimeout(() => {
          tableRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 하이라이트 효과
          (tableRow as HTMLElement).style.transition = 'background-color 0.3s';
          (tableRow as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
          setTimeout(() => {
            (tableRow as HTMLElement).style.backgroundColor = '';
          }, 2000);
        }, 300);
      } else if (attemptCount < maxAttempts) {
        // 테이블이 아직 렌더링되지 않았으면 재시도
        setTimeout(scrollToPath, attemptInterval);
      }
    };

    // 첫 시도는 약간의 지연 후 시작 (탭 전환 완료 대기)
    setTimeout(scrollToPath, 300);
  }, []);

  // TopCause 클릭 시 path 필터 적용 후 스크롤 이동 (useEffect는 다른 경로로 path 변경 시 대비)
  useEffect(() => {
    if (activeTab === API_HISTORY_TAB_INDEX && filters.path && activeKpi === 'availability') {
      scrollToApiPath(filters.path);
    }
  }, [activeTab, filters.path, activeKpi, scrollToApiPath]);

  return (
    <Box data-testid="page-admin-monitoring" sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack spacing={1}>
          <Typography variant="h4">통합 모니터링 대시보드</Typography>
        </Stack>

        <AuraInsightBar
          insightText="Aura 분석 결과: 현재 전체적인 트래픽은 안정적이나, 특정 IP에서의 반복적인 로그인 시도가 감지되었습니다. 보안 로그 확인을 권장합니다."
          status="warning"
        />

        {/* Filter Bar */}
        <Card sx={{ p: 2 }}>
          <MonitoringFilterBar filters={filters} onChange={handleFilterChange} onReset={handleReset} />
        </Card>

        {/* KPI Cards: SLI/SLO 4종, 클릭 시 API 히스토리 탭 + 드릴다운 필터, Active State Border */}
        <MonitoringKPICards
          dateFrom={filters.dateFrom ? datetimeLocalToIso(filters.dateFrom) : chartDateRange.from}
          dateTo={filters.dateTo ? datetimeLocalToIso(filters.dateTo) : chartDateRange.to}
          activeKpi={activeTab === API_HISTORY_TAB_INDEX ? activeKpi : null}
          onKpiClick={(cardKey) => {
            setActiveKpi(cardKey);
            setActiveTab(API_HISTORY_TAB_INDEX);
            if (cardKey === 'error') setFilters((prev) => ({ ...prev, statusCode: '4xx,5xx' }));
            else if (cardKey === 'availability') setFilters((prev) => ({ ...prev, statusCode: '5xx' }));
            else if (cardKey === 'latency' || cardKey === 'traffic') setFilters((prev) => ({ ...prev, statusCode: '' }));
          }}
          onTopCausePathClick={(path) => {
            // API 히스토리 탭으로 이동
            setActiveTab(API_HISTORY_TAB_INDEX);
            setActiveKpi('availability');
            // path 필터 + 5xx 상태 코드 필터 설정
            setFilters((prev) => ({
              ...prev,
              path,
              statusCode: '5xx',
            }));
            // 클릭마다 스크롤 실행 보장 (같은 path 재클릭 시에도 동작)
            // 탭 전환 및 테이블 렌더링 대기 시간을 두고 실행
            setTimeout(() => {
              scrollToApiPath(path);
            }, 500);
          }}
        />

        {/* Charts */}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          <Card sx={{ flex: 1, p: 3 }}>
            <MonitoringCharts
              type="pv-uv"
              from={chartDateRange.from}
              to={chartDateRange.to}
              onPvUvRangeSelect={(fromIso, toIso) => {
                setChartTimeRange({ from: fromIso, to: toIso });
                setActiveTab(API_HISTORY_TAB_INDEX);
              }}
            />
          </Card>
          <Card sx={{ flex: 1, p: 3 }}>
            <MonitoringCharts
              activeKpi={activeKpi}
              forcedRightMetric={
                activeKpi === 'availability' || activeKpi === 'error'
                  ? 'API_5XX'
                  : activeKpi === 'latency'
                    ? 'LATENCY_P95'
                    : activeKpi === 'traffic'
                      ? 'API_TOTAL'
                      : undefined
              }
              type="api"
              from={chartDateRange.from}
              to={chartDateRange.to}
            />
          </Card>
        </Stack>

        {/* Detail Tabs */}
        <Card sx={{ p: 3 }}>
          <MonitoringTabs
            activeKpi={activeKpi}
            activeTab={activeTab}
            chartTimeRangeOverride={chartTimeRange}
            filters={filters}
            onTabChange={handleTabChange}
          />
        </Card>
      </Stack>
    </Box>
  );
};
