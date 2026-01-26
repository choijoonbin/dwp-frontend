import { useMemo, useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  type PageViewItem,
  type EventLogItem,
  type ApiHistoryItem,
  type VisitorSummary,
  useCodesByResourceQuery,
  getSelectOptionsByGroup,
  useMonitoringEventsQuery,
  useMonitoringVisitorsQuery,
  useMonitoringPageViewsQuery,
  useMonitoringApiHistoriesQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TablePagination from '@mui/material/TablePagination';

import type { MonitoringKpiCardKey } from './monitoring-kpi-cards';

// ----------------------------------------------------------------------

type MonitoringTabsProps = {
  filters: {
    period: '1h' | '24h' | '7d' | '30d';
    dateFrom: string;
    dateTo: string;
    route: string;
    menu: string;
    path: string;
    userId: string;
    apiName: string;
    apiUrl: string;
    statusCode: string;
  };
  /** 제어 모드: KPI 드릴다운 시 API 히스토리 탭으로 전환 */
  activeTab?: number;
  /** Latency KPI 클릭 시 응답시간 내림차순 정렬 및 안내 칩 노출 */
  activeKpi?: MonitoringKpiCardKey | null;
  /** 좌측 PV/UV 차트에서 포인트 클릭 시 해당 시간대로 API 히스토리만 필터 */
  chartTimeRangeOverride?: { from: string; to: string } | null;
  onTabChange?: (tab: number) => void;
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

/**
 * Events Tab Filters Component
 * Uses code-based event type options instead of hardcoded values
 * 
 * Fetches UI_ACTION codes from /api/admin/codes/usage?resourceKey=menu.admin.monitoring
 * and renders them as select options. Falls back to EVENT_TYPE if UI_ACTION is not available.
 */
export const EventsTabFilters = ({
  keyword,
  eventType,
  resourceKey,
  onKeywordChange,
  onEventTypeChange,
  onResourceKeyChange,
}: {
  keyword: string;
  eventType: string;
  resourceKey: string;
  onKeywordChange: (value: string) => void;
  onEventTypeChange: (value: string) => void;
  onResourceKeyChange: (value: string) => void;
}) => {
  // Fetch codes for menu.admin.monitoring resource
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.monitoring');

  // Get event type options from code map
  // Try UI_ACTION first, then EVENT_TYPE as fallback
  const eventTypeOptions = useMemo(() => {
    const uiActionOptions = getSelectOptionsByGroup(codeMap, 'UI_ACTION');
    if (uiActionOptions.length > 0) {
      return uiActionOptions;
    }
    const fallbackEventTypeOptions = getSelectOptionsByGroup(codeMap, 'EVENT_TYPE');
    if (fallbackEventTypeOptions.length > 0) {
      return fallbackEventTypeOptions;
    }
    return [];
  }, [codeMap]);

  const hasEventTypeCodes = eventTypeOptions.length > 0;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <TextField
        label="검색 (Action / Label / Path)"
        size="small"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        sx={{ flex: 1 }}
      />
      <TextField
        select
        label="Event Type"
        size="small"
        value={eventType}
        onChange={(e) => onEventTypeChange(e.target.value)}
        disabled={!hasEventTypeCodes || codesLoading}
        helperText={
          codesLoading
            ? '코드 로딩 중...'
            : !hasEventTypeCodes
              ? '코드 매핑 필요 (UI_ACTION 또는 EVENT_TYPE)'
              : undefined
        }
        sx={{ minWidth: 150 }}
      >
        <MenuItem value="">전체</MenuItem>
        {eventTypeOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Resource Key"
        size="small"
        value={resourceKey}
        onChange={(e) => onResourceKeyChange(e.target.value)}
        sx={{ flex: 1 }}
      />
    </Stack>
  );
};

export const MonitoringTabs = ({
  activeKpi,
  chartTimeRangeOverride,
  filters,
  activeTab: controlledTab,
  onTabChange,
}: MonitoringTabsProps) => {
  const [internalTab, setInternalTab] = useState(0);
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailData, setDetailData] = useState<PageViewItem | ApiHistoryItem | VisitorSummary | EventLogItem | null>(null);

  // Tab-specific filters (independent per tab)
  const [visitorsKeyword, setVisitorsKeyword] = useState('');
  const [eventsKeyword, setEventsKeyword] = useState('');
  const [eventsEventType, setEventsEventType] = useState('');
  const [eventsResourceKey, setEventsResourceKey] = useState('');
  const [expandedEventRow, setExpandedEventRow] = useState<string | null>(null);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setPage(0); // 탭 변경 시 페이지 리셋
    // Clear detail data when switching tabs to prevent type mismatches
    setDetailData(null);
    setDetailDialogOpen(false);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Convert filters to API params (single source of truth for from/to)
  // Use period-based calculation if dateFrom/dateTo are empty, otherwise use provided dates
  const { from, to } = useMemo(() => {
    if (filters.dateFrom && filters.dateTo) {
      return {
        from: datetimeLocalToIso(filters.dateFrom),
        to: datetimeLocalToIso(filters.dateTo),
      };
    }
    return getDateRangeFromPeriod(filters.period);
  }, [filters.dateFrom, filters.dateTo, filters.period]);

  // Page Views Query
  const pageViewsParams = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      from,
      to,
      route: filters.route || undefined,
      menu: filters.menu || undefined,
      path: filters.path || undefined,
      userId: filters.userId || undefined,
      keyword: filters.route || filters.path || filters.menu || undefined,
    }),
    [page, rowsPerPage, from, to, filters.route, filters.menu, filters.path, filters.userId]
  );

  const {
    data: pageViewsData,
    isLoading: isLoadingPageViews,
    error: pageViewsError,
  } = useMonitoringPageViewsQuery(activeTab === 0 ? pageViewsParams : undefined);

  // Visitors Query
  const visitorsParams = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      from,
      to,
      keyword: visitorsKeyword || undefined,
    }),
    [page, rowsPerPage, from, to, visitorsKeyword]
  );

  const {
    data: visitorsData,
    isLoading: isLoadingVisitors,
    error: visitorsError,
  } = useMonitoringVisitorsQuery(activeTab === 1 ? visitorsParams : undefined);

  // Events Query
  const eventsParams = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      from,
      to,
      keyword: eventsKeyword || undefined,
      eventType: eventsEventType || undefined,
      resourceKey: eventsResourceKey || undefined,
    }),
    [page, rowsPerPage, from, to, eventsKeyword, eventsEventType, eventsResourceKey]
  );

  const {
    data: eventsData,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useMonitoringEventsQuery(activeTab === 2 ? eventsParams : undefined);

  // API Histories Query (좌측 차트 시간대 선택 시 chartTimeRangeOverride 사용)
  const apiHistoriesFromTo = chartTimeRangeOverride?.from && chartTimeRangeOverride?.to
    ? { from: chartTimeRangeOverride.from, to: chartTimeRangeOverride.to }
    : { from, to };

  const apiHistoriesParams = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      from: apiHistoriesFromTo.from,
      to: apiHistoriesFromTo.to,
      apiName: filters.apiName || undefined,
      apiUrl: filters.apiUrl || undefined,
      statusCode: filters.statusCode || undefined,
      userId: filters.userId || undefined,
      keyword: filters.apiName || filters.apiUrl || undefined,
      ...(activeKpi === 'latency' ? { sort: 'latencyMs,desc' as const } : activeKpi === 'traffic' ? { sort: 'createdAt,desc' as const } : {}),
    }),
    [
      page,
      rowsPerPage,
      apiHistoriesFromTo.from,
      apiHistoriesFromTo.to,
      filters.apiName,
      filters.apiUrl,
      filters.statusCode,
      filters.userId,
      activeKpi,
    ]
  );

  const {
    data: apiHistoriesData,
    isLoading: isLoadingApiHistories,
    error: apiHistoriesError,
  } = useMonitoringApiHistoriesQuery(activeTab === 3 ? apiHistoriesParams : undefined);

  const getCurrentData = () => {
    switch (activeTab) {
      case 0: // 페이지뷰
        return {
          items: pageViewsData?.items ?? [],
          total: pageViewsData?.total ?? 0,
          isLoading: isLoadingPageViews,
          error: pageViewsError,
        };
      case 1: // 방문자뷰
        return {
          items: visitorsData?.items ?? [],
          total: visitorsData?.total ?? 0,
          isLoading: isLoadingVisitors,
          error: visitorsError,
        };
      case 2: // 이벤트
        return {
          items: eventsData?.items ?? [],
          total: eventsData?.total ?? 0,
          isLoading: isLoadingEvents,
          error: eventsError,
        };
      case 3: {
        // API 히스토리 (Latency 드릴다운 시 응답시간 내림차순 정렬, 백엔드 미지원 시 클라이언트 정렬)
        let items = apiHistoriesData?.items ?? [];
        if (activeKpi === 'latency' && items.length > 0) {
          items = [...items].sort(
            (a, b) =>
              ((b as ApiHistoryItem).responseTime ?? 0) - ((a as ApiHistoryItem).responseTime ?? 0)
          );
        }
        return {
          items,
          total: apiHistoriesData?.total ?? 0,
          isLoading: isLoadingApiHistories,
          error: apiHistoriesError,
        };
      }
      default:
        return { items: [], total: 0, isLoading: false, error: null };
    }
  };

  const currentData = getCurrentData();
  const paginatedData = currentData.items;

  const renderTableContent = () => {
    if (currentData.error) {
      return (
        <TableBody>
          <TableRow key="error-row">
            <TableCell colSpan={10}>
              <Alert severity="error">
                데이터를 불러오는 중 오류가 발생했습니다:{' '}
                {currentData.error instanceof Error ? currentData.error.message : 'Unknown error'}
              </Alert>
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    switch (activeTab) {
      case 0: // 페이지뷰
        return (
          <>
            <TableHead>
              <TableRow>
                <TableCell>Route</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>User Agent</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.isLoading ? (
                Array.from({ length: rowsPerPage }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" />
                    </TableCell>
                    <TableCell align="right">
                      <Skeleton variant="rectangular" width={60} height={32} />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow key="pageviews-empty">
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as PageViewItem[]).map((row, index) => (
                  <TableRow key={row.id || `pageview-${index}-${row.timestamp}`}>
                    <TableCell>{row.route}</TableCell>
                    <TableCell>{row.path}</TableCell>
                    <TableCell>{row.userId || '-'}</TableCell>
                    <TableCell>
                      {new Date(row.timestamp).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell>{row.userAgent || '-'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setDetailData(row);
                          setDetailDialogOpen(true);
                        }}
                      >
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        );
      case 1: // 방문자뷰
        return (
          <>
            <TableHead>
              <TableRow>
                <TableCell>Visitor ID</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>First Seen</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Page Views</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Last Path</TableCell>
                <TableCell>Last Device</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.isLoading ? (
                Array.from({ length: rowsPerPage }).map((_unused, idx) => (
                  <TableRow key={idx}>
                    {Array.from({ length: 9 }).map((_unused2, cellIdx) => (
                      <TableCell key={cellIdx}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow key="visitors-empty">
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as VisitorSummary[]).map((row) => (
                  <TableRow key={row.visitorId}>
                    <TableCell>{row.visitorId}</TableCell>
                    <TableCell>{row.userId || '-'}</TableCell>
                    <TableCell>
                      {new Date(row.firstSeenAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(row.lastSeenAt).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell>{row.pageViewCount}</TableCell>
                    <TableCell>{row.eventCount}</TableCell>
                    <TableCell>{row.lastPath || '-'}</TableCell>
                    <TableCell>{row.lastDevice || '-'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setDetailData(row);
                          setDetailDialogOpen(true);
                        }}
                      >
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        );
      case 2: // 이벤트
        return (
          <>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>Occurred At</TableCell>
                <TableCell>Event Type</TableCell>
                <TableCell>Resource Key</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Visitor ID</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Path</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.isLoading ? (
                Array.from({ length: rowsPerPage }).map((_unused, idx) => (
                  <TableRow key={idx}>
                    {Array.from({ length: 10 }).map((_unused2, cellIdx) => (
                      <TableCell key={cellIdx}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow key="events-empty">
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as EventLogItem[]).flatMap((row) => {
                  const rowId = row.id || row.sysEventLogId?.toString() || `event-${row.occurredAt}`;
                  return [
                    <TableRow key={rowId}>
                      <TableCell>
                        {row.metadata && (
                          <IconButton
                            size="small"
                            onClick={() => setExpandedEventRow(expandedEventRow === rowId ? null : rowId)}
                          >
                            <Iconify
                              icon={expandedEventRow === rowId ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
                              width={16}
                            />
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(row.occurredAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </TableCell>
                      <TableCell>{row.eventType}</TableCell>
                      <TableCell>{row.resourceKey}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.label || '-'}</TableCell>
                      <TableCell>{row.visitorId || '-'}</TableCell>
                      <TableCell>{row.userId || '-'}</TableCell>
                      <TableCell>{row.path || '-'}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => {
                            setDetailData(row);
                            setDetailDialogOpen(true);
                          }}
                        >
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>,
                    ...(row.metadata
                      ? [
                          <TableRow key={`${rowId}-expand`}>
                            <TableCell colSpan={10} sx={{ py: 0 }}>
                              <Collapse in={expandedEventRow === rowId} timeout="auto" unmountOnExit>
                                <Box sx={{ p: 2, bgcolor: 'background.neutral' }}>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(row.metadata, null, 2)}
                                  </Typography>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>,
                        ]
                      : []),
                  ];
                })
              )}
            </TableBody>
          </>
        );
      case 3: // API 히스토리
        return (
          <>
            <TableHead>
              <TableRow>
                <TableCell>API Name</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Status Code</TableCell>
                <TableCell>User ID</TableCell>
                <TableCell>Response Time (ms)</TableCell>
                <TableCell>Trace ID</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.isLoading ? (
                Array.from({ length: rowsPerPage }).map((_unused, idx) => (
                  <TableRow key={idx}>
                    {Array.from({ length: 8 }).map((_unused2, cellIdx) => (
                      <TableCell key={cellIdx}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow key="api-histories-empty">
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as ApiHistoryItem[]).map((row, index) => (
                  <TableRow key={row.id || `api-history-${index}-${row.timestamp || index}`}>
                    <TableCell>{row.apiName}</TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.5,
                          borderRadius: 0.5,
                          bgcolor: row.method === 'GET' ? 'primary.lighter' : 'success.lighter',
                          color: row.method === 'GET' ? 'primary.darker' : 'success.darker',
                        }}
                      >
                        {row.method}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.5,
                          borderRadius: 0.5,
                          bgcolor: row.statusCode >= 400 ? 'error.lighter' : 'success.lighter',
                          color: row.statusCode >= 400 ? 'error.darker' : 'success.darker',
                        }}
                      >
                        {row.statusCode}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.userId || '-'}</TableCell>
                    <TableCell>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{
                          color:
                            row.responseTime != null && row.responseTime > 1000
                              ? row.responseTime > 3000
                                ? 'error.main'
                                : 'warning.main'
                              : 'text.primary',
                          fontWeight: row.responseTime != null && row.responseTime > 1000 ? 600 : undefined,
                        }}
                      >
                        {row.responseTime != null ? `${row.responseTime}ms` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.traceId ? (
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                          }}
                        >
                          {row.traceId}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(row.timestamp).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setDetailData(row);
                          setDetailDialogOpen(true);
                        }}
                      >
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { label: '페이지뷰', value: 0 },
    { label: '방문자뷰', value: 1 },
    { label: '이벤트', value: 2 },
    { label: 'API 히스토리', value: 3 },
  ];

  return (
    <Stack spacing={2}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          {tabs.map((tab) => (
            <Tab key={tab.value} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {activeTab === 3 &&
        (filters.statusCode ||
          activeKpi === 'latency' ||
          activeKpi === 'traffic' ||
          chartTimeRangeOverride) && (
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            {filters.statusCode && (
              <Typography component="span" variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                Active Filter:{' '}
                {filters.statusCode === '4xx,5xx'
                  ? '4xx, 5xx Error'
                  : filters.statusCode === '5xx'
                    ? '5xx Error'
                    : filters.statusCode === '2xx'
                      ? '2xx Success'
                      : filters.statusCode}
              </Typography>
            )}
            {activeKpi === 'latency' && (
              <Chip
                size="small"
                label="응답 시간 높은 순으로 정렬됨"
                color="default"
                variant="outlined"
              />
            )}
            {activeKpi === 'traffic' && (
              <Chip
                size="small"
                label="최신순 정렬됨"
                color="default"
                variant="outlined"
              />
            )}
            {chartTimeRangeOverride && (
              <Chip
                size="small"
                label="좌측 차트 선택 시간대 필터"
                color="default"
                variant="outlined"
              />
            )}
          </Stack>
        )}

      {/* Tab-specific filters */}
      {activeTab === 1 && (
        <Stack direction="row" spacing={2}>
          <TextField
            label="검색 (Visitor ID / Path)"
            size="small"
            value={visitorsKeyword}
            onChange={(e) => setVisitorsKeyword(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      {activeTab === 2 && (
        <EventsTabFilters
          keyword={eventsKeyword}
          eventType={eventsEventType}
          resourceKey={eventsResourceKey}
          onKeywordChange={setEventsKeyword}
          onEventTypeChange={setEventsEventType}
          onResourceKeyChange={setEventsResourceKey}
        />
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          총 {currentData.total}건
        </Typography>
        <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:download-bold" />}>
          Excel 다운로드
        </Button>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          {renderTableContent()}
        </Table>
      </Box>

      <TablePagination
        component="div"
        count={currentData.total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 30, 50]}
        labelRowsPerPage="페이지당 행 수:"
      />

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>상세 정보</DialogTitle>
        <DialogContent>
          {detailData && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {activeTab === 0 && (detailData as PageViewItem) && (
                <>
                  <DetailRow label="ID" value={(detailData as PageViewItem).id} />
                  <DetailRow label="Route" value={(detailData as PageViewItem).route} />
                  <DetailRow label="Path" value={(detailData as PageViewItem).path} />
                  <DetailRow label="User ID" value={(detailData as PageViewItem).userId || '-'} />
                  <DetailRow label="Timestamp" value={new Date((detailData as PageViewItem).timestamp).toLocaleString('ko-KR')} />
                  <DetailRow label="User Agent" value={(detailData as PageViewItem).userAgent || '-'} />
                  <DetailRow label="Device" value={(detailData as PageViewItem).device || '-'} />
                  <DetailRow label="Referrer" value={(detailData as PageViewItem).referrer || '-'} />
                  <DetailRow label="Menu Key" value={(detailData as PageViewItem).menuKey || '-'} />
                  <DetailRow label="Title" value={(detailData as PageViewItem).title || '-'} />
                </>
              )}
              {activeTab === 1 && (detailData as VisitorSummary) && (
                <>
                  <DetailRow label="Visitor ID" value={(detailData as VisitorSummary).visitorId} />
                  <DetailRow label="User ID" value={(detailData as VisitorSummary).userId || '-'} />
                  <DetailRow label="Page Views" value={((detailData as VisitorSummary).pageViewCount ?? 0).toString()} />
                  <DetailRow label="Event Count" value={((detailData as VisitorSummary).eventCount ?? 0).toString()} />
                  <DetailRow label="Last Path" value={(detailData as VisitorSummary).lastPath || '-'} />
                  <DetailRow label="Last Device" value={(detailData as VisitorSummary).lastDevice || '-'} />
                  <DetailRow
                    label="First Visit"
                    value={
                      (detailData as VisitorSummary).firstSeenAt
                        ? new Date((detailData as VisitorSummary).firstSeenAt).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '-'
                    }
                  />
                  <DetailRow
                    label="Last Visit"
                    value={
                      (detailData as VisitorSummary).lastSeenAt
                        ? new Date((detailData as VisitorSummary).lastSeenAt).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '-'
                    }
                  />
                </>
              )}
              {activeTab === 2 && (detailData as EventLogItem) && (
                <>
                  <DetailRow label="ID" value={(detailData as EventLogItem).id || (detailData as EventLogItem).sysEventLogId?.toString() || '-'} />
                  <DetailRow label="Event Type" value={(detailData as EventLogItem).eventType || '-'} />
                  <DetailRow label="Resource Key" value={(detailData as EventLogItem).resourceKey || '-'} />
                  <DetailRow label="Action" value={(detailData as EventLogItem).action || '-'} />
                  <DetailRow label="Label" value={(detailData as EventLogItem).label || '-'} />
                  <DetailRow label="User ID" value={(detailData as EventLogItem).userId?.toString() || '-'} />
                  <DetailRow label="Path" value={(detailData as EventLogItem).path || '-'} />
                  <DetailRow
                    label="Occurred At"
                    value={
                      (detailData as EventLogItem).occurredAt
                        ? new Date((detailData as EventLogItem).occurredAt).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '-'
                    }
                  />
                  {((detailData as EventLogItem).metadata as Record<string, unknown>) && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Metadata
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          p: 2,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          fontSize: '0.875rem',
                          overflow: 'auto',
                          maxHeight: 300,
                        }}
                      >
                        {JSON.stringify((detailData as EventLogItem).metadata, null, 2)}
                      </Box>
                    </Box>
                  )}
                </>
              )}
              {activeTab === 3 && (detailData as ApiHistoryItem) && (
                <>
                  <DetailRow label="ID" value={(detailData as ApiHistoryItem).id || '-'} />
                  <DetailRow label="API Name" value={(detailData as ApiHistoryItem).apiName || '-'} />
                  <DetailRow label="API URL" value={(detailData as ApiHistoryItem).apiUrl || '-'} />
                  <DetailRow label="Method" value={(detailData as ApiHistoryItem).method || '-'} />
                  <DetailRow label="Status Code" value={(detailData as ApiHistoryItem).statusCode ? (detailData as ApiHistoryItem).statusCode.toString() : '-'} />
                  <DetailRow label="User ID" value={(detailData as ApiHistoryItem).userId || '-'} />
                  <DetailRow label="Response Time" value={(detailData as ApiHistoryItem).responseTime ? `${(detailData as ApiHistoryItem).responseTime}ms` : '-'} />
                  <DetailRow label="Trace ID" value={(detailData as ApiHistoryItem).traceId || '-'} />
                  <DetailRow
                    label="Timestamp"
                    value={
                      (detailData as ApiHistoryItem).timestamp
                        ? new Date((detailData as ApiHistoryItem).timestamp).toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '-'
                    }
                  />
                  {(detailData as ApiHistoryItem).requestBody && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Request Body
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          p: 2,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          fontSize: '0.875rem',
                          overflow: 'auto',
                          maxHeight: 200,
                        }}
                      >
                        {(detailData as ApiHistoryItem).requestBody}
                      </Box>
                    </Box>
                  )}
                  {(detailData as ApiHistoryItem).responseBody && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Response Body
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          p: 2,
                          bgcolor: 'grey.100',
                          borderRadius: 1,
                          fontSize: '0.875rem',
                          overflow: 'auto',
                          maxHeight: 200,
                        }}
                      >
                        {(detailData as ApiHistoryItem).responseBody}
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

// ----------------------------------------------------------------------
// Detail Row Component
// ----------------------------------------------------------------------

type DetailRowProps = {
  label: string;
  value: string;
};

const DetailRow = ({ label, value }: DetailRowProps) => (
  <Box sx={{ display: 'flex', gap: 2 }}>
    <Typography variant="subtitle2" sx={{ minWidth: 120, fontWeight: 600 }}>
      {label}:
    </Typography>
    <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-word' }}>
      {value}
    </Typography>
  </Box>
);
