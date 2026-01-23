import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

// ----------------------------------------------------------------------

type MonitoringFilterBarProps = {
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
  onChange: (filters: Partial<MonitoringFilterBarProps['filters']>) => void;
  onReset: () => void;
};

export const MonitoringFilterBar = ({ filters, onChange, onReset }: MonitoringFilterBarProps) => {
  const handlePeriodChange = (_event: React.MouseEvent<HTMLElement>, newPeriod: '1h' | '24h' | '7d' | '30d' | null) => {
    if (newPeriod !== null) {
      onChange({ period: newPeriod });
    }
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          필터
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button variant="text" startIcon={<Iconify icon="solar:refresh-bold" />} onClick={onReset}>
            검색 초기화
          </Button>
          <Button variant="contained" startIcon={<Iconify icon="solar:magnifer-bold" />}>
            검색
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Iconify icon="solar:calendar-bold" width={18} />
              <Typography variant="subtitle2">기간</Typography>
              <ToggleButtonGroup
                value={filters.period}
                exclusive
                onChange={handlePeriodChange}
                aria-label="기간 선택"
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 1,
                    py: 0,
                    minWidth: 36,
                    height: 22,
                    fontSize: '0.75rem',
                    lineHeight: 1,
                  },
                }}
              >
                <ToggleButton value="1h" aria-label="1시간">
                  1h
                </ToggleButton>
                <ToggleButton value="24h" aria-label="24시간">
                  24h
                </ToggleButton>
                <ToggleButton value="7d" aria-label="7일">
                  7d
                </ToggleButton>
                <ToggleButton value="30d" aria-label="30일">
                  30d
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <TextField
                  id="monitoring-filter-dateFrom"
                  label="From"
                  type="datetime-local"
                  size="small"
                  value={filters.dateFrom}
                  onChange={(e) => onChange({ dateFrom: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ name: 'monitoring-dateFrom' }}
                  sx={{ flex: 1 }}
                />
                <Typography
                  variant="body2"
                  sx={{ px: 0.5, color: 'text.secondary', display: { xs: 'none', sm: 'inline' } }}
                >
                  ~
                </Typography>
                <TextField
                  id="monitoring-filter-dateTo"
                  label="To"
                  type="datetime-local"
                  size="small"
                  value={filters.dateTo}
                  onChange={(e) => onChange({ dateTo: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ name: 'monitoring-dateTo' }}
                  sx={{ flex: 1 }}
                />
            </Stack>
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:folder-with-files-bold" width={18} />
              <Typography variant="subtitle2">라우트/메뉴</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                id="monitoring-filter-route"
                label="Route"
                size="small"
                value={filters.route}
                onChange={(e) => onChange({ route: e.target.value })}
                inputProps={{ name: 'monitoring-route' }}
                sx={{ flex: 1 }}
              />
              <TextField
                id="monitoring-filter-menu"
                label="Menu"
                size="small"
                value={filters.menu}
                onChange={(e) => onChange({ menu: e.target.value })}
                inputProps={{ name: 'monitoring-menu' }}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:map-point-wave-bold" width={18} />
              <Typography variant="subtitle2">경로 (Path)</Typography>
            </Stack>
            <TextField
              id="monitoring-filter-path"
              label="Path"
              size="small"
              value={filters.path}
              onChange={(e) => onChange({ path: e.target.value })}
              inputProps={{ name: 'monitoring-path' }}
              sx={{ flex: 1 }}
            />
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:user-bold" width={18} />
              <Typography variant="subtitle2">사용자</Typography>
            </Stack>
            <TextField
              id="monitoring-filter-userId"
              label="User ID"
              size="small"
              value={filters.userId}
              onChange={(e) => onChange({ userId: e.target.value })}
              inputProps={{ name: 'monitoring-userId' }}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Stack spacing={1} sx={{ gridColumn: { xs: 'auto', md: 'span 2' } }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Iconify icon="solar:server-square-cloud-bold" width={18} />
              <Typography variant="subtitle2">API 필터</Typography>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                id="monitoring-filter-apiName"
                label="API Name"
                size="small"
                value={filters.apiName}
                onChange={(e) => onChange({ apiName: e.target.value })}
                inputProps={{ name: 'monitoring-apiName' }}
                sx={{ flex: 1 }}
              />
              <TextField
                id="monitoring-filter-apiUrl"
                label="API URL"
                size="small"
                value={filters.apiUrl}
                onChange={(e) => onChange({ apiUrl: e.target.value })}
                inputProps={{ name: 'monitoring-apiUrl' }}
                sx={{ flex: 1 }}
              />
              <TextField
                id="monitoring-filter-statusCode"
                label="Status Code"
                size="small"
                value={filters.statusCode}
                onChange={(e) => onChange({ statusCode: e.target.value })}
                inputProps={{ name: 'monitoring-statusCode' }}
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Stack>
  );
};
