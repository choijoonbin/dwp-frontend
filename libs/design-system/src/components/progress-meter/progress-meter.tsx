import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SxProps, Theme } from '@mui/material/styles';

export type ProgressMeterProps = {
  label: string;
  value: number;
  tone?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error';
  size?: 'compact' | 'standard';
  valueLabel?: string;
  sx?: SxProps<Theme>;
};

function normalizedProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function ProgressMeter({
  label,
  value,
  tone = 'primary',
  size = 'standard',
  valueLabel,
  sx,
}: ProgressMeterProps) {
  const normalizedValue = normalizedProgress(value);
  return (
    <Box sx={sx}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {valueLabel ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {valueLabel}
          </Typography>
        ) : null}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={normalizedValue}
        color={tone}
        aria-label={label}
        aria-valuenow={normalizedValue}
        aria-valuetext={valueLabel}
        sx={{ mt: 0.5, height: size === 'compact' ? 4 : 6, borderRadius: 999 }}
      />
    </Box>
  );
}
