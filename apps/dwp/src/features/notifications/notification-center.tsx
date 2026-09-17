import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, Check, CheckCheck, Clock3, Inbox } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyNotificationTriage,
  createNotificationIdempotencyKey,
  getNotificationDeliveryProfile,
  getNotificationDetail,
  getNotificationInbox,
  getNotificationSummary,
  isNotificationCursorResetError,
  type NotificationDetail,
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
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import { notificationQueryKeys } from './integration-contract';
import { scheduleNotificationCacheInvalidation } from './notification-cache-policy';
import { NotificationBulkUndoBanner } from './notification-bulk-undo-banner';
import { NotificationPageFrame } from './notification-page-frame';
import {
  defaultSnoozeTime,
  flattenNotificationPages,
  moveNotificationSelection,
  notificationMatchesView,
  optimisticTriageItem,
} from './notification-model';
import {
  isNotificationShortcutTarget,
  orderNotificationItemsForPresentation,
  optimisticNotificationSummary,
} from './notification-inbox-model';
import {
  inboxScopeFromQueryKey,
  updateInboxCache,
  type NotificationInboxCache,
} from './notification-center-cache';
import { NotificationFilterBar } from './notification-filter-bar';
import { NotificationResultCount } from './notification-result-count';
import {
  EMPTY_NOTIFICATION_FILTERS,
  hasNotificationFilters,
  notificationFiltersForView,
  notificationQueryFacets,
} from './notification-filter-model';
import type { CenterFilters } from './notification-filter-model';
export type { CenterFilters, NotificationCenterScope } from './notification-filter-model';
import { NotificationCenterDetail } from './notification-center-detail';
import { useNotificationInspectorHeight } from './use-notification-inspector-height';
import type { NotificationCenterProps } from './notification-center-contract';
import { NotificationWorkbenchHeader } from './notification-inbox-chrome';
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
import {
  DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
  NOTIFICATION_SAVED_VIEW_SURFACE,
  notificationBuiltInSavedViews,
  parseNotificationSavedViewConfiguration,
  selectedNotificationBuiltInViewId,
} from './notification-saved-view-model';
import { NotificationSavedViewControl } from './notification-saved-view-control';
import { useNotificationContextCatalog } from './use-notification-context-catalog';
import {
  NotificationCenterPresentationControls,
  NotificationCenterPresentationList,
  type NotificationCenterPresentationLabels,
  useNotificationCenterPresentationLabels,
} from './notification-center-presentation';

import type { NotificationCenterPresentation } from './notification-saved-view-model';

const PAGE_SIZE = 30;

export function NotificationCenter({
  initialView = 'PRIORITY',
  initialNotificationId = null,
  initialQuery = '',
  initialReadState = 'ALL',
  initialAppKey = '',
  initialPriority = 'ALL',
  initialReason = 'ALL',
  initialAttentionEffect = 'ALL',
  initialIncludedTypes = EMPTY_NOTIFICATION_FILTERS.includedTypes,
  initialContextFilters = EMPTY_NOTIFICATION_FILTERS.contextFilters,
  onOpenSettings,
  onOpenTarget,
  onViewChange,
  onScopeChange,
  onDetailChange,
  presentationLabels,
}: NotificationCenterProps & {
  presentationLabels?: Partial<NotificationCenterPresentationLabels>;
}) {
  const { t } = useTranslation('notifications');
  const theme = useTheme();
  const compactDetail = useMediaQuery(theme.breakpoints.down('lg'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const notificationClock = useNotificationClock();
  const localizedPresentationLabels = useNotificationCenterPresentationLabels(presentationLabels);
  const [localView, setView] = useState<NotificationView>(initialView);
  const [localFilters, setFilters] = useState<CenterFilters>(() => ({
    ...EMPTY_NOTIFICATION_FILTERS,
    query: initialQuery,
    readState: initialReadState,
    appKey: initialAppKey,
    priority: initialPriority,
    reason: initialReason,
    attentionEffect: initialAttentionEffect,
    includedTypes: [...initialIncludedTypes],
    contextFilters: [...initialContextFilters],
  }));
  const [presentation, setPresentation] = useState<NotificationCenterPresentation>(() => ({
    ...DEFAULT_NOTIFICATION_CENTER_PRESENTATION,
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
        attentionEffect: initialAttentionEffect,
        includedTypes: initialIncludedTypes,
        contextFilters: initialContextFilters,
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
  const inspector = useNotificationInspectorHeight();
  const lastSummaryChangeVersionRef = useRef<string | null>(null);
  const closeItemDetails = useCallback(() => {
    setDetailOpen(false);
    setRetainedDetailItem(null);
    onDetailChange?.(null);
  }, [onDetailChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  const queryFacets = useMemo(
    () => notificationQueryFacets(filters.includedTypes, filters.contextFilters),
    [filters.contextFilters, filters.includedTypes]
  );
  const scopeKey = JSON.stringify([
    view,
    debouncedQuery,
    filters.appKey,
    filters.priority,
    filters.readState,
    filters.reason,
    filters.attentionEffect,
    queryFacets.includedTypes,
    queryFacets.contexts,
  ]);
  const previousScopeKeyRef = useRef(scopeKey);

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
      attentionEffect: initialAttentionEffect,
      includedTypes: [...initialIncludedTypes],
      contextFilters: [...initialContextFilters],
    }));
  }, [
    initialAppKey,
    initialAttentionEffect,
    initialContextFilters,
    initialPriority,
    initialQuery,
    initialReadState,
    initialReason,
    initialIncludedTypes,
  ]);

  useEffect(() => {
    if (initialNotificationId) {
      setSelectedId(initialNotificationId);
      setDetailOpen(true);
      return;
    }
    setDetailOpen(false);
    setRetainedDetailItem(null);
  }, [initialNotificationId]);

  const queryScope = useMemo(
    () => ({
      view,
      query: debouncedQuery || undefined,
      appKey: filters.appKey || undefined,
      priority: filters.priority,
      readState: filters.readState,
      reason: view === 'MENTIONS' ? ('ALL' as const) : filters.reason,
      attentionEffect: filters.attentionEffect,
      includedTypes: view === 'MENTIONS' ? [] : queryFacets.includedTypes,
      contexts: queryFacets.contexts,
    }),
    [
      debouncedQuery,
      filters.appKey,
      filters.attentionEffect,
      filters.priority,
      filters.readState,
      filters.reason,
      queryFacets,
      view,
    ]
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
  const contextOptions = useNotificationContextCatalog(loadedItems, filters.contextFilters);
  const navigationItems = useMemo(
    () => orderNotificationItemsForPresentation(items, presentation.grouping),
    [items, presentation.grouping]
  );
  const selectedItem = items.find((item) => item.notificationId === selectedId) ?? null;
  const routedDetailQuery = useQuery({
    queryKey: notificationQueryKeys.detail(selectedId),
    queryFn: ({ signal }) => getNotificationDetail(selectedId ?? '', signal),
    enabled: Boolean(detailOpen && selectedId && !selectedItem && !retainedDetailItem),
    staleTime: 30_000,
    retry: 1,
  });
  const detailItem =
    selectedItem ??
    (retainedDetailItem?.notificationId === selectedId ? retainedDetailItem : null) ??
    routedDetailQuery.data?.item ??
    null;
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
    const firstItem = items[0];
    setSelectedId(firstItem.notificationId);
    if (!compactDetail) {
      setRetainedDetailItem(firstItem);
      setDetailOpen(true);
      onDetailChange?.(firstItem.notificationId);
    }
  }, [compactDetail, items, onDetailChange, selectedId]);

  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) return;
    previousScopeKeyRef.current = scopeKey;
    setSelectedIds(new Set());
    setSelectedId(null);
    setDetailOpen(false);
    setRetainedDetailItem(null);
  }, [scopeKey]);

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
        closeItemDetails();
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
      closeItemDetails();
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
    onDetailChange?.(item.notificationId);
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
    const currentIndex = navigationItems.findIndex((item) => item.notificationId === focusedId);
    const next = moveNotificationSelection(
      currentIndex,
      event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
      navigationItems.length
    );
    if (next < 0) return;
    const item = navigationItems[next];
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
        navigationItems.findIndex((item) => item.notificationId === (focusedId ?? selectedId))
      );
      if (key === 'j' || key === 'k') {
        event.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(navigationItems.length - 1, currentIndex + (key === 'j' ? 1 : -1))
        );
        const nextItem = navigationItems[nextIndex];
        if (!nextItem) return;
        setSelectedId(nextItem.notificationId);
        rowRefs.current[nextIndex]?.focus();
        return;
      }
      if ((key !== 'e' && key !== 's') || triageMutation.isPending || !online) return;
      const currentItem = navigationItems[currentIndex];
      if (!currentItem) return;
      event.preventDefault();
      const nextItem =
        navigationItems[currentIndex + 1] ?? navigationItems[currentIndex - 1] ?? null;
      setSelectedId(nextItem?.notificationId ?? null);
      triageItem(currentItem, key === 'e' ? 'COMPLETE' : 'SNOOZE');
      window.setTimeout(() => {
        const nextIndex = nextItem
          ? Math.max(
              0,
              navigationItems.findIndex((item) => item.notificationId === nextItem.notificationId) -
                (currentIndex < navigationItems.length - 1 ? 1 : 0)
            )
          : -1;
        if (nextIndex >= 0) rowRefs.current[nextIndex]?.focus();
      }, 0);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [navigationItems, online, selectedId, triageItem, triageMutation.isPending]);

  const partial = inboxQuery.data?.pages.some((page) => page.partial) || summaryQuery.data?.partial;
  const unavailableSources = [
    ...new Set([
      ...(summaryQuery.data?.unavailableSources ?? []),
      ...(inboxQuery.data?.pages.flatMap((page) => page.unavailableSources) ?? []),
    ]),
  ];
  const privacyReady = Boolean(profileQuery.data);

  const selectView = (nextView: NotificationView) => {
    if (detailOpen) closeItemDetails();
    const nextFilters = notificationFiltersForView(filters, nextView);
    setView(nextView);
    setFilters(nextFilters);
    onScopeChange?.({ ...nextFilters, view: nextView });
    onViewChange?.(nextView);
  };

  const changeFilters = (nextFilters: CenterFilters) => {
    if (detailOpen) closeItemDetails();
    setFilters(nextFilters);
    onScopeChange?.({ ...nextFilters, view });
  };
  const currentScope = { ...filters, view };
  const selectedBuiltInViewId = selectedNotificationBuiltInViewId(currentScope, presentation);
  const builtInSavedViews = notificationBuiltInSavedViews({
    priority: t('savedViews.builtIn.priority'),
    unread: t('savedViews.builtIn.unread'),
    mentions: t('savedViews.builtIn.mentions'),
  });

  const applySavedView = (configuration: Record<string, unknown>) => {
    const nextSavedView = parseNotificationSavedViewConfiguration(configuration);
    if (!nextSavedView) {
      toast.error(t('savedViews.invalid'));
      return;
    }
    const { scope: nextScope, presentation: nextPresentation } = nextSavedView;
    setView(nextScope.view);
    setFilters(nextScope);
    setPresentation(nextPresentation);
    onScopeChange?.(nextScope);
    onViewChange?.(nextScope.view);
  };

  return (
    <NotificationPageFrame>
      <Box sx={{ pb: 8 }}>
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
          contextOptions={contextOptions}
          savedViewControl={
            <NotificationSavedViewControl
              surfaceKey={NOTIFICATION_SAVED_VIEW_SURFACE}
              currentScope={currentScope}
              currentPresentation={presentation}
              appOptions={appOptions}
              contextOptions={contextOptions}
              builtInViews={builtInSavedViews}
              selectedBuiltInViewId={selectedBuiltInViewId}
              onApply={applySavedView}
            />
          }
          onViewChange={selectView}
          onChange={changeFilters}
        />

        <NotificationCenterPresentationControls
          presentation={presentation}
          labels={localizedPresentationLabels}
          onDensityChange={(density) => setPresentation((current) => ({ ...current, density }))}
          onGroupingChange={(grouping) => setPresentation((current) => ({ ...current, grouping }))}
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
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" fontWeight="fontWeightBold" sx={{ mr: 'auto' }}>
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

        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.27fr) minmax(360px, 1fr)',
            },
            gap: { lg: 1.5 },
            alignItems: 'start',
          }}
        >
          <Box minWidth={0}>
            <NotificationResultCount
              visible={items.length}
              total={inboxQuery.data?.pages[0]?.approximateTotal}
            />
            {inboxQuery.isLoading || profileQuery.isLoading ? (
              <LoadingState label={t('states.loading')} variant="skeleton" skeletonRows={7} />
            ) : (inboxQuery.isError && !isNotificationCursorResetError(inboxQuery.error)) ||
              profileQuery.isError ? (
              <ErrorState
                title={t('states.loadErrorTitle')}
                description={t('states.loadErrorDescription')}
                retryLabel={t('actions.retry')}
                onRetry={() => void Promise.all([inboxQuery.refetch(), profileQuery.refetch()])}
                retrying={inboxQuery.isFetching || profileQuery.isFetching}
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
              <NotificationCenterPresentationList
                items={items}
                presentation={presentation}
                labels={localizedPresentationLabels}
                listLabel={t('center.listLabel')}
                profile={profileQuery.data}
                protectedTitle={t('arrival.protectedContent')}
                now={notificationClock}
                selectedId={selectedId}
                selectedIds={selectedIds}
                detailItemId={detailItem?.notificationId ?? null}
                detailOpen={detailOpen}
                compactDetail={compactDetail}
                busy={triageMutation.isPending || !online}
                rowRefs={rowRefs}
                onKeyDown={handleListKeyDown}
                onFocusItem={previewItem}
                onToggleChecked={(item, checked) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (checked) next.add(item.notificationId);
                    else next.delete(item.notificationId);
                    return next;
                  });
                }}
                onOpenDetails={openItemDetails}
                onTriage={triageItem}
                onOpenTarget={onOpenTarget}
                onQuickReply={quickReply}
              />
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
            ref={inspector.ref}
            data-testid="notification-desktop-inspector"
            sx={{
              display: { xs: 'none', lg: 'block' },
              position: 'sticky',
              top: 'calc(var(--dwp-shell-desktop-sticky-offset, 64px) + 16px)',
              minWidth: 0,
              minHeight: 0,
              height: inspector.height ?? 'calc(100dvh - 360px)',
              scrollMarginBottom: (theme) => theme.spacing(2),
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              bgcolor: 'background.paper',
              boxShadow: 'var(--notification-panel-shadow)',
            }}
          >
            <NotificationCenterDetail
              item={detailOpen && privacyReady ? detailItem : null}
              open={detailOpen}
              mode="desktop"
              loading={routedDetailQuery.isLoading || profileQuery.isLoading}
              error={routedDetailQuery.isError || profileQuery.isError}
              fetching={routedDetailQuery.isFetching || profileQuery.isFetching}
              busy={triageMutation.isPending || !online}
              onBack={closeItemDetails}
              onRetry={() =>
                void Promise.all([routedDetailQuery.refetch(), profileQuery.refetch()])
              }
              onTriage={(action, snoozedUntil) => {
                if (detailItem) triageMutation.mutate({ item: detailItem, action, snoozedUntil });
              }}
              onOpenTarget={onOpenTarget}
              onQuickReply={(target, body, idempotencyKey) =>
                detailItem
                  ? quickReply(detailItem, target, body, idempotencyKey)
                  : Promise.reject(new Error('Notification detail is unavailable.'))
              }
            />
          </Box>
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
        open={compactDetail && detailOpen}
        onClose={closeItemDetails}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 520 },
              maxWidth: '100%',
              overflow: 'hidden',
              bgcolor: 'background.paper',
            },
          },
        }}
      >
        <NotificationCenterDetail
          item={privacyReady ? detailItem : null}
          open={detailOpen}
          mode="mobile"
          loading={routedDetailQuery.isLoading || profileQuery.isLoading}
          error={routedDetailQuery.isError || profileQuery.isError}
          fetching={routedDetailQuery.isFetching || profileQuery.isFetching}
          busy={triageMutation.isPending || !online}
          onBack={closeItemDetails}
          onRetry={() => void Promise.all([routedDetailQuery.refetch(), profileQuery.refetch()])}
          onTriage={(action, snoozedUntil) => {
            if (detailItem) triageMutation.mutate({ item: detailItem, action, snoozedUntil });
          }}
          onOpenTarget={onOpenTarget}
          onQuickReply={(target, body, idempotencyKey) =>
            detailItem
              ? quickReply(detailItem, target, body, idempotencyKey)
              : Promise.reject(new Error('Notification detail is unavailable.'))
          }
        />
      </Drawer>
    </NotificationPageFrame>
  );
}
