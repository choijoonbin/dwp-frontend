import Box from '@mui/material/Box';

import type { WorkplaceHomeWeekDay } from './workplace-home-model';

export function WorkplaceHomeWorkloadBar({
  day,
  label,
}: {
  day: WorkplaceHomeWeekDay;
  label: string;
}) {
  const total = Math.max(480, day.meetingMinutes + day.focusMinutes);

  return (
    <Box
      role="img"
      aria-label={label}
      sx={{
        display: 'flex',
        height: 7,
        bgcolor: 'action.hover',
        overflow: 'hidden',
        borderRadius: 0.5,
      }}
    >
      <Box sx={{ width: `${(day.meetingMinutes / total) * 100}%`, bgcolor: 'primary.main' }} />
      <Box sx={{ width: `${(day.focusMinutes / total) * 100}%`, bgcolor: 'success.main' }} />
    </Box>
  );
}
