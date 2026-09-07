import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  DoorOpen,
  Link,
  Mail,
  Pencil,
  RefreshCw,
  Settings2,
  Video,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  ErrorState,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  foundationTokens,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MeetingPersonalRoomDetails } from './meeting-personal-room-details';
import { personalRoomInvitationUrl } from './meeting-personal-room-model';
import { useMeetingPersonalRoomState } from './meeting-personal-room-state';
import { meetingSurface } from './meeting-visual-system';

export type MeetingPersonalRoomProps = {
  onEnterMeeting: (meetingId: string) => void;
  onCheckDevices: () => void;
  onBack: () => void;
};

export function MeetingPersonalRoom(props: MeetingPersonalRoomProps) {
  const { user, isAuthenticated } = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const canView = isLoaded && hasPermission('APP.MEETINGS', 'VIEW');
  const canCreate =
    isLoaded &&
    (hasPermission('APP.MEETINGS', 'CREATE') || hasPermission('APP.MEETINGS', 'MANAGE'));
  const canUpdate =
    isLoaded &&
    (hasPermission('APP.MEETINGS', 'UPDATE') || hasPermission('APP.MEETINGS', 'MANAGE'));
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
    canView,
    canCreate,
    canUpdate,
  ]);
  return (
    <PersonalRoomContent
      key={scope}
      {...props}
      scope={scope}
      enabled={isAuthenticated && Boolean(user) && canView}
      permissionsLoading={!isLoaded}
      canCreate={canCreate}
      canUpdate={canUpdate}
    />
  );
}

function PersonalRoomContent({
  scope,
  enabled,
  permissionsLoading,
  canCreate,
  canUpdate,
  ...props
}: MeetingPersonalRoomProps & {
  scope: string;
  enabled: boolean;
  permissionsLoading: boolean;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const { t } = useTranslation('meetings');
  const state = useMeetingPersonalRoomState(scope, enabled, props.onEnterMeeting);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [rotating, setRotating] = useState(false);
  const current = state.room.data;
  const busy = state.busy !== null;
  const nameValid = Boolean(name.trim()) && name.length <= 160;
  if (permissionsLoading || (enabled && state.room.isPending))
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <LoadingState label={t('personalRoom.loading')} variant="skeleton" skeletonRows={5} />
      </PageCanvas>
    );
  if (!enabled || state.revoked || state.room.isError)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <ErrorState
          title={t('personalRoom.title')}
          description={t(
            !enabled || state.revoked ? 'personalRoom.forbidden' : 'personalRoom.loadError'
          )}
          retryLabel={enabled ? t('actions.retry') : undefined}
          onRetry={enabled ? state.retry : undefined}
        />
      </PageCanvas>
    );
  const invitation =
    current && typeof window !== 'undefined'
      ? personalRoomInvitationUrl(window.location.origin, current)
      : '';
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Box data-testid="meeting-personal-room">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ mb: 2 }}
        >
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<ArrowLeft size={16} />}
            onClick={props.onBack}
          >
            {t('personalRoom.back')}
          </ActionButton>
          <Typography variant="caption" color="text.secondary">
            {t('personalRoom.title')}
          </Typography>
          <ActionIconButton label={t('personalRoom.refresh')} onClick={state.retry} disabled={busy}>
            <RefreshCw size={16} />
          </ActionIconButton>
        </Stack>
        {state.notice && (
          <InlineFeedback
            severity={
              ['created', 'updated', 'rotated', 'copied'].includes(state.notice)
                ? 'success'
                : 'warning'
            }
            sx={{ mb: 2 }}
          >
            {t(`personalRoom.notices.${state.notice}`)}
            {state.notice === 'conflict' && (
              <ActionButton intent="quiet" size="small" onClick={state.retry}>
                {t('actions.retry')}
              </ActionButton>
            )}
          </InlineFeedback>
        )}
        {!current ? (
          <Box
            component="section"
            sx={{
              p: { xs: 2, md: 3 },
              bgcolor: 'background.paper',
              borderRadius: foundationTokens.radius.surface + 'px',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Stack gap={2} sx={{ maxWidth: 640 }}>
              <Typography component="h1" variant="h5">
                {t('personalRoom.first.title')}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {t('personalRoom.first.description')}
              </Typography>
              <FormField
                label={t('personalRoom.name')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                inputProps={{ maxLength: 160 }}
                disabled={busy || !canCreate}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <ActionButton
                  intent="primary"
                  disabled={!nameValid || !canCreate}
                  loading={state.busy === 'create'}
                  onClick={() => {
                    if (canCreate) void state.create(name);
                  }}
                >
                  {t('personalRoom.first.create')}
                </ActionButton>
                <ActionButton
                  intent="secondary"
                  startIcon={<Settings2 size={16} />}
                  onClick={props.onCheckDevices}
                >
                  {t('personalRoom.checkDevices')}
                </ActionButton>
              </Stack>
              {!canCreate && <InlineFeedback>{t('personalRoom.createPermission')}</InlineFeedback>}
              <Typography variant="caption" color="text.secondary">
                {t('personalRoom.first.noSession')}
              </Typography>
            </Stack>
          </Box>
        ) : (
          <>
            <Box
              component="section"
              aria-label={t('personalRoom.identity')}
              sx={(theme) => ({
                ...meetingSurface(theme, { tone: 'primary', elevated: true }),
                p: { xs: 2, md: 3 },
                mb: 3,
              })}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'minmax(0,1fr)',
                    md: 'minmax(0,1fr) minmax(220px, 28%)',
                  },
                  gap: 3,
                  alignItems: 'center',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1.5} alignItems="center">
                    <Box
                      aria-hidden="true"
                      sx={{
                        p: 1.5,
                        bgcolor: 'action.selected',
                        color: 'primary.main',
                        borderRadius: foundationTokens.radius.control + 'px',
                      }}
                    >
                      <DoorOpen size={24} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere' }}>
                        {current.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('personalRoom.version', {
                          version: current.version,
                          revision: current.invitationRevision,
                        })}
                      </Typography>
                    </Box>
                    <ActionIconButton
                      label={t('personalRoom.rename')}
                      disabled={busy || !canUpdate}
                      onClick={() => {
                        setName(current.name);
                        setEditing(true);
                      }}
                    >
                      <Pencil size={16} />
                    </ActionIconButton>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ my: 1.5 }}>
                    {t('personalRoom.description')}
                  </Typography>
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    sx={{
                      p: 1.25,
                      bgcolor: 'action.hover',
                      borderRadius: foundationTokens.radius.control + 'px',
                    }}
                  >
                    <Link size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                    <Typography
                      component="p"
                      variant="caption"
                      sx={{ m: 0, overflowWrap: 'anywhere', minWidth: 0, userSelect: 'all' }}
                    >
                      {invitation}
                    </Typography>
                  </Stack>
                  <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<Copy size={15} />}
                      disabled={busy}
                      onClick={() => void state.copy(current)}
                    >
                      {t('personalRoom.copyLink')}
                    </ActionButton>
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<Mail size={15} />}
                      disabled={busy}
                      onClick={() =>
                        void state.copy(current, (url) =>
                          t('personalRoom.invitationText', { name: current.name, url })
                        )
                      }
                    >
                      {t('personalRoom.copyInvitation')}
                    </ActionButton>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    {t('personalRoom.qrUnavailable')}
                  </Typography>
                </Box>
                <Stack gap={1}>
                  <ActionButton
                    intent="primary"
                    startIcon={<Video size={18} />}
                    endIcon={<ArrowRight size={16} />}
                    loading={state.busy === 'start'}
                    disabled={!canCreate || (busy && state.busy !== 'start')}
                    sx={{ minHeight: 48 }}
                    onClick={() => {
                      if (canCreate) void state.start(current);
                    }}
                  >
                    {t(current.currentMeetingId ? 'personalRoom.continue' : 'personalRoom.start')}
                  </ActionButton>
                  <ActionButton
                    intent="secondary"
                    startIcon={<Settings2 size={16} />}
                    disabled={busy}
                    onClick={props.onCheckDevices}
                    sx={{ minHeight: 44 }}
                  >
                    {t('personalRoom.checkDevices')}
                  </ActionButton>
                  <Typography variant="caption" color="text.secondary">
                    {t(canCreate ? 'personalRoom.startHint' : 'personalRoom.createPermission')}
                  </Typography>
                </Stack>
              </Box>
            </Box>
            <MeetingPersonalRoomDetails
              room={current}
              history={state.history}
              page={state.page}
              onPage={state.setPage}
              busy={busy}
              canUpdate={canUpdate}
              onRotate={() => setRotating(true)}
              onCheckDevices={props.onCheckDevices}
              refreshedAt={state.room.dataUpdatedAt}
            />
            <FormDialog
              open={editing}
              title={t('personalRoom.rename')}
              cancelLabel={t('actions.cancel')}
              submitLabel={t('personalRoom.saveName')}
              busy={state.busy === 'update'}
              submitDisabled={!nameValid || name.trim() === current.name || !canUpdate}
              onClose={() => setEditing(false)}
              onSubmit={async () => {
                if (canUpdate && (await state.rename(name, current))) setEditing(false);
              }}
            >
              {(state.notice === 'conflict' || state.notice === 'failed') && (
                <InlineFeedback severity="warning" sx={{ mb: 2 }}>
                  {t(`personalRoom.notices.${state.notice}`)}
                  {state.notice === 'conflict' && (
                    <ActionButton intent="quiet" size="small" onClick={state.retry}>
                      {t('personalRoom.refresh')}
                    </ActionButton>
                  )}
                </InlineFeedback>
              )}
              <FormField
                autoFocus
                label={t('personalRoom.name')}
                value={name}
                onChange={(event) => setName(event.target.value)}
                inputProps={{ maxLength: 160 }}
                disabled={busy}
              />
            </FormDialog>
            <ConfirmDialog
              open={rotating}
              title={t('personalRoom.rotate.confirmTitle')}
              description={t('personalRoom.rotate.confirmDescription')}
              cancelLabel={t('actions.cancel')}
              confirmLabel={t('personalRoom.rotate.confirm')}
              intent="danger"
              busy={state.busy === 'rotate'}
              details={
                (state.notice === 'conflict' || state.notice === 'failed') && (
                  <InlineFeedback severity="warning">
                    {t(`personalRoom.notices.${state.notice}`)}
                    {state.notice === 'conflict' && (
                      <ActionButton intent="quiet" size="small" onClick={state.retry}>
                        {t('personalRoom.refresh')}
                      </ActionButton>
                    )}
                  </InlineFeedback>
                )
              }
              onClose={() => setRotating(false)}
              onConfirm={async () => {
                if (canUpdate && (await state.rotate(current))) setRotating(false);
              }}
            />
          </>
        )}
      </Box>
    </PageCanvas>
  );
}
