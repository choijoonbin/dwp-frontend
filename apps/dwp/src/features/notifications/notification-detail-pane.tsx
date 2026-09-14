import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  MailOpen,
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getNotificationDetail,
  NOTIFICATION_API_CAPABILITIES,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';
import {
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system/components/states/state-panels';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';
import { NotificationDetailReply } from './notification-detail-reply';
import {
  displayNotificationActorLabel,
  resolveMessagingReplyTarget,
} from './notification-inbox-model';
import { defaultSnoozeTime } from './notification-model';
import { useNotificationTargetNavigation } from './use-notification-target-navigation';

import type {
  NotificationItem,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationDetailPane({
  item,
  mode = 'desktop',
  onBack,
  onTriage,
  onOpenTarget,
  onQuickReply,
  busy,
}: {
  item: NotificationItem;
  mode?: 'desktop' | 'mobile';
  onBack?: () => void;
  onTriage: (action: NotificationTriageAction, snoozedUntil?: string) => void;
  onOpenTarget?: (href: string) => void;
  onQuickReply: (
    target: { conversationId: string; replyToMessageId?: string },
    body: string,
    idempotencyKey: string
  ) => Promise<void>;
  busy: boolean;
}) {
  const { t } = useTranslation('notifications');
  const [snoozeAnchor, setSnoozeAnchor] = useState<HTMLElement | null>(null);
  const [sensitiveRevealed, setSensitiveRevealed] = useState(false);
  const [replyActionContainer, setReplyActionContainer] = useState<HTMLElement | null>(null);
  const mobile = mode === 'mobile';
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
  const actorLabel = displayNotificationActorLabel(detail?.item.actorLabel ?? item.actorLabel);
  const replyTarget = detail ? resolveMessagingReplyTarget(detail.item) : null;
  const canReply = Boolean(
    detail &&
    !detailQuery.isError &&
    detail.targetState === 'AVAILABLE' &&
    !detail.item.sensitive &&
    replyTarget
  );
  const showFooter = Boolean(
    detail &&
    !detailQuery.isError &&
    (!detail.item.sensitive || sensitiveRevealed) &&
    detail.targetState === 'AVAILABLE' &&
    (primary?.href || canReply)
  );
  const triageButtonSx = {
    width: mobile
      ? foundationTokens.density.comfortable.controlHeight
      : foundationTokens.density.compact.controlHeight,
    height: mobile
      ? foundationTokens.density.comfortable.controlHeight
      : foundationTokens.density.compact.controlHeight,
  };
  const triageTools = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent={mobile ? 'space-around' : undefined}
      gap={1}
    >
      <ActionIconButton
        label={item.readAt ? t('actions.markUnread') : t('actions.markRead')}
        onClick={() => onTriage(item.readAt ? 'UNREAD' : 'READ')}
        disabled={busy}
        size="small"
        sx={triageButtonSx}
      >
        {item.readAt ? <MailOpen size={18} /> : <CheckCheck size={18} />}
      </ActionIconButton>
      {(!item.savedAt || NOTIFICATION_API_CAPABILITIES.unsave) && (
        <ActionIconButton
          label={item.savedAt ? t('actions.unsave') : t('actions.save')}
          onClick={() => onTriage(item.savedAt ? 'UNSAVE' : 'SAVE')}
          disabled={busy}
          intent={item.savedAt ? 'primary' : 'default'}
          size="small"
          sx={triageButtonSx}
        >
          {item.savedAt ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </ActionIconButton>
      )}
      <ActionIconButton
        label={t('actions.snooze')}
        onClick={(event) => setSnoozeAnchor(event.currentTarget)}
        disabled={busy}
        size="small"
        sx={triageButtonSx}
      >
        <Clock3 size={18} />
      </ActionIconButton>
      {(!item.completedAt || NOTIFICATION_API_CAPABILITIES.restore) && (
        <ActionIconButton
          label={item.completedAt ? t('actions.restore') : t('actions.complete')}
          onClick={() => onTriage(item.completedAt ? 'RESTORE' : 'COMPLETE')}
          disabled={busy}
          size="small"
          sx={{ ...triageButtonSx, color: item.completedAt ? 'success.main' : undefined }}
        >
          {item.completedAt ? <RotateCcw size={18} /> : <Check size={18} />}
        </ActionIconButton>
      )}
    </Stack>
  );
  const personalTools = (
    <Box
      component="section"
      aria-label={t('bulk.toolbarLabel')}
      sx={{ mt: 2, py: 1, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {t('workbench.shortcuts.label')}
      </Typography>
      {triageTools}
    </Box>
  );

  useEffect(() => {
    setSensitiveRevealed(false);
  }, [item.notificationId]);

  return (
    <Box
      component="aside"
      aria-label={t('detail.regionLabel')}
      sx={{
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{
          minHeight: 52,
          flexShrink: 0,
          px: 1.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          flexWrap="wrap"
          sx={{ minWidth: 0, flex: 1 }}
        >
          {onBack && (
            <ActionIconButton
              label={t('actions.back')}
              onClick={onBack}
              size="small"
              sx={triageButtonSx}
            >
              <ArrowLeft size={18} />
            </ActionIconButton>
          )}
          <Typography
            component="h2"
            aria-label={t('detail.title')}
            variant={mobile ? 'subtitle1' : 'caption'}
            fontWeight="fontWeightBold"
            style={mobile ? undefined : { borderRadius: foundationTokens.radius.compact }}
            sx={{
              minWidth: 0,
              overflowWrap: 'anywhere',
              color: mobile ? 'text.primary' : 'primary.main',
              px: mobile ? 0 : 1,
              py: mobile ? 0 : 0.5,
              border: mobile ? 0 : 1,
              borderColor: 'primary.main',
            }}
          >
            {mobile
              ? t('detail.title')
              : t(`sources.${item.source.appKey.toLocaleLowerCase('en-US')}`, {
                  defaultValue: item.source.appName,
                })}
          </Typography>
          {!mobile && (
            <Chip
              size="small"
              label={t(`reason.${item.reason.kind}`, { defaultValue: item.reason.label })}
              style={{ borderRadius: foundationTokens.radius.compact }}
              sx={{
                maxWidth: '100%',
                height: 'auto',
                minHeight: foundationTokens.density.compact.controlHeight,
                '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
              }}
            />
          )}
        </Stack>
        {!mobile && triageTools}
      </Stack>
      <Menu
        anchorEl={snoozeAnchor}
        open={Boolean(snoozeAnchor)}
        onClose={() => setSnoozeAnchor(null)}
      >
        {[4, 24, 72].map((hours) => (
          <MenuItem
            key={hours}
            disabled={busy}
            onClick={() => {
              setSnoozeAnchor(null);
              onTriage('SNOOZE', defaultSnoozeTime(hours));
            }}
          >
            {t('actions.snoozeHours', { count: hours })}
          </MenuItem>
        ))}
      </Menu>

      <Box
        data-testid="notification-detail-scroll"
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
      >
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
          <Box sx={{ p: 2 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              {mobile && (
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  style={{ borderRadius: foundationTokens.radius.compact }}
                  sx={{
                    maxWidth: '100%',
                    '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
                    height: 'auto',
                    minHeight: foundationTokens.density.compact.controlHeight,
                  }}
                  label={t(`sources.${detail.item.source.appKey.toLocaleLowerCase('en-US')}`, {
                    defaultValue: detail.item.source.appName,
                  })}
                />
              )}
              <Chip
                size="small"
                variant="outlined"
                style={{ borderRadius: foundationTokens.radius.compact }}
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
                <Chip
                  size="small"
                  variant="outlined"
                  label={t('detail.protected')}
                  style={{ borderRadius: foundationTokens.radius.compact }}
                />
              )}
            </Stack>
            {detail.item.sensitive && !sensitiveRevealed ? (
              <>
                <Box
                  role="status"
                  style={{ borderRadius: foundationTokens.radius.surface }}
                  sx={{
                    mt: 2,
                    p: 1.5,
                    border: 1,
                    borderColor: 'info.main',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Stack gap={1.5} alignItems="flex-start">
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
                {mobile && personalTools}
              </>
            ) : (
              <>
                <Typography component="h3" variant="h6" sx={{ mt: 1.5, overflowWrap: 'anywhere' }}>
                  {detail.item.title}
                </Typography>
                <Box
                  component="dl"
                  data-testid="notification-detail-context"
                  style={{ borderRadius: foundationTokens.radius.surface }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr)',
                    gap: 1,
                    p: 1.5,
                    m: 0,
                    mt: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                  }}
                >
                  <DetailContextItem
                    label={t('detail.context.source')}
                    value={t(`sources.${detail.item.source.appKey.toLocaleLowerCase('en-US')}`, {
                      defaultValue: detail.item.source.appName,
                    })}
                  />
                  <DetailContextItem
                    label={t('detail.context.reason')}
                    value={t(`reason.${detail.item.reason.kind}`, {
                      defaultValue: detail.item.reason.label,
                    })}
                  />
                  {actorLabel && (
                    <DetailContextItem label={t('detail.context.actor')} value={actorLabel} />
                  )}
                  <DetailContextItem
                    label={t('detail.notificationReceived')}
                    value={formatDate(detail.absoluteOccurredAt, {
                      dateStyle: 'long',
                      timeStyle: 'short',
                    })}
                  />
                  {detail.item.dueAt && (
                    <DetailContextItem
                      label={t('detail.context.due')}
                      value={formatDate(detail.item.dueAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      tone={detail.item.priority === 'URGENT' ? 'error.main' : undefined}
                    />
                  )}
                </Box>

                {detail.item.preview && (
                  <Box
                    component="section"
                    aria-label={t('preferences.presentation.preview')}
                    sx={{ mt: 2 }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {t('preferences.presentation.preview')}
                    </Typography>
                    <Box
                      style={{ borderRadius: foundationTokens.radius.surface }}
                      sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                      >
                        {detail.item.preview}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {detail.targetState !== 'AVAILABLE' && (
                  <Box
                    role="alert"
                    style={{ borderRadius: foundationTokens.radius.surface }}
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

                {mobile && personalTools}

                {canReply && (
                  <NotificationDetailReply
                    key={`${detail.item.notificationId}:${replyTarget?.conversationId}:${replyTarget?.replyToMessageId ?? ''}`}
                    item={detail.item}
                    busy={busy}
                    onQuickReply={onQuickReply}
                    mobile={mobile}
                    actionContainer={replyActionContainer}
                  />
                )}

                <Box
                  component="details"
                  sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
                >
                  <Box
                    component="summary"
                    sx={{ cursor: 'pointer', typography: 'subtitle2', overflowWrap: 'anywhere' }}
                  >
                    {t('detail.whyTitle')}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t(`reasonExplanation.${detail.item.reason.kind}`, {
                      defaultValue: detail.reasonExplanation,
                    })}
                  </Typography>
                </Box>

                {detail.timeline.length > 0 && (
                  <Box
                    component="details"
                    sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
                  >
                    <Box
                      component="summary"
                      sx={{ cursor: 'pointer', typography: 'subtitle2', overflowWrap: 'anywhere' }}
                    >
                      {t('detail.timelineTitle')}
                    </Box>
                    <Stack component="ol" gap={0} sx={{ p: 0, m: 0, mt: 1, listStyle: 'none' }}>
                      {detail.timeline.map((entry) => (
                        <Box
                          component="li"
                          key={entry.entryId}
                          sx={{
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            gap={1}
                            flexWrap="wrap"
                          >
                            <Typography variant="body2" fontWeight="fontWeightBold">
                              {entry.title === 'Notification received'
                                ? t('detail.notificationReceived')
                                : entry.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              whiteSpace="nowrap"
                            >
                              {formatDate(entry.occurredAt, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </Stack>
                          {entry.detail && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {entry.detail}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </Box>
      {showFooter && (
        <Box
          component="footer"
          data-testid="notification-detail-primary-action"
          sx={{
            flexShrink: 0,
            px: 2,
            pt: 1.5,
            pb: 'max(12px, env(safe-area-inset-bottom))',
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'grid',
            gridTemplateColumns:
              mobile && canReply && primary?.href ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
            gap: 1,
          }}
        >
          {primary?.href && (
            <ActionButton
              intent={mobile && canReply ? 'secondary' : 'primary'}
              size="small"
              fullWidth
              disabled={!primary.enabled || busy}
              endIcon={<ExternalLink size={16} aria-hidden="true" />}
              loading={targetNavigation.openingId === item.notificationId}
              onClick={() => void targetNavigation.openTarget(item.notificationId)}
              sx={{
                minWidth: 0,
                minHeight: foundationTokens.density.comfortable.controlHeight,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
              }}
            >
              {primary.label}
            </ActionButton>
          )}
          {mobile && canReply && (
            <Box
              ref={setReplyActionContainer}
              sx={{ minWidth: 0, display: 'flex', alignItems: 'stretch' }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

function DetailContextItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 3fr)',
        gap: 1,
        alignItems: 'baseline',
      }}
    >
      <Typography
        component="dt"
        variant="caption"
        color="text.secondary"
        sx={{ overflowWrap: 'anywhere' }}
      >
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="body2"
        fontWeight="fontWeightMedium"
        color={tone}
        sx={{ m: 0, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}
