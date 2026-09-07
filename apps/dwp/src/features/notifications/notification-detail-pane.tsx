import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  Clock3,
  MailOpen,
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getNotificationDetail,
  NOTIFICATION_API_CAPABILITIES,
} from '@dwp-frontend/shared-utils/api/notification-api';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { defaultSnoozeTime } from './notification-model';
import { useNotificationTargetNavigation } from './use-notification-target-navigation';

import type {
  NotificationItem,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationDetailPane({
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
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const detailQuery = useQuery({
    queryKey: notificationQueryKeys.detail(item.notificationId),
    queryFn: ({ signal }) => getNotificationDetail(item.notificationId, signal),
    staleTime: 30_000,
    retry: 1,
  });
  const targetNavigation = useNotificationTargetNavigation(
    onOpenTarget,
    () => void detailQuery.refetch()
  );
  const detail = detailQuery.data;
  const primary = (detail?.item ?? item).actions.find((action) => action.primary);

  useEffect(() => {
    setSensitiveRevealed(false);
  }, [item.notificationId]);

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
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
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
            <Chip
              size="small"
              variant="outlined"
              label={t(`sources.${detail.item.source.appKey.toLocaleLowerCase('en-US')}`, {
                defaultValue: detail.item.source.appName,
              })}
            />
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
          {detail.item.sensitive && !sensitiveRevealed ? (
            <Box
              role="status"
              sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'info.main', bgcolor: 'action.hover' }}
            >
              <Stack gap={1.25} alignItems="flex-start">
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {t('arrival.protectedContent')}
                </Typography>
                <ActionButton
                  intent="secondary"
                  size="small"
                  onClick={() => setSensitiveRevealed(true)}
                >
                  {t('home.open')}
                </ActionButton>
              </Stack>
            </Box>
          ) : (
            <>
              <Typography component="h3" variant="h5" sx={{ mt: 2, overflowWrap: 'anywhere' }}>
                {detail.item.title}
              </Typography>
              {detail.item.preview && (
                <Typography color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                  {detail.item.preview}
                </Typography>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                {formatDate(detail.absoluteOccurredAt, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </Typography>

              {detail.targetState !== 'AVAILABLE' && (
                <Box
                  role="alert"
                  sx={{
                    mt: 2,
                    p: 1.5,
                    border: 1,
                    borderColor: 'warning.main',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="body2">
                    {detail.targetStateReason
                      ? t(`detail.targetReason.${detail.targetStateReason}`, {
                          defaultValue: t(`detail.targetState.${detail.targetState}`),
                        })
                      : t(`detail.targetState.${detail.targetState}`)}
                  </Typography>
                </Box>
              )}

              <Box
                component="section"
                sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}
              >
                <Typography component="h4" variant="subtitle2">
                  {t('detail.whyTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(`reasonExplanation.${detail.item.reason.kind}`, {
                    defaultValue: detail.reasonExplanation,
                  })}
                </Typography>
              </Box>

              {detail.timeline.length > 0 && (
                <Box
                  component="section"
                  sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}
                >
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
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {entry.title === 'Notification received'
                              ? t('detail.notificationReceived')
                              : entry.title}
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
                  loading={targetNavigation.openingId === item.notificationId}
                  onClick={() => void targetNavigation.openTarget(item.notificationId)}
                >
                  {primary.label}
                </ActionButton>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
