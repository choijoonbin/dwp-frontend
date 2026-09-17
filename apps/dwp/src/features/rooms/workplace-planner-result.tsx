import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react';
import { ActionButton, EmptyState, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplacePlannerBatchCounts } from './workplace-planner-model';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplacePlannerOfferAction } from './workplace-planner-offer-action';
import { WorkplacePlannerPlacementEvidence } from './workplace-planner-placement-evidence';
import { WorkplacePlannerPromotionStatus } from './workplace-planner-promotion-status';
import { WorkplacePlannerWaitlistConditions } from './workplace-planner-waitlist-conditions';

import type {
  WorkplaceBookingBatch,
  WorkplaceExploreResponse,
  WorkplaceTeamPlacementConstraint,
  WorkplaceTeamPlacementConstraintEvidence,
  WorkplaceWaitlistEntry,
} from '@dwp-frontend/shared-utils';

function stateColor(state: WorkplaceBookingBatch['state']) {
  if (state === 'SUCCEEDED') return 'success' as const;
  if (state === 'PARTIAL' || state === 'COMPENSATING' || state === 'RESULT_UNKNOWN')
    return 'warning' as const;
  if (state === 'FAILED' || state === 'COMPENSATED') return 'error' as const;
  return 'info' as const;
}

export function WorkplacePlannerResult({
  batch,
  constraints,
  constraintEvidence,
  waitlists,
  catalog,
  loading,
  sourceReady,
  compensating,
  replanning,
  onRefresh,
  onCompensate,
  onReplan,
  acceptingOfferId,
  cancellingWaitlistId,
  onAcceptOffer,
  onLeaveWaitlist,
  waitlistServerTime,
  waitlistServerAnchorMs,
  timeZone,
  onRefreshWaitlists,
  onNewPlan,
}: {
  batch: WorkplaceBookingBatch | null;
  constraints: readonly WorkplaceTeamPlacementConstraint[];
  constraintEvidence: readonly WorkplaceTeamPlacementConstraintEvidence[];
  waitlists: readonly WorkplaceWaitlistEntry[];
  catalog: WorkplaceExploreResponse | null;
  loading: boolean;
  sourceReady: boolean;
  compensating: boolean;
  replanning: boolean;
  onRefresh: () => void;
  onCompensate: () => void;
  onReplan: () => void;
  acceptingOfferId: string | null;
  cancellingWaitlistId: string | null;
  onAcceptOffer: (offerId: string, expectedOfferVersion: number) => void;
  onLeaveWaitlist: (entry: WorkplaceWaitlistEntry) => void;
  waitlistServerTime: string;
  waitlistServerAnchorMs: number;
  timeZone: string;
  onRefreshWaitlists: () => void;
  onNewPlan: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  if (!batch) {
    return (
      <Box data-testid="workplace-planner-result" sx={workplaceMemberCard}>
        <EmptyState
          icon={<RefreshCw size={28} />}
          title={t('workplace.planner.result.recoveryTitle')}
          description={t('workplace.planner.result.recoveryDescription')}
          action={
            <ActionButton intent="primary" loading={loading} onClick={onRefresh}>
              {t('workplace.planner.actions.queryStatus')}
            </ActionButton>
          }
        />
      </Box>
    );
  }

  const counts = workplacePlannerBatchCounts(batch);
  const succeeded = batch.items.filter((item) => item.state === 'SUCCEEDED');
  const unresolved = batch.items.filter(
    (item) => item.state === 'FAILED' || item.state === 'RESULT_UNKNOWN'
  );
  const compensationAvailable = succeeded.some((item) => item.compensationAvailable);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);

  return (
    <Box data-testid="workplace-planner-result" sx={workplaceMemberCard}>
      <Box p={{ xs: 1.5, md: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
          <Box>
            <Typography component="h2" variant="h6">
              {t('workplace.planner.result.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.planner.result.itemSummary', { count: batch.items.length })}
            </Typography>
          </Box>
          <Chip
            color={stateColor(batch.state)}
            label={t(`workplace.planner.batchStates.${batch.state}`)}
          />
        </Stack>

        {(batch.state === 'RESULT_UNKNOWN' || batch.requeryRequired) && (
          <Box data-testid="workplace-planner-result-unknown">
            <InlineFeedback
              severity="warning"
              icon={<AlertTriangle size={19} />}
              action={
                <ActionButton intent="quiet" size="small" loading={loading} onClick={onRefresh}>
                  {t('workplace.planner.actions.queryStatus')}
                </ActionButton>
              }
              sx={{ mt: 2 }}
            >
              <Typography component="p" variant="subtitle2">
                {t('workplace.planner.result.unknownTitle')}
              </Typography>
              <Typography variant="body2">
                {t('workplace.planner.result.unknownDescription')}
              </Typography>
            </InlineFeedback>
          </Box>
        )}
        {!sourceReady && (
          <InlineFeedback severity="warning" sx={{ mt: 2 }}>
            {t('workplace.planner.states.staleWriteBlocked')}
          </InlineFeedback>
        )}

        <Stack direction="row" gap={0.75} flexWrap="wrap" mt={2}>
          {Object.entries(counts)
            .filter(([, count]) => count > 0)
            .map(([state, count]) => (
              <Chip
                key={state}
                size="small"
                variant="outlined"
                label={t(`workplace.planner.itemStates.${state}`, { count })}
              />
            ))}
        </Stack>

        <Box component="details" sx={{ mt: 1 }}>
          <Typography component="summary" variant="caption" sx={{ cursor: 'pointer' }}>
            {t('workplace.planner.result.auditDetails')}
          </Typography>
          <Typography
            component="p"
            variant="caption"
            color="text.secondary"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {t('workplace.planner.result.batchAudit', {
              batch: batch.batchId,
              actor: batch.actorUserId,
            })}
          </Typography>
        </Box>

        <WorkplacePlannerPlacementEvidence
          constraints={constraints}
          evidence={constraintEvidence}
        />

        <Stack spacing={1} mt={2}>
          {batch.items.map((item) => {
            const site = catalog?.sites.find((candidate) => candidate.siteId === item.siteId);
            const floor = catalog?.floors.find((candidate) => candidate.floorId === item.floorId);
            const start = formatDate(
              item.startsAt,
              { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timeZone },
              locale
            );
            const end = formatDate(
              item.endsAt,
              { timeStyle: 'short', timeZone: item.timeZone },
              locale
            );
            return (
              <Box
                key={item.batchItemId}
                data-testid={`workplace-planner-result-item-${item.batchItemId}`}
                sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}
              >
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Box minWidth={0}>
                    <Typography component="p" variant="subtitle2">
                      {item.resourceDisplayName}
                    </Typography>
                    <Typography variant="body2">
                      {t('workplace.planner.result.itemSchedule', { start, end })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('workplace.planner.result.itemLocation', {
                        site:
                          site?.name ?? t('workplace.planner.configuration.locationUnavailable'),
                        floor:
                          floor?.name ?? t('workplace.planner.configuration.locationUnavailable'),
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('workplace.planner.result.bookedFor', {
                        beneficiary: item.beneficiaryDisplayName,
                      })}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={
                      item.state === 'SUCCEEDED'
                        ? 'success'
                        : item.state === 'FAILED'
                          ? 'error'
                          : 'warning'
                    }
                    label={t(`workplace.planner.itemStateLabels.${item.state}`)}
                  />
                </Stack>
                <Box component="details" sx={{ mt: 0.75 }}>
                  <Typography component="summary" variant="caption" sx={{ cursor: 'pointer' }}>
                    {t('workplace.planner.result.auditDetails')}
                  </Typography>
                  <Typography
                    component="p"
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {t('workplace.planner.result.itemAudit', {
                      clientKey: item.clientItemKey,
                      beneficiary: item.beneficiaryUserId,
                      person: item.beneficiaryPersonPublicId ?? '—',
                      grant: item.delegationGrantId ?? t('workplace.planner.review.selfGrant'),
                      authority: item.authority,
                      site: item.siteId,
                      floor: item.floorId,
                    })}
                  </Typography>
                </Box>
                {item.errorMessage && (
                  <Typography variant="body2" color="error.main" sx={{ mt: 0.75 }}>
                    {item.errorMessage}
                  </Typography>
                )}
                {item.ownerReferenceId && (
                  <ActionButton
                    component={Link}
                    intent="quiet"
                    size="small"
                    endIcon={<ExternalLink size={14} />}
                    to={`/workplace/reservations?reservationAuthority=${item.authority}&reservation=${encodeURIComponent(item.ownerReferenceId)}`}
                    sx={{ mt: 0.75 }}
                  >
                    {t('workplace.planner.actions.openReservation')}
                  </ActionButton>
                )}
              </Box>
            );
          })}
        </Stack>

        {(batch.state === 'PARTIAL' || unresolved.length > 0) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography component="p" variant="subtitle2">
              {t('workplace.planner.result.recoveryActions')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mt={1}>
              {compensationAvailable && (
                <ActionButton
                  intent="danger"
                  loading={compensating}
                  disabled={!sourceReady}
                  onClick={onCompensate}
                >
                  {t('workplace.planner.actions.compensate')}
                </ActionButton>
              )}
              {unresolved.some((item) => item.state === 'FAILED') && (
                <ActionButton
                  intent="secondary"
                  loading={replanning}
                  disabled={!sourceReady}
                  startIcon={<RotateCcw size={16} />}
                  onClick={onReplan}
                >
                  {t('workplace.planner.actions.replan')}
                </ActionButton>
              )}
              <ActionButton intent="quiet" loading={loading} onClick={onRefresh}>
                {t('workplace.planner.actions.queryStatus')}
              </ActionButton>
            </Stack>
          </>
        )}

        {waitlists.length > 0 && (
          <Box mt={2}>
            <Typography component="h3" variant="subtitle1">
              {t('workplace.planner.waitlist.title')}
            </Typography>
            <Stack spacing={1} mt={1}>
              {waitlists.map((entry) => (
                <Box
                  key={entry.waitlistEntryId}
                  sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
                >
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography component="p" variant="subtitle2">
                        {entry.beneficiaryDisplayName} ·{' '}
                        {t(`workplace.resourceTypes.${entry.resourceType}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.rankVisible && entry.rank !== null
                          ? t('workplace.planner.waitlist.rank', { value: entry.rank })
                          : t('workplace.planner.waitlist.rankHidden')}
                      </Typography>
                      <WorkplacePlannerWaitlistConditions
                        conditions={entry.conditions}
                        timeZone={timeZone}
                      />
                      <WorkplacePlannerPromotionStatus
                        entry={entry}
                        onRefresh={onRefreshWaitlists}
                      />
                    </Box>
                    <Chip
                      size="small"
                      label={t(`workplace.planner.waitlistStates.${entry.state}`)}
                    />
                  </Stack>
                  {(entry.state === 'ACTIVE' || entry.state === 'OFFERED') && (
                    <ActionButton
                      intent="danger"
                      size="small"
                      loading={cancellingWaitlistId === entry.waitlistEntryId}
                      disabled={!sourceReady}
                      onClick={() => onLeaveWaitlist(entry)}
                      sx={{ mt: 1 }}
                    >
                      {t('workplace.planner.actions.leaveWaitlist')}
                    </ActionButton>
                  )}
                  {entry.offer && (
                    <Box mt={1}>
                      <WorkplacePlannerOfferAction
                        offer={entry.offer}
                        serverTime={waitlistServerTime}
                        serverAnchorMs={waitlistServerAnchorMs}
                        catalog={catalog}
                        siteId={entry.siteId}
                        floorId={entry.floorId}
                        timeZone={timeZone}
                        sourceReady={sourceReady}
                        accepting={acceptingOfferId === entry.offer.offerId}
                        onAccept={onAcceptOffer}
                        onRefresh={onRefreshWaitlists}
                      />
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <ActionButton
          intent="primary"
          startIcon={<CheckCircle2 size={17} />}
          onClick={onNewPlan}
          sx={{ mt: 2, minHeight: 44 }}
        >
          {t('workplace.planner.actions.newPlan')}
        </ActionButton>
      </Box>
    </Box>
  );
}
