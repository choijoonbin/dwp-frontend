import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Settings2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyNotificationTriage,
  createNotificationIdempotencyKey,
  getNotificationInbox,
  getNotificationDeliveryProfile,
  getNotificationSummary,
  isNotificationCursorResetError,
  type NotificationItem,
  type NotificationLiveSignal,
  type NotificationView,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system/components/states/state-panels';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { notificationQueryKeys } from './integration-contract';
import { scheduleNotificationCacheInvalidation } from './notification-cache-policy';
import { reconcileGlanceItems } from './notification-model';
import { notificationArrivalContent } from '../../components/notification-arrival-policy';
import {
  NotificationConnectionNotice,
  NotificationItemRow,
  NotificationPrimaryAction,
  NotificationSyncResetNotice,
  useNotificationClock,
} from './notification-ui';
import {
  useNotificationLiveUpdates,
  useNotificationSyncResetSignal,
  useOnlineStatus,
} from './use-notification-runtime';

import type { Theme } from '@mui/material/styles';

const GLANCE_LIMIT = 6;

type GlanceState = {
  visible: NotificationItem[];
  buffered: NotificationItem[];
  bufferedCount: number;
};

const EMPTY_GLANCE: GlanceState = { visible: [], buffered: [], bufferedCount: 0 };

export type NotificationHeaderGlanceProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onDismiss: () => void;
  onTriggerUpdate: (label: string, totalUnread: number) => void;
  onOpenCenter: (notificationId?: string) => void;
  onOpenSettings: () => void;
};

export function NotificationHeaderGlance({
  open,
  anchorEl,
  onDismiss,
  onTriggerUpdate,
  onOpenCenter,
  onOpenSettings,
}: NotificationHeaderGlanceProps) {
  const { t } = useTranslation(['notifications', 'common']);
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const dialogTitleId = useId();
  const notificationClock = useNotificationClock();
  const [view, setView] = useState<Extract<NotificationView, 'PRIORITY' | 'ALL'>>('PRIORITY');
  const [glance, setGlance] = useState<GlanceState>(EMPTY_GLANCE);
  const [resynchronizing, setResynchronizing] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const bufferedArrivalIdsRef = useRef(new Set<string>());

  const summaryQuery = useQuery({
    queryKey: notificationQueryKeys.summary(),
    queryFn: ({ signal }) => getNotificationSummary(signal),
    staleTime: 15_000,
    refetchInterval: online ? 30_000 : false,
    retry: 1,
  });
  const inboxQuery = useQuery({
    queryKey: notificationQueryKeys.inbox({ surface: 'glance', view }),
    queryFn: ({ signal }) => getNotificationInbox({ view, limit: GLANCE_LIMIT }, signal),
    enabled: open,
    staleTime: 10_000,
    refetchInterval: open && online ? 15_000 : false,
    retry: 1,
  });
  const profileQuery = useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: ({ signal }) => getNotificationDeliveryProfile(signal),
    staleTime: 30_000,
    retry: 1,
  });

  const handleLiveSignal = useCallback(
    (signal: NotificationLiveSignal) => {
      if (open && view === 'ALL') {
        for (const notificationId of signal.arrivalIds) {
          bufferedArrivalIdsRef.current.add(notificationId);
        }
      }
      void scheduleNotificationCacheInvalidation(queryClient);
    },
    [open, queryClient, view]
  );
  const connectionState = useNotificationLiveUpdates(handleLiveSignal);
  const { resetRequired, clearResetRequired } = useNotificationSyncResetSignal();

  useEffect(() => {
    if (!open) return;
    setGlance((current) => {
      const reconciled = reconcileGlanceItems(
        current.visible,
        inboxQuery.data?.items ?? [],
        true,
        GLANCE_LIMIT
      );
      return {
        ...reconciled,
        bufferedCount: Math.max(
          reconciled.bufferedCount,
          reconciled.buffered.length > 0 ? bufferedArrivalIdsRef.current.size : 0
        ),
      };
    });
  }, [inboxQuery.data?.items, open]);

  useEffect(() => {
    if (open) return;
    bufferedArrivalIdsRef.current.clear();
    setGlance({
      visible: inboxQuery.data?.items.slice(0, GLANCE_LIMIT) ?? [],
      buffered: [],
      bufferedCount: 0,
    });
  }, [inboxQuery.data?.items, open]);

  useEffect(() => {
    bufferedArrivalIdsRef.current.clear();
    setGlance(EMPTY_GLANCE);
  }, [view]);

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.inboxRoot() }),
    ]);
  }, [queryClient]);

  const triageMutation = useMutation({
    mutationFn: ({ item }: { item: NotificationItem }) =>
      applyNotificationTriage(item.notificationId, {
        action: 'READ',
        expectedVersion: item.version,
        idempotencyKey: createNotificationIdempotencyKey('glance-read'),
      }),
    onSuccess: invalidate,
  });
  const readVisibleMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        glance.visible
          .filter((item) => !item.readAt)
          .map((item) =>
            applyNotificationTriage(item.notificationId, {
              action: 'READ',
              expectedVersion: item.version,
              idempotencyKey: createNotificationIdempotencyKey('glance-read-visible'),
            })
          )
      ),
    onSuccess: invalidate,
  });

  const cursorResetRequired =
    resetRequired ||
    isNotificationCursorResetError(inboxQuery.error) ||
    isNotificationCursorResetError(summaryQuery.error);
  const resynchronize = async () => {
    setResynchronizing(true);
    try {
      setGlance(EMPTY_GLANCE);
      await queryClient.resetQueries({ queryKey: notificationQueryKeys.root });
      clearResetRequired();
    } finally {
      setResynchronizing(false);
    }
  };

  const mergeBuffered = () => {
    const list = listRef.current;
    const previousHeight = list?.scrollHeight ?? 0;
    const previousTop = list?.scrollTop ?? 0;
    const focusedId =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.notificationFocusId
        : undefined;
    bufferedArrivalIdsRef.current.clear();
    setGlance((current) => ({
      visible: current.buffered,
      buffered: [],
      bufferedCount: 0,
    }));
    requestAnimationFrame(() => {
      if (list) list.scrollTop = previousTop + Math.max(0, list.scrollHeight - previousHeight);
      if (focusedId) {
        list
          ?.querySelector<HTMLElement>(`[data-notification-focus-id="${CSS.escape(focusedId)}"]`)
          ?.focus();
      }
    });
  };

  const actionableUnread = summaryQuery.data?.actionableUnread ?? 0;
  const totalUnread = summaryQuery.data?.totalUnread ?? 0;
  const accessibleLabel = t('glance.triggerLabel', {
    actionable: actionableUnread,
    total: totalUnread,
  });
  useEffect(() => {
    onTriggerUpdate(accessibleLabel, totalUnread);
  }, [accessibleLabel, onTriggerUpdate, totalUnread]);
  const tabCounts = summaryQuery.data?.viewCounts;
  const hasUnreadVisible = glance.visible.some((item) => !item.readAt);
  const partial = summaryQuery.data?.partial || inboxQuery.data?.partial;
  const unavailableSources = useMemo(
    () => [
      ...new Set([
        ...(summaryQuery.data?.unavailableSources ?? []),
        ...(inboxQuery.data?.unavailableSources ?? []),
      ]),
    ],
    [inboxQuery.data?.unavailableSources, summaryQuery.data?.unavailableSources]
  );

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onDismiss}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': dialogTitleId,
          'aria-modal': true,
          sx: {
            width: compact ? 'calc(100vw - 24px)' : 420,
            maxWidth: 420,
            maxHeight: compact ? 'calc(100vh - 96px)' : 640,
            borderRadius: 1,
            overflow: 'hidden',
          },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ px: 1.75, py: 1.25 }}
      >
        <Box minWidth={0}>
          <Typography id={dialogTitleId} component="h2" variant="subtitle1" fontWeight={760}>
            {t('glance.dialogLabel')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('glance.summary', { actionable: actionableUnread, total: totalUnread })}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.25}>
          <ActionIconButton
            label={t('glance.markVisibleRead')}
            disabled={!hasUnreadVisible || readVisibleMutation.isPending || !online}
            loading={readVisibleMutation.isPending}
            onClick={() => readVisibleMutation.mutate()}
            size="small"
          >
            <CheckCheck size={18} />
          </ActionIconButton>
          <ActionIconButton
            label={t('glance.openSettings')}
            onClick={() => {
              onOpenSettings();
            }}
            size="small"
          >
            <Settings2 size={18} />
          </ActionIconButton>
          <ActionIconButton label={t('common:actions.close')} onClick={onDismiss} size="small">
            <X size={18} />
          </ActionIconButton>
        </Stack>
      </Stack>
      <Tabs
        value={view}
        onChange={(_event, next: NotificationView) => setView(next as 'PRIORITY' | 'ALL')}
        variant="fullWidth"
        aria-label={t('glance.viewsLabel')}
        sx={{ minHeight: 40, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          value="PRIORITY"
          label={t('views.PRIORITY', { count: tabCounts?.PRIORITY ?? 0 })}
          sx={{ minHeight: 40 }}
        />
        <Tab
          value="ALL"
          label={t('views.ALL', { count: tabCounts?.ALL ?? 0 })}
          sx={{ minHeight: 40 }}
        />
      </Tabs>
      <NotificationConnectionNotice
        state={connectionState}
        partial={partial}
        unavailableSources={unavailableSources}
      />
      {cursorResetRequired && (
        <NotificationSyncResetNotice
          onResynchronize={() => void resynchronize()}
          busy={resynchronizing}
          compact
        />
      )}
      {glance.buffered.length > 0 && glance.bufferedCount > 0 && (
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Box
            component="span"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            sx={{
              position: 'absolute',
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {t('glance.newItems', { count: glance.bufferedCount })}
          </Box>
          <ActionButton intent="secondary" size="small" fullWidth onClick={mergeBuffered}>
            {t('glance.newItems', { count: glance.bufferedCount })}
          </ActionButton>
        </Box>
      )}
      <Box ref={listRef} sx={{ maxHeight: 440, overflowY: 'auto' }}>
        {inboxQuery.isLoading && glance.visible.length === 0 ? (
          <LoadingState
            label={t('states.loading')}
            variant="skeleton"
            skeletonRows={4}
            size="compact"
          />
        ) : inboxQuery.isError &&
          !isNotificationCursorResetError(inboxQuery.error) &&
          glance.visible.length === 0 ? (
          <ErrorState
            title={t('states.loadErrorTitle')}
            description={t('states.loadErrorDescription')}
            retryLabel={t('actions.retry')}
            onRetry={() => void inboxQuery.refetch()}
            retrying={inboxQuery.isFetching}
            size="compact"
          />
        ) : glance.visible.length === 0 ? (
          <EmptyState
            title={t(`empty.${view}.title`)}
            description={t(`empty.${view}.description`)}
            size="compact"
          />
        ) : (
          <Box component="ul" aria-label={t('glance.dialogLabel')} sx={{ p: 0, m: 0 }}>
            {glance.visible.map((item) => {
              const content = notificationArrivalContent(
                item,
                profileQuery.data,
                t('arrival.protectedContent')
              );
              const concealContext =
                item.sensitive || profileQuery.data?.presentation.previewMode === 'HIDDEN';
              return (
                <Box component="li" key={item.notificationId} sx={{ listStyle: 'none' }}>
                  <NotificationItemRow
                    item={{ ...item, title: content.title, preview: content.preview }}
                    now={notificationClock}
                    compact
                    concealContext={concealContext}
                    onSelect={() => {
                      if (!item.readAt && !triageMutation.isPending) {
                        triageMutation.mutate({ item });
                      }
                      onOpenCenter(item.notificationId);
                    }}
                    trailing={
                      concealContext ? undefined : <NotificationPrimaryAction item={item} />
                    }
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      <Divider />
      <Box sx={{ p: 1 }}>
        <ActionButton
          intent="quiet"
          fullWidth
          onClick={() => {
            onOpenCenter();
          }}
        >
          {t('glance.openCenter')}
        </ActionButton>
      </Box>
    </Popover>
  );
}
