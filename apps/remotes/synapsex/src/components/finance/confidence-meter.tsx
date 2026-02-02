import type { Theme, SxProps } from '@mui/material/styles';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

// ----------------------------------------------------------------------

export type ConfidenceMeterProps = {
  value: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  sx?: SxProps<Theme>;
};

function getColor(value: number): 'success' | 'warning' | 'error' {
  if (value >= 90) return 'success';
  if (value >= 70) return 'warning';
  return 'error';
}

const sizeMap = {
  sm: { height: 4, width: 64, fontSize: '0.75rem' },
  md: { height: 6, width: 80, fontSize: '0.8125rem' },
  lg: { height: 8, width: 96, fontSize: '0.875rem' },
};

export const ConfidenceMeter = ({
  value,
  showLabel = true,
  size = 'md',
  sx,
}: ConfidenceMeterProps) => {
  const config = sizeMap[size];
  const color = getColor(value);

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, ...sx }}>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, value))}
        color={color}
        sx={{
          height: config.height,
          width: config.width,
          borderRadius: 1,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': { borderRadius: 1 },
        }}
      />
      {showLabel && (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: config.fontSize,
            fontVariantNumeric: 'tabular-nums',
            color: `${color}.main`,
          }}
        >
          {value}%
        </Typography>
      )}
    </Box>
  );
};

export type ConfidenceRingProps = {
  value: number;
  size?: number;
  strokeWidth?: number;
  sx?: SxProps<Theme>;
};

export const ConfidenceRing = ({
  value: rawValue,
  size = 60,
  strokeWidth = 4,
  sx,
}: ConfidenceRingProps) => {
  const value = Math.min(100, Math.max(0, rawValue));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const color = getColor(value);

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sx,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          style={{ color: 'var(--mui-palette-action-hover)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            color: `var(--mui-palette-${color}-main)`,
            transition: 'stroke-dashoffset 0.5s ease',
          }}
        />
      </svg>
      <Typography
        component="span"
        sx={{
          position: 'absolute',
          fontSize: '0.875rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: `${color}.main`,
        }}
      >
        {value}%
      </Typography>
    </Box>
  );
};
