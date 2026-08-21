import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, ChevronRight, MessagesSquare, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions';
import { resolveProductTimeZone } from '@dwp-frontend/design-system';
import {
  getNotificationDetail,
  getNotificationDeliveryProfile,
  getNotificationEffectiveSettings,
  NOTIFICATION_LIVE_EVENT,
  parseNotificationLiveSignal,
  type NotificationDeliveryProfile,
  type NotificationEffectiveSettings,
  type NotificationItem,
  type NotificationLiveSignal,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { useNavigate } from 'react-router-dom';

import {
  isAssertiveNotificationArrival,
  isPersistentNotificationArrival,
  notificationArrivalContent,
  shouldSurfaceNotificationArrival,
} from './notification-arrival-policy';
import { isNotificationTargetActive } from './notification-active-context';
import { notificationQueryKeys } from '../features/notifications/integration-contract';
import { usePersonalPreference } from '../providers/personal-preference-provider';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Fade from '@mui/material/Fade';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const MAXIMUM_FETCH_BATCH = 20;
const MAXIMUM_PENDING_IDS = 200;
const MAXIMUM_RETRY_ATTEMPTS = 3;
const ARRIVAL_DURATION_MS = 8_000;
const ARRIVAL_RETRY_DELAY_MS = 1_500;

type Arrival = {
  item: NotificationItem;
  href: string | null;
};

type ArrivalPolicyState = {
  ready: boolean;
  profile: NotificationDeliveryProfile | undefined;
  settings: NotificationEffectiveSettings | undefined;
};

function primaryHref(item: NotificationItem): string | null {
  return (
    item.actions.find((action) => action.enabled && action.primary && action.href)?.href ??
    item.actions.find((action) => action.enabled && action.href)?.href ??
    null
  );
}

function arrivalIcon(item: NotificationItem) {
  return item.source.appKey === 'messaging' ? <MessagesSquare size={18} /> : <BellRing size={18} />;
}

export function NotificationArrivalHost() {
  const { t } = useTranslation(['notifications', 'common']);
  const { isAuthenticated, user } = useAuth();
  const personalPreference = usePersonalPreference();
  const navigate = useNavigate();
  const [urgentQueue, setUrgentQueue] = useState<Arrival[]>([]);
  const [ordinaryCount, setOrdinaryCount] = useState(0);
  const [arrivalRevision, setArrivalRevision] = useState(0);
  const seenIds = useRef(new Set<string>());
  const pendingIds = useRef(new Set<string>());
  const inFlightIds = useRef(new Set<string>());
  const retryAttempts = useRef(new Map<string, number>());
  const identity = user ? `${user.tenantId}:${user.userId}` : null;
  const identityRef = useRef(identity);
  const policyStateRef = useRef<ArrivalPolicyState>({
    ready: false,
    profile: undefined,
    settings: undefined,
  });
  const profileQuery = useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: ({ signal }) => getNotificationDeliveryProfile(signal),
    enabled: isAuthenticated && Boolean(user),
    staleTime: 30_000,
    retry: 1,
  });
  const effectiveSettingsQuery = useQuery({
    queryKey: notificationQueryKeys.effectiveSettings(),
    queryFn: ({ signal }) => getNotificationEffectiveSettings(signal),
    enabled: isAuthenticated && Boolean(user),
    staleTime: 30_000,
    retry: 1,
  });
  const effectiveProfile = useMemo(() => {
    if (!profileQuery.data) return undefined;
    return {
      ...profileQuery.data,
      quietHours: {
        ...profileQuery.data.quietHours,
        timeZone: resolveProductTimeZone(
          personalPreference.preference?.preferences.regional.timeZone,
          profileQuery.data.quietHours.timeZone
        ),
      },
    };
  }, [personalPreference.preference?.preferences.regional.timeZone, profileQuery.data]);
  const arrivalPolicyReady = Boolean(
    profileQuery.isSuccess &&
    effectiveProfile &&
    effectiveSettingsQuery.isSuccess &&
    effectiveSettingsQuery.data &&
    !effectiveSettingsQuery.data.partial
  );

  useEffect(() => {
    identityRef.current = identity;
    policyStateRef.current = {
      ready: arrivalPolicyReady,
      profile: effectiveProfile,
      settings: effectiveSettingsQuery.data,
    };
  }, [arrivalPolicyReady, effectiveProfile, effectiveSettingsQuery.data, identity]);

  const enqueue = useCallback((arrival: Arrival) => {
    if (!isPersistentNotificationArrival(arrival.item)) {
      setOrdinaryCount((current) => current + 1);
      return;
    }
    setUrgentQueue((current) =>
      current.some(({ item }) => item.notificationId === arrival.item.notificationId)
        ? current
        : [...current, arrival]
    );
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setUrgentQueue([]);
      setOrdinaryCount(0);
      seenIds.current.clear();
      pendingIds.current.clear();
      inFlightIds.current.clear();
      retryAttempts.current.clear();
      return undefined;
    }

    const handleSignal = (event: Event) => {
      const signal = parseNotificationLiveSignal(
        (event as CustomEvent<NotificationLiveSignal>).detail
      );
      if (!signal) return;
      let changed = false;
      for (const notificationId of signal.changedIds) {
        if (seenIds.current.has(notificationId)) continue;
        if ((retryAttempts.current.get(notificationId) ?? 0) >= MAXIMUM_RETRY_ATTEMPTS) {
          retryAttempts.current.delete(notificationId);
        }
        if (!pendingIds.current.has(notificationId)) {
          pendingIds.current.add(notificationId);
          changed = true;
        } else {
          changed = true;
        }
      }
      while (pendingIds.current.size > MAXIMUM_PENDING_IDS) {
        const oldest = pendingIds.current.values().next().value;
        if (!oldest) break;
        pendingIds.current.delete(oldest);
        retryAttempts.current.delete(oldest);
      }
      if (changed) setArrivalRevision((current) => current + 1);
    };

    window.addEventListener(NOTIFICATION_LIVE_EVENT, handleSignal);
    return () => window.removeEventListener(NOTIFICATION_LIVE_EVENT, handleSignal);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || !arrivalPolicyReady) return undefined;
    const candidateIds = [...pendingIds.current]
      .filter(
        (notificationId) =>
          !seenIds.current.has(notificationId) &&
          !inFlightIds.current.has(notificationId) &&
          (retryAttempts.current.get(notificationId) ?? 0) < MAXIMUM_RETRY_ATTEMPTS
      )
      .slice(0, MAXIMUM_FETCH_BATCH);
    if (candidateIds.length === 0) return undefined;

    const processingIdentity = identity;
    const inFlight = inFlightIds.current;
    candidateIds.forEach((notificationId) => inFlight.add(notificationId));
    void Promise.allSettled(
      candidateIds.map((notificationId) => getNotificationDetail(notificationId))
    ).then((settled) => {
      let retryRequired = false;
      settled.forEach((result, index) => {
        const notificationId = candidateIds[index];
        if (!notificationId) return;
        inFlight.delete(notificationId);
        if (identityRef.current !== processingIdentity) return;

        if (result.status === 'rejected') {
          const attempts = (retryAttempts.current.get(notificationId) ?? 0) + 1;
          retryAttempts.current.set(notificationId, attempts);
          retryRequired ||= attempts < MAXIMUM_RETRY_ATTEMPTS;
          return;
        }

        const policyState = policyStateRef.current;
        if (!policyState.ready) return;
        pendingIds.current.delete(notificationId);
        retryAttempts.current.delete(notificationId);
        seenIds.current.add(notificationId);
        while (seenIds.current.size > 2_000) {
          const oldest = seenIds.current.values().next().value;
          if (!oldest) break;
          seenIds.current.delete(oldest);
        }

        const item = result.value.item;
        if (!shouldSurfaceNotificationArrival(item, policyState.profile, policyState.settings)) {
          return;
        }
        if (isNotificationTargetActive(item, document.visibilityState === 'visible')) return;
        enqueue({ item, href: primaryHref(item) });
      });

      const morePending = [...pendingIds.current].some(
        (notificationId) =>
          !inFlight.has(notificationId) &&
          (retryAttempts.current.get(notificationId) ?? 0) < MAXIMUM_RETRY_ATTEMPTS
      );
      if ((retryRequired || morePending) && identityRef.current === processingIdentity) {
        window.setTimeout(
          () => {
            if (identityRef.current === processingIdentity) {
              setArrivalRevision((current) => current + 1);
            }
          },
          retryRequired ? ARRIVAL_RETRY_DELAY_MS : 0
        );
      }
    });
  }, [arrivalPolicyReady, arrivalRevision, enqueue, identity, isAuthenticated, user]);

  const currentUrgent = urgentQueue[0] ?? null;
  const summaryVisible = !currentUrgent && ordinaryCount > 0;
  const content = currentUrgent
    ? notificationArrivalContent(
        currentUrgent.item,
        effectiveProfile,
        t('arrival.protectedContent')
      )
    : null;
  const assertive = currentUrgent ? isAssertiveNotificationArrival(currentUrgent.item) : false;
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    []
  );
  const close = useCallback(() => {
    if (currentUrgent) {
      setUrgentQueue((items) => items.slice(1));
      return;
    }
    setOrdinaryCount(0);
  }, [currentUrgent]);
  const open = useCallback(() => {
    if (!currentUrgent) {
      setOrdinaryCount(0);
      navigate('/notifications/center');
      return;
    }
    close();
    navigate(
      currentUrgent.href ??
        `/notifications/center/${encodeURIComponent(currentUrgent.item.notificationId)}`
    );
  }, [close, currentUrgent, navigate]);

  return (
    <Snackbar
      open={Boolean(currentUrgent) || summaryVisible}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      autoHideDuration={currentUrgent ? null : ARRIVAL_DURATION_MS}
      onClose={(_, reason) => reason !== 'clickaway' && close()}
      TransitionComponent={Fade}
      transitionDuration={reducedMotion ? 0 : { enter: 180, exit: 140 }}
      sx={{ mt: 7, mr: { xs: 0, sm: 1 }, maxWidth: { xs: 'calc(100vw - 24px)', sm: 420 } }}
    >
      <Paper
        elevation={8}
        role={assertive ? 'alert' : 'status'}
        aria-live={assertive ? 'assertive' : 'polite'}
        aria-atomic="true"
        sx={{
          width: 1,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: 'background.paper',
        }}
      >
        {(currentUrgent || summaryVisible) && (
          <Stack direction="row" alignItems="flex-start">
            <ButtonBase
              onClick={open}
              aria-label={`${
                currentUrgent
                  ? (content?.title ?? t('arrival.protectedContent'))
                  : t('glance.newItems', { count: ordinaryCount })
              }. ${t('arrival.open')}`}
              sx={{ minWidth: 0, flex: 1, p: 1.75, textAlign: 'left', alignItems: 'stretch' }}
            >
              <Stack direction="row" gap={1.25} sx={{ width: 1 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    flex: '0 0 auto',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                  }}
                >
                  {currentUrgent ? arrivalIcon(currentUrgent.item) : <BellRing size={18} />}
                </Box>
                <Box minWidth={0} sx={{ flex: 1 }}>
                  {currentUrgent && (
                    <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary">
                        {currentUrgent.item.source.appName}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        color="error"
                        label={t('priority.URGENT')}
                      />
                    </Stack>
                  )}
                  <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
                    {currentUrgent
                      ? content?.title
                      : t('glance.newItems', { count: ordinaryCount })}
                  </Typography>
                  {content?.preview && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.25,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {content.preview}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    color="primary.main"
                    sx={{ display: 'block', mt: 0.75 }}
                  >
                    {currentUrgent ? currentUrgent.item.reason.label : t('arrival.open')}
                  </Typography>
                </Box>
                <ActionIconButton component="span" size="small" label={t('arrival.open')}>
                  <ChevronRight size={18} />
                </ActionIconButton>
              </Stack>
            </ButtonBase>
            <Box sx={{ pt: 1, pr: 1 }}>
              <ActionIconButton size="small" label={t('common:actions.close')} onClick={close}>
                <X size={17} />
              </ActionIconButton>
            </Box>
          </Stack>
        )}
      </Paper>
    </Snackbar>
  );
}
