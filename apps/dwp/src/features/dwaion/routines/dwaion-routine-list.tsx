import { Archive, Clock3, FlaskConical, PauseCircle } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';

import type { DwaionRoutineCopy } from './dwaion-routine-copy';
import type { DwaionRoutine } from './dwaion-routine-model';

export function DwaionRoutineList({
  routines,
  selectedId,
  onSelect,
  copy = DWAION_ROUTINE_COPY_KO,
}: {
  routines: readonly DwaionRoutine[];
  selectedId?: string;
  onSelect: (routine: DwaionRoutine) => void;
  copy?: DwaionRoutineCopy;
}) {
  return (
    <Box
      component="section"
      aria-label={copy.title}
      sx={{ borderBlock: 1, borderColor: 'divider' }}
    >
      {routines.map((routine, index) => (
        <Box key={routine.routineId}>
          {index > 0 ? <Divider /> : null}
          <Box
            component="button"
            type="button"
            aria-pressed={selectedId === routine.routineId}
            onClick={() => onSelect(routine)}
            sx={{
              width: '100%',
              minHeight: 64,
              display: 'grid',
              gridTemplateColumns: '40px minmax(0, 1fr) auto',
              gap: 1.25,
              alignItems: 'center',
              border: 0,
              px: { xs: 1, sm: 1.5 },
              py: 1.25,
              bgcolor: selectedId === routine.routineId ? 'var(--dwp-product-soft)' : 'transparent',
              color: 'text.primary',
              textAlign: 'left',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
              '@media (forced-colors: active)': {
                border: selectedId === routine.routineId ? '1px solid Highlight' : 0,
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: (theme) => theme.shape.borderRadius,
                bgcolor: 'action.hover',
                color: routine.status === 'DRAFT' ? 'primary.main' : 'text.secondary',
              }}
            >
              {routine.status === 'DRAFT' ? (
                <FlaskConical size={19} />
              ) : routine.status === 'PAUSED' ? (
                <PauseCircle size={19} />
              ) : (
                <Archive size={19} />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                <Typography
                  variant="body2"
                  fontWeight="fontWeightBold"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {routine.title}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  label={copy.status[routine.status]}
                  sx={{ height: 22 }}
                />
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
              >
                {routine.description}
              </Typography>
            </Box>
            <Stack alignItems="flex-end" gap={0.35} sx={{ minWidth: 0 }}>
              <Clock3 size={15} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {routine.schedule.localTime.slice(0, 5)}
              </Typography>
              <Typography variant="caption" color="primary.main">
                {copy.proposalOnly}
              </Typography>
            </Stack>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
