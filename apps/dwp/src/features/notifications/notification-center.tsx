import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Check, CheckCheck, Clock3, Inbox } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyNotificationTriage,
  createNotificationIdempotencyKey,
  getNotificationDeliveryProfile,
  getNotificationInbox,
  getNotificationSummary,
  isNotificationCursorResetError,
  type NotificationDetail,
  type NotificationInboxPage,
  type NotificationItem,
  type NotificationSummary,
  type NotificationTriageAction,
  type NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';
import {
  getNotificationSummaryByApp,
  sendMessagingMessage,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  ErrorState,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { scheduleNotificationCacheInvalidation } from './notification-cache-policy';
import { NotificationBulkUndoBanner } from './notification-bulk-undo-banner';
import { notificationArrivalContent } from '../../components/notification-arrival-policy';
import {
  defaultSnoozeTime,
  flattenNotificationPages,
  moveNotificationSelection,
  notificationMatchesView,
  optimisticTriageItem,
} from './notification-model';
import {
  groupNotificationStream,
  isNotificationShortcutTarget,
  notificationMatchesInboxScope,
  optimisticNotificationSummary,
} from './notification-inbox-model';
import { NotificationActionCard } from './notification-action-card';
import { NotificationFilterBar } from './notification-filter-bar';
import {
  EMPTY_NOTIFICATION_FILTERS,
  hasNotificationFilters,
  notificationFiltersForView,
} from './notification-filter-model';
import type { CenterFilters, NotificationCenterScope } from './notification-filter-model';
export type { CenterFilters, NotificationCenterScope } from './notification-filter-model';
import { NotificationDetailPane } from './notification-detail-pane';
import {
  NotificationStreamGroupHeading,
  NotificationWorkbenchHeader,
} from './notification-inbox-chrome';
import {
  NotificationConnectionNotice,
  NotificationSyncResetNotice,
  useNotificationClock,
} from './notification-ui';
import {
  useNotificationLiveUpdates,
  useNotificationSyncResetSignal,
  useOnlineStatus,
} from './use-notification-runtime';
import { useNotificationBulkActions } from './use-notification-bulk-actions';

import type { InfiniteData } from '@tanstack/react-query';
import type { NotificationInboxFilterScope } from './notification-inbox-model';

const PAGE_SIZE = 30;

export type NotificationCenterProps = {
  initialView?: NotificationView;
  initialNotificationId?: string | null;
  initialQuery?: string;
  initialReadState?: CenterFilters['readState'];
  initialAppKey?: string;
  initialPriority?: CenterFilters['priority'];
  initialReason?: CenterFilters['reason'];
  onOpenSettings: () => void;
  onOpenTarget?: (href: string) => void;
  onViewChange?: (view: NotificationView) => void;
  onScopeChange?: (scope: NotificationCenterScope) => void;
};

type NotificationInboxCache = InfiniteData<NotificationInboxPage> | NotificationInboxPage;

function updatePageItems(
  page: NotificationInboxPage,
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): NotificationInboxPage {
  return {
    ...page,
    items: page.items
      .map((candidate) => (candidate.notificationId === item.notificationId ? item : candidate))
      .filter((candidate) => notificationMatchesInboxScope(candidate, scope)),
  };
}

function updateInboxCache(
  data: NotificationInboxCache | undefined,
  item: NotificationItem,
  scope: NotificationInboxFilterScope
): NotificationInboxCache | undefined {
  if (!data) return data;
  if (!('pages' in data)) return updatePageItems(data, item, scope);
  return {
    ...data,
    pages: data.pages.map((page) => updatePageItems(page, item, scope)),
  };
}

function inboxScopeFromQueryKey(queryKey: readonly unknown[]): NotificationInboxFilterScope {
  const scope = queryKey[2];
  if (!scope || typeof scope !== 'object') return { view: 'PRIORITY' };
  return scope as NotificationInboxFilterScope;
}

export function NotificationCenter({
  initialView = 'PRIORITY',
  initialNotificationId = null,
  initialQuery = '',
  initialReadState = 'ALL',
  initialAppKey = '',
  initialPriority = 'ALL',
  initialReason = 'ALL',
  onOpenSettings,
  onOpenTarget,
  onViewChange,
  onScopeChange,
}: NotificationCenterProps) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const notificationClock = useNotificationClock();
  const [localView, setView] = useState<NotificationView>(initialView);
  const [localFilters, setFilters] = useState<CenterFilters>(() => ({
    ...EMPTY_NOTIFICATION_FILTERS,
    query: initialQuery,
    readState: initialReadState,
    appKey: initialAppKey,
    priority: initialPriority,
    reason: initialReason,
  }));
  const view = onScopeChange ? initialView : localView;
  // Route-controlled facets cannot lag browser history. Keep only the search draft local.
  const filters = onScopeChange
    ? {
        ...localFilters,
        appKey: initialAppKey,
        priority: initialPriority,
        readState: initialReadState,
        reason: initialReason,
      }
    : localFilters;
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery.trim());
  const [selectedId, setSelectedId] = useState<string | null>(initialNotificationId);
  const [detailOpen, setDetailOpen] = useState(Boolean(initialNotificationId));
  const [retainedDetailItem, setRetainedDetailItem] = useState<NotificationItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [knownApps, setKnownApps] = useState<Map<string, string>>(new Map());
  const [resynchronizing, setResynchronizing] = useState(false);
  const [triageAnnouncement, setTriageAnnouncement] = useState('');
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scopeInitializedRef = useRef(false);
  const lastSummaryChangeVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      query: initialQuery,
      readState: initialReadState,
      appKey: initialAppKey,
      priority: initialPriority,
      reason: initialReason,
    }));
  }, [initialAppKey, initialPriority, initialQuery, initialReadState, initialReason]);

  useEffect(() => {
    if (!initialNotificationId) return;
    setSelectedId(initialNotificationId);
    setDetailOpen(true);
  }, [initialNotificationId]);

  const queryScope = useMemo(
    () => ({
      view,
      query: debouncedQuery || undefined,
      appKey: filters.appKey || undefined,
      priority: filters.priority,
      readState: filters.readState,
      reason: view === 'MENTIONS' ? ('ALL' as const) : filters.reason,
    }),
    [debouncedQuery, filters.appKey, filters.priority, filters.readState, filters.reason, view]
  );

  const inboxKey = notificationQueryKeys.inbox(queryScope);
  const inboxQuery = useInfiniteQuery({
    queryKey: inboxKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      getNotificationInbox(
        {
          ...queryScope,
          cursor: pageParam,
          limit: PAGE_SIZE,
        },
        signal
      ),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 15_000,
    retry: 1,
  });
  const summaryQuery = useQuery({
    queryKey: notificationQueryKeys.summary(),
    queryFn: ({ signal }) => getNotificationSummary(signal),
    staleTime: 15_000,
    refetchInterval: online ? 30_000 : false,
    retry: 1,
  });
  const appSummaryQuery = useQuery({
    queryKey: notificationQueryKeys.appSummary({ surface: 'center' }),
    queryFn: ({ signal }) => getNotificationSummaryByApp(signal),
    staleTime: 15_000,
    refetchInterval: online ? 30_000 : false,
    retry: 1,
  });
  const profileQuery = useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: ({ signal }) => getNotificationDeliveryProfile(signal),
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    const currentVersion = summaryQuery.data?.changeVersion;
    if (!currentVersion) return;
    const previousVersion = lastSummaryChangeVersionRef.current;
    lastSummaryChangeVersionRef.current = currentVersion;
    if (previousVersion && previousVersion !== currentVersion) {
      void queryClient.invalidateQueries({ queryKey: notificationQueryKeys.inboxRoot() });
    }
  }, [queryClient, summaryQuery.data?.changeVersion]);

  const loadedItems = useMemo(
    () => flattenNotificationPages(inboxQuery.data?.pages),
    [inboxQuery.data?.pages]
  );
  const items = loadedItems;
  const selectedItem = items.find((item) => item.notificationId === selectedId) ?? null;
  const detailItem =
    selectedItem ?? (retainedDetailItem?.notificationId === selectedId ? retainedDetailItem : null);
  const appOptions = useMemo(() => {
    const options = new Map(knownApps);
    for (const app of appSummaryQuery.data?.apps ?? []) {
      if (!options.has(app.appKey)) {
        options.set(
          app.appKey,
          t(`sources.${app.appKey.toLocaleLowerCase('en-US')}`, { defaultValue: app.appKey })
        );
      }
    }
    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [appSummaryQuery.data?.apps, knownApps, t]);

  useEffect(() => {
    if (loadedItems.length === 0) return;
    setKnownApps((current) => {
      const next = new Map(current);
      let changed = false;
      for (const item of loadedItems) {
        if (next.get(item.source.appKey) === item.source.appName) continue;
        next.set(item.source.appKey, item.source.appName);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [loadedItems]);

  useEffect(() => {
    if (selectedId || items.length === 0) return;
    setSelectedId(items[0].notificationId);
  }, [items, selectedId]);

  useEffect(() => {
    if (!scopeInitializedRef.current) {
      scopeInitializedRef.current = true;
      return;
    }
    setSelectedIds(new Set());
    setSelectedId(null);
    setDetailOpen(false);
    setRetainedDetailItem(null);
  }, [view, debouncedQuery, filters.appKey, filters.priority, filters.readState, filters.reason]);

  const refreshNotificationData = useCallback(async () => {
    await scheduleNotificationCacheInvalidation(queryClient);
  }, [queryClient]);
  const connectionState = useNotificationLiveUpdates(refreshNotificationData);
  const { resetRequired, clearResetRequired } = useNotificationSyncResetSignal();

  const triageMutation = useMutation({
    mutationFn: ({
      item,
      action,
      snoozedUntil,
    }: {
      item: NotificationItem;
      action: NotificationTriageAction;
      snoozedUntil?: string;
      announce?: boolean;
    }) =>
      applyNotificationTriage(item.notificationId, {
        action,
        expectedVersion: item.version,
        snoozedUntil,
        idempotencyKey: createNotificationIdempotencyKey(`center-${action.toLowerCase()}`),
      }),
    onMutate: async ({ item, action, snoozedUntil, announce }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationQueryKeys.inboxRoot() }),
        queryClient.cancelQueries({ queryKey: notificationQueryKeys.summary() }),
      ]);
      const previousInboxes = queryClient.getQueriesData<NotificationInboxCache>({
        queryKey: notificationQueryKeys.inboxRoot(),
      });
      const previousSummary = queryClient.getQueryData<NotificationSummary>(
        notificationQueryKeys.summary()
      );
      const optimistic = optimisticTriageItem(item, action, undefined, snoozedUntil);
      for (const [queryKey, pageData] of previousInboxes) {
        queryClient.setQueryData(
          queryKey,
          updateInboxCache(pageData, optimistic, inboxScopeFromQueryKey(queryKey))
        );
      }
      if (previousSummary) {
        queryClient.setQueryData(
          notificationQueryKeys.summary(),
          optimisticNotificationSummary(previousSummary, item, optimistic)
        );
      }
      if (detailOpen && selectedId === item.notificationId) setRetainedDetailItem(optimistic);
      if (announce !== false) {
        setTriageAnnouncement(t('workbench.announcements.pending', { title: item.title }));
      }
      return { previousInboxes, previousSummary, previousDetailItem: retainedDetailItem };
    },
    onError: (_error, variables, context) => {
      for (const [queryKey, pageData] of context?.previousInboxes ?? []) {
        queryClient.setQueryData(queryKey, pageData);
      }
      if (context?.previousSummary) {
        queryClient.setQueryData(notificationQueryKeys.summary(), context.previousSummary);
      }
      if (context?.previousDetailItem) setRetainedDetailItem(context.previousDetailItem);
      if (variables.announce !== false) {
        setTriageAnnouncement(t('workbench.announcements.failed', { title: variables.item.title }));
        toast.error(t('feedback.triageError'));
      }
    },
    onSuccess: (result, variables) => {
      const currentInboxes = queryClient.getQueriesData<NotificationInboxCache>({
        queryKey: notificationQueryKeys.inboxRoot(),
      });
      for (const [queryKey, pageData] of currentInboxes) {
        queryClient.setQueryData(
          queryKey,
          updateInboxCache(pageData, result.item, inboxScopeFromQueryKey(queryKey))
        );
      }
      queryClient.setQueryData(notificationQueryKeys.summary(), result.summary);
      queryClient.setQueryData<NotificationDetail>(
        notificationQueryKeys.detail(result.item.notificationId),
        (currentDetail) => (currentDetail ? { ...currentDetail, item: result.item } : currentDetail)
      );
      setRetainedDetailItem((current) =>
        current?.notificationId === result.item.notificationId ? result.item : current
      );
      if (!notificationMatchesView(result.item, view)) {
        setDetailOpen(false);
        setRetainedDetailItem(null);
      }
      if (variables.announce !== false) {
        setTriageAnnouncement(
          t('workbench.announcements.completed', { title: variables.item.title })
        );
        toast.success(t(`feedback.${variables.action}`));
      }
    },
    onSettled: async () => {
      await Promise.all([
        scheduleNotificationCacheInvalidation(queryClient),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.detail(selectedId) }),
      ]);
    },
  });

  const { bulkMutation, undoMutation, undoReceipt, dismissUndo } = useNotificationBulkActions({
    selectedIds,
    setSelectedIds,
    refresh: refreshNotificationData,
  });

  const cursorResetRequired =
    resetRequired ||
    isNotificationCursorResetError(inboxQuery.error) ||
    isNotificationCursorResetError(summaryQuery.error);
  const resynchronize = async () => {
    setResynchronizing(true);
    try {
      setSelectedIds(new Set());
      setSelectedId(null);
      await queryClient.resetQueries({ queryKey: notificationQueryKeys.root });
      clearResetRequired();
    } finally {
      setResynchronizing(false);
    }
  };

  const openItemDetails = (item: NotificationItem) => {
    setSelectedId(item.notificationId);
    setRetainedDetailItem(item);
    setDetailOpen(true);
    if (!item.readAt && !triageMutation.isPending) {
      triageMutation.mutate({ item, action: 'READ' });
    }
  };

  const previewItem = (item: NotificationItem) => {
    setSelectedId(item.notificationId);
  };

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

  const quickReply = async (
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
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const target = event.target instanceof Element ? event.target : null;
    const focusedId = target
      ?.closest('[data-notification-focus-id]')
      ?.getAttribute('data-notification-focus-id');
    if (!focusedId) return;
    event.preventDefault();
    const currentIndex = items.findIndex((item) => item.notificationId === focusedId);
    const next = moveNotificationSelection(
      currentIndex,
      event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
      items.length
    );
    if (next < 0) return;
    const item = items[next];
    if (!item) return;
    previewItem(item);
    rowRefs.current[next]?.focus();
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        isNotificationShortcutTarget(event.target)
      ) {
        return;
      }
      const key = event.key.toLocaleLowerCase('en-US');
      const focusedId =
        event.target instanceof Element
          ? event.target
              .closest('[data-notification-focus-id]')
              ?.getAttribute('data-notification-focus-id')
          : null;
      const currentIndex = Math.max(
        0,
        items.findIndex((item) => item.notificationId === (focusedId ?? selectedId))
      );
      if (key === 'j' || key === 'k') {
        event.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(items.length - 1, currentIndex + (key === 'j' ? 1 : -1))
        );
        const nextItem = items[nextIndex];
        if (!nextItem) return;
        setSelectedId(nextItem.notificationId);
        rowRefs.current[nextIndex]?.focus();
        return;
      }
      if ((key !== 'e' && key !== 's') || triageMutation.isPending || !online) return;
      const currentItem = items[currentIndex];
      if (!currentItem) return;
      event.preventDefault();
      const nextItem = items[currentIndex + 1] ?? items[currentIndex - 1] ?? null;
      setSelectedId(nextItem?.notificationId ?? null);
      triageItem(currentItem, key === 'e' ? 'COMPLETE' : 'SNOOZE');
      window.setTimeout(() => {
        const nextIndex = nextItem
          ? Math.max(
              0,
              items.findIndex((item) => item.notificationId === nextItem.notificationId) -
                (currentIndex < items.length - 1 ? 1 : 0)
            )
          : -1;
        if (nextIndex >= 0) rowRefs.current[nextIndex]?.focus();
      }, 0);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [items, online, selectedId, triageItem, triageMutation.isPending]);

  const partial = inboxQuery.data?.pages.some((page) => page.partial) || summaryQuery.data?.partial;
  const unavailableSources = [
    ...new Set([
      ...(summaryQuery.data?.unavailableSources ?? []),
      ...(inboxQuery.data?.pages.flatMap((page) => page.unavailableSources) ?? []),
    ]),
  ];
  const streamGroups = groupNotificationStream(items);
  const itemIndexById = new Map(items.map((item, index) => [item.notificationId, index]));

  const selectView = (nextView: NotificationView) => {
    const nextFilters = notificationFiltersForView(filters, nextView);
    setView(nextView);
    setFilters(nextFilters);
    onScopeChange?.({ ...nextFilters, view: nextView });
    onViewChange?.(nextView);
  };

  const changeFilters = (nextFilters: CenterFilters) => {
    setFilters(nextFilters);
    onScopeChange?.({ ...nextFilters, view });
  };

  return (
    <PageCanvas mode="workspace">
      <Box sx={{ width: 1, pb: 8 }}>
        <NotificationWorkbenchHeader
          state={connectionState}
          generatedAt={summaryQuery.data?.generatedAt}
          onOpenSettings={onOpenSettings}
        />

        {(connectionState === 'offline' || partial) && (
          <NotificationConnectionNotice
            state={connectionState}
            partial={partial}
            unavailableSources={unavailableSources}
          />
        )}
        {cursorResetRequired && items.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <NotificationSyncResetNotice
              onResynchronize={() => void resynchronize()}
              busy={resynchronizing}
            />
          </Box>
        )}

        <NotificationFilterBar
          view={view}
          filters={filters}
          summary={summaryQuery.data}
          appOptions={appOptions}
          onViewChange={selectView}
          onChange={changeFilters}
        />

        {selectedIds.size > 0 && (
          <Stack
            role="toolbar"
            aria-label={t('bulk.toolbarLabel')}
            direction="row"
            alignItems="center"
            gap={0.5}
            sx={{
              mt: 1,
              px: 1.25,
              py: 0.75,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" fontWeight={750} sx={{ mr: 'auto' }}>
              {t('bulk.selected', { count: selectedIds.size })}
            </Typography>
            <ActionIconButton
              label={t('actions.markRead')}
              onClick={() => bulkMutation.mutate('READ')}
              disabled={bulkMutation.isPending || !online}
              size="small"
            >
              <CheckCheck size={17} />
            </ActionIconButton>
            <ActionIconButton
              label={t('actions.save')}
              onClick={() => bulkMutation.mutate('SAVE')}
              disabled={bulkMutation.isPending || !online}
              size="small"
            >
              <Bookmark size={17} />
            </ActionIconButton>
            <ActionIconButton
              label={t('actions.snooze')}
              onClick={() => bulkMutation.mutate('SNOOZE')}
              disabled={bulkMutation.isPending || !online}
              size="small"
            >
              <Clock3 size={17} />
            </ActionIconButton>
            <ActionIconButton
              label={t('actions.complete')}
              onClick={() => bulkMutation.mutate('COMPLETE')}
              disabled={bulkMutation.isPending || !online}
              size="small"
            >
              <Check size={17} />
            </ActionIconButton>
          </Stack>
        )}
        {undoReceipt && (
          <NotificationBulkUndoBanner
            expiresAt={undoReceipt.expiresAt}
            busy={undoMutation.isPending}
            onUndo={() => undoMutation.mutate(undoReceipt.token)}
            onDismiss={dismissUndo}
          />
        )}

        <Box sx={{ mt: 1.5 }}>
          {inboxQuery.isLoading ? (
            <LoadingState label={t('states.loading')} variant="skeleton" skeletonRows={7} />
          ) : inboxQuery.isError && !isNotificationCursorResetError(inboxQuery.error) ? (
            <ErrorState
              title={t('states.loadErrorTitle')}
              description={t('states.loadErrorDescription')}
              retryLabel={t('actions.retry')}
              onRetry={() => void inboxQuery.refetch()}
              retrying={inboxQuery.isFetching}
            />
          ) : cursorResetRequired && items.length === 0 ? (
            <NotificationSyncResetNotice
              onResynchronize={() => void resynchronize()}
              busy={resynchronizing}
              compact
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Inbox size={28} />}
              title={t(
                hasNotificationFilters(filters) ? 'filters.emptyTitle' : `empty.${view}.title`
              )}
              description={t(
                hasNotificationFilters(filters)
                  ? 'filters.emptyDescription'
                  : `empty.${view}.description`
              )}
            />
          ) : (
            <Box
              component="ul"
              aria-label={t('center.listLabel')}
              onKeyDown={handleListKeyDown}
              sx={{ p: 0, m: 0, listStyle: 'none' }}
            >
              {streamGroups.map((group) => (
                <Box component="li" key={group.key} sx={{ listStyle: 'none' }}>
                  <NotificationStreamGroupHeading groupKey={group.key} count={group.items.length} />
                  <Stack component="ul" gap={0.85} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                    {group.items.map((item) => {
                      const index = itemIndexById.get(item.notificationId) ?? 0;
                      const content = notificationArrivalContent(
                        item,
                        profileQuery.data,
                        t('arrival.protectedContent')
                      );
                      const displayItem = {
                        ...item,
                        title: content.title,
                        preview: content.preview,
                      };
                      const concealContext =
                        item.sensitive || profileQuery.data?.presentation.previewMode === 'HIDDEN';
                      return (
                        <Box component="li" key={item.notificationId}>
                          <NotificationActionCard
                            item={displayItem}
                            now={notificationClock}
                            active={item.notificationId === selectedId}
                            checked={selectedIds.has(item.notificationId)}
                            busy={triageMutation.isPending || !online}
                            concealContext={concealContext}
                            tabIndex={
                              item.notificationId === selectedId || (!selectedId && index === 0)
                                ? 0
                                : -1
                            }
                            rowRef={(element) => {
                              rowRefs.current[index] = element;
                            }}
                            onFocus={() => previewItem(item)}
                            onToggleChecked={(checked) => {
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (checked) next.add(item.notificationId);
                                else next.delete(item.notificationId);
                                return next;
                              });
                            }}
                            onOpenDetails={() => openItemDetails(item)}
                            onTriage={(action) => triageItem(item, action)}
                            onOpenTarget={onOpenTarget}
                            onQuickReply={(target, body, idempotencyKey) =>
                              quickReply(item, target, body, idempotencyKey)
                            }
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </Box>
          )}

          {inboxQuery.hasNextPage && (
            <Box sx={{ pt: 1.5, display: 'grid', placeItems: 'center' }}>
              <ActionButton
                intent="secondary"
                loading={inboxQuery.isFetchingNextPage}
                loadingLabel={t('states.loadingMore')}
                onClick={() => void inboxQuery.fetchNextPage()}
              >
                {t('actions.loadMore')}
              </ActionButton>
            </Box>
          )}
          {inboxQuery.isFetchNextPageError && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {t('states.loadMoreError')}
            </Alert>
          )}
        </Box>

        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            p: 0,
            m: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {triageAnnouncement}
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={detailOpen && Boolean(detailItem)}
        onClose={() => {
          setDetailOpen(false);
          setRetainedDetailItem(null);
        }}
        slotProps={{
          paper: {
            sx: { width: { xs: '100%', sm: 520 }, maxWidth: '100%', bgcolor: 'background.paper' },
          },
        }}
      >
        {detailItem && (
          <NotificationDetailPane
            item={detailItem}
            onBack={() => {
              setDetailOpen(false);
              setRetainedDetailItem(null);
            }}
            onTriage={(action, snoozedUntil) =>
              triageMutation.mutate({ item: detailItem, action, snoozedUntil })
            }
            onOpenTarget={onOpenTarget}
            busy={triageMutation.isPending || !online}
          />
        )}
      </Drawer>
    </PageCanvas>
  );
}
