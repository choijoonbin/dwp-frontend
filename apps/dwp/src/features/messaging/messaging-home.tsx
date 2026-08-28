import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getMessagingConversations,
  getMessagingHome,
  getMessagingSavedItems,
  useAuth,
} from '@dwp-frontend/shared-utils';
import { ActionButton, LiveStatus, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { MessagingPageHeading, messagingRelativeTime } from './messaging-components';
import {
  MessagingAttentionOverview,
  MessagingFocusQueue,
  MessagingHomeSkeleton,
} from './messaging-home-sections';
import {
  MessagingContinuePanel,
  MessagingSpacesPanel,
} from './messaging-home-continuation-sections';
import { buildMessagingHomeView } from './messaging-home-model';

export function MessagingHome() {
  const { t, i18n } = useTranslation('messaging');
  const auth = useAuth();
  const navigate = useNavigate();
  const homeQuery = useQuery({
    queryKey: ['messaging', 'home'],
    queryFn: getMessagingHome,
    staleTime: 20_000,
    retry: 1,
  });
  const conversationsQuery = useQuery({
    queryKey: ['messaging', 'conversations', 'home-attention'],
    queryFn: () => getMessagingConversations({ scope: 'ALL', page: 0, pageSize: 50 }),
    staleTime: 20_000,
    retry: 1,
  });
  const savedQuery = useQuery({
    queryKey: ['messaging', 'saved-items', 'home'],
    queryFn: () => getMessagingSavedItems({ page: 0, pageSize: 3 }),
    staleTime: 20_000,
    retry: 1,
  });
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorning');
    if (hour < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);
  const data = homeQuery.data;
  const view = useMemo(
    () =>
      data
        ? buildMessagingHomeView(data, conversationsQuery.data?.items ?? data.priority)
        : undefined,
    [conversationsQuery.data?.items, data]
  );
  const refreshing = homeQuery.isFetching || conversationsQuery.isFetching || savedQuery.isFetching;

  const refreshAll = () => {
    void Promise.all([homeQuery.refetch(), conversationsQuery.refetch(), savedQuery.refetch()]);
  };

  return (
    <PageCanvas topInset="compact">
      <Box sx={{ width: 1, maxWidth: 1440, mx: 'auto' }}>
        <MessagingPageHeading
          eyebrow={t('home.eyebrow')}
          title={t('home.title', {
            greeting,
            name: auth.user?.displayName ?? t('home.member'),
          })}
          description={t('home.description')}
          actions={
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems="center">
              {data && (
                <LiveStatus
                  state={refreshing ? 'syncing' : 'live'}
                  label={t(refreshing ? 'home.sync.refreshing' : 'home.sync.current')}
                  detail={t('home.sync.updated', {
                    time: messagingRelativeTime(
                      data.generatedAt,
                      i18n.resolvedLanguage ?? i18n.language
                    ),
                  })}
                  refreshLabel={t('actions.refresh')}
                  refreshing={refreshing}
                  onRefresh={refreshAll}
                />
              )}
              <ActionButton
                intent="primary"
                startIcon={<MessageSquarePlus size={17} />}
                onClick={() => navigate('/messages/people')}
              >
                {t('actions.newDirect')}
              </ActionButton>
            </Stack>
          }
        />

        <Stack spacing={3} sx={{ mt: 2.5 }}>
          {homeQuery.isError && (
            <Alert
              severity="error"
              action={
                <ActionButton intent="quiet" onClick={() => homeQuery.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('home.loadError')}
            </Alert>
          )}

          {homeQuery.isLoading ? (
            <MessagingHomeSkeleton />
          ) : data && view ? (
            <>
              <MessagingAttentionOverview
                metrics={data.metrics}
                state={view.attentionState}
                onOpenInbox={() => navigate('/messages/inbox')}
                onOpenMentions={() => navigate('/messages/inbox?attention=mentions')}
                onOpenSaved={() => navigate('/messages/later')}
              />

              {conversationsQuery.isError && (
                <Alert
                  severity="warning"
                  action={
                    <ActionButton intent="quiet" onClick={() => conversationsQuery.refetch()}>
                      {t('actions.retry')}
                    </ActionButton>
                  }
                >
                  {t('home.focus.partial')}
                </Alert>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr)',
                  gap: 3,
                  alignItems: 'start',
                  '@media (min-width: 1280px)': {
                    gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.75fr)',
                  },
                }}
              >
                <MessagingFocusQueue
                  conversations={view.focusConversations}
                  loading={conversationsQuery.isLoading}
                  onOpenAll={() => navigate('/messages/inbox')}
                />
                <Stack spacing={2.5}>
                  <MessagingSpacesPanel
                    conversations={view.spaceConversations}
                    metrics={data.metrics}
                    onOpenAll={() => navigate('/messages/spaces')}
                  />
                  <MessagingContinuePanel
                    items={savedQuery.data?.items ?? []}
                    loading={savedQuery.isLoading}
                    error={savedQuery.isError}
                    onRetry={() => savedQuery.refetch()}
                    onOpenAll={() => navigate('/messages/later')}
                    onOpenDirectory={() => navigate('/messages/people')}
                  />
                </Stack>
              </Box>
            </>
          ) : null}
        </Stack>
      </Box>
    </PageCanvas>
  );
}
