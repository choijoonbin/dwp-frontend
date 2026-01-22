import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MonitoringTabs } from './monitoring-tabs';
import { MonitoringCharts } from './monitoring-charts';
import { MonitoringKPICards } from './monitoring-kpi-cards';
import { MonitoringFilterBar } from './monitoring-filter-bar';

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

export const MonitoringPage = () => {
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

  // Update dateFrom/dateTo when period changes
  useEffect(() => {
    const dateRange = getDateRangeFromPeriod(filters.period);
    setFilters((prev) => ({
      ...prev,
      dateFrom: isoToDatetimeLocal(dateRange.from),
      dateTo: isoToDatetimeLocal(dateRange.to),
    }));
    savePeriodToStorage(filters.period);
  }, [filters.period]);

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters };
      // If period changed, update dates automatically
      if (newFilters.period && newFilters.period !== prev.period) {
        const dateRange = getDateRangeFromPeriod(newFilters.period);
        updated.dateFrom = isoToDatetimeLocal(dateRange.from);
        updated.dateTo = isoToDatetimeLocal(dateRange.to);
        savePeriodToStorage(newFilters.period);
      }
      return updated;
    });
  };

  const handleReset = () => {
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

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack spacing={1}>
          <Typography variant="h4">통합 모니터링 대시보드</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            시스템 사용 현황 및 API 모니터링을 확인할 수 있습니다.
          </Typography>
        </Stack>

        {/* Filter Bar */}
        <Card sx={{ p: 2 }}>
          <MonitoringFilterBar filters={filters} onChange={handleFilterChange} onReset={handleReset} />
        </Card>

        {/* KPI Cards */}
        <MonitoringKPICards
          dateFrom={filters.dateFrom ? datetimeLocalToIso(filters.dateFrom) : chartDateRange.from}
          dateTo={filters.dateTo ? datetimeLocalToIso(filters.dateTo) : chartDateRange.to}
        />

        {/* Charts */}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          <Card sx={{ flex: 1, p: 3 }}>
            <MonitoringCharts type="pv-uv" from={chartDateRange.from} to={chartDateRange.to} />
          </Card>
          <Card sx={{ flex: 1, p: 3 }}>
            <MonitoringCharts type="api" from={chartDateRange.from} to={chartDateRange.to} />
          </Card>
        </Stack>

        {/* Detail Tabs */}
        <Card sx={{ p: 3 }}>
          <MonitoringTabs filters={filters} />
        </Card>
      </Stack>
    </Box>
  );
};
