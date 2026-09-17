import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, RefreshCw } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplacePlannerOfferSecondsRemaining } from './workplace-planner-model';

import type { WorkplaceAlternativeOffer } from '@dwp-frontend/shared-utils';
import type { WorkplaceExploreResponse } from '@dwp-frontend/shared-utils';

export function WorkplacePlannerOfferAction({
  offer,
  serverTime,
  serverAnchorMs,
  catalog,
  siteId,
  floorId,
  timeZone,
  sourceReady,
  accepting,
  onAccept,
  onRefresh,
}: {
  offer: WorkplaceAlternativeOffer;
  serverTime: string;
  serverAnchorMs: number;
  catalog: WorkplaceExploreResponse | null;
  siteId: string | null;
  floorId: string | null;
  timeZone: string;
  sourceReady: boolean;
  accepting: boolean;
  onAccept: (offerId: string, expectedOfferVersion: number) => void;
  onRefresh: () => void;
}) {
  const { t, i18n } = useTranslation('rooms');
  const [tick, setTick] = useState(0);
  const refreshedExpiredOfferRef = useRef<string | null>(null);
  const elapsedMs = serverAnchorMs > 0 ? Math.max(0, Date.now() - serverAnchorMs) : 0;
  const secondsRemaining = workplacePlannerOfferSecondsRemaining(
    offer.expiresAt,
    serverTime,
    elapsedMs
  );
  const offered = offer.state === 'OFFERED';
  const expired = !offered || secondsRemaining <= 0;
  const offerSnapshotKey = `${offer.offerId}:${offer.version}`;
  const resource = catalog?.resources.find(
    (candidate) => candidate.resourceId === offer.resourceId
  );
  const floor = catalog?.floors.find(
    (candidate) => candidate.floorId === (offer.floorId || resource?.floorId || floorId)
  );
  const site = catalog?.sites.find(
    (candidate) =>
      candidate.siteId === (offer.siteId || resource?.siteId || floor?.siteId || siteId)
  );
  const displayTimeZone = offer.timeZone || site?.timeZone || timeZone;
  const locale = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const proposedStart = formatDate(
    offer.startsAt,
    { dateStyle: 'medium', timeStyle: 'short', timeZone: displayTimeZone },
    locale
  );
  const proposedEnd = formatDate(
    offer.endsAt,
    { timeStyle: 'short', timeZone: displayTimeZone },
    locale
  );

  useEffect(() => {
    if (!offered || secondsRemaining <= 0) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [offered, secondsRemaining, tick]);

  useEffect(() => {
    if (!offered || secondsRemaining > 0) return;
    if (refreshedExpiredOfferRef.current === offerSnapshotKey) return;
    refreshedExpiredOfferRef.current = offerSnapshotKey;
    onRefresh();
  }, [offerSnapshotKey, offered, onRefresh, secondsRemaining]);

  return (
    <Stack spacing={0.75} alignItems="flex-start">
      <Typography component="p" variant="body2">
        {t('workplace.planner.waitlist.offerResource', {
          resource:
            offer.resourceDisplayName ||
            resource?.name ||
            t('workplace.planner.waitlist.resourceUnavailable'),
          site: site?.name ?? t('workplace.planner.waitlist.locationUnavailable'),
          floor: floor?.name ?? t('workplace.planner.waitlist.locationUnavailable'),
        })}
      </Typography>
      <Typography component="p" variant="caption" color="text.secondary">
        {t('workplace.planner.waitlist.offerSchedule', {
          start: proposedStart,
          end: proposedEnd,
        })}
      </Typography>
      <Typography
        data-testid="workplace-planner-offer-countdown"
        component="p"
        variant="caption"
        color={expired ? 'error.main' : 'warning.main'}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        <Clock3 size={13} aria-hidden="true" />
        {expired
          ? t('workplace.planner.waitlist.offerExpired')
          : t('workplace.planner.waitlist.offerCountdown', { seconds: secondsRemaining })}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.75}>
        <ActionButton
          data-testid="workplace-planner-offer-accept"
          intent="primary"
          size="small"
          loading={accepting}
          disabled={!sourceReady || expired}
          onClick={() => onAccept(offer.offerId, offer.version)}
        >
          {t('workplace.planner.actions.acceptOffer')}
        </ActionButton>
        {expired && (
          <ActionButton
            data-testid="workplace-planner-offer-refresh"
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={14} />}
            onClick={onRefresh}
          >
            {t('workplace.planner.actions.refreshOffer')}
          </ActionButton>
        )}
      </Stack>
    </Stack>
  );
}
