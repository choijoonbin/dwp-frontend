import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  BellRing,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Mail,
  MessageCircle,
  ShieldAlert,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { GlyphSurface } from '@dwp-frontend/design-system/components/glyph-surface';
import { formatDate, formatRelativeTime } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { useNotificationTargetNavigation } from './use-notification-target-navigation';

import type { NotificationConnectionState } from './use-notification-runtime';
import type {
  NotificationItem,
  NotificationPriority,
} from '@dwp-frontend/shared-utils/api/notification-api';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const SOURCE_ICON: Record<string, LucideIcon> = {
  approval: CheckCircle2,
  mail: Mail,
  spaces: MessageCircle,
  security: ShieldAlert,
};

function relativeTimestamp(value: string): string {
  const timestamp = new Date(value).getTime();
  const difference = timestamp - Date.now();
  const minutes = Math.round(difference / 60_000);
  if (Math.abs(minutes) < 60) return formatRelativeTime(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatRelativeTime(hours, 'hour');
  return formatRelativeTime(Math.round(hours / 24), 'day');
}

function priorityColor(priority: NotificationPriority): 'error' | 'warning' | 'info' | 'default' {
  if (priority === 'URGENT') return 'error';
  if (priority === 'HIGH') return 'warning';
  if (priority === 'NORMAL') return 'info';
  return 'default';
}

export function NotificationConnectionNotice({
  state,
  partial,
  unavailableSources,
}: {
  state: NotificationConnectionState;
  partial?: boolean;
  unavailableSources?: string[];
}) {
  const { t } = useTranslation('notifications');
  if (state === 'live' && !partial) return null;
  const offline = state === 'offline';
  const label = offline
    ? t('states.offline')
    : partial
      ? t('states.partial', { count: unavailableSources?.length ?? 0 })
      : t('states.polling');
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ px: 1.5, py: 0.75, bgcolor: 'action.hover', color: 'text.secondary' }}
    >
      <Stack direction="row" alignItems="center" gap={0.75}>
        {offline ? <CircleAlert size={15} /> : <Clock3 size={15} />}
        <Typography variant="caption">{label}</Typography>
      </Stack>
    </Box>
  );
}

export function NotificationSyncResetNotice({
  onResynchronize,
  busy = false,
  compact = false,
}: {
  onResynchronize: () => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Alert
      severity="warning"
      role="alert"
      action={
        <ActionButton
          intent="secondary"
          size="small"
          loading={busy}
          loadingLabel={t('states.resynchronizing')}
          onClick={onResynchronize}
        >
          {t('actions.resynchronize')}
        </ActionButton>
      }
      sx={{ borderRadius: 0, py: compact ? 0.25 : 0.75 }}
    >
      <Typography variant={compact ? 'caption' : 'body2'} fontWeight={650}>
        {t('states.syncResetRequired')}
      </Typography>
      {!compact && (
        <Typography variant="body2" color="text.secondary">
          {t('states.syncResetDescription')}
        </Typography>
      )}
    </Alert>
  );
}

export function NotificationPageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        pb: 2.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" gap={1.5} alignItems="flex-start">
        <GlyphSurface size={42} variant="soft">
          <BellRing size={21} strokeWidth={1.8} />
        </GlyphSurface>
        <Box minWidth={0}>
          <Typography component="h1" variant="h4">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.35 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
      {actions}
    </Box>
  );
}

export function NotificationItemRow({
  item,
  selected = false,
  compact = false,
  onSelect,
  trailing,
  concealContext = false,
  tabIndex,
  rowRef,
}: {
  item: NotificationItem;
  selected?: boolean;
  compact?: boolean;
  onSelect: () => void;
  trailing?: ReactNode;
  concealContext?: boolean;
  tabIndex?: number;
  rowRef?: (element: HTMLButtonElement | null) => void;
}) {
  const { t } = useTranslation('notifications');
  const Icon = SOURCE_ICON[item.source.appKey] ?? Bell;
  const timestamp = useMemo(() => relativeTimestamp(item.lastActivityAt), [item.lastActivityAt]);
  const unread = !item.readAt;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: trailing ? 'minmax(0, 1fr) auto' : '1fr',
        alignItems: 'stretch',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <ButtonBase
        ref={rowRef}
        aria-pressed={selected}
        aria-label={`${t(`filters.read.${unread ? 'UNREAD' : 'READ'}`)}. ${item.title}`}
        tabIndex={tabIndex}
        data-notification-focus-id={item.notificationId}
        onClick={onSelect}
        sx={{
          minWidth: 0,
          minHeight: compact ? 64 : 78,
          px: compact ? 1.5 : 2,
          py: compact ? 1 : 1.4,
          display: 'grid',
          gridTemplateColumns: `${compact ? 32 : 36}px minmax(0, 1fr)`,
          gap: 1.25,
          alignItems: 'start',
          justifyContent: 'stretch',
          textAlign: 'left',
          transition: 'background-color 160ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <Box
            aria-hidden="true"
            sx={(theme) => ({
              width: compact ? 32 : 36,
              height: compact ? 32 : 36,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              color: item.source.accent ?? theme.palette.primary.main,
              bgcolor: alpha(item.source.accent ?? theme.palette.primary.main, 0.1),
            })}
          >
            <Icon size={compact ? 16 : 18} strokeWidth={1.8} />
          </Box>
          {unread && (
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                border: 2,
                borderColor: 'background.paper',
              }}
            />
          )}
        </Box>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Typography variant="body2" fontWeight={unread ? 760 : 620} noWrap sx={{ minWidth: 0 }}>
              {item.title}
            </Typography>
            <Tooltip
              title={formatDate(item.lastActivityAt, { dateStyle: 'medium', timeStyle: 'short' })}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
              >
                {timestamp}
              </Typography>
            </Tooltip>
          </Stack>
          {item.preview && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.2,
                display: '-webkit-box',
                WebkitLineClamp: compact ? 1 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.preview}
            </Typography>
          )}
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.7 }}>
            {item.priority !== 'LOW' && (
              <Chip
                size="small"
                variant="outlined"
                color={priorityColor(item.priority)}
                label={t(`priority.${item.priority}`)}
                sx={{ height: 22 }}
              />
            )}
            {!concealContext && (
              <Typography variant="caption" color="text.secondary">
                {t(`reason.${item.reason.kind}`, { defaultValue: item.reason.label })}
              </Typography>
            )}
            {!concealContext && item.threadCount > 1 && (
              <Typography variant="caption" color="text.secondary">
                {t('item.threadCount', { count: item.threadCount })}
              </Typography>
            )}
            {item.savedAt && <Bookmark size={14} aria-label={t('item.saved')} />}
          </Stack>
        </Box>
      </ButtonBase>
      {trailing && <Box sx={{ display: 'grid', placeItems: 'center', pr: 1 }}>{trailing}</Box>}
    </Box>
  );
}

export function NotificationPrimaryAction({
  item,
  onOpenTarget,
}: {
  item: NotificationItem;
  onOpenTarget?: (href: string) => void;
}) {
  const primary = item.actions.find((action) => action.primary) ?? item.actions[0];
  const targetNavigation = useNotificationTargetNavigation(onOpenTarget);
  if (!primary) return null;
  return (
    <ButtonBase
      component="button"
      onClick={() => void targetNavigation.openTarget(item.notificationId)}
      disabled={!primary.enabled || targetNavigation.openingId === item.notificationId}
      sx={{
        minHeight: 36,
        px: 1.25,
        borderRadius: 1,
        color: 'primary.main',
        fontWeight: 720,
        fontSize: 13,
        gap: 0.5,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {primary.label}
      <ChevronRight size={16} />
    </ButtonBase>
  );
}
