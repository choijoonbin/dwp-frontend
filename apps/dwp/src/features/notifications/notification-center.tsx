import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Filter,
  Inbox,
  MailOpen,
  RotateCcw,
  Search,
  Settings2,
} from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyNotificationTriage,
  createNotificationIdempotencyKey,
  getNotificationDetail,
  getNotificationInbox,
  getNotificationSummary,
  isNotificationCursorResetError,
  NOTIFICATION_API_CAPABILITIES,
  type NotificationDetail,
  type NotificationInboxPage,
  type NotificationItem,
  type NotificationPriority,
  type NotificationTriageAction,
  type NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { notificationQueryKeys } from './integration-contract';
import {
  defaultSnoozeTime,
  flattenNotificationPages,
  moveNotificationSelection,
  NOTIFICATION_VIEWS,
  notificationMatchesView,
  optimisticTriageItem,
} from './notification-model';
import {
  NotificationConnectionNotice,
  NotificationItemRow,
  NotificationPageHeading,
  NotificationSyncResetNotice,
} from './notification-ui';
import {
  useNotificationLiveUpdates,
  useNotificationSyncResetSignal,
  useOnlineStatus,
} from './use-notification-runtime';

import type { InfiniteData } from '@tanstack/react-query';
import type { Theme } from '@mui/material/styles';

const PAGE_SIZE = 30;

type CenterFilters = {
  query: string;
  appKey: string;
  priority: NotificationPriority | 'ALL';
  readState: 'ALL' | 'UNREAD' | 'READ';
};

const EMPTY_FILTERS: CenterFilters = {
  query: '',
  appKey: '',
  priority: 'ALL',
  readState: 'ALL',
};

export type NotificationCenterProps = {
  initialView?: NotificationView;
  initialNotificationId?: string | null;
  onOpenSettings: () => void;
  onOpenTarget?: (href: string) => void;
};

function updatePageItem(
  data: InfiniteData<NotificationInboxPage> | undefined,
  item: NotificationItem,
  view: NotificationView
): InfiniteData<NotificationInboxPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items
        .map((candidate) => (candidate.notificationId === item.notificationId ? item : candidate))
        .filter((candidate) => notificationMatchesView(candidate, view)),
    })),
  };
}

function NotificationDetailPane({
  item,
  onBack,
  onTriage,
  onOpenTarget,
  busy,
}: {
  item: NotificationItem;
  onBack?: () => void;
  onTriage: (action: NotificationTriageAction, snoozedUntil?: string) => void;
  onOpenTarget?: (href: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation('notifications');
  const [snoozeAnchor, setSnoozeAnchor] = useState<HTMLElement | null>(null);
  const detailQuery = useQuery({
    queryKey: notificationQueryKeys.detail(item.notificationId),
    queryFn: ({ signal }) => getNotificationDetail(item.notificationId, signal),
    staleTime: 30_000,
    retry: 1,
  });
  const detail = detailQuery.data;
  const primary = (detail?.item ?? item).actions.find((action) => action.primary);

  return (
    <Box component="aside" aria-label={t('detail.regionLabel')} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ minHeight: 52, px: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" gap={0.5}>
          {onBack && (
            <ActionIconButton label={t('actions.back')} onClick={onBack} size="small">
              <ArrowLeft size={18} />
            </ActionIconButton>
          )}
          <Typography component="h2" variant="subtitle1" fontWeight={760}>
            {t('detail.title')}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.25}>
          <ActionIconButton
            label={item.readAt ? t('actions.markUnread') : t('actions.markRead')}
            onClick={() => onTriage(item.readAt ? 'UNREAD' : 'READ')}
            disabled={busy}
            size="small"
          >
            {item.readAt ? <MailOpen size={18} /> : <CheckCheck size={18} />}
          </ActionIconButton>
          {(!item.savedAt || NOTIFICATION_API_CAPABILITIES.unsave) && (
            <ActionIconButton
              label={item.savedAt ? t('actions.unsave') : t('actions.save')}
              onClick={() => onTriage(item.savedAt ? 'UNSAVE' : 'SAVE')}
              disabled={busy}
              size="small"
            >
              {item.savedAt ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </ActionIconButton>
          )}
          <ActionIconButton
            label={t('actions.snooze')}
            onClick={(event) => setSnoozeAnchor(event.currentTarget)}
            disabled={busy}
            size="small"
          >
            <Clock3 size={18} />
          </ActionIconButton>
          {(!item.completedAt || NOTIFICATION_API_CAPABILITIES.restore) && (
            <ActionIconButton
              label={item.completedAt ? t('actions.restore') : t('actions.complete')}
              onClick={() => onTriage(item.completedAt ? 'RESTORE' : 'COMPLETE')}
              disabled={busy}
              size="small"
            >
              {item.completedAt ? <RotateCcw size={18} /> : <Check size={18} />}
            </ActionIconButton>
          )}
        </Stack>
      </Stack>
      <Menu
        anchorEl={snoozeAnchor}
        open={Boolean(snoozeAnchor)}
        onClose={() => setSnoozeAnchor(null)}
      >
        {[4, 24, 72].map((hours) => (
          <MenuItem
            key={hours}
            onClick={() => {
              setSnoozeAnchor(null);
              onTriage('SNOOZE', defaultSnoozeTime(hours));
            }}
          >
            {t('actions.snoozeHours', { count: hours })}
          </MenuItem>
        ))}
      </Menu>

      {detailQuery.isLoading ? (
        <LoadingState label={t('states.loadingDetail')} variant="skeleton" skeletonRows={5} />
      ) : detailQuery.isError || !detail ? (
        <ErrorState
          title={t('states.detailErrorTitle')}
          description={t('states.detailErrorDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => void detailQuery.refetch()}
          retrying={detailQuery.isFetching}
        />
      ) : (
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Chip size="small" variant="outlined" label={detail.item.source.appName} />
            <Chip
              size="small"
              variant="outlined"
              color={
                detail.item.priority === 'URGENT'
                  ? 'error'
                  : detail.item.priority === 'HIGH'
                    ? 'warning'
                    : 'default'
              }
              label={t(`priority.${detail.item.priority}`)}
            />
            {detail.item.sensitive && (
              <Chip size="small" variant="outlined" label={t('detail.protected')} />
            )}
          </Stack>
          <Typography component="h3" variant="h5" sx={{ mt: 2, overflowWrap: 'anywhere' }}>
            {detail.item.title}
          </Typography>
          {detail.item.preview && (
            <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
              {detail.item.preview}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {formatDate(detail.absoluteOccurredAt, { dateStyle: 'long', timeStyle: 'short' })}
          </Typography>

          {detail.targetState !== 'AVAILABLE' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {detail.targetStateReason ?? t(`detail.targetState.${detail.targetState}`)}
            </Alert>
          )}

          <Box component="section" sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography component="h4" variant="subtitle2">
              {t('detail.whyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {detail.reasonExplanation}
            </Typography>
          </Box>

          {detail.timeline.length > 0 && (
            <Box component="section" sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
              <Typography component="h4" variant="subtitle2">
                {t('detail.timelineTitle')}
              </Typography>
              <Stack component="ol" gap={0} sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }}>
                {detail.timeline.map((entry) => (
                  <Box
                    component="li"
                    key={entry.entryId}
                    sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Stack direction="row" justifyContent="space-between" gap={1}>
                      <Typography variant="body2" fontWeight={700}>
                        {entry.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                        {formatDate(entry.occurredAt, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Stack>
                    {entry.detail && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                        {entry.detail}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {primary?.href && detail.targetState === 'AVAILABLE' && (
            <ActionButton
              intent="primary"
              sx={{ mt: 3 }}
              onClick={() =>
                onOpenTarget
                  ? onOpenTarget(primary.href as string)
                  : window.location.assign(primary.href as string)
              }
            >
              {primary.label}
            </ActionButton>
          )}
        </Box>
      )}
    </Box>
  );
}

export function NotificationCenter({
  initialView = 'PRIORITY',
  initialNotificationId = null,
  onOpenSettings,
  onOpenTarget,
}: NotificationCenterProps) {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const mobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const [view, setView] = useState<NotificationView>(initialView);
  const [filters, setFilters] = useState<CenterFilters>(EMPTY_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialNotificationId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resynchronizing, setResynchronizing] = useState(false);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scopeInitializedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(filters.query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filters.query]);

  const queryScope = useMemo(() => ({ view }), [view]);
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

  const loadedItems = useMemo(
    () => flattenNotificationPages(inboxQuery.data?.pages),
    [inboxQuery.data?.pages]
  );
  const items = useMemo(() => {
    const normalizedQuery = debouncedQuery.toLocaleLowerCase();
    return loadedItems.filter((item) => {
      if (filters.appKey && item.source.appKey !== filters.appKey) return false;
      if (filters.priority !== 'ALL' && item.priority !== filters.priority) return false;
      if (filters.readState === 'READ' && !item.readAt) return false;
      if (filters.readState === 'UNREAD' && item.readAt) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.preview, item.source.appName, item.actorLabel]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [debouncedQuery, filters.appKey, filters.priority, filters.readState, loadedItems]);
  const selectedItem = items.find((item) => item.notificationId === selectedId) ?? null;
  const appOptions = useMemo(
    () =>
      [
        ...new Map(loadedItems.map((item) => [item.source.appKey, item.source.appName])).entries(),
      ].sort((left, right) => left[1].localeCompare(right[1])),
    [loadedItems]
  );

  useEffect(() => {
    if (mobile || selectedId || items.length === 0) return;
    setSelectedId(items[0].notificationId);
  }, [items, mobile, selectedId]);

  useEffect(() => {
    if (!scopeInitializedRef.current) {
      scopeInitializedRef.current = true;
      return;
    }
    setSelectedIds(new Set());
    setSelectedId(null);
  }, [view, debouncedQuery, filters.appKey, filters.priority, filters.readState]);

  const refreshNotificationData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.inboxRoot() }),
    ]);
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
    }) =>
      applyNotificationTriage(item.notificationId, {
        action,
        expectedVersion: item.version,
        snoozedUntil,
        idempotencyKey: createNotificationIdempotencyKey(`center-${action.toLowerCase()}`),
      }),
    onMutate: async ({ item, action, snoozedUntil }) => {
      await queryClient.cancelQueries({ queryKey: inboxKey });
      const previous = queryClient.getQueryData<InfiniteData<NotificationInboxPage>>(inboxKey);
      const optimistic = optimisticTriageItem(item, action, undefined, snoozedUntil);
      queryClient.setQueryData(inboxKey, updatePageItem(previous, optimistic, view));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(inboxKey, context.previous);
      toast.error(t('feedback.triageError'));
    },
    onSuccess: (result, variables) => {
      const current = queryClient.getQueryData<InfiniteData<NotificationInboxPage>>(inboxKey);
      queryClient.setQueryData(inboxKey, updatePageItem(current, result.item, view));
      queryClient.setQueryData<NotificationDetail>(
        notificationQueryKeys.detail(result.item.notificationId),
        (currentDetail) => (currentDetail ? { ...currentDetail, item: result.item } : currentDetail)
      );
      if (!notificationMatchesView(result.item, view)) setSelectedId(null);
      toast.success(t(`feedback.${variables.action}`));
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.detail(selectedId) }),
      ]);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (
      action: Extract<NotificationTriageAction, 'READ' | 'SAVE' | 'SNOOZE' | 'COMPLETE'>
    ) => {
      const selectedItems = loadedItems.filter((item) => selectedIds.has(item.notificationId));
      const settled = await Promise.allSettled(
        selectedItems.map((item) =>
          applyNotificationTriage(item.notificationId, {
            action,
            expectedVersion: item.version,
            snoozedUntil: action === 'SNOOZE' ? defaultSnoozeTime(4) : undefined,
            idempotencyKey: createNotificationIdempotencyKey(
              `center-selection-${action.toLowerCase()}`
            ),
          })
        )
      );
      return {
        total: settled.length,
        failed: settled.filter((result) => result.status === 'rejected').length,
      };
    },
    onSuccess: async (result) => {
      setSelectedIds(new Set());
      await refreshNotificationData();
      toast.success(
        result.failed > 0
          ? t('feedback.bulkPartial', { count: result.failed })
          : t('feedback.bulkSuccess', { count: result.total })
      );
    },
    onError: () => toast.error(t('feedback.bulkError')),
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

  const selectItem = (item: NotificationItem) => {
    setSelectedId(item.notificationId);
    if (!item.readAt && !triageMutation.isPending) {
      triageMutation.mutate({ item, action: 'READ' });
    }
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = items.findIndex((item) => item.notificationId === selectedId);
    const next = moveNotificationSelection(
      currentIndex,
      event.key as 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
      items.length
    );
    if (next < 0) return;
    const item = items[next];
    if (!item) return;
    selectItem(item);
    rowRefs.current[next]?.focus();
  };

  const partial = inboxQuery.data?.pages.some((page) => page.partial) || summaryQuery.data?.partial;
  const unavailableSources = [
    ...(summaryQuery.data?.unavailableSources ?? []),
    ...(inboxQuery.data?.pages.flatMap((page) => page.unavailableSources) ?? []),
  ];
  const showDetailOnly = mobile && selectedItem;

  return (
    <PageCanvas mode="workspace">
      <NotificationPageHeading
        title={t('center.title')}
        description={t('center.description')}
        actions={
          <ActionButton
            intent="secondary"
            startIcon={<Settings2 size={17} />}
            onClick={onOpenSettings}
          >
            {t('actions.settings')}
          </ActionButton>
        }
      />

      <NotificationConnectionNotice
        state={connectionState}
        partial={partial}
        unavailableSources={unavailableSources}
      />
      {cursorResetRequired && items.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <NotificationSyncResetNotice
            onResynchronize={() => void resynchronize()}
            busy={resynchronizing}
          />
        </Box>
      )}

      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '156px minmax(320px, 0.9fr) minmax(360px, 1.1fr)',
          },
          minHeight: { md: 620 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        {!showDetailOnly && (
          <Box
            component="nav"
            aria-label={t('center.viewsLabel')}
            sx={{
              display: { xs: 'none', md: 'block' },
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.default',
              py: 1,
            }}
          >
            {NOTIFICATION_VIEWS.map((candidate) => (
              <ActionButton
                key={candidate}
                intent="quiet"
                fullWidth
                aria-current={candidate === view ? 'page' : undefined}
                onClick={() => setView(candidate)}
                sx={{
                  minHeight: 42,
                  justifyContent: 'space-between',
                  borderRadius: 0,
                  px: 1.5,
                  bgcolor: candidate === view ? 'action.selected' : undefined,
                  color: candidate === view ? 'primary.main' : 'text.primary',
                }}
              >
                <span>
                  {t(`views.${candidate}`, {
                    count: summaryQuery.data?.viewCounts[candidate] ?? 0,
                  })}
                </span>
                <Typography component="span" variant="caption" color="text.secondary">
                  {summaryQuery.data?.viewCounts[candidate] ?? 0}
                </Typography>
              </ActionButton>
            ))}
          </Box>
        )}

        {!showDetailOnly && (
          <Box sx={{ minWidth: 0, borderRight: { md: 1 }, borderColor: 'divider' }}>
            <Box sx={{ p: 1.25, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <Select
                  value={view}
                  onChange={(event) => setView(event.target.value as NotificationView)}
                  size="small"
                  aria-label={t('center.viewsLabel')}
                  sx={{ display: { md: 'none' }, minWidth: 160 }}
                >
                  {NOTIFICATION_VIEWS.map((candidate) => (
                    <MenuItem key={candidate} value={candidate}>
                      {t(`views.${candidate}`, {
                        count: summaryQuery.data?.viewCounts[candidate] ?? 0,
                      })}
                    </MenuItem>
                  ))}
                </Select>
                <FormField
                  value={filters.query}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder={t('center.searchPlaceholder')}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={17} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ flex: 1 }}
                />
                <Select
                  value={filters.priority}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      priority: event.target.value as CenterFilters['priority'],
                    }))
                  }
                  size="small"
                  aria-label={t('filters.priority')}
                  IconComponent={ChevronDown}
                  startAdornment={<Filter size={16} />}
                  sx={{ minWidth: 132 }}
                >
                  {(['ALL', 'URGENT', 'HIGH', 'NORMAL', 'LOW'] as const).map((priority) => (
                    <MenuItem key={priority} value={priority}>
                      {priority === 'ALL' ? t('filters.allPriorities') : t(`priority.${priority}`)}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
              <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                <Select
                  value={filters.appKey}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, appKey: event.target.value }))
                  }
                  size="small"
                  aria-label={t('filters.app')}
                  displayEmpty
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="">{t('filters.allApps')}</MenuItem>
                  {appOptions.map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  value={filters.readState}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      readState: event.target.value as CenterFilters['readState'],
                    }))
                  }
                  size="small"
                  aria-label={t('filters.readState')}
                  sx={{ minWidth: 120 }}
                >
                  {(['ALL', 'UNREAD', 'READ'] as const).map((state) => (
                    <MenuItem key={state} value={state}>
                      {t(`filters.read.${state}`)}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            </Box>

            {selectedIds.size > 0 && (
              <Stack
                role="toolbar"
                aria-label={t('bulk.toolbarLabel')}
                direction="row"
                alignItems="center"
                gap={0.5}
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="caption" fontWeight={700} sx={{ mr: 'auto' }}>
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

            <Box
              role="listbox"
              aria-label={t('center.listLabel')}
              onKeyDown={handleListKeyDown}
              sx={{ maxHeight: { md: 680 }, overflowY: 'auto' }}
            >
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
                  title={t(`empty.${view}.title`)}
                  description={t(`empty.${view}.description`)}
                />
              ) : (
                <>
                  {items.map((item, index) => (
                    <Box
                      key={item.notificationId}
                      sx={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)' }}
                    >
                      <Box sx={{ display: 'grid', placeItems: 'start center', pt: 1.5 }}>
                        <Checkbox
                          size="small"
                          checked={selectedIds.has(item.notificationId)}
                          onChange={(event) => {
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(item.notificationId);
                              else next.delete(item.notificationId);
                              return next;
                            });
                          }}
                          inputProps={{ 'aria-label': t('bulk.selectItem', { title: item.title }) }}
                        />
                      </Box>
                      <NotificationItemRow
                        item={item}
                        selected={item.notificationId === selectedId}
                        tabIndex={
                          item.notificationId === selectedId || (!selectedId && index === 0)
                            ? 0
                            : -1
                        }
                        rowRef={(element) => {
                          rowRefs.current[index] = element;
                        }}
                        onSelect={() => selectItem(item)}
                      />
                    </Box>
                  ))}
                  {inboxQuery.hasNextPage && (
                    <Box sx={{ p: 1.5, display: 'grid', placeItems: 'center' }}>
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
                    <Alert severity="warning" sx={{ m: 1.5 }}>
                      {t('states.loadMoreError')}
                    </Alert>
                  )}
                </>
              )}
            </Box>
          </Box>
        )}

        {selectedItem ? (
          <NotificationDetailPane
            item={selectedItem}
            onBack={mobile ? () => setSelectedId(null) : undefined}
            onTriage={(action, snoozedUntil) =>
              triageMutation.mutate({ item: selectedItem, action, snoozedUntil })
            }
            onOpenTarget={onOpenTarget}
            busy={triageMutation.isPending || !online}
          />
        ) : (
          !mobile && (
            <EmptyState
              icon={<Bell size={28} />}
              title={t('detail.emptyTitle')}
              description={t('detail.emptyDescription')}
            />
          )
        )}
      </Box>
    </PageCanvas>
  );
}
