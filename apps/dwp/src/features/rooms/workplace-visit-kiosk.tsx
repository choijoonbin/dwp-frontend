import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, CircleHelp, LogOut, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  arriveWorkplaceKioskVisit,
  checkoutWorkplaceKioskVisit,
  createWorkplaceIdempotencyKey,
  getWorkplaceKioskSession,
  getWorkplaceKioskVisit,
  heartbeatWorkplaceKioskSession,
  requestWorkplaceKioskHelp,
  resolveIdempotentMutationIntent,
} from '@dwp-frontend/shared-utils';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, FormField, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { workplaceVisitTone } from './workplace-visits-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceKioskDeviceAuth,
  WorkplaceKioskVisit,
} from '@dwp-frontend/shared-utils';

type KioskCommand = 'ARRIVE' | 'CHECKOUT' | 'HELP' | 'PRIVACY';

function kioskMessage(state: string) {
  if (state === 'UNREGISTERED') return 'unregistered';
  if (state === 'WRONG_SITE') return 'wrongSite';
  if (state === 'OFFLINE') return 'offline';
  if (state === 'PRIVACY_NOTICE_REQUIRED') return 'privacyRequired';
  if (state === 'PROVIDER_UNAVAILABLE') return 'providerUnavailable';
  if (state === 'HELP_REQUESTED') return 'helpRequested';
  if (state === 'RETIRED') return 'retired';
  return null;
}

export function WorkplaceVisitKiosk({ auth }: { auth: WorkplaceKioskDeviceAuth }) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const queryClient = useQueryClient();
  const [visitId, setVisitId] = useState('');
  const [visit, setVisit] = useState<WorkplaceKioskVisit | null>(null);
  const [reason, setReason] = useState('Visitor confirmed the requested kiosk action');
  const [confirmed, setConfirmed] = useState(false);
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const sessionQuery = useQuery({
    queryKey: ['workplace', 'kiosk', 'session'],
    queryFn: () => getWorkplaceKioskSession(auth),
    retry: false,
    refetchInterval: 30_000,
  });
  const session = sessionQuery.data ?? null;
  const ready = Boolean(
    session?.state === 'READY' &&
      session.active &&
      session.privacyNoticeAccepted &&
      session.deviceId &&
      session.siteId
  );
  const stateMessage = session ? kioskMessage(session.state) : null;
  const lookup = useMutation({
    mutationFn: () => {
      if (!ready || !visitId.trim()) throw new Error('KIOSK_LOOKUP_BLOCKED');
      return getWorkplaceKioskVisit(visitId.trim(), auth);
    },
    retry: false,
    onSuccess: setVisit,
  });
  const command = useMutation({
    mutationFn: async (action: KioskCommand) => {
      if (!session?.deviceId) throw new Error('KIOSK_SESSION_REQUIRED');
      const expectedVersion =
        action === 'ARRIVE' || action === 'CHECKOUT' ? visit?.version : session.version;
      if (expectedVersion === undefined) throw new Error('KIOSK_VERSION_REQUIRED');
      const input = {
        expectedVersion,
        reason: reason.trim(),
        explicitConfirmation: true as const,
      };
      if (!confirmed || !input.reason) throw new Error('KIOSK_CONFIRMATION_REQUIRED');
      const fingerprint = { action, visitId: visit?.visitId, ...input };
      const intent = resolveIdempotentMutationIntent(intentRef.current, fingerprint, () =>
        createWorkplaceIdempotencyKey(`visit-kiosk-${action.toLowerCase()}`)
      );
      intentRef.current = intent;
      const options = { idempotencyKey: intent.key };
      if (action === 'ARRIVE' && visit) {
        return arriveWorkplaceKioskVisit(visit.visitId, input, options, auth);
      }
      if (action === 'CHECKOUT' && visit) {
        return checkoutWorkplaceKioskVisit(visit.visitId, input, options, auth);
      }
      if (action === 'PRIVACY') {
        if (!session.privacyNoticeVersion) throw new Error('KIOSK_PRIVACY_VERSION_REQUIRED');
        return heartbeatWorkplaceKioskSession(
          session.deviceId,
          {
            expectedVersion: session.version,
            privacyNoticeVersion: session.privacyNoticeVersion,
            privacyNoticeAccepted: true,
            observedAt: new Date().toISOString(),
          },
          options,
          auth
        );
      }
      return requestWorkplaceKioskHelp(session.deviceId, input, options, auth);
    },
    retry: false,
    onSuccess: async (result, action) => {
      intentRef.current = null;
      setConfirmed(false);
      if ((action === 'ARRIVE' || action === 'CHECKOUT') && 'visit' in result && visit) {
        setVisit({ ...visit, state: result.visit.state, version: result.visit.version });
      }
      await queryClient.invalidateQueries({ queryKey: ['workplace', 'kiosk', 'session'] });
    },
    onError: () => void sessionQuery.refetch(),
  });
  const recovery = visit?.state === 'RESULT_UNKNOWN';

  return (
    <Box
      component="main"
      data-testid="workplace-visit-kiosk"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        p: { xs: 1.5, sm: 3 },
      }}
    >
      <Box
        sx={(theme) => ({
          ...workplaceMemberCard(theme),
          width: 'min(100%, 640px)',
          p: { xs: 2, sm: 3 },
        })}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="primary.main">
              {t('workplace.visits.kiosk.eyebrow')}
            </Typography>
            <Typography component="h1" variant="h4" fontWeight="fontWeightBold">
              {t('workplace.visits.kiosk.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t('workplace.visits.kiosk.description')}
            </Typography>
          </Box>
          {sessionQuery.isLoading ? (
            <LoadingState embedded label={t('workplace.visits.kiosk.checkingDevice')} />
          ) : sessionQuery.isError || !session ? (
            <InlineFeedback severity="error">
              {t('workplace.visits.kiosk.sessionError')}
              <ActionButton intent="quiet" onClick={() => void sessionQuery.refetch()}>
                {t('actions.retry')}
              </ActionButton>
            </InlineFeedback>
          ) : (
            <>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                <Chip
                  color={ready ? 'success' : 'warning'}
                  label={t(`workplace.visits.kioskStates.${session.state}`)}
                />
                {session.lastHeartbeatAt && (
                  <Typography variant="caption" color="text.secondary">
                    {t('workplace.visits.kiosk.lastHeartbeat', {
                      value: formatDate(
                        session.lastHeartbeatAt,
                        { dateStyle: 'short', timeStyle: 'short' },
                        locale
                      ),
                    })}
                  </Typography>
                )}
              </Stack>
              {stateMessage && (
                <InlineFeedback severity={session.state === 'RETIRED' ? 'error' : 'warning'}>
                  {t(`workplace.visits.kiosk.messages.${stateMessage}`)}
                </InlineFeedback>
              )}
              {session.state === 'PRIVACY_NOTICE_REQUIRED' && (
                <ActionButton
                  intent="primary"
                  disabled={!confirmed}
                  loading={command.isPending}
                  onClick={() => command.mutate('PRIVACY')}
                >
                  {t('workplace.visits.kiosk.acceptPrivacy')}
                </ActionButton>
              )}
              {ready && (
                <Stack spacing={1.25}>
                  <FormField
                    label={t('workplace.visits.kiosk.visitReference')}
                    value={visitId}
                    onChange={(event) => setVisitId(event.target.value)}
                  />
                  <ActionButton
                    intent="secondary"
                    loading={lookup.isPending}
                    disabled={!visitId.trim()}
                    onClick={() => lookup.mutate()}
                  >
                    {t('workplace.visits.kiosk.findVisit')}
                  </ActionButton>
                </Stack>
              )}
              {lookup.isError && (
                <InlineFeedback severity="error">
                  {t('workplace.visits.kiosk.visitNotFound')}
                </InlineFeedback>
              )}
              {visit && (
                <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 2 })}>
                  <Stack direction="row" justifyContent="space-between" gap={1} alignItems="start">
                    <Box>
                      <Typography component="h2" variant="h6">
                        {visit.maskedLabel}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {visit.purpose}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={workplaceVisitTone(visit.state)}
                      label={t(`workplace.visits.states.${visit.state}`)}
                    />
                  </Stack>
                  {recovery ? (
                    <InlineFeedback
                      severity="warning"
                      icon={<AlertTriangle size={18} />}
                      sx={{ mt: 1.5 }}
                    >
                      {t('workplace.visits.recovery.getOnly')}
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<RefreshCw size={15} />}
                        onClick={() => lookup.mutate()}
                      >
                        {t('workplace.visits.actions.refreshStatus')}
                      </ActionButton>
                    </InlineFeedback>
                  ) : (
                    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                      {visit.state === 'READY' && (
                        <ActionButton
                          intent="primary"
                          startIcon={<BadgeCheck size={16} />}
                          disabled={!confirmed}
                          loading={command.isPending}
                          onClick={() => command.mutate('ARRIVE')}
                        >
                          {t('workplace.visits.kiosk.arrive')}
                        </ActionButton>
                      )}
                      {visit.state === 'ARRIVED' && (
                        <ActionButton
                          intent="primary"
                          startIcon={<LogOut size={16} />}
                          disabled={!confirmed}
                          loading={command.isPending}
                          onClick={() => command.mutate('CHECKOUT')}
                        >
                          {t('workplace.visits.kiosk.checkout')}
                        </ActionButton>
                      )}
                    </Stack>
                  )}
                </Box>
              )}
              <FormField
                label={t('workplace.visits.fields.reason')}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                }
                label={t('workplace.visits.kiosk.confirmation')}
              />
              {!['UNREGISTERED', 'RETIRED'].includes(session.state) && (
                <ActionButton
                  intent="quiet"
                  startIcon={<CircleHelp size={16} />}
                  disabled={!confirmed}
                  loading={command.isPending}
                  onClick={() => command.mutate('HELP')}
                >
                  {t('workplace.visits.kiosk.requestHelp')}
                </ActionButton>
              )}
              {command.isError && (
                <InlineFeedback severity="error">
                  {t('workplace.visits.kiosk.commandError')}
                </InlineFeedback>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

export function WorkplaceVisitKioskRoute() {
  const { t } = useTranslation('rooms');
  const [auth] = useState<WorkplaceKioskDeviceAuth | null>(() => {
    const runtime = (
      window as typeof window & {
        __DWP_WORKPLACE_KIOSK_BOOTSTRAP__?: WorkplaceKioskDeviceAuth;
      }
    ).__DWP_WORKPLACE_KIOSK_BOOTSTRAP__;
    delete (
      window as typeof window & {
        __DWP_WORKPLACE_KIOSK_BOOTSTRAP__?: WorkplaceKioskDeviceAuth;
      }
    ).__DWP_WORKPLACE_KIOSK_BOOTSTRAP__;
    return runtime?.tenantId && /^[0-9a-f]{64}$/u.test(runtime.deviceIdentitySha256)
      ? runtime
      : null;
  });
  if (!auth) {
    return (
      <Box component="main" sx={{ p: 3 }}>
        <InlineFeedback severity="error">
          {t('workplace.visits.kiosk.bootstrapError')}
        </InlineFeedback>
      </Box>
    );
  }
  return <WorkplaceVisitKiosk auth={auth} />;
}
