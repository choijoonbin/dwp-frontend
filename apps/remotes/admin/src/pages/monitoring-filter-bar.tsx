import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
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
      {/* Period Preset */}
      <Box>
        <ToggleButtonGroup
          value={filters.period}
          exclusive
          onChange={handlePeriodChange}
          aria-label="기간 선택"
          size="small"
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
      </Box>

      {/* Date Range */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="From"
          type="date"
          size="small"
          value={filters.dateFrom}
          onChange={(e) => onChange({ dateFrom: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={filters.dateTo}
          onChange={(e) => onChange({ dateTo: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
      </Stack>

      {/* Search Fields */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Route"
          size="small"
          value={filters.route}
          onChange={(e) => onChange({ route: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Menu"
          size="small"
          value={filters.menu}
          onChange={(e) => onChange({ menu: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Path"
          size="small"
          value={filters.path}
          onChange={(e) => onChange({ path: e.target.value })}
          sx={{ flex: 1 }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="User ID"
          size="small"
          value={filters.userId}
          onChange={(e) => onChange({ userId: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          label="API Name"
          size="small"
          value={filters.apiName}
          onChange={(e) => onChange({ apiName: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          label="API URL"
          size="small"
          value={filters.apiUrl}
          onChange={(e) => onChange({ apiUrl: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          label="Status Code"
          size="small"
          value={filters.statusCode}
          onChange={(e) => onChange({ statusCode: e.target.value })}
          sx={{ flex: 1 }}
        />
      </Stack>

      {/* Actions */}
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button variant="outlined" startIcon={<Iconify icon="solar:refresh-bold" />} onClick={onReset}>
          초기화
        </Button>
        <Button variant="contained" startIcon={<Iconify icon="solar:magnifer-bold" />}>
          검색
        </Button>
      </Stack>
    </Stack>
  );
};
