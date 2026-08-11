import { Search, X } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { ActionButton } from '../../components/actions';

export type ActiveFilter = {
  key: string;
  label: string;
  onRemove: () => void;
};

export type FilterBarProps = {
  ariaLabel: string;
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  activeFilters?: ActiveFilter[];
  resetLabel?: string;
  onReset?: () => void;
  resultLabel?: string;
  savedViews?: React.ReactNode;
  actions?: React.ReactNode;
};

export function FilterBar({
  ariaLabel,
  searchLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilters = [],
  resetLabel,
  onReset,
  resultLabel,
  savedViews,
  actions,
}: FilterBarProps) {
  return (
    <Box
      component="section"
      aria-label={ariaLabel}
      sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 1.5 }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={1.25}>
        <TextField
          size="small"
          label={searchLabel}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          sx={{ width: { xs: 1, md: 320 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        {filters && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, overflowX: 'auto' }}
          >
            {filters}
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {savedViews}
        {actions}
        {resultLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {resultLabel}
          </Typography>
        )}
      </Stack>
      {activeFilters.length > 0 && (
        <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
          {activeFilters.map((filter) => (
            <Chip
              key={filter.key}
              size="small"
              label={filter.label}
              onDelete={filter.onRemove}
              deleteIcon={<X size={14} aria-hidden="true" />}
            />
          ))}
          {resetLabel && onReset && (
            <ActionButton intent="quiet" size="small" onClick={onReset}>
              {resetLabel}
            </ActionButton>
          )}
        </Stack>
      )}
    </Box>
  );
}

export type SearchParamValue = string | readonly string[] | null | undefined;

export function mergeFilterSearchParams(
  current: URLSearchParams,
  values: Record<string, SearchParamValue>
): URLSearchParams {
  const next = new URLSearchParams(current);
  Object.entries(values).forEach(([key, value]) => {
    next.delete(key);
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((entry) => next.append(key, entry));
    } else if (value != null && value !== '') {
      next.set(key, String(value));
    }
  });
  return next;
}
