import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BellRing } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  LoadingState,
  LocalErrorState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import {
  applyNotificationTriage,
  createNotificationIdempotencyKey,
  getNotificationDeliveryProfile,
  getNotificationInbox,
  getNotificationSummary,
  getNotificationSummaryByApp,
  sendMessagingMessage,
  useToast,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { notificationArrivalContent } from '../../components/notification-arrival-policy';
import { scheduleNotificationCacheInvalidation } from './notification-cache-policy';
import { NotificationActionCard } from './notification-action-card';
import { NotificationHomeHeader } from './notification-home-header';
import { NotificationHomeInsights } from './notification-home-insights';
import {
  groupNotificationStream,
  kpiView,
  mergeNotificationInboxPages,
  optimisticNotificationSummary,
  notificationMatchesInboxScope,
} from './notification-inbox-model';
import {
  NotificationDigestBanner,
  NotificationKpiFilterBar,
  NotificationStreamGroupHeading,
} from './notification-inbox-chrome';
import {
  NOTIFICATION_CENTER_PATH,
  NOTIFICATION_SETTINGS_PATH,
  notificationCenterPath,
} from './notification-navigation';
import { notificationQueryKeys } from './integration-contract';
import { defaultSnoozeTime, optimisticTriageItem } from './notification-model';
import {
  NotificationConnectionNotice,
  NotificationItemRow,
  useNotificationClock,
} from './notification-ui';
import { useNotificationLiveUpdates, useOnlineStatus } from './use-notification-runtime';

import type {
  AppNotificationCounter,
  NotificationInboxPage,
  NotificationItem,
  NotificationSummary,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils';
import type {
  NotificationInboxFilterScope,
  NotificationKpiKey,
  NotificationStreamGroupKey,
} from './notification-inbox-model';

const HOME_ALL_SCOPE = { surface: 'home', view: 'ALL' } as const;
const HOME_PRIORITY_SCOPE = { surface: 'home', view: 'PRIORITY' } as const;
const HOME_MENTIONS_SCOPE = { surface: 'home', view: 'MENTIONS' } as const;
const HOME_INBOX_SCOPES = [HOME_ALL_SCOPE, HOME_PRIORITY_SCOPE, HOME_MENTIONS_SCOPE] as const;
const HOME_APP_SUMMARY_SCOPE = { surface: 'home' } as const;
const HOME_INBOX_LIMIT = 8;
const NOTIFICATION_HOME_MAX_WIDTH = 1600;
const HOME_GROUP_PREVIEW_LIMIT: Record<NotificationStreamGroupKey, number> = {
  ACTION_REQUIRED: 2,
  CONVERSATIONS: 1,
  UPDATES: 3,
};

function homeGroupCenterPath(groupKey: NotificationStreamGroupKey): string {
  if (groupKey === 'ACTION_REQUIRED') return notificationCenterPath({ view: 'PRIORITY' });
  if (groupKey === 'CONVERSATIONS') return notificationCenterPath({ view: 'MENTIONS' });
  return notificationCenterPath({ view: 'ALL' });
}

function sortAppCounters(counters: AppNotificationCounter[]): AppNotificationCounter[] {
  return [...counters]
    .filter((counter) => counter.totalUnread > 0)
    .sort(
      (left, right) =>
        right.urgentUnread - left.urgentUnread ||
        right.actionableUnread - left.actionableUnread ||
        right.totalUnread - left.totalUnread ||
        right.lastActivityAt.localeCompare(left.lastActivityAt)
    )
    .slice(0, 6);
}

function updateHomeInbox(
  page: NotificationInboxPage | undefined,
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): NotificationInboxPage | undefined {
  if (!page) return page;
  const previous = page.items.find((candidate) => candidate.notificationId === item.notificationId);
  const visible = notificationMatchesInboxScope(item, scope);
  const nextItems = page.items
    .map((candidate) => (candidate.notificationId === item.notificationId ? item : candidate))
    .filter((candidate) => notificationMatchesInboxScope(candidate, scope));
  const totalDelta = Number(visible) - Number(Boolean(previous));
  return {
    ...page,
    items: nextItems,
    approximateTotal:
      page.approximateTotal == null
        ? page.approximateTotal
        : Math.max(0, page.approximateTotal + totalDelta),
  };
}

type HomeTriageCommand = {
  item: NotificationItem;
  action: NotificationTriageAction;
  snoozedUntil?: string;
  announce?: boolean;
};

export function NotificationHome() {
  const { t } = useTranslation('notifications');
  const theme = useTheme();
  const desktopInsights = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const online = useOnlineStatus();
  const notificationClock = useNotificationClock();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<NotificationKpiKey | null>(null);
  const selectionScope = useMemo(
    () => ({ surface: 'home-selection', ...kpiView(activeKpi ?? 'ACTIONABLE') }),
    [activeKpi]
  );
  const homeScopes = useMemo(() => [...HOME_INBOX_SCOPES, selectionScope], [selectionScope]);
  const handleLiveSignal = useCallback(() => {
    void scheduleNotificationCacheInvalidation(queryClient);
  }, [queryClient]);
  const connectionState = useNotificationLiveUpdates(handleLiveSignal);
  const pollingInterval = connectionState === 'offline' ? false : 30_000;

  const summaryQuery = useQuery({
    queryKey: notificationQueryKeys.summary(),
    queryFn: ({ signal }) => getNotificationSummary(signal),
    staleTime: 15_000,
    refetchInterval: pollingInterval,
    retry: 1,
  });
  const inboxQuery = useQuery({
    queryKey: notificationQueryKeys.inbox(HOME_ALL_SCOPE),
    queryFn: ({ signal }) => getNotificationInbox({ view: 'ALL', limit: HOME_INBOX_LIMIT }, signal),
    staleTime: 15_000,
    refetchInterval: pollingInterval,
    retry: 1,
  });
  const priorityInboxQuery = useQuery({
    queryKey: notificationQueryKeys.inbox(HOME_PRIORITY_SCOPE),
    queryFn: ({ signal }) => getNotificationInbox({ view: 'PRIORITY', limit: 4 }, signal),
    staleTime: 15_000,
    refetchInterval: pollingInterval,
    retry: 1,
  });
  const mentionsInboxQuery = useQuery({
    queryKey: notificationQueryKeys.inbox(HOME_MENTIONS_SCOPE),
    queryFn: ({ signal }) => getNotificationInbox({ view: 'MENTIONS', limit: 3 }, signal),
    staleTime: 15_000,
    refetchInterval: pollingInterval,
    retry: 1,
  });
  const selectionQuery = useQuery({
    queryKey: notificationQueryKeys.inbox(selectionScope),
    queryFn: ({ signal }) =>
      getNotificationInbox({ ...selectionScope, limit: HOME_INBOX_LIMIT }, signal),
    enabled: activeKpi !== null,
    staleTime: 15_000,
    refetchInterval: activeKpi !== null ? pollingInterval : false,
    retry: 1,
  });
  const profileQuery = useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: ({ signal }) => getNotificationDeliveryProfile(signal),
    staleTime: 30_000,
    retry: 1,
  });
  const appSummaryQuery = useQuery({
    queryKey: notificationQueryKeys.appSummary(HOME_APP_SUMMARY_SCOPE),
    queryFn: ({ signal }) => getNotificationSummaryByApp(signal),
    staleTime: 15_000,
    refetchInterval: pollingInterval,
    retry: 1,
  });

  const triageMutation = useMutation({
    mutationFn: ({ item, action, snoozedUntil }: HomeTriageCommand) =>
      applyNotificationTriage(item.notificationId, {
        action,
        expectedVersion: item.version,
        snoozedUntil,
        idempotencyKey: createNotificationIdempotencyKey(`home-${action.toLowerCase()}`),
      }),
    onMutate: async ({ item, action, snoozedUntil }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationQueryKeys.inboxRoot() }),
        queryClient.cancelQueries({ queryKey: notificationQueryKeys.summary() }),
      ]);
      const previousInboxes = homeScopes.map((scope) => ({
        scope,
        data: queryClient.getQueryData<NotificationInboxPage>(notificationQueryKeys.inbox(scope)),
      }));
      const previousSummary = queryClient.getQueryData<NotificationSummary>(
        notificationQueryKeys.summary()
      );
      const optimistic = optimisticTriageItem(item, action, undefined, snoozedUntil);
      previousInboxes.forEach(({ scope, data }) => {
        queryClient.setQueryData(
          notificationQueryKeys.inbox(scope),
          updateHomeInbox(data, optimistic, scope)
        );
      });
      if (previousSummary) {
        queryClient.setQueryData(
          notificationQueryKeys.summary(),
          optimisticNotificationSummary(previousSummary, item, optimistic)
        );
      }
      return { previousInboxes, previousSummary };
    },
    onError: (_error, variables, context) => {
      context?.previousInboxes.forEach(({ scope, data }) => {
        if (data) {
          queryClient.setQueryData(notificationQueryKeys.inbox(scope), data);
        }
      });
      if (context?.previousSummary) {
        queryClient.setQueryData(notificationQueryKeys.summary(), context.previousSummary);
      }
      if (variables.announce !== false) toast.error(t('feedback.triageError'));
    },
    onSuccess: (result, variables) => {
      homeScopes.forEach((scope) => {
        queryClient.setQueryData<NotificationInboxPage>(
          notificationQueryKeys.inbox(scope),
          (current) => updateHomeInbox(current, result.item, scope)
        );
      });
      queryClient.setQueryData(notificationQueryKeys.summary(), result.summary);
      if (variables.announce !== false) toast.success(t(`feedback.${variables.action}`));
    },
    onSettled: async () => {
      await scheduleNotificationCacheInvalidation(queryClient);
    },
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      scheduleNotificationCacheInvalidation(queryClient),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.preferences() }),
    ]);
  }, [queryClient]);

  const inbox = useMemo(
    () =>
      mergeNotificationInboxPages(
        [priorityInboxQuery.data, mentionsInboxQuery.data, inboxQuery.data],
        HOME_INBOX_LIMIT
      ),
    [inboxQuery.data, mentionsInboxQuery.data, priorityInboxQuery.data]
  );

  useEffect(() => {
    const items = inbox?.items ?? [];
    if (items.length === 0) {
      setActiveId(null);
      return;
    }
    if (!items.some((item) => item.notificationId === activeId)) {
      setActiveId(items[0]?.notificationId ?? null);
    }
  }, [activeId, inbox?.items]);

  const triageItem = useCallback(
    (item: NotificationItem, action: NotificationTriageAction) => {
      triageMutation.mutate({
        item,
        action,
        ...(action === 'SNOOZE' ? { snoozedUntil: defaultSnoozeTime(4) } : {}),
      });
    },
    [triageMutation]
  );

  const quickReply = useCallback(
    async (
      item: NotificationItem,
      target: { conversationId: string; replyToMessageId?: string },
      body: string,
      idempotencyKey: string
    ) => {
      await sendMessagingMessage({
        conversationId: target.conversationId,
        body,
        replyToMessageId: target.replyToMessageId,
        idempotencyKey,
      });
      await queryClient.invalidateQueries({ queryKey: ['messaging'] });
      let completionPending = false;
      if (!item.completedAt) {
        try {
          await triageMutation.mutateAsync({ item, action: 'COMPLETE', announce: false });
        } catch {
          completionPending = true;
        }
      }
      if (completionPending) toast.warning(t('workbench.card.replyCompletionPending'));
      else toast.success(t('workbench.card.replySent'));
    },
    [queryClient, t, toast, triageMutation]
  );

  const selectKpi = useCallback((key: NotificationKpiKey) => {
    setActiveKpi((current) => (current === key ? null : key));
  }, []);
  const topApps = useMemo(
    () => sortAppCounters(appSummaryQuery.data?.apps ?? []),
    [appSummaryQuery.data?.apps]
  );
  const unavailableSources = useMemo(
    () =>
      Array.from(
        new Set([
          ...(summaryQuery.data?.unavailableSources ?? []),
          ...(inboxQuery.data?.unavailableSources ?? []),
          ...(priorityInboxQuery.data?.unavailableSources ?? []),
          ...(mentionsInboxQuery.data?.unavailableSources ?? []),
          ...(appSummaryQuery.data?.unavailableSources ?? []),
          ...(activeKpi ? (selectionQuery.data?.unavailableSources ?? []) : []),
        ])
      ),
    [
      appSummaryQuery.data?.unavailableSources,
      inboxQuery.data?.unavailableSources,
      mentionsInboxQuery.data?.unavailableSources,
      priorityInboxQuery.data?.unavailableSources,
      summaryQuery.data?.unavailableSources,
      activeKpi,
      selectionQuery.data?.unavailableSources,
    ]
  );
  const partial =
    Boolean(summaryQuery.data?.partial) ||
    Boolean(inboxQuery.data?.partial) ||
    Boolean(priorityInboxQuery.data?.partial) ||
    Boolean(mentionsInboxQuery.data?.partial) ||
    Boolean(appSummaryQuery.data?.partial) ||
    Boolean(activeKpi && selectionQuery.data?.partial);
  const refreshing =
    summaryQuery.isFetching ||
    inboxQuery.isFetching ||
    priorityInboxQuery.isFetching ||
    mentionsInboxQuery.isFetching ||
    profileQuery.isFetching ||
    appSummaryQuery.isFetching ||
    (activeKpi !== null && selectionQuery.isFetching);
  const coreLoading = summaryQuery.isLoading || inboxQuery.isLoading || profileQuery.isLoading;
  const coreError = summaryQuery.isError || inboxQuery.isError || profileQuery.isError;
  const summary = summaryQuery.data;
  const profile = profileQuery.data;
  const displayedInbox = activeKpi ? selectionQuery.data : inbox;
  const streamGroups = useMemo(
    () => groupNotificationStream(displayedInbox?.items ?? []),
    [displayedInbox?.items]
  );
  const generatedAt = summary?.generatedAt ?? appSummaryQuery.data?.generatedAt;

  const header = (
    <NotificationHomeHeader
      search={search}
      onSearchChange={setSearch}
      onSearch={() => navigate(notificationCenterPath({ view: 'ALL', query: search }))}
      state={connectionState}
      generatedAt={generatedAt}
      refreshing={refreshing}
      onRefresh={() => void handleRefresh()}
    />
  );

  if (coreLoading) {
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <Box sx={{ width: 1, maxWidth: NOTIFICATION_HOME_MAX_WIDTH, mx: 'auto' }}>
          {header}
          <Box sx={{ mt: 2.5 }}>
            <LoadingState label={t('home.loading')} variant="skeleton" size="page" />
          </Box>
        </Box>
      </PageCanvas>
    );
  }
  if (coreError || !summary || !inbox || !profile) {
    return (
      <PageCanvas mode="workspace" topInset="compact">
        <Box sx={{ width: 1, maxWidth: NOTIFICATION_HOME_MAX_WIDTH, mx: 'auto' }}>
          {header}
          <Box sx={{ mt: 2.5 }}>
            <LocalErrorState
              title={t('home.errorTitle')}
              description={t('home.errorDescription')}
              retryLabel={t('actions.retry')}
              onRetry={() => void handleRefresh()}
              retrying={refreshing}
              size="page"
            />
          </Box>
        </Box>
      </PageCanvas>
    );
  }

  const digestLead = inbox.items.find((item) => item.actionable);
  const protectedDigestLead = digestLead
    ? {
        ...digestLead,
        title: notificationArrivalContent(digestLead, profile, t('arrival.protectedContent')).title,
      }
    : undefined;
  const insights = (
    <NotificationHomeInsights
      apps={topApps}
      appsLoading={appSummaryQuery.isLoading}
      appsError={appSummaryQuery.isError}
      appsRefreshing={appSummaryQuery.isFetching}
      profile={profile}
      onRetryApps={() => void appSummaryQuery.refetch()}
      onOpenSettings={() => navigate(NOTIFICATION_SETTINGS_PATH)}
    />
  );
  const leadingGroups = activeKpi
    ? streamGroups
    : streamGroups.filter((group) => group.key !== 'UPDATES');
  const trailingGroups = activeKpi ? [] : streamGroups.filter((group) => group.key === 'UPDATES');
  const renderHomeGroups = (groups: typeof streamGroups) =>
    groups.map((group) => {
      const previewLimit = activeKpi ? HOME_INBOX_LIMIT : HOME_GROUP_PREVIEW_LIMIT[group.key];
      const visibleItems = group.items.slice(0, previewLimit);
      const hiddenCount = Math.max(0, group.items.length - visibleItems.length);
      return (
        <Box
          component="section"
          aria-labelledby={`notification-home-group-${group.key}`}
          key={group.key}
          sx={{ '& + &': { mt: 1.2 } }}
        >
          <NotificationStreamGroupHeading
            groupKey={group.key}
            count={group.items.length}
            headingId={`notification-home-group-${group.key}`}
            headingComponent="h3"
          />
          <Stack component="ul" spacing={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {visibleItems.map((item) => {
              const content = notificationArrivalContent(
                item,
                profile,
                t('arrival.protectedContent')
              );
              const displayItem = {
                ...item,
                title: content.title,
                preview: content.preview,
              };
              const concealContext =
                item.sensitive || profile.presentation.previewMode === 'HIDDEN';
              const openDetails = () =>
                navigate(`${NOTIFICATION_CENTER_PATH}/${encodeURIComponent(item.notificationId)}`);
              if (group.key === 'UPDATES') {
                return (
                  <Box component="li" key={item.notificationId}>
                    <Box component="article">
                      <NotificationItemRow
                        item={displayItem}
                        compact
                        concealContext={concealContext}
                        now={notificationClock}
                        onSelect={openDetails}
                        trailing={
                          <Box sx={{ display: 'grid', placeItems: 'center', px: 0.5 }}>
                            <ActionIconButton
                              label={t('actions.detail')}
                              size="small"
                              onClick={openDetails}
                            >
                              <ArrowRight size={16} />
                            </ActionIconButton>
                          </Box>
                        }
                      />
                    </Box>
                  </Box>
                );
              }
              return (
                <Box component="li" key={item.notificationId}>
                  <NotificationActionCard
                    item={displayItem}
                    now={notificationClock}
                    active={item.notificationId === activeId}
                    checked={false}
                    busy={
                      !online ||
                      (triageMutation.isPending &&
                        triageMutation.variables?.item.notificationId === item.notificationId)
                    }
                    concealContext={concealContext}
                    tabIndex={0}
                    rowRef={() => undefined}
                    onFocus={() => setActiveId(item.notificationId)}
                    onToggleChecked={() => undefined}
                    onOpenDetails={openDetails}
                    onTriage={(action) => triageItem(item, action)}
                    onOpenTarget={(href) => navigate(href)}
                    onQuickReply={(target, body, idempotencyKey) =>
                      quickReply(item, target, body, idempotencyKey)
                    }
                    selectable={false}
                    density="compact"
                    surfaceTone={group.key === 'CONVERSATIONS' ? 'conversation' : 'default'}
                    replyInitiallyOpen={group.key === 'CONVERSATIONS'}
                    hideUnknownReason
                  />
                </Box>
              );
            })}
          </Stack>
          {hiddenCount > 0 && (
            <ActionButton
              component={Link}
              to={homeGroupCenterPath(group.key)}
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} />}
              sx={{ mt: 0.5 }}
            >
              {t('workbench.groups.more', { count: hiddenCount })}
            </ActionButton>
          )}
        </Box>
      );
    });
  return (
    <PageCanvas mode="workspace" topInset="compact">
      <Box sx={{ width: 1, maxWidth: NOTIFICATION_HOME_MAX_WIDTH, mx: 'auto' }}>
        {header}
        {(partial || connectionState === 'offline') && (
          <Box sx={{ mt: 1.5 }}>
            <NotificationConnectionNotice
              state={connectionState}
              partial={partial}
              unavailableSources={unavailableSources}
            />
          </Box>
        )}

        <NotificationKpiFilterBar
          summary={summary}
          view={activeKpi ? selectionScope.view : 'ALL'}
          readState={activeKpi ? selectionScope.readState : 'ALL'}
          onSelect={selectKpi}
        />
        <NotificationDigestBanner
          summary={summary}
          lead={protectedDigestLead}
          onReview={() => setActiveKpi('ACTIONABLE')}
        />

        <Box
          sx={{
            mt: 1.75,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1fr) minmax(300px, 360px)',
            },
            gap: { xs: 2, lg: 2.25 },
            alignItems: 'start',
          }}
        >
          <Box
            component="section"
            aria-labelledby="notification-home-priority"
            sx={{ minWidth: 0 }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Box>
                <Typography
                  id="notification-home-priority"
                  component="h2"
                  variant="subtitle1"
                  fontWeight="fontWeightBold"
                >
                  {activeKpi ? t(`workbench.kpis.${activeKpi}`) : t('home.priorityTitle')}
                </Typography>
              </Box>
              <ActionButton
                component={Link}
                to={notificationCenterPath(activeKpi ? selectionScope : { view: 'ALL' })}
                intent="quiet"
                size="small"
                endIcon={<ArrowRight size={16} />}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {t('home.openCenter')}
              </ActionButton>
            </Stack>
            <Box sx={{ mt: 1.25 }}>
              {activeKpi && selectionQuery.isLoading ? (
                <LoadingState label={t('states.loading')} variant="skeleton" skeletonRows={3} />
              ) : activeKpi && selectionQuery.isError ? (
                <LocalErrorState
                  title={t('states.loadErrorTitle')}
                  description={t('states.loadErrorDescription')}
                  retryLabel={t('actions.retry')}
                  onRetry={() => void selectionQuery.refetch()}
                />
              ) : displayedInbox?.items.length ? (
                <>
                  {renderHomeGroups(leadingGroups)}
                  {!desktopInsights && <Box sx={{ my: 2 }}>{insights}</Box>}
                  {renderHomeGroups(trailingGroups)}
                </>
              ) : (
                <>
                  <EmptyState
                    title={t('home.emptyTitle')}
                    description={t('home.emptyDescription')}
                    icon={<BellRing size={24} />}
                    size="compact"
                  />
                  {!desktopInsights && <Box sx={{ mt: 2 }}>{insights}</Box>}
                </>
              )}
            </Box>
          </Box>

          {desktopInsights && insights}
        </Box>
      </Box>
    </PageCanvas>
  );
}
