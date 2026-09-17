import { useTranslation } from 'react-i18next';
import { BellRing, Hourglass } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplacePlannerOfferAction } from './workplace-planner-offer-action';
import { WorkplacePlannerPromotionStatus } from './workplace-planner-promotion-status';
import { WorkplacePlannerWaitlistConditions } from './workplace-planner-waitlist-conditions';

import type { WorkplaceExploreResponse, WorkplaceWaitlistEntry } from '@dwp-frontend/shared-utils';

export function WorkplacePlannerWaitlists({
  entries,
  sourceReady,
  catalog,
  timeZone,
  serverTime,
  serverAnchorMs,
  updatingId,
  cancellingId,
  acceptingOfferId,
  onToggleAutoConfirm,
  onLeave,
  onAcceptOffer,
  onRefresh,
}: {
  entries: readonly WorkplaceWaitlistEntry[];
  sourceReady: boolean;
  catalog: WorkplaceExploreResponse | null;
  timeZone: string;
  serverTime: string;
  serverAnchorMs: number;
  updatingId: string | null;
  cancellingId: string | null;
  acceptingOfferId: string | null;
  onToggleAutoConfirm: (entry: WorkplaceWaitlistEntry) => void;
  onLeave: (entry: WorkplaceWaitlistEntry) => void;
  onAcceptOffer: (offerId: string, expectedOfferVersion: number) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('rooms');
  if (entries.length === 0) return null;
  return (
    <Box data-testid="workplace-planner-waitlists" sx={workplaceMemberCard} mt={2}>
      <Box p={{ xs: 1.5, md: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Hourglass size={19} aria-hidden="true" />
          <Typography component="h2" variant="h6">
            {t('workplace.planner.waitlist.title')}
          </Typography>
        </Stack>
        <Stack spacing={1.25} mt={1.5}>
          {entries.map((entry) => (
            <Box
              key={entry.waitlistEntryId}
              data-testid={`workplace-planner-waitlist-${entry.waitlistEntryId}`}
              sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box minWidth={0}>
                  <Typography component="p" variant="subtitle2">
                    {entry.beneficiaryDisplayName} ·{' '}
                    {t(`workplace.resourceTypes.${entry.resourceType}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {entry.rankVisible && entry.rank !== null
                      ? t('workplace.planner.waitlist.rank', { value: entry.rank })
                      : t('workplace.planner.waitlist.rankHidden')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('workplace.planner.waitlist.channels', {
                      value: entry.notificationChannels
                        .map((channel) =>
                          t(`workplace.planner.waitlist.notificationChannels.${channel}`)
                        )
                        .join(', '),
                    })}
                  </Typography>
                  <WorkplacePlannerWaitlistConditions
                    conditions={entry.conditions}
                    timeZone={timeZone}
                  />
                  <WorkplacePlannerPromotionStatus entry={entry} onRefresh={onRefresh} />
                </Box>
                <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                  <Chip size="small" label={t(`workplace.planner.waitlistStates.${entry.state}`)} />
                  <Chip
                    size="small"
                    icon={<BellRing size={13} />}
                    color={entry.autoConfirm ? 'primary' : 'default'}
                    label={t(
                      entry.autoConfirm
                        ? 'workplace.planner.waitlist.autoConfirmOn'
                        : 'workplace.planner.waitlist.autoConfirmOff'
                    )}
                  />
                </Stack>
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                gap={1}
                mt={1}
              >
                {(entry.state === 'ACTIVE' || entry.state === 'OFFERED') && (
                  <>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      loading={updatingId === entry.waitlistEntryId}
                      disabled={!sourceReady}
                      onClick={() => onToggleAutoConfirm(entry)}
                    >
                      {t(
                        entry.autoConfirm
                          ? 'workplace.planner.actions.disableAutoConfirm'
                          : 'workplace.planner.actions.enableAutoConfirm'
                      )}
                    </ActionButton>
                    <ActionButton
                      intent="danger"
                      size="small"
                      loading={cancellingId === entry.waitlistEntryId}
                      disabled={!sourceReady}
                      onClick={() => onLeave(entry)}
                    >
                      {t('workplace.planner.actions.leaveWaitlist')}
                    </ActionButton>
                  </>
                )}
                {entry.offer && (
                  <WorkplacePlannerOfferAction
                    offer={entry.offer}
                    serverTime={serverTime}
                    serverAnchorMs={serverAnchorMs}
                    catalog={catalog}
                    siteId={entry.siteId}
                    floorId={entry.floorId}
                    timeZone={timeZone}
                    sourceReady={sourceReady}
                    accepting={acceptingOfferId === entry.offer.offerId}
                    onAccept={onAcceptOffer}
                    onRefresh={onRefresh}
                  />
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
