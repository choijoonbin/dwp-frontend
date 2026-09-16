import { useTranslation } from 'react-i18next';
import { CalendarClock, CheckCircle2, CircleSlash2 } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function WorkTaskScheduleFollowUp({ available }: { available: boolean }) {
  const { t } = useTranslation('work');
  const StatusIcon = available ? CheckCircle2 : CircleSlash2;

  return (
    <Box
      role="status"
      aria-label={t('workHub.taskForm.scheduleAfterCreate')}
      sx={{
        minHeight: 44,
        border: 1,
        borderColor: available ? 'primary.main' : 'divider',
        bgcolor: available ? 'action.selected' : 'action.disabledBackground',
        borderRadius: 1,
        px: 1,
        py: 0.75,
      }}
    >
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" gap={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <CalendarClock size={18} aria-hidden="true" />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" variant="body2" sx={{ fontWeight: 'fontWeightMedium' }}>
              {t('workHub.taskForm.scheduleAfterCreate')}
            </Typography>
            <Typography component="p" variant="caption" color="text.secondary" sx={{ m: 0 }}>
              {t(
                available
                  ? 'workHub.taskForm.scheduleAfterCreateAutomatic'
                  : 'workHub.taskForm.scheduleAfterCreateUnavailable'
              )}
            </Typography>
          </Box>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          icon={<StatusIcon size={15} aria-hidden="true" />}
          label={t(
            available
              ? 'workHub.taskForm.scheduleAfterCreateReady'
              : 'workHub.taskForm.scheduleAfterCreateUnavailableShort'
          )}
        />
      </Stack>
    </Box>
  );
}
