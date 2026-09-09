import { Archive, Clock3, Database, FlaskConical, PauseCircle, ShieldCheck } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DWAION_ROUTINE_COPY_KO } from './dwaion-routine-copy';
import { routineConsentComplete } from './dwaion-routine-model';

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
    <Box component="section" aria-label={copy.title} sx={{ display: 'grid', gap: 1.5 }}>
      {routines.map((routine) => (
        <Box key={routine.routineId}>
          <Box
            component="button"
            type="button"
            aria-pressed={selectedId === routine.routineId}
            onClick={() => onSelect(routine)}
            sx={{
              width: '100%',
              minHeight: 132,
              display: 'block',
              border: 1,
              borderColor:
                selectedId === routine.routineId
                  ? 'primary.main'
                  : routineConsentComplete(routine.consents)
                    ? 'divider'
                    : 'warning.main',
              borderLeftWidth: 4,
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 2 + 'px',
              px: { xs: 1.5, sm: 2 },
              py: 1.5,
              bgcolor: 'background.paper',
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
            <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start">
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                  {selectedId === routine.routineId ? (
                    <Chip size="small" color="primary" label={copy.selected} sx={{ height: 22 }} />
                  ) : null}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${copy.revisionPrefix}${routine.revision}`}
                    sx={{ height: 22 }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={
                      routine.status === 'DRAFT' && !routineConsentComplete(routine.consents)
                        ? 'warning'
                        : routine.status === 'DRAFT'
                          ? 'success'
                          : 'default'
                    }
                    label={
                      routine.status === 'DRAFT' && !routineConsentComplete(routine.consents)
                        ? copy.filters.ATTENTION
                        : copy.status[routine.status]
                    }
                    sx={{ height: 22 }}
                  />
                </Stack>
                <Typography
                  variant="h6"
                  fontWeight="fontWeightBold"
                  sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                >
                  {routine.title}
                </Typography>
              </Box>
              <Box
                aria-hidden="true"
                sx={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
                  bgcolor: 'var(--dwp-product-soft)',
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
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {routine.description}
            </Typography>
            <Divider sx={{ my: 1.25 }} />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <Fact
                icon={<Clock3 size={15} />}
                label={copy.schedule}
                value={`${copy.cadence[routine.schedule.cadence]} · ${routine.schedule.localTime.slice(0, 5)}`}
              />
              <Fact
                icon={<Database size={15} />}
                label={copy.sources}
                value={routine.sourceKeys
                  .map(
                    (source) =>
                      copy.sourceLabels[source as keyof typeof copy.sourceLabels] ?? source
                  )
                  .join(' · ')}
              />
              <Fact
                icon={<ShieldCheck size={15} />}
                label={copy.engineLabel}
                value={copy.proposalOnly}
              />
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ mt: 0.2, color: 'primary.main' }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="caption" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
