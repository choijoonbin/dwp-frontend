import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';
import {
  decideVideoMeetingLobbyRequest,
  getVideoMeetingLobby,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatMeetingTime } from './meeting-components';

export function MeetingLobbyPanel({ meetingId }: { meetingId: string }) {
  const { t, i18n } = useTranslation('meetings');
  const queryClient = useQueryClient();
  const queryKey = ['meetings', meetingId, 'lobby'] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getVideoMeetingLobby(meetingId),
    refetchInterval: 3_000,
    retry: 1,
  });
  const decisionMutation = useMutation({
    mutationFn: ({
      requestId,
      expectedVersion,
      decision,
    }: {
      requestId: string;
      expectedVersion: number;
      decision: 'APPROVE' | 'DENY';
    }) => decideVideoMeetingLobbyRequest(meetingId, requestId, expectedVersion, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Box component="section" aria-labelledby="meeting-lobby-title" sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <ShieldCheck size={18} aria-hidden="true" />
          <Typography id="meeting-lobby-title" component="h2" variant="subtitle2" fontWeight={800}>
            {t('room.lobby')}
          </Typography>
        </Stack>
        {query.data && (
          <Chip size="small" label={t('room.lobbyCount', { count: query.data.waiting.length })} />
        )}
      </Stack>

      {query.isLoading ? (
        <Stack role="status" alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={24} aria-label={t('room.lobby')} />
        </Stack>
      ) : query.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('room.lobbyLoadError')}
        </Alert>
      ) : query.data?.waiting.length ? (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          {query.data.waiting.map((participant, index) => {
            const busy =
              decisionMutation.isPending &&
              decisionMutation.variables?.requestId === participant.requestId;
            return (
              <Box key={participant.requestId}>
                {index > 0 && <Divider />}
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ p: 1.5 }}>
                  <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>
                    {participant.displayName.slice(0, 1)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {participant.displayName}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(participant.external ? 'room.external' : 'room.internal')}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {participant.organizationName ??
                        participant.email ??
                        t('room.requestedAt', {
                          time: formatMeetingTime(participant.requestedAt, i18n.language),
                        })}
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.5}>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={busy}
                      aria-label={`${t('actions.deny')} ${participant.displayName}`}
                      onClick={() =>
                        decisionMutation.mutate({
                          requestId: participant.requestId,
                          expectedVersion: participant.version,
                          decision: 'DENY',
                        })
                      }
                    >
                      <UserRoundX size={17} />
                    </ActionButton>
                    <ActionButton
                      intent="primary"
                      size="small"
                      loading={busy}
                      aria-label={`${t('actions.approve')} ${participant.displayName}`}
                      onClick={() =>
                        decisionMutation.mutate({
                          requestId: participant.requestId,
                          expectedVersion: participant.version,
                          decision: 'APPROVE',
                        })
                      }
                    >
                      <UserRoundCheck size={17} />
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
        </Box>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('room.lobbyEmpty')}
          description={t('room.lobbyEmptyDescription')}
          size="compact"
        />
      )}
      {decisionMutation.isError && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {t('room.lobbyDecisionError')}
        </Alert>
      )}
    </Box>
  );
}
