import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import { resolveVideoMeetingPersonalRoomInvitation } from '@dwp-frontend/shared-utils/api/video-meeting-personal-room-api';
import {
  ActionButton,
  ErrorState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { ArrowRight, DoorOpen } from 'lucide-react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  createMeetingIntelligenceAuthorizationFence,
  MeetingIntelligenceAuthorizationSupersededError,
} from './meeting-intelligence-authorization-fence';
import { personalRoomCommandFailure } from './meeting-personal-room-model';

export type MeetingPersonalRoomInvitationProps = {
  opaqueAlias: string;
  revision: number;
  onEnterMeeting: (meetingId: string) => void;
};

export function MeetingPersonalRoomInvitation(props: MeetingPersonalRoomInvitationProps) {
  const { user, isAuthenticated } = useAuth();
  const { isLoaded, hasPermission } = usePermissions();
  const enabled =
    isAuthenticated && Boolean(user) && isLoaded && hasPermission('APP.MEETINGS', 'VIEW');
  const scope = JSON.stringify([
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
    enabled,
    props.opaqueAlias,
    props.revision,
  ]);
  return (
    <InvitationContent
      key={scope}
      {...props}
      scope={scope}
      enabled={enabled}
      permissionsLoading={!isLoaded}
    />
  );
}

function InvitationContent({
  opaqueAlias,
  revision,
  onEnterMeeting,
  scope,
  enabled,
  permissionsLoading,
}: MeetingPersonalRoomInvitationProps & {
  scope: string;
  enabled: boolean;
  permissionsLoading: boolean;
}) {
  const { t } = useTranslation('meetings');
  const client = useQueryClient();
  const authority = useMemo(() => createMeetingIntelligenceAuthorizationFence(scope), [scope]);
  const mounted = useRef(false);
  const entering = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<'forbidden' | 'unavailable' | 'failed' | null>(null);
  const key = ['meetings', 'personal-room-invitation', scope] as const;
  const classify = (error: unknown) =>
    personalRoomCommandFailure(error) === 'forbidden'
      ? 'forbidden'
      : error && typeof error === 'object' && 'status' in error && error.status === 404
        ? 'unavailable'
        : 'failed';
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const validation = authority.beginValidation();
      try {
        const result = await resolveVideoMeetingPersonalRoomInvitation(
          opaqueAlias,
          revision,
          signal
        );
        if (!authority.authorize(validation))
          throw new MeetingIntelligenceAuthorizationSupersededError();
        setFailure(null);
        return result;
      } catch (error) {
        if (!signal.aborted && authority.deny(validation) !== null) {
          client.setQueryData(key, null);
          setFailure(classify(error));
        }
        throw error;
      }
    },
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      authority.revoke();
    };
  }, [authority]);
  const enter = async () => {
    const generation = authority.capture();
    if (entering.current || !enabled || !mounted.current || !authority.canCommit(generation))
      return;
    entering.current = true;
    setBusy(true);
    try {
      // Resolve again on the explicit action; a displayed link can have rotated since loading.
      const current = await resolveVideoMeetingPersonalRoomInvitation(opaqueAlias, revision);
      if (!mounted.current || !authority.canCommit(generation)) return;
      client.setQueryData(key, current);
      if (current.sessionAvailable && current.meetingId) onEnterMeeting(current.meetingId);
    } catch (error) {
      if (!mounted.current || !authority.canCommit(generation)) return;
      authority.revoke();
      client.setQueryData(key, null);
      setFailure(classify(error));
    } finally {
      entering.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (permissionsLoading || (enabled && query.isPending))
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <LoadingState label={t('personalRoomInvitation.loading')} />
      </PageCanvas>
    );
  if (!enabled || failure || query.isError || !query.data)
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <ErrorState
          title={t('personalRoomInvitation.title')}
          description={t(
            `personalRoomInvitation.${!enabled ? 'forbidden' : (failure ?? 'failed')}`
          )}
          retryLabel={enabled ? t('actions.retry') : undefined}
          onRetry={enabled ? () => void query.refetch() : undefined}
        />
      </PageCanvas>
    );
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Box
        component="section"
        data-testid="personal-room-invitation"
        sx={{
          maxWidth: 720,
          p: { xs: 2, md: 3 },
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
        }}
      >
        <Stack gap={2}>
          <DoorOpen size={28} aria-hidden="true" />
          <Typography component="h1" variant="h5">
            {t('personalRoomInvitation.title')}
          </Typography>
          <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
            {query.data.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('personalRoomInvitation.description')}
          </Typography>
          {query.data.sessionAvailable ? (
            <ActionButton
              intent="primary"
              endIcon={<ArrowRight size={16} />}
              loading={busy}
              onClick={() => void enter()}
            >
              {t('personalRoomInvitation.enter')}
            </ActionButton>
          ) : (
            <InlineFeedback>{t('personalRoomInvitation.noSession')}</InlineFeedback>
          )}
          {!query.data.sessionAvailable && (
            <ActionButton
              intent="secondary"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {t('personalRoomInvitation.refresh')}
            </ActionButton>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('personalRoomInvitation.consent')}
          </Typography>
        </Stack>
      </Box>
    </PageCanvas>
  );
}
