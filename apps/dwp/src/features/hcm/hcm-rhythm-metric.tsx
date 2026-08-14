import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { hcmToneColor } from './hcm-home-visuals';

import type { LucideIcon } from 'lucide-react';

type HcmRhythmMetricProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  progress?: number;
  onClick: () => void;
};

export function HcmRhythmMetric({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  onClick,
}: HcmRhythmMetricProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        width: 1,
        minHeight: 116,
        p: 1.5,
        display: 'block',
        textAlign: 'left',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        transition: theme.transitions.create(['border-color', 'background-color'], {
          duration: 120,
        }),
        '&:hover': {
          borderColor: alpha(hcmToneColor.teal, 0.4),
          bgcolor: alpha(hcmToneColor.teal, theme.palette.mode === 'dark' ? 0.09 : 0.025),
        },
        '&:focus-visible': {
          outline: `3px solid ${hcmToneColor.teal}`,
          outlineOffset: 2,
        },
      })}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography
            component="p"
            sx={{ mt: 0.2, fontSize: '1.18rem', lineHeight: 1.25, fontWeight: 800 }}
          >
            {value}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            width: 34,
            height: 34,
            flex: '0 0 34px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            color: hcmToneColor.teal,
            bgcolor: alpha(hcmToneColor.teal, 0.09),
          }}
        >
          <Icon size={17} strokeWidth={1.9} />
        </Box>
      </Stack>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          aria-label={label}
          sx={{ mt: 1.15, height: 5, borderRadius: 1 }}
        />
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: progress === undefined ? 1.05 : 0.65, display: 'block', lineHeight: 1.4 }}
      >
        {detail}
      </Typography>
    </ButtonBase>
  );
}
