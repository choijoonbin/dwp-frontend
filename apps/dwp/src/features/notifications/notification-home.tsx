import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  Layers3,
  Mail,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  GlyphSurface,
  LoadingState,
  LocalErrorState,
  PageCanvas,
  ProgressMeter,
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
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationArrivalContent } from '../../components/notification-arrival-policy';
import { scheduleNotificationCacheInvalidation } from './notification-cache-policy';
import { NotificationActionCard } from './notification-action-card';
import { NotificationHomeHeader } from './notification-home-header';
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
import { NotificationConnectionNotice, useNotificationClock } from './notification-ui';
import { useNotificationLiveUpdates, useOnlineStatus } from './use-notification-runtime';

import type {
  AppNotificationCounter,
  NotificationDeliveryProfile,
  NotificationInboxPage,
  NotificationItem,
  NotificationSummary,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils';
import type { NotificationKpiKey, NotificationInboxFilterScope } from './notification-inbox-model';
import type { LucideIcon } from 'lucide-react';

const HOME_ALL_SCOPE = { surface: 'home', view: 'ALL' } as const;
const HOME_PRIORITY_SCOPE = { surface: 'home', view: 'PRIORITY' } as const;
const HOME_MENTIONS_SCOPE = { surface: 'home', view: 'MENTIONS' } as const;
const HOME_INBOX_SCOPES = [HOME_ALL_SCOPE, HOME_PRIORITY_SCOPE, HOME_MENTIONS_SCOPE] as const;
const HOME_APP_SUMMARY_SCOPE = { surface: 'home' } as const;
const HOME_INBOX_LIMIT = 8;

const SOURCE_ICON: Record<string, LucideIcon> = {
  approvals: CheckCircle2,
  hcm: UsersRound,
  mail: Mail,
  messaging: MessageSquareText,
  security: ShieldCheck,
  space: Layers3,
  spaces: Layers3,
};

function deliveryProfileMetrics(profile: NotificationDeliveryProfile) {
  const channels = Object.values(profile.channels);
  return {
    enabledChannels: channels.filter(Boolean).length,
    totalChannels: channels.length,
  };
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
  const appScale = Math.max(1, ...topApps.map((app) => app.totalUnread));
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
        {header}
        <Box sx={{ mt: 2.5 }}>
          <LoadingState label={t('home.loading')} variant="skeleton" size="page" />
        </Box>
      </PageCanvas>
    );
  }
  if (coreError || !summary || !inbox || !profile) {
    return (
      <PageCanvas mode="workspace" topInset="compact">
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
      </PageCanvas>
    );
  }

  const deliveryMetrics = deliveryProfileMetrics(profile);
  const digestLead = inbox.items.find((item) => item.actionable);
  const protectedDigestLead = digestLead
    ? {
        ...digestLead,
        title: notificationArrivalContent(digestLead, profile, t('arrival.protectedContent')).title,
      }
    : undefined;
  return (
    <PageCanvas mode="workspace" topInset="compact">
      {header}
      {(partial || connectionState === 'offline') && (
        <Box sx={{ mt: 2.5 }}>
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
          mt: 2,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1fr) 300px',
          },
          gap: { xs: 2.5, lg: 2.5 },
          alignItems: 'start',
        }}
      >
        <Box component="section" aria-labelledby="notification-home-priority">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'flex-end' }}
            gap={1.25}
          >
            <Box>
              <Typography id="notification-home-priority" component="h2" variant="h6">
                {activeKpi ? t(`workbench.kpis.${activeKpi}`) : t('home.priorityTitle')}
              </Typography>
            </Box>
            <ActionButton
              component={Link}
              to={notificationCenterPath(activeKpi ? selectionScope : { view: 'ALL' })}
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={16} />}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' }, whiteSpace: 'nowrap' }}
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
              groupNotificationStream(displayedInbox.items).map((group) => (
                <Box
                  component="section"
                  aria-labelledby={`notification-home-group-${group.key}`}
                  key={group.key}
                  sx={{ '& + &': { mt: 1.4 } }}
                >
                  <NotificationStreamGroupHeading
                    groupKey={group.key}
                    count={group.items.length}
                    headingId={`notification-home-group-${group.key}`}
                    headingComponent="h3"
                  />
                  <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                    {group.items.map((item) => {
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
                                triageMutation.variables?.item.notificationId ===
                                  item.notificationId)
                            }
                            concealContext={concealContext}
                            tabIndex={0}
                            rowRef={() => undefined}
                            onFocus={() => setActiveId(item.notificationId)}
                            onToggleChecked={() => undefined}
                            onOpenDetails={() =>
                              navigate(
                                `${NOTIFICATION_CENTER_PATH}/${encodeURIComponent(item.notificationId)}`
                              )
                            }
                            onTriage={(action) => triageItem(item, action)}
                            onOpenTarget={(href) => navigate(href)}
                            onQuickReply={(target, body, idempotencyKey) =>
                              quickReply(item, target, body, idempotencyKey)
                            }
                            selectable={false}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              ))
            ) : (
              <EmptyState
                title={t('home.emptyTitle')}
                description={t('home.emptyDescription')}
                icon={<BellRing size={24} />}
                size="compact"
              />
            )}
          </Box>
        </Box>

        <Stack component="aside" spacing={3.25} aria-label={t('home.summaryLabel')}>
          <Box component="section" aria-labelledby="notification-home-apps">
            <Typography id="notification-home-apps" component="h2" variant="h6">
              {t('preferences.apps.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('home.appDistribution')}
            </Typography>
            <Box sx={{ mt: 1.75, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
              {appSummaryQuery.isLoading ? (
                <LoadingState label={t('states.loadingAppSettings')} size="compact" />
              ) : appSummaryQuery.isError ? (
                <LocalErrorState
                  title={t('states.loadErrorTitle')}
                  description={t('states.loadErrorDescription')}
                  retryLabel={t('actions.retry')}
                  onRetry={() => void appSummaryQuery.refetch()}
                  retrying={appSummaryQuery.isFetching}
                  size="compact"
                />
              ) : topApps.length ? (
                topApps.map((app, index) => {
                  const AppIcon = SOURCE_ICON[app.appKey] ?? Bell;
                  const appName = t(`sources.${app.appKey}`, { defaultValue: app.appKey });
                  return (
                    <Box key={app.appKey} sx={{ py: 1.35 }}>
                      {index > 0 && <Divider sx={{ mb: 1.35 }} />}
                      <Stack direction="row" spacing={1.1} alignItems="flex-start">
                        <GlyphSurface size={32} variant="soft">
                          <AppIcon size={16} strokeWidth={1.8} />
                        </GlyphSurface>
                        <Box minWidth={0} flex={1}>
                          <ProgressMeter
                            label={appName}
                            value={(app.totalUnread / appScale) * 100}
                            valueLabel={`${t('home.metrics.unread')} ${app.totalUnread}`}
                            size="compact"
                          />
                          <Stack direction="row" gap={1.25} sx={{ mt: 0.65 }}>
                            <Typography variant="caption" color="text.secondary">
                              {t('home.metrics.actionable')} {app.actionableUnread}
                            </Typography>
                            <Typography variant="caption" color="error.main">
                              {t('priority.URGENT')} {app.urgentUnread}
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })
              ) : (
                <EmptyState
                  title={t('preferences.apps.emptyTitle')}
                  description={t('preferences.apps.emptyDescription')}
                  icon={<Bell size={22} />}
                  size="compact"
                />
              )}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="notification-home-delivery">
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
              <Box>
                <Typography id="notification-home-delivery" component="h2" variant="h6">
                  {t('settings.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {t('settings.description')}
                </Typography>
              </Box>
              <ActionIconButton
                label={t('actions.settings')}
                size="small"
                onClick={() => navigate(NOTIFICATION_SETTINGS_PATH)}
              >
                <Settings2 size={16} />
              </ActionIconButton>
            </Stack>
            <Box sx={{ mt: 1.75, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
              {[
                {
                  icon: BellRing,
                  label: t('preferences.global.title'),
                  value: `${deliveryMetrics.enabledChannels} / ${deliveryMetrics.totalChannels}`,
                },
                {
                  icon: Clock3,
                  label: t('preferences.quiet.title'),
                  value: profile.quietHours.enabled
                    ? `${profile.quietHours.start}–${profile.quietHours.end}`
                    : t('preferences.digest.modes.OFF'),
                },
                {
                  icon: Mail,
                  label: t('preferences.digest.title'),
                  value: t(`preferences.digest.modes.${profile.digest.mode}`),
                },
              ].map((metric, index) => (
                <Box key={metric.label}>
                  {index > 0 && <Divider />}
                  <Stack direction="row" alignItems="center" gap={1.1} sx={{ py: 1.25 }}>
                    <Box aria-hidden="true" sx={{ color: 'primary.main', display: 'grid' }}>
                      <metric.icon size={17} strokeWidth={1.8} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" flex={1}>
                      {metric.label}
                    </Typography>
                    <Typography variant="body2" fontWeight="fontWeightBold" textAlign="right">
                      {metric.value}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </Box>
    </PageCanvas>
  );
}
