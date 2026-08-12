import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CircleHelp,
  Clock3,
  KeyRound,
  LogOut,
  Network,
  MapPin,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
} from 'lucide-react';
import {
  describeSessionDevice,
  getAuthSessions,
  logoutOtherSessions,
  redirectToSignIn,
  revokeAuthSession,
  useAuth,
  useAuthPolicyQuery,
  useIdpQuery,
  useToast,
} from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import type { AuthSessionData, SessionDevice } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

type PendingAction = { kind: 'session'; session: AuthSessionData } | { kind: 'others' } | null;

const iconProps = { size: 20, strokeWidth: 1.8, 'aria-hidden': true } as const;

function DeviceIcon({ kind }: { kind: SessionDevice['kind'] }) {
  if (kind === 'mobile') return <Smartphone {...iconProps} />;
  if (kind === 'tablet') return <Tablet {...iconProps} />;
  if (kind === 'desktop') return <Monitor {...iconProps} />;
  return <CircleHelp {...iconProps} />;
}

function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatDate(date, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function SecurityPostureRow({
  icon: Icon,
  title,
  value,
  detail,
  state = 'managed',
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
  state?: 'healthy' | 'managed' | 'attention';
}) {
  const { t } = useTranslation('account');
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '36px minmax(0, 1fr)', md: '36px 180px minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 2, md: 2.5 },
        py: 2,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 36,
          height: 36,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          bgcolor: 'action.hover',
          color: 'text.secondary',
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Typography component="p" variant="subtitle2" sx={{ gridColumn: { xs: '2', md: 'auto' } }}>
        {title}
      </Typography>
      <Box sx={{ gridColumn: { xs: '2', md: 'auto' }, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </Box>
      <Chip
        size="small"
        variant="outlined"
        color={state === 'healthy' ? 'success' : state === 'attention' ? 'warning' : 'default'}
        label={t(`security.posture.states.${state}`)}
        sx={{ gridColumn: { xs: '2', md: 'auto' }, justifySelf: { xs: 'start', md: 'end' } }}
      />
    </Box>
  );
}

export default function SecurityPage() {
  const { t } = useTranslation('account');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const policyQuery = useAuthPolicyQuery();
  const ssoConfigured = Boolean(
    policyQuery.data?.ssoLoginEnabled && policyQuery.data.allowedLoginTypes.includes('SSO')
  );
  const idpQuery = useIdpQuery({
    enabled: ssoConfigured,
    providerKey: policyQuery.data?.ssoProviderKey,
  });
  const [sessions, setSessions] = useState<AuthSessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const otherSessionCount = useMemo(
    () => sessions.filter((session) => !session.current).length,
    [sessions]
  );

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const response = await getAuthSessions();
      setSessions(Array.isArray(response.data) ? response.data : []);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const confirmAction = async () => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    try {
      if (pendingAction.kind === 'others') {
        await logoutOtherSessions();
        toast.success(t('security.toasts.otherSessionsSignedOut'));
        setPendingAction(null);
        await loadSessions();
        return;
      }

      await revokeAuthSession(pendingAction.session.sessionId);
      if (pendingAction.session.current) {
        auth.invalidateSession();
        redirectToSignIn(navigate, location);
        return;
      }
      toast.success(t('security.toasts.sessionSignedOut'));
      setPendingAction(null);
      await loadSessions();
    } catch {
      toast.error(t('security.toasts.signOutError'));
      setPendingAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageCanvas mode="focus">
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            {t('security.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {auth.user?.displayName || t('shell.accountFallback')} /{' '}
            {auth.user?.tenantName || auth.user?.tenantCode || t('security.workspaceFallback')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogOut size={18} aria-hidden="true" />}
          disabled={isLoading || otherSessionCount === 0}
          onClick={() => setPendingAction({ kind: 'others' })}
        >
          {t('security.actions.signOutOthers')}
        </Button>
      </Box>

      <Box component="section" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
          <Typography component="h2" variant="h6">
            {t('security.posture.title')}
          </Typography>
          <Chip size="small" variant="outlined" label={t('security.posture.tenantManaged')} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('security.posture.description')}
        </Typography>

        {policyQuery.isError ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {t('security.posture.policyUnavailable')}
          </Alert>
        ) : policyQuery.isLoading ? (
          <Box sx={{ minHeight: 120, display: 'grid', placeItems: 'center' }}>
            <CircularProgress size={24} aria-label={t('security.posture.loading')} />
          </Box>
        ) : policyQuery.data ? (
          <Stack
            divider={<Divider flexItem />}
            sx={{
              mt: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <SecurityPostureRow
              icon={KeyRound}
              title={t('security.posture.signInMethods')}
              value={policyQuery.data.allowedLoginTypes
                .map((method) => t(`security.posture.methods.${method}`))
                .join(' + ')}
              detail={t('security.posture.signInMethodsDetail', {
                defaultMethod: t(`security.posture.methods.${policyQuery.data.defaultLoginType}`),
              })}
              state="healthy"
            />
            <SecurityPostureRow
              icon={Network}
              title={t('security.posture.sso')}
              value={
                ssoConfigured
                  ? idpQuery.data?.providerKey || t('security.posture.ssoConfigured')
                  : t('security.posture.ssoNotConfigured')
              }
              detail={
                idpQuery.isError
                  ? t('security.posture.idpUnavailable')
                  : ssoConfigured
                    ? t('security.posture.ssoDetail', {
                        protocol: idpQuery.data?.providerType ?? 'OIDC',
                      })
                    : t('security.posture.ssoNotConfiguredDetail')
              }
              state={ssoConfigured && idpQuery.data ? 'healthy' : 'managed'}
            />
            <SecurityPostureRow
              icon={ShieldCheck}
              title={t('security.posture.mfa')}
              value={
                policyQuery.data.requireMfa
                  ? t('security.posture.mfaRequired')
                  : t('security.posture.mfaNotRequired')
              }
              detail={t('security.posture.mfaDetail')}
              state={policyQuery.data.requireMfa ? 'healthy' : 'managed'}
            />
          </Stack>
        ) : null}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 5 }}>
        <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
        <Typography component="h2" variant="h6">
          {t('security.activeSessions')}
        </Typography>
        {!isLoading && <Chip label={sessions.length} size="small" variant="outlined" />}
      </Box>
      <Divider sx={{ mt: 1, mb: 0 }} />

      {hasError && (
        <Alert
          severity="error"
          sx={{ mt: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={() => void loadSessions()}
            >
              {t('security.actions.retry')}
            </Button>
          }
        >
          {t('security.errors.load')}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ minHeight: 180, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} aria-label={t('security.loading')} />
        </Box>
      ) : (
        <Box
          component="ul"
          aria-label={t('security.activeSessions')}
          sx={{ p: 0, m: 0, listStyle: 'none' }}
        >
          {sessions.map((session) => {
            const device = describeSessionDevice(session.userAgent);
            const browser =
              device.browser === 'Unknown browser' ? t('security.unknownBrowser') : device.browser;
            const platform =
              device.platform === 'Unknown device' ? t('security.unknownDevice') : device.platform;
            const deviceLabel =
              device.browser === 'Unknown browser'
                ? platform
                : t('security.deviceLabel', { browser, platform });
            return (
              <Box
                component="li"
                key={session.sessionId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '40px minmax(0, 1fr)',
                    md: '40px minmax(220px, 1fr) 1fr auto',
                  },
                  columnGap: 2,
                  rowGap: { xs: 2, md: 1 },
                  alignItems: 'center',
                  py: 3,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: session.current ? 'primary.main' : 'action.hover',
                    color: session.current ? 'primary.contrastText' : 'text.secondary',
                    borderRadius: 1,
                  }}
                >
                  <DeviceIcon kind={device.kind} />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography component="p" variant="subtitle2">
                      {deviceLabel}
                    </Typography>
                    {session.current && (
                      <Chip label={t('security.current')} color="success" size="small" />
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    title={session.userAgent || undefined}
                    noWrap
                  >
                    {session.userAgent || t('security.userAgentUnavailable')}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    gridColumn: { xs: '2', md: 'auto' },
                    display: 'grid',
                    gap: 0.75,
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <MapPin size={15} aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {session.ipAddress || t('security.ipUnavailable')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Clock3 size={15} aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {t('security.lastActive', {
                        date: formatSessionDate(session.lastSeenAt),
                      })}
                    </Typography>
                  </Box>
                </Box>

                <Button
                  color="error"
                  variant="text"
                  startIcon={<LogOut size={17} aria-hidden="true" />}
                  sx={{
                    gridColumn: { xs: '2', md: 'auto' },
                    justifySelf: { xs: 'start', md: 'end' },
                  }}
                  onClick={() => setPendingAction({ kind: 'session', session })}
                >
                  {session.current
                    ? t('security.actions.signOut')
                    : t('security.actions.endSession')}
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog
        open={Boolean(pendingAction)}
        onClose={isSubmitting ? undefined : () => setPendingAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {pendingAction?.kind === 'others'
            ? t('security.dialog.othersTitle')
            : t('security.dialog.sessionTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingAction?.kind === 'others'
              ? t('security.dialog.othersDescription', { count: otherSessionCount })
              : pendingAction?.session.current
                ? t('security.dialog.currentDescription')
                : t('security.dialog.sessionDescription')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isSubmitting} onClick={() => setPendingAction(null)}>
            {t('security.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={isSubmitting}
            onClick={() => void confirmAction()}
          >
            {isSubmitting ? t('security.actions.signingOut') : t('security.actions.signOut')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageCanvas>
  );
}
