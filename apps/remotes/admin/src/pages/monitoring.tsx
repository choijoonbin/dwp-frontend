import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import { MonitoringTabs } from './monitoring-tabs';
import { MonitoringCharts } from './monitoring-charts';
import { MonitoringKPICards } from './monitoring-kpi-cards';
import { MonitoringFilterBar } from './monitoring-filter-bar';

// ----------------------------------------------------------------------

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

export const MonitoringPage = () => {
  const [filters, setFilters] = useState({
    period: '24h' as '1h' | '24h' | '7d' | '30d',
    dateFrom: '',
    dateTo: '',
    route: '',
    menu: '',
    path: '',
    userId: '',
    apiName: '',
    apiUrl: '',
    statusCode: '',
  });

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Filters change will trigger refetch via query key dependencies
  };

  const handleReset = () => {
    setFilters({
      period: '24h',
      dateFrom: '',
      dateTo: '',
      route: '',
      menu: '',
      path: '',
      userId: '',
      apiName: '',
      apiUrl: '',
      statusCode: '',
    });
  };

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
        <MonitoringKPICards dateFrom={filters.dateFrom || undefined} dateTo={filters.dateTo || undefined} />

        {/* Charts */}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
          <Card sx={{ flex: 1, p: 3 }}>
            <MonitoringCharts
              type="pv-uv"
              from={filters.dateFrom ? new Date(filters.dateFrom).toISOString() : getDateRangeFromPeriod(filters.period).from}
              to={filters.dateTo ? new Date(filters.dateTo).toISOString() : getDateRangeFromPeriod(filters.period).to}
            />
          </Card>
          <Card sx={{ flex: 1, p: 3 }}>
            <MonitoringCharts
              type="api"
              from={filters.dateFrom ? new Date(filters.dateFrom).toISOString() : getDateRangeFromPeriod(filters.period).from}
              to={filters.dateTo ? new Date(filters.dateTo).toISOString() : getDateRangeFromPeriod(filters.period).to}
            />
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
