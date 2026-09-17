import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import type { WorkplaceWaitlistEntry } from '@dwp-frontend/shared-utils';

const KNOWN_PROMOTION_CODES = new Set([
  'BENEFICIARY_AUTHORIZATION_NOT_ACTIVE',
  'DISTANCE_ANCHOR_REQUIRED',
  'GROUP_MEMBERSHIP_REVALIDATION_UNAVAILABLE',
  'MATCHED_ALTERNATIVE_RESOURCE',
  'MATCHED_FLEXIBLE_WINDOW',
  'MATCHED_FLEXIBLE_WINDOW_AND_RESOURCE',
  'MATCHED_ORIGINAL_WINDOW',
  'MATCH_LOST_DURING_EXACT_HOLD',
  'NO_CURRENT_RESOURCE_MATCH',
  'PHYSICAL_DISTANCE_SCALE_NOT_CONFIGURED',
]);

export function WorkplacePlannerPromotionStatus({
  entry,
  onRefresh,
}: {
  entry: WorkplaceWaitlistEntry;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('rooms');
  if (entry.promotionEvaluationState === 'MATCHED' || entry.offer) return null;
  const code =
    entry.promotionDecisionCode && KNOWN_PROMOTION_CODES.has(entry.promotionDecisionCode)
      ? entry.promotionDecisionCode
      : 'GENERIC';
  const blocked = entry.promotionEvaluationState === 'BLOCKED';
  return (
    <Box data-testid={`workplace-planner-promotion-${entry.waitlistEntryId}`}>
      <InlineFeedback
        severity={blocked ? 'warning' : 'info'}
        action={
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={14} />}
            onClick={onRefresh}
          >
            {t('workplace.planner.actions.refreshWaitlist')}
          </ActionButton>
        }
        sx={{ mt: 1 }}
      >
        <Typography component="p" variant="subtitle2">
          {t(
            blocked
              ? 'workplace.planner.waitlist.promotionBlocked'
              : `workplace.planner.waitlist.promotionStates.${entry.promotionEvaluationState}`
          )}
        </Typography>
        <Typography variant="body2">
          {t(`workplace.planner.waitlist.promotionDecisions.${code}`)}
        </Typography>
      </InlineFeedback>
    </Box>
  );
}
