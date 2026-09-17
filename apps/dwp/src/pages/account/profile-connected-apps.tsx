import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  beginWorkspaceProductivityAuthorization,
  disconnectWorkspaceProductivityConnection,
  listWorkspaceProductivityConnections,
  syncWorkspaceProductivityResources,
  useToast,
  type ProductivityResourceKind,
  type WorkspaceProductivityConnection,
} from '@dwp-frontend/shared-utils';
import { ActionButton } from '@dwp-frontend/design-system';
import { Link2, PlugZap, RefreshCw, Unplug } from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const CONNECTIONS_QUERY_KEY = ['account', 'productivity-connections'] as const;

function synchronizationKinds(
  connection: WorkspaceProductivityConnection
): ProductivityResourceKind[] {
  const scopes = [...connection.grantedScopes, ...connection.requestedScopes].map((scope) =>
    scope.toLowerCase()
  );
  const kinds: ProductivityResourceKind[] = [];
  if (scopes.some((scope) => scope.includes('mail'))) kinds.push('MAIL');
  if (scopes.some((scope) => scope.includes('calendar'))) kinds.push('CALENDAR');
  return kinds;
}

function authorizationTarget(value: string): string {
  const target = new URL(value, window.location.origin);
  if (
    target.protocol !== 'https:' &&
    !(target.protocol === 'http:' && target.hostname === 'localhost')
  ) {
    throw new Error('UNSAFE_AUTHORIZATION_URL');
  }
  return target.toString();
}

function stateColor(
  state: WorkspaceProductivityConnection['consentState']
): 'success' | 'warning' | 'default' {
  if (state === 'CONNECTED') return 'success';
  if (state === 'REAUTHORIZATION_REQUIRED') return 'warning';
  return 'default';
}

export function ProfileConnectedApps({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation('account');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [disconnecting, setDisconnecting] = useState<WorkspaceProductivityConnection | null>(null);
  const connectionsQuery = useQuery({
    queryKey: CONNECTIONS_QUERY_KEY,
    queryFn: listWorkspaceProductivityConnections,
    enabled,
    retry: false,
  });
  const authorization = useMutation({
    mutationFn: (connection: WorkspaceProductivityConnection) =>
      beginWorkspaceProductivityAuthorization(connection.connectorId),
    onSuccess: (result) => window.location.assign(authorizationTarget(result.authorizationUrl)),
    onError: () => toast.error(t('profile.connections.toasts.authorizationFailed')),
  });
  const synchronize = useMutation({
    mutationFn: async (connection: WorkspaceProductivityConnection) => {
      const kinds = synchronizationKinds(connection);
      if (kinds.length === 0) throw new Error('NO_SYNCHRONIZABLE_SCOPE');
      return syncWorkspaceProductivityResources(connection.connectorId, kinds);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: CONNECTIONS_QUERY_KEY });
      if (result.failedKinds.length > 0) {
        toast.warning(
          t('profile.connections.toasts.syncPartial', {
            started: result.startedKinds.length,
            failed: result.failedKinds.length,
          })
        );
      } else {
        toast.success(t('profile.connections.toasts.syncStarted'));
      }
    },
    onError: () => toast.error(t('profile.connections.toasts.syncFailed')),
  });
  const disconnect = useMutation({
    mutationFn: (connection: WorkspaceProductivityConnection) =>
      disconnectWorkspaceProductivityConnection(connection.connectorId),
    onSuccess: async () => {
      setDisconnecting(null);
      await queryClient.invalidateQueries({ queryKey: CONNECTIONS_QUERY_KEY });
      toast.success(t('profile.connections.toasts.disconnected'));
    },
    onError: () => toast.error(t('profile.connections.toasts.disconnectFailed')),
  });

  return (
    <Box component="section" data-testid="profile-connected-apps" sx={{ mt: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Link2 size={20} aria-hidden="true" />
            <Typography component="h2" variant="h6">
              {t('profile.connections.title')}
            </Typography>
            {connectionsQuery.data && (
              <Chip
                size="small"
                label={t('profile.connections.count', {
                  count: connectionsQuery.data.filter((item) => item.consentState === 'CONNECTED')
                    .length,
                })}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('profile.connections.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<RefreshCw size={16} />}
          disabled={!enabled || connectionsQuery.isFetching}
          onClick={() => void connectionsQuery.refetch()}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          {t('profile.connections.refresh')}
        </ActionButton>
      </Stack>

      {!enabled ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('profile.connections.providerBoundary')}
        </Alert>
      ) : connectionsQuery.isLoading ? (
        <Box sx={{ minHeight: 144, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={26} aria-label={t('profile.connections.loading')} />
        </Box>
      ) : connectionsQuery.isError ? (
        <Alert
          severity="warning"
          sx={{ mt: 1.5 }}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => void connectionsQuery.refetch()}
            >
              {t('profile.retry')}
            </ActionButton>
          }
        >
          {t('profile.connections.unavailable')}
        </Alert>
      ) : connectionsQuery.data?.length ? (
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
          {connectionsQuery.data.map((connection) => {
            const connected = connection.consentState === 'CONNECTED';
            const busy = authorization.isPending || synchronize.isPending || disconnect.isPending;
            return (
              <Box
                key={connection.connectorId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '40px minmax(0, 1fr)',
                    md: '40px minmax(0, 1fr) auto',
                  },
                  gap: 1.5,
                  alignItems: 'center',
                  p: 2,
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                    color: 'primary.main',
                  }}
                >
                  <PlugZap size={19} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography component="h3" variant="subtitle2">
                      {connection.displayName}
                    </Typography>
                    <Chip
                      size="small"
                      color={stateColor(connection.consentState)}
                      label={t(`profile.connections.states.${connection.consentState}`)}
                    />
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
                  >
                    {t('profile.connections.scopes', {
                      scopes:
                        (connected ? connection.grantedScopes : connection.requestedScopes).join(
                          ', '
                        ) || t('profile.connections.noScopes'),
                    })}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25 }}
                  >
                    {connection.lastSuccessfulSyncAt
                      ? t('profile.connections.lastSync', {
                          date: formatDate(connection.lastSuccessfulSyncAt, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }),
                        })
                      : t('profile.connections.neverSynced')}
                  </Typography>
                  {connection.actionRequiredCode && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {t('profile.connections.actionRequired', {
                        code: connection.actionRequiredCode,
                      })}
                    </Alert>
                  )}
                </Box>
                <Stack
                  direction="row"
                  gap={1}
                  flexWrap="wrap"
                  sx={{ gridColumn: { xs: '2', md: 'auto' }, justifyContent: { md: 'flex-end' } }}
                >
                  {connected && (
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={busy || synchronizationKinds(connection).length === 0}
                      onClick={() => synchronize.mutate(connection)}
                    >
                      {t('profile.connections.sync')}
                    </ActionButton>
                  )}
                  <ActionButton
                    intent="secondary"
                    size="small"
                    disabled={busy || connection.lifecycleState !== 'ACTIVE'}
                    onClick={() => authorization.mutate(connection)}
                  >
                    {t(
                      connected ? 'profile.connections.reauthorize' : 'profile.connections.connect'
                    )}
                  </ActionButton>
                  {connected && (
                    <ActionButton
                      intent="danger"
                      size="small"
                      startIcon={<Unplug size={15} />}
                      disabled={busy}
                      onClick={() => setDisconnecting(connection)}
                    >
                      {t('profile.connections.disconnect')}
                    </ActionButton>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('profile.connections.empty')}
        </Alert>
      )}

      <Alert data-transfer-coverage="productivity-only" severity="info" sx={{ mt: 1.5 }}>
        {t('profile.connections.transferBoundary')}
      </Alert>

      <Dialog
        open={Boolean(disconnecting)}
        onClose={disconnect.isPending ? undefined : () => setDisconnecting(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('profile.connections.disconnectDialog.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('profile.connections.disconnectDialog.description', {
              app: disconnecting?.displayName,
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ActionButton
            intent="quiet"
            disabled={disconnect.isPending}
            onClick={() => setDisconnecting(null)}
          >
            {t('security.actions.cancel')}
          </ActionButton>
          <ActionButton
            intent="danger"
            disabled={disconnect.isPending || !disconnecting}
            onClick={() => disconnecting && disconnect.mutate(disconnecting)}
          >
            {t('profile.connections.disconnect')}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
