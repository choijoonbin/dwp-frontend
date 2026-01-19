import { useState, useMemo } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import {
  useMonitoringPageViewsQuery,
  useMonitoringApiHistoriesQuery,
  useMonitoringVisitorsQuery,
  useMonitoringEventsQuery,
  type PageViewItem,
  type ApiHistoryItem,
  type VisitorSummary,
  type EventLogItem,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TablePagination from '@mui/material/TablePagination';

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
};

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

export const MonitoringTabs = ({ filters }: MonitoringTabsProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Tab-specific filters (independent per tab)
  const [visitorsKeyword, setVisitorsKeyword] = useState('');
  const [eventsKeyword, setEventsKeyword] = useState('');
  const [eventsEventType, setEventsEventType] = useState('');
  const [eventsResourceKey, setEventsResourceKey] = useState('');
  const [expandedEventRow, setExpandedEventRow] = useState<string | null>(null);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setPage(0); // 탭 변경 시 페이지 리셋
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Convert filters to API params (single source of truth for from/to)
  const { from, to } = useMemo(() => {
    if (filters.dateFrom && filters.dateTo) {
      return {
        from: new Date(filters.dateFrom).toISOString(),
        to: new Date(filters.dateTo).toISOString(),
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

  // API Histories Query
  const apiHistoriesParams = useMemo(
    () => ({
      page: page + 1,
      size: rowsPerPage,
      from,
      to,
      apiName: filters.apiName || undefined,
      apiUrl: filters.apiUrl || undefined,
      statusCode: filters.statusCode || undefined,
      userId: filters.userId || undefined,
      keyword: filters.apiName || filters.apiUrl || undefined,
    }),
    [page, rowsPerPage, from, to, filters.apiName, filters.apiUrl, filters.statusCode, filters.userId]
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
      case 3: // API 히스토리
        return {
          items: apiHistoriesData?.items ?? [],
          total: apiHistoriesData?.total ?? 0,
          isLoading: isLoadingApiHistories,
          error: apiHistoriesError,
        };
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
          <TableRow>
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
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as PageViewItem[]).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.route}</TableCell>
                    <TableCell>{row.path}</TableCell>
                    <TableCell>{row.userId || '-'}</TableCell>
                    <TableCell>{new Date(row.timestamp).toLocaleString('ko-KR')}</TableCell>
                    <TableCell>{row.userAgent || '-'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => console.log('View details', row)}>
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
                <TableRow>
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
                    <TableCell>{new Date(row.firstSeenAt).toLocaleString('ko-KR')}</TableCell>
                    <TableCell>{new Date(row.lastSeenAt).toLocaleString('ko-KR')}</TableCell>
                    <TableCell>{row.pageViewCount}</TableCell>
                    <TableCell>{row.eventCount}</TableCell>
                    <TableCell>{row.lastPath || '-'}</TableCell>
                    <TableCell>{row.lastDevice || '-'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => console.log('View details', row)}>
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
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as EventLogItem[]).map((row) => (
                  <>
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.metadata && (
                          <IconButton
                            size="small"
                            onClick={() => setExpandedEventRow(expandedEventRow === row.id ? null : row.id)}
                          >
                            <Iconify
                              icon={expandedEventRow === row.id ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
                              width={16}
                            />
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>{new Date(row.occurredAt).toLocaleString('ko-KR')}</TableCell>
                      <TableCell>{row.eventType}</TableCell>
                      <TableCell>{row.resourceKey}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.label || '-'}</TableCell>
                      <TableCell>{row.visitorId || '-'}</TableCell>
                      <TableCell>{row.userId || '-'}</TableCell>
                      <TableCell>{row.path || '-'}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => console.log('View details', row)}>
                          상세
                        </Button>
                      </TableCell>
                    </TableRow>
                    {row.metadata && (
                      <TableRow>
                        <TableCell colSpan={10} sx={{ py: 0 }}>
                          <Collapse in={expandedEventRow === row.id} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'background.neutral' }}>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                {JSON.stringify(row.metadata, null, 2)}
                              </Typography>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
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
                <TableCell>Timestamp</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentData.isLoading ? (
                Array.from({ length: rowsPerPage }).map((_unused, idx) => (
                  <TableRow key={idx}>
                    {Array.from({ length: 7 }).map((_unused2, cellIdx) => (
                      <TableCell key={cellIdx}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 3 }}>
                      데이터가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (paginatedData as ApiHistoryItem[]).map((row) => (
                  <TableRow key={row.id}>
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
                    <TableCell>{row.responseTime ? `${row.responseTime}ms` : '-'}</TableCell>
                    <TableCell>{new Date(row.timestamp).toLocaleString('ko-KR')}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => console.log('View details', row)}>
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
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="검색 (Action / Label / Path)"
            size="small"
            value={eventsKeyword}
            onChange={(e) => setEventsKeyword(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            label="Event Type"
            size="small"
            value={eventsEventType}
            onChange={(e) => setEventsEventType(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="view">View</MenuItem>
            <MenuItem value="click">Click</MenuItem>
            <MenuItem value="execute">Execute</MenuItem>
            <MenuItem value="scroll">Scroll</MenuItem>
          </TextField>
          <TextField
            label="Resource Key"
            size="small"
            value={eventsResourceKey}
            onChange={(e) => setEventsResourceKey(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Stack>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          총 {currentData.total}건
        </Typography>
        <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:download-bold" />}>
          Excel 다운로드
        </Button>
      </Stack>

      <Table>
        {renderTableContent()}
      </Table>

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
    </Stack>
  );
};
