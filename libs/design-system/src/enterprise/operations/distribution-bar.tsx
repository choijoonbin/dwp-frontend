import Box from '@mui/material/Box';

export type DistributionSegment = {
  key: string;
  value: number;
  color: string;
};

export type DistributionBarProps = {
  label: string;
  segments: DistributionSegment[];
  height?: number;
};

export function DistributionBar({ label, segments, height = 7 }: DistributionBarProps) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);

  return (
    <Box
      role="img"
      aria-label={label}
      sx={{
        width: 1,
        height,
        display: 'flex',
        gap: '2px',
        overflow: 'hidden',
        borderRadius: 0.5,
        bgcolor: 'action.hover',
      }}
    >
      {total > 0 &&
        segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <Box
              key={segment.key}
              aria-hidden="true"
              sx={{
                width: `${(segment.value / total) * 100}%`,
                minWidth: segment.value > 0 ? 2 : 0,
                height: 1,
                bgcolor: segment.color,
              }}
            />
          ))}
    </Box>
  );
}
