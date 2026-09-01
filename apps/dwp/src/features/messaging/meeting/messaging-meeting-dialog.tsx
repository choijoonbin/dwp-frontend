import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PreJoin, type LocalUserChoices } from '@livekit/components-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Video } from 'lucide-react';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';
import {
  endMessagingMeeting,
  getCurrentMessagingMeeting,
  getMessagingMeetingHistory,
  getMessagingMeetingCapability,
  issueMessagingMeetingToken,
  startMessagingMeeting,
  type MessagingMeetingJoinCredential,
} from '@dwp-frontend/shared-utils/api/messaging-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { Theme } from '@mui/material/styles';

import { resolveMeetingLobbyState } from './meeting-state';
import { MessagingMeetingHistory } from './messaging-meeting-history';

import '@livekit/components-styles';

const LazyLiveKitMeetingRoom = lazy(() => import('./livekit-meeting-room'));

export type MessagingMeetingLabels = {
  title: string;
  description: string;
  close: string;
  loading: string;
  unavailable: string;
  active: string;
  ready: string;
  start: string;
  join: string;
  preparing: string;
  retry: string;
  joinLabel: string;
  microphone: string;
  camera: string;
  displayName: string;
  error: string;
  live: string;
  connecting: string;
  connectionError: string;
  permissionError: string;
  disconnected: string;
  endForEveryone: string;
  ending: string;
  historyTitle: string;
  historyDescription: string;
  historyEmpty: string;
  historyEndedBy: (name: string) => string;
  historyMinutes: (count: number) => string;
};

export type MessagingMeetingDialogProps = {
  open: boolean;
  conversationId: string;
  conversationName: string;
  displayName: string;
  currentUserId: number;
  canModerateConversation?: boolean;
  labels: MessagingMeetingLabels;
  presentation?: 'dialog' | 'fullscreen';
  onClose: () => void;
};

export function MessagingMeetingDialog({
  open,
  conversationId,
  conversationName,
  displayName,
  currentUserId,
  canModerateConversation = false,
  labels,
  presentation = 'dialog',
  onClose,
}: MessagingMeetingDialogProps) {
  const { i18n } = useTranslation('messaging');
  const queryClient = useQueryClient();
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const [preJoin, setPreJoin] = useState(false);
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [credential, setCredential] = useState<MessagingMeetingJoinCredential | null>(null);
  const [localError, setLocalError] = useState(false);

  const capabilityQuery = useQuery({
    queryKey: ['messaging', 'meeting', conversationId, 'capability'],
    queryFn: () => getMessagingMeetingCapability(conversationId),
    enabled: open && Boolean(conversationId),
    staleTime: 60_000,
    retry: 1,
  });
  const currentQuery = useQuery({
    queryKey: ['messaging', 'meeting', conversationId, 'current'],
    queryFn: () => getCurrentMessagingMeeting(conversationId),
    enabled: open && Boolean(conversationId),
    refetchInterval: credential ? false : 10_000,
    retry: 1,
  });
  const historyQuery = useQuery({
    queryKey: ['messaging', 'meeting', conversationId, 'history'],
    queryFn: () => getMessagingMeetingHistory(conversationId, 5),
    enabled: open && Boolean(conversationId),
    staleTime: 30_000,
    retry: 1,
  });
  const startMutation = useMutation({
    mutationFn: () => startMessagingMeeting(conversationId),
    onSuccess: (session) => {
      queryClient.setQueryData(['messaging', 'meeting', conversationId, 'current'], session);
      setPreJoin(true);
      setLocalError(false);
    },
    onError: () => setLocalError(true),
  });
  const tokenMutation = useMutation({
    mutationFn: () => issueMessagingMeetingToken(conversationId),
    onSuccess: (nextCredential) => {
      setCredential(nextCredential);
      setLocalError(false);
    },
    onError: () => setLocalError(true),
  });
  const endMutation = useMutation({
    mutationFn: () => endMessagingMeeting(conversationId),
    onSuccess: () => {
      setCredential(null);
      setChoices(null);
      setPreJoin(false);
      queryClient.setQueryData(['messaging', 'meeting', conversationId, 'current'], null);
      void queryClient.invalidateQueries({
        queryKey: ['messaging', 'meeting', conversationId, 'history'],
      });
      onClose();
    },
    onError: () => setLocalError(true),
  });

  useEffect(() => {
    if (open) return;
    setPreJoin(false);
    setChoices(null);
    setCredential(null);
    setLocalError(false);
  }, [open]);

  const loading = capabilityQuery.isLoading || currentQuery.isLoading;
  const lobbyState = resolveMeetingLobbyState({
    loading,
    capability: capabilityQuery.data,
    session: currentQuery.data,
  });
  const busy = startMutation.isPending || tokenMutation.isPending;
  const fullScreen = presentation === 'fullscreen' || compact;
  const inMeeting = Boolean(credential && choices);

  const enterPreJoin = () => {
    if (lobbyState === 'START') {
      startMutation.mutate();
      return;
    }
    setPreJoin(true);
    setLocalError(false);
  };

  const join = (nextChoices: LocalUserChoices) => {
    setChoices(nextChoices);
    tokenMutation.mutate();
  };

  return (
    <ContentDialog
      open={open}
      title={labels.title}
      description={conversationName}
      closeLabel={labels.close}
      onClose={onClose}
      busy={Boolean(credential) || busy}
      fullScreen={fullScreen}
      hideHeader={inMeeting}
      maxWidth={inMeeting ? 'lg' : preJoin ? 'md' : 'sm'}
      titleStart={
        <Box
          sx={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: 2,
          }}
        >
          <Video size={21} />
        </Box>
      }
      contentDividers={!credential}
      contentSx={
        inMeeting
          ? { p: 0, height: '100%', bgcolor: '#111315' }
          : {
              display: 'grid',
              placeItems: 'center',
              minHeight: 0,
              overflow: 'auto',
              py: preJoin ? 2.5 : 4,
            }
      }
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 2,
            overflow: 'hidden',
            height: fullScreen
              ? '100dvh'
              : inMeeting
                ? 'min(84dvh, 880px)'
                : preJoin
                  ? 'min(82dvh, 720px)'
                  : 'auto',
          },
        },
      }}
    >
      {credential && choices ? (
        <Suspense
          fallback={
            <Stack
              height="100%"
              alignItems="center"
              justifyContent="center"
              spacing={2}
              role="status"
            >
              <CircularProgress aria-hidden="true" />
              <Typography color="common.white">{labels.connecting}</Typography>
            </Stack>
          }
        >
          <LazyLiveKitMeetingRoom
            conversationName={conversationName}
            credential={credential}
            choices={choices}
            labels={labels}
            ending={endMutation.isPending}
            canEndForEveryone={
              currentQuery.data?.startedBy === currentUserId || canModerateConversation
            }
            operationError={localError ? labels.error : null}
            onLeave={() => {
              setCredential(null);
              setChoices(null);
              onClose();
            }}
            onEndForEveryone={() => endMutation.mutate()}
          />
        </Suspense>
      ) : (
        <Stack width="min(100%, 720px)" spacing={3} alignItems="stretch">
          {(localError || capabilityQuery.isError || currentQuery.isError) && (
            <Alert
              severity="error"
              action={
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => {
                    setLocalError(false);
                    void capabilityQuery.refetch();
                    void currentQuery.refetch();
                  }}
                >
                  {labels.retry}
                </ActionButton>
              }
            >
              {labels.error}
            </Alert>
          )}
          {preJoin ? (
            <Box
              data-lk-theme="default"
              sx={{
                overflow: 'hidden',
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                '& .lk-prejoin': { minHeight: 420 },
                '@media (prefers-reduced-motion: reduce)': {
                  '& *': { transition: 'none !important', animation: 'none !important' },
                },
              }}
            >
              <PreJoin
                defaults={{
                  username: displayName,
                  audioEnabled: false,
                  videoEnabled: false,
                }}
                persistUserChoices={false}
                joinLabel={tokenMutation.isPending ? labels.preparing : labels.joinLabel}
                micLabel={labels.microphone}
                camLabel={labels.camera}
                userLabel={labels.displayName}
                onError={() => setLocalError(true)}
                onSubmit={(nextChoices) => join({ ...nextChoices, username: displayName })}
              />
            </Box>
          ) : (
            <Stack spacing={3}>
              <Stack spacing={2.5} alignItems="center" textAlign="center" role="status">
                {lobbyState === 'LOADING' ? (
                  <>
                    <CircularProgress size={32} aria-hidden="true" />
                    <Typography color="text.secondary">{labels.loading}</Typography>
                  </>
                ) : lobbyState === 'UNAVAILABLE' ? (
                  <Alert severity="info" icon={<ShieldCheck size={20} />} sx={{ width: '100%' }}>
                    {labels.unavailable}
                  </Alert>
                ) : (
                  <>
                    <Typography variant="h5" fontWeight={750}>
                      {lobbyState === 'JOIN' ? labels.active : labels.ready}
                    </Typography>
                    <Typography color="text.secondary">{labels.description}</Typography>
                    <ActionButton
                      intent="primary"
                      size="large"
                      loading={busy}
                      loadingLabel={labels.preparing}
                      startIcon={<Video size={18} />}
                      onClick={enterPreJoin}
                    >
                      {lobbyState === 'JOIN' ? labels.join : labels.start}
                    </ActionButton>
                  </>
                )}
              </Stack>
              <MessagingMeetingHistory
                items={historyQuery.data ?? []}
                loading={historyQuery.isLoading}
                language={i18n.resolvedLanguage ?? i18n.language}
                labels={{
                  title: labels.historyTitle,
                  description: labels.historyDescription,
                  empty: labels.historyEmpty,
                  endedBy: labels.historyEndedBy,
                  minutes: labels.historyMinutes,
                }}
              />
            </Stack>
          )}
        </Stack>
      )}
    </ContentDialog>
  );
}
