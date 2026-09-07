import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Info,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Reply,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';
import { formatDate, formatRelativeTime } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { resolveMessagingReplyTarget } from './notification-inbox-model';
import { useNotificationTargetNavigation } from './use-notification-target-navigation';

import type {
  NotificationItem,
  NotificationPriority,
  NotificationTriageAction,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type { LucideIcon } from 'lucide-react';

const SOURCE_ICON: Record<string, LucideIcon> = {
  approval: CheckCircle2,
  approvals: CheckCircle2,
  mail: Mail,
  messaging: MessageCircle,
  space: MessageCircle,
  spaces: MessageCircle,
  security: ShieldAlert,
};

function relativeTimestamp(value: string, now: number): string {
  const difference = new Date(value).getTime() - now;
  const minutes = Math.round(difference / 60_000);
  if (Math.abs(minutes) < 60) return formatRelativeTime(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatRelativeTime(hours, 'hour');
  return formatRelativeTime(Math.round(hours / 24), 'day');
}

function priorityTone(priority: NotificationPriority): 'error' | 'warning' | 'info' | 'default' {
  if (priority === 'URGENT') return 'error';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'NORMAL') return 'info';
  return 'default';
}

export function NotificationActionCard({
  item,
  now,
  active,
  checked,
  busy,
  concealContext,
  tabIndex,
  rowRef,
  onFocus,
  onToggleChecked,
  onOpenDetails,
  onTriage,
  onOpenTarget,
  onQuickReply,
  selectable = true,
}: {
  item: NotificationItem;
  now: number;
  active: boolean;
  checked: boolean;
  busy: boolean;
  concealContext: boolean;
  tabIndex: number;
  rowRef: (element: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onToggleChecked: (checked: boolean) => void;
  onOpenDetails: () => void;
  onTriage: (action: NotificationTriageAction) => void;
  onOpenTarget?: (href: string) => void;
  onQuickReply: (
    target: { conversationId: string; replyToMessageId?: string },
    body: string,
    idempotencyKey: string
  ) => Promise<void>;
  selectable?: boolean;
}) {
  const { t } = useTranslation('notifications');
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState(false);
  const [replyIdempotencyKey, setReplyIdempotencyKey] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const replyTarget = useMemo(() => resolveMessagingReplyTarget(item), [item]);
  const targetNavigation = useNotificationTargetNavigation(onOpenTarget);
  const normalizedSource = item.source.appKey.toLocaleLowerCase('en-US');
  const Icon = SOURCE_ICON[normalizedSource] ?? Bell;
  const primary = item.actions.find((action) => action.primary) ?? item.actions[0];
  const unread = !item.readAt;
  const timestamp = relativeTimestamp(item.lastActivityAt, now);
  const absoluteTimestamp = formatDate(item.lastActivityAt, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const submitReply = async () => {
    const body = replyBody.trim();
    if (!replyTarget || !body || replyBusy) return;
    const idempotencyKey = replyIdempotencyKey ?? crypto.randomUUID();
    setReplyIdempotencyKey(idempotencyKey);
    setReplyBusy(true);
    setReplyError(false);
    try {
      await onQuickReply(replyTarget, body, idempotencyKey);
      setReplyBody('');
      setReplyIdempotencyKey(null);
      setReplying(false);
    } catch {
      setReplyError(true);
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <Box
      component="article"
      data-notification-card={item.notificationId}
      aria-label={`${item.title}, ${t(unread ? 'workbench.card.unread' : 'workbench.card.read')}`}
      sx={(theme) => ({
        position: 'relative',
        border: 1,
        borderLeft: 3,
        borderColor: active ? 'primary.main' : 'divider',
        borderLeftColor:
          item.priority === 'URGENT'
            ? 'error.main'
            : item.actionable
              ? 'primary.main'
              : active
                ? 'primary.main'
                : 'divider',
        borderRadius: 'shape.borderRadius',
        bgcolor: 'background.paper',
        boxShadow: active ? theme.shadows[1] : 'none',
        transition: theme.transitions.create(['border-color', 'box-shadow', 'opacity'], {
          duration: theme.transitions.duration.shorter,
        }),
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      })}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.1} sx={{ p: { xs: 1.25, md: 1.5 } }}>
        {selectable && (
          <Checkbox
            size="small"
            checked={checked}
            onChange={(event) => onToggleChecked(event.target.checked)}
            inputProps={{ 'aria-label': t('bulk.selectItem', { title: item.title }) }}
            sx={{ mt: -0.45, ml: -0.5 }}
          />
        )}
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            width: 36,
            height: 36,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'shape.borderRadius',
            flexShrink: 0,
            color: item.source.accent ?? 'var(--dwp-product-accent)',
            bgcolor: alpha(item.source.accent ?? theme.palette.primary.main, 0.1),
          })}
        >
          <Icon size={18} strokeWidth={1.9} />
        </Box>
        <Box minWidth={0} sx={{ flex: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={0.7}>
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" minWidth={0}>
              <Typography variant="caption" fontWeight="fontWeightBold">
                {t(`sources.${normalizedSource}`, { defaultValue: item.source.appName })}
              </Typography>
              {item.actorLabel && !concealContext && (
                <Typography variant="caption" color="text.secondary">
                  {item.actorLabel}
                </Typography>
              )}
              <Chip
                size="small"
                variant="outlined"
                color={priorityTone(item.priority)}
                label={t(`priority.${item.priority}`)}
                sx={{ height: 20 }}
              />
              {item.actionable && (
                <Chip
                  size="small"
                  label={t('workbench.card.actionRequired')}
                  sx={{
                    height: 20,
                    bgcolor: 'var(--dwp-product-selection)',
                    color: 'var(--dwp-product-accent)',
                  }}
                />
              )}
            </Stack>
            <Typography
              component="time"
              dateTime={item.lastActivityAt}
              title={absoluteTimestamp}
              variant="caption"
              color="text.secondary"
              whiteSpace="nowrap"
            >
              {timestamp}
            </Typography>
          </Stack>

          <ButtonBase
            ref={rowRef}
            tabIndex={tabIndex}
            data-notification-focus-id={item.notificationId}
            aria-current={active ? 'true' : undefined}
            onFocus={onFocus}
            onClick={onOpenDetails}
            sx={{
              mt: 0.65,
              display: 'block',
              width: 1,
              textAlign: 'left',
              borderRadius: 'shape.borderRadius',
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            <Typography
              component="h3"
              variant="subtitle1"
              fontWeight={unread ? 'fontWeightBold' : 'fontWeightMedium'}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {item.title}
            </Typography>
          </ButtonBase>
          {item.preview && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.35, whiteSpace: 'pre-wrap' }}
            >
              {item.preview}
            </Typography>
          )}

          <Stack direction="row" gap={0.8} alignItems="center" flexWrap="wrap" sx={{ mt: 0.9 }}>
            {!concealContext && (
              <Typography variant="caption" color="text.secondary">
                {t(`reason.${item.reason.kind}`, { defaultValue: item.reason.label })}
              </Typography>
            )}
            {!concealContext && item.threadCount > 1 && (
              <Typography variant="caption" color="text.secondary">
                · {t('item.threadCount', { count: item.threadCount })}
              </Typography>
            )}
            {item.dueAt && (
              <Typography
                variant="caption"
                color={item.priority === 'URGENT' ? 'error.main' : 'text.secondary'}
              >
                ·{' '}
                {t('workbench.card.due', {
                  time: formatDate(item.dueAt, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </Typography>
            )}
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1}
            sx={{ mt: 1.15, pt: 1, borderTop: 1, borderColor: 'divider' }}
          >
            <Stack direction="row" gap={0.65} flexWrap="wrap">
              {replyTarget && !concealContext && (
                <ActionButton
                  intent="primary"
                  size="small"
                  startIcon={<Reply size={15} />}
                  onClick={() => setReplying((current) => !current)}
                >
                  {t('workbench.card.reply')}
                </ActionButton>
              )}
              {primary?.enabled && primary.href && (
                <ActionButton
                  intent={replyTarget ? 'secondary' : 'primary'}
                  size="small"
                  endIcon={<ChevronRight size={15} />}
                  loading={targetNavigation.openingId === item.notificationId}
                  onClick={() => void targetNavigation.openTarget(item.notificationId)}
                >
                  {primary.label}
                </ActionButton>
              )}
            </Stack>
            <Stack
              direction="row"
              gap={0.1}
              justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
              flexWrap="wrap"
              sx={{ minWidth: 0, maxWidth: '100%', display: { xs: 'none', sm: 'flex' } }}
            >
              <ActionIconButton label={t('actions.detail')} size="small" onClick={onOpenDetails}>
                <Info size={17} />
              </ActionIconButton>
              <ActionIconButton
                label={item.savedAt ? t('actions.unsave') : t('actions.save')}
                size="small"
                disabled={busy}
                onClick={() => onTriage(item.savedAt ? 'UNSAVE' : 'SAVE')}
              >
                {item.savedAt ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </ActionIconButton>
              <ActionIconButton
                label={t('actions.snooze')}
                size="small"
                disabled={busy}
                onClick={() => onTriage('SNOOZE')}
              >
                <Clock3 size={17} />
              </ActionIconButton>
              <ActionIconButton
                label={item.completedAt ? t('actions.restore') : t('actions.complete')}
                size="small"
                disabled={busy}
                onClick={() => onTriage(item.completedAt ? 'RESTORE' : 'COMPLETE')}
              >
                {item.completedAt ? <CheckCircle2 size={17} /> : <Check size={17} />}
              </ActionIconButton>
            </Stack>
            <Box sx={{ display: { xs: 'block', sm: 'none' }, alignSelf: 'flex-end' }}>
              <ActionIconButton
                label={t('actions.more')}
                size="small"
                aria-haspopup="menu"
                aria-expanded={Boolean(actionMenuAnchor)}
                onClick={(event) => setActionMenuAnchor(event.currentTarget)}
              >
                <MoreHorizontal size={18} />
              </ActionIconButton>
              <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={() => setActionMenuAnchor(null)}
              >
                <MenuItem
                  sx={{ gap: 1 }}
                  onClick={() => {
                    setActionMenuAnchor(null);
                    onOpenDetails();
                  }}
                >
                  <Info size={17} />
                  {t('actions.detail')}
                </MenuItem>
                <MenuItem
                  sx={{ gap: 1 }}
                  disabled={busy}
                  onClick={() => {
                    setActionMenuAnchor(null);
                    onTriage(item.savedAt ? 'UNSAVE' : 'SAVE');
                  }}
                >
                  {item.savedAt ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                  {item.savedAt ? t('actions.unsave') : t('actions.save')}
                </MenuItem>
                <MenuItem
                  sx={{ gap: 1 }}
                  disabled={busy}
                  onClick={() => {
                    setActionMenuAnchor(null);
                    onTriage('SNOOZE');
                  }}
                >
                  <Clock3 size={17} />
                  {t('actions.snooze')}
                </MenuItem>
                <MenuItem
                  sx={{ gap: 1 }}
                  disabled={busy}
                  onClick={() => {
                    setActionMenuAnchor(null);
                    onTriage(item.completedAt ? 'RESTORE' : 'COMPLETE');
                  }}
                >
                  {item.completedAt ? <CheckCircle2 size={17} /> : <Check size={17} />}
                  {item.completedAt ? t('actions.restore') : t('actions.complete')}
                </MenuItem>
              </Menu>
            </Box>
          </Stack>

          <Collapse in={replying} unmountOnExit>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={0.75}
              alignItems="flex-end"
              sx={{
                mt: 1.1,
                p: 1,
                bgcolor: 'action.hover',
                borderRadius: 'shape.borderRadius',
              }}
            >
              <FormField
                multiline
                minRows={2}
                fullWidth
                value={replyBody}
                onChange={(event) => {
                  setReplyBody(event.target.value);
                  if (replyError) {
                    setReplyError(false);
                    setReplyIdempotencyKey(null);
                  }
                }}
                label={t('workbench.card.replyLabel')}
                placeholder={t('workbench.card.replyPlaceholder')}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submitReply();
                }}
                errorMessage={replyError ? t('workbench.card.replyError') : undefined}
              />
              <ActionButton
                intent="primary"
                size="small"
                startIcon={<Send size={15} />}
                disabled={!replyBody.trim()}
                loading={replyBusy}
                onClick={() => void submitReply()}
                sx={{ flexShrink: 0 }}
              >
                {t('workbench.card.send')}
              </ActionButton>
            </Stack>
          </Collapse>
        </Box>
      </Stack>
    </Box>
  );
}
