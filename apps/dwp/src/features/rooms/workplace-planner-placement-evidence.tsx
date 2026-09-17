import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type {
  WorkplaceTeamPlacementConstraint,
  WorkplaceTeamPlacementConstraintEvidence,
} from '@dwp-frontend/shared-utils';

const EVIDENCE_COLOR = {
  SATISFIED: 'success',
  UNSATISFIED: 'error',
  UNSUPPORTED: 'warning',
} as const;

export function WorkplacePlannerPlacementEvidence({
  constraints,
  evidence,
}: {
  constraints: readonly WorkplaceTeamPlacementConstraint[];
  evidence: readonly WorkplaceTeamPlacementConstraintEvidence[];
}) {
  const { t } = useTranslation('rooms');
  if (constraints.length === 0 && evidence.length === 0) return null;

  const constraintByGroup = new Map(
    constraints.map((constraint) => [constraint.groupKey, constraint])
  );
  return (
    <Box data-testid="workplace-planner-placement-evidence" sx={{ mt: 2 }}>
      <Typography component="h3" variant="subtitle1">
        {t('workplace.planner.placement.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('workplace.planner.placement.description', { count: evidence.length })}
      </Typography>
      <Stack spacing={1} mt={1}>
        {evidence.map((item) => {
          const requested = constraintByGroup.get(item.groupKey);
          const labels = requested
            ? [
                requested.adjacentSeats ? t('workplace.planner.placement.adjacentSeats') : null,
                requested.sameNeighborhood
                  ? t('workplace.planner.placement.sameNeighborhood')
                  : null,
                requested.minimumDistanceMeters !== null
                  ? t('workplace.planner.placement.minimumDistance', {
                      value: requested.minimumDistanceMeters,
                    })
                  : null,
                requested.maximumDistanceMeters !== null
                  ? t('workplace.planner.placement.maximumDistance', {
                      value: requested.maximumDistanceMeters,
                    })
                  : null,
              ].filter(Boolean)
            : [];
          return (
            <Box
              key={item.groupKey}
              data-testid={`workplace-planner-placement-${item.groupKey}`}
              sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
            >
              <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
                <Typography component="p" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {t('workplace.planner.placement.group', { value: item.groupKey })}
                </Typography>
                <Chip
                  size="small"
                  color={EVIDENCE_COLOR[item.state]}
                  label={t(`workplace.planner.placement.states.${item.state}`)}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {labels.length > 0
                  ? t('workplace.planner.placement.requested', { value: labels.join(' · ') })
                  : t('workplace.planner.placement.noConstraints')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {item.message}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {item.code}
              </Typography>
              {item.selectedResourceIds.length > 0 && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('workplace.planner.placement.selectedResources', {
                    value: item.selectedResourceIds.join(', '),
                  })}
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
