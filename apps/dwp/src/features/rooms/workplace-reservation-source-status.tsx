import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { workplaceHomeSourceState } from './workplace-home-source-state';

import type { WorkplaceHomeSourceState } from './workplace-home-source-state';
import type { WorkplaceReservationAuthority } from './workplace-unified-reservations-model';

function stateColor(state: WorkplaceHomeSourceState): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'READY') return 'success';
  if (state === 'STALE' || state === 'LOADING') return 'warning';
  if (state === 'DENIED' || state === 'UNAVAILABLE') return 'error';
  return 'default';
}

export function resolveReservationSourceState({
  loaded,
  permitted,
  snapshot,
}: {
  loaded: boolean;
  permitted: boolean;
  snapshot: {
    data: unknown;
    error: unknown;
    failureCount: number;
    failureReason: unknown;
    isError: boolean;
    isPending: boolean;
  };
}): WorkplaceHomeSourceState {
  if (!loaded) return 'LOADING';
  if (!permitted) return 'DENIED';
  return workplaceHomeSourceState({ ...snapshot, required: true });
}

export function WorkplaceReservationSourceStatus({
  authority,
  state,
  lastVerified,
  onRetry,
}: {
  authority: WorkplaceReservationAuthority;
  state: WorkplaceHomeSourceState;
  lastVerified: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box
      data-testid={`workplace-reservations-source-${authority.toLowerCase()}`}
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, minWidth: 0 })}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box minWidth={0}>
          <Typography component="p" variant="subtitle2">
            {t(`workplace.reservations.authorities.${authority}`)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.reservations.lastVerified', { value: lastVerified })}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={stateColor(state)}
          label={t(`workplace.reservations.sourceStates.${state}`)}
        />
      </Stack>
      {(state === 'STALE' || state === 'UNAVAILABLE') && (
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<RefreshCw size={14} />}
          onClick={onRetry}
          sx={{ mt: 1 }}
        >
          {t('actions.retry')}
        </ActionButton>
      )}
    </Box>
  );
}
