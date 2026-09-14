import { foundationTokens } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Focus, UsersRound } from 'lucide-react';

import type { WorkplaceHomeWeekDay } from './workplace-home-model';

export function WorkplaceHomeWorkloadBar({
  day,
  label,
  meetingLabel,
  focusLabel,
  meetingValue,
  focusValue,
  scaleMinutes,
  compact = false,
}: {
  day: WorkplaceHomeWeekDay;
  label: string;
  meetingLabel: string;
  focusLabel: string;
  meetingValue: string;
  focusValue: string;
  scaleMinutes: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Stack
        role="img"
        aria-label={label}
        data-testid="workplace-week-workload"
        sx={{ minWidth: 0 }}
      >
        <Box
          aria-hidden="true"
          sx={{
            display: 'flex',
            height: 12,
            bgcolor: 'action.hover',
            borderRadius: foundationTokens.workplace.radius.card + 'px',
            overflow: 'hidden',
          }}
        >
          {[
            { minutes: day.meetingMinutes, color: 'primary.main' },
            { minutes: day.focusMinutes, color: 'primary.light' },
          ].map((series, index) => (
            <Box
              key={index}
              sx={{
                height: 1,
                width: `${Math.min(100, (series.minutes / scaleMinutes) * 100)}%`,
                minWidth: series.minutes ? 4 : 0,
                bgcolor: series.color,
              }}
            />
          ))}
        </Box>
      </Stack>
    );
  }
  return (
    <Stack
      role="img"
      aria-label={label}
      data-testid="workplace-week-workload"
      spacing={compact ? 0.6 : 1.15}
    >
      {[
        {
          key: 'meeting',
          label: meetingLabel,
          value: meetingValue,
          minutes: day.meetingMinutes,
          color: 'primary.main',
          icon: UsersRound,
        },
        {
          key: 'focus',
          label: focusLabel,
          value: focusValue,
          minutes: day.focusMinutes,
          color: 'primary.light',
          icon: Focus,
        },
      ].map((series) => {
        const Icon = series.icon;
        return (
          <Box key={series.key} aria-hidden="true">
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Stack direction="row" spacing={0.65} alignItems="center" minWidth={0}>
                <Icon size={14} />
                <Typography variant="caption" fontWeight="fontWeightBold">
                  {series.label}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
                {series.value}
              </Typography>
            </Stack>
            <Box
              sx={{
                mt: 0.55,
                height: compact ? 5 : 10,
                bgcolor: 'action.hover',
                borderRadius: foundationTokens.radius.compact + 'px',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${Math.min(100, (series.minutes / scaleMinutes) * 100)}%`,
                  minWidth: series.minutes ? 4 : 0,
                  height: 1,
                  bgcolor: series.color,
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
