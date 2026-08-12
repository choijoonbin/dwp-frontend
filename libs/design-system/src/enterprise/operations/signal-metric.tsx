import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export type SignalMetricTone = 'primary' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

export type SignalMetricProps = {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: SignalMetricTone;
  progress?: number;
  progressLabel?: string;
  onClick?: () => void;
  actionLabel?: string;
};

const toneColor = (tone: SignalMetricTone) =>
  tone === 'neutral' ? 'text.secondary' : `${tone}.main`;

export function SignalMetric({
  label,
  value,
  detail,
  icon,
  tone = 'primary',
  progress,
  progressLabel,
  onClick,
  actionLabel,
}: SignalMetricProps) {
  const content = (
    <Box sx={{ width: 1, minWidth: 0, p: { xs: 1.5, md: 1.75 }, textAlign: 'left' }}>
      <Box
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {label}
          </Typography>
          <Typography
            component="p"
            sx={{
              mt: 0.25,
              fontSize: '1.625rem',
              lineHeight: 1.25,
              fontWeight: 760,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={(theme) => {
            const color =
              tone === 'neutral' ? theme.palette.text.secondary : theme.palette[tone].main;
            return {
              width: 32,
              height: 32,
              flex: '0 0 32px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              color,
              bgcolor: alpha(color, 0.1),
            };
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {detail}
      </Typography>
      {progress !== undefined && (
        <Box sx={{ mt: 1.25 }}>
          <Box
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.max(0, Math.min(100, progress)))}
            aria-label={progressLabel ?? label}
            sx={{ height: 5, overflow: 'hidden', bgcolor: 'action.hover', borderRadius: 0.5 }}
          >
            <Box
              sx={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                height: 1,
                bgcolor: toneColor(tone),
                transition: (theme) => theme.transitions.create('width'),
              }}
            />
          </Box>
          {progressLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {progressLabel}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  const commonSx = {
    width: 1,
    minWidth: 0,
    height: 1,
    display: 'block',
    overflow: 'hidden',
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
    bgcolor: 'background.paper',
  } as const;

  if (!onClick) return <Box sx={commonSx}>{content}</Box>;

  return (
    <ButtonBase
      aria-label={actionLabel ?? label}
      onClick={onClick}
      sx={{
        ...commonSx,
        '&:hover': { borderColor: toneColor(tone), bgcolor: 'action.hover' },
      }}
    >
      {content}
    </ButtonBase>
  );
}
