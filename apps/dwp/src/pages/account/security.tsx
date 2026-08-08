import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CircleHelp,
  Clock3,
  LogOut,
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
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

import type { AuthSessionData, SessionDevice } from '@dwp-frontend/shared-utils';

type PendingAction = { kind: 'session'; session: AuthSessionData } | { kind: 'others' } | null;

const iconProps = { size: 20, strokeWidth: 1.8, 'aria-hidden': true } as const;

function DeviceIcon({ kind }: { kind: SessionDevice['kind'] }) {
  if (kind === 'mobile') return <Smartphone {...iconProps} />;
  if (kind === 'tablet') return <Tablet {...iconProps} />;
  if (kind === 'desktop') return <Monitor {...iconProps} />;
  return <CircleHelp {...iconProps} />;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SecurityPage() {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<AuthSessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const otherSessionCount = useMemo(
    () => sessions.filter((session) => !session.current).length,
    [sessions]
  );

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAuthSessions();
      setSessions(Array.isArray(response.data) ? response.data : []);
    } catch {
      setError('Active sessions could not be loaded.');
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
        toast.success('Other sessions have been signed out.');
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
      toast.success('The session has been signed out.');
      setPendingAction(null);
      await loadSessions();
    } catch {
      toast.error('The session could not be signed out.');
      setPendingAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
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
            Security & sessions
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {auth.user?.displayName || 'Account'} / {auth.user?.tenantCode || 'Workspace'}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogOut size={18} aria-hidden="true" />}
          disabled={isLoading || otherSessionCount === 0}
          onClick={() => setPendingAction({ kind: 'others' })}
        >
          Sign out other sessions
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 5 }}>
        <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
        <Typography component="h2" variant="h6">
          Active browser sessions
        </Typography>
        {!isLoading && <Chip label={sessions.length} size="small" variant="outlined" />}
      </Box>
      <Divider sx={{ mt: 1, mb: 0 }} />

      {error && (
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
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ minHeight: 180, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} aria-label="Loading active sessions" />
        </Box>
      ) : (
        <Box
          component="ul"
          aria-label="Active browser sessions"
          sx={{ p: 0, m: 0, listStyle: 'none' }}
        >
          {sessions.map((session) => {
            const device = describeSessionDevice(session.userAgent);
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
                      {device.label}
                    </Typography>
                    {session.current && <Chip label="Current" color="success" size="small" />}
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    title={session.userAgent || undefined}
                    noWrap
                  >
                    {session.userAgent || 'User agent unavailable'}
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
                      {session.ipAddress || 'IP unavailable'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Clock3 size={15} aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Last active {formatDate(session.lastSeenAt)}
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
                  {session.current ? 'Sign out' : 'End session'}
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
          {pendingAction?.kind === 'others' ? 'Sign out other sessions?' : 'End this session?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingAction?.kind === 'others'
              ? `This will sign out ${otherSessionCount} other active ${otherSessionCount === 1 ? 'session' : 'sessions'}.`
              : pendingAction?.session.current
                ? 'You will be returned to the sign-in screen.'
                : 'This browser will need to sign in again.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isSubmitting} onClick={() => setPendingAction(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={isSubmitting}
            onClick={() => void confirmAction()}
          >
            {isSubmitting ? 'Signing out...' : 'Sign out'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
