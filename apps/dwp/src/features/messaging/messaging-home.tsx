import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createDirectMessagingConversation,
  getMessagingConversations,
  getMessagingHome,
  getMessagingSavedItems,
  getMessagingSharedAssets,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, LiveStatus, PageCanvas } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { MessagingPageHeading, messagingRelativeTime } from './messaging-components';
import {
  MessagingAttentionOverview,
  MessagingFocusQueue,
  MessagingHomeSkeleton,
} from './messaging-home-sections';
import {
  MessagingContinuePanel,
  MessagingPeoplePulse,
  MessagingSpacesPanel,
} from './messaging-home-continuation-sections';
import {
  buildMessagingHomeView,
  filterMessagingHomeConversations,
  messagingHomeFilter,
  type MessagingHomeFilter,
} from './messaging-home-model';
import { MessagingHomeHuddle } from './messaging-home-huddle';
import { MessagingHomeSharedAssets } from './messaging-home-shared-assets';

export function MessagingHome() {
  const { t, i18n } = useTranslation('messaging');
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = messagingHomeFilter(params.get('focus'));
  const homeQuery = useQuery({
    queryKey: ['messaging', 'home', auth.user?.tenantId, auth.user?.userId],
    queryFn: getMessagingHome,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const conversationsQuery = useQuery({
    queryKey: [
      'messaging',
      'conversations',
      'home-attention',
      auth.user?.tenantId,
      auth.user?.userId,
    ],
    queryFn: () => getMessagingConversations({ scope: 'ALL', page: 0, pageSize: 50 }),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const mentionsEnabled = filter === 'MENTIONS' || (homeQuery.data?.metrics.mentions ?? 0) > 0;
  const mentionsQuery = useQuery({
    queryKey: [
      'messaging',
      'conversations',
      'home-mentions',
      auth.user?.tenantId,
      auth.user?.userId,
    ],
    queryFn: () => getMessagingConversations({ scope: 'MENTIONS', page: 0, pageSize: 50 }),
    enabled: mentionsEnabled,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const savedQuery = useQuery({
    queryKey: ['messaging', 'saved-items', 'home', auth.user?.tenantId, auth.user?.userId],
    queryFn: () => getMessagingSavedItems({ page: 0, pageSize: 3 }),
    staleTime: 20_000,
    retry: 1,
  });
  const directMutation = useMutation({
    mutationFn: createDirectMessagingConversation,
    onSuccess: (conversation) =>
      navigate(`/messages/direct?conversation=${conversation.conversationId}`),
    onError: () => toast.error(t('people.openError')),
  });
  const assetsQuery = useQuery({
    queryKey: ['messaging', 'home', 'shared-assets', auth.user?.tenantId, auth.user?.userId],
    enabled: auth.isAuthenticated && Boolean(auth.user?.tenantId && auth.user?.userId),
    queryFn: () => getMessagingSharedAssets(6),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });
  const hour = new Date().getHours();
  const greeting = t(
    hour < 12
      ? 'home.greetingMorning'
      : hour < 18
        ? 'home.greetingAfternoon'
        : 'home.greetingEvening'
  );
  const data = homeQuery.data;
  const conversationSource = useMemo(
    () => conversationsQuery.data?.items ?? data?.priority ?? [],
    [conversationsQuery.data?.items, data?.priority]
  );
  const view = useMemo(
    () => (data ? buildMessagingHomeView(data, conversationSource) : undefined),
    [conversationSource, data]
  );
  const filtered = filterMessagingHomeConversations(
    conversationSource,
    filter,
    mentionsQuery.data?.items
  );
  const completeSource =
    !!conversationsQuery.data &&
    conversationsQuery.data.total <= conversationsQuery.data.items.length;
  const filterCounts: Partial<Record<MessagingHomeFilter, number>> = {
    ALL: data?.metrics.unreadConversations,
    ...(completeSource
      ? {
          SPACE: filterMessagingHomeConversations(conversationSource, 'SPACE').length,
          DIRECT: filterMessagingHomeConversations(conversationSource, 'DIRECT').length,
        }
      : {}),
    ...(mentionsQuery.data && !mentionsQuery.isError ? { MENTIONS: mentionsQuery.data.total } : {}),
  };
  const refreshing =
    homeQuery.isFetching ||
    conversationsQuery.isFetching ||
    savedQuery.isFetching ||
    mentionsQuery.isFetching ||
    assetsQuery.isFetching;
  const refreshAll = () => {
    void Promise.all([
      homeQuery.refetch(),
      conversationsQuery.refetch(),
      savedQuery.refetch(),
      assetsQuery.refetch(),
      ...(mentionsEnabled ? [mentionsQuery.refetch()] : []),
    ]);
  };
  const setFilter = (next: MessagingHomeFilter) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === 'ALL') updated.delete('focus');
        else updated.set('focus', next);
        return updated;
      },
      { replace: true }
    );
  const openFocus = () =>
    navigate(
      filter === 'MENTIONS'
        ? '/messages/inbox?attention=mentions'
        : filter === 'SPACE'
          ? '/messages/spaces'
          : filter === 'DIRECT'
            ? '/messages/direct'
            : '/messages/inbox'
    );

  return (
    <PageCanvas topInset="compact">
      <Box
        data-testid="messaging-home-canvas"
        sx={{
          width: 1,
          minWidth: 0,
          display: 'grid',
          gap: { xs: 2.5, lg: 3 },
          alignItems: 'start',
          gridTemplateColumns: 'minmax(0, 1fr)',
          '@media (min-width: 1180px)': { gridTemplateColumns: 'minmax(0, 1fr) 280px' },
          '@media (min-width: 1600px)': { gridTemplateColumns: 'minmax(0, 1fr) 320px' },
        }}
      >
        <Stack
          spacing={2}
          sx={{ minWidth: 0, containerType: 'inline-size', containerName: 'messaging-home-main' }}
        >
          <MessagingPageHeading
            eyebrow={t('home.eyebrow')}
            title={t('home.title', { greeting, name: auth.user?.displayName ?? t('home.member') })}
            description={t('home.description')}
            actions={
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                {data && (
                  <LiveStatus
                    state={homeQuery.isError ? 'stale' : refreshing ? 'syncing' : 'live'}
                    label={t(
                      homeQuery.isError
                        ? 'home.sync.stale'
                        : refreshing
                          ? 'home.sync.refreshing'
                          : 'home.sync.current'
                    )}
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
                  size="small"
                  startIcon={<MessageSquarePlus size={16} />}
                  onClick={() => navigate('/messages/people')}
                >
                  {t('actions.newDirect')}
                </ActionButton>
              </Stack>
            }
          />
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
              <MessagingFocusQueue
                conversations={filtered.slice(0, 6)}
                loading={
                  filter === 'MENTIONS' ? mentionsQuery.isLoading : conversationsQuery.isLoading
                }
                error={filter === 'MENTIONS' && mentionsQuery.isError}
                onRetry={() => mentionsQuery.refetch()}
                filter={filter}
                onFilterChange={setFilter}
                filterCounts={filterCounts}
                onOpenAll={openFocus}
              />
              {auth.user?.userId && (
                <MessagingHomeHuddle
                  conversations={conversationSource}
                  userId={auth.user.userId}
                  displayName={auth.user.displayName ?? t('home.member')}
                />
              )}
              <MessagingHomeSharedAssets
                items={assetsQuery.data?.items ?? []}
                loading={assetsQuery.isLoading}
                error={assetsQuery.isError}
                onRetry={() => assetsQuery.refetch()}
              />
            </>
          ) : null}
        </Stack>
        {data && view && (
          <Stack
            component="aside"
            aria-label={t('home.contextRail')}
            spacing={2.75}
            sx={(theme) => ({
              minWidth: 0,
              px: { xs: 0, lg: 2 },
              pt: { xs: 2, lg: 0.5 },
              pb: 2,
              borderStyle: 'solid',
              borderTopWidth: { xs: 1, lg: 0 },
              borderLeftWidth: { xs: 0, lg: 1 },
              borderRightWidth: 0,
              borderBottomWidth: 0,
              borderColor: 'divider',
              bgcolor: alpha(theme.palette.background.paper, 0.6),
            })}
          >
            <MessagingPeoplePulse
              people={data.people}
              onOpenDirectory={() => navigate('/messages/people')}
              onOpenPerson={(userId) => directMutation.mutate(userId)}
              openingPerson={directMutation.isPending}
            />
            <MessagingSpacesPanel
              conversations={view.spaceConversations}
              directConversations={view.directConversations}
              metrics={data.metrics}
              onOpenAll={() => navigate('/messages/spaces')}
              onOpenDirect={() => navigate('/messages/direct')}
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
        )}
      </Box>
    </PageCanvas>
  );
}
