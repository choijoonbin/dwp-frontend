import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system';
import { Paperclip, Star, UserRoundPlus } from 'lucide-react';
import { formatRelativeTime, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { ReactNode } from 'react';
import type { MailThread } from '@dwp-frontend/shared-utils';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

export function MailPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      spacing={2}
      sx={{ minWidth: 0 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" sx={{ color: 'var(--dwp-product-accent)' }}>
            {eyebrow}
          </Typography>
        )}
        <Typography
          component="h1"
          variant="h4"
          fontWeight="fontWeightBold"
          sx={{ mt: eyebrow ? 0.25 : 0, '&:focus': { outline: 'none' } }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 760 }}>
          {description}
        </Typography>
      </Box>
      {actions}
    </Stack>
  );
}

export function MailMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: string;
}) {
  return (
    <Box sx={{ px: 2.5, py: 2.25, minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone, flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary" fontWeight="fontWeightBold">
          {label}
        </Typography>
      </Stack>
      <Typography component="p" variant="h4" fontWeight="fontWeightBold" sx={{ mt: 0.85 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
        {detail}
      </Typography>
    </Box>
  );
}

function initials(name: string) {
  const value = name.trim();
  if (!value) return '?';
  const words = value.split(/\s+/u);
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
    : value.slice(0, 2);
}

export function mailRelativeTime(value: string, language: string) {
  const date = new Date(value);
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const locale = resolveSupportedLocale(language);
  if (Math.abs(minutes) < 60) {
    return formatRelativeTime(minutes, 'minute', { numeric: 'auto' }, locale);
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatRelativeTime(hours, 'hour', { numeric: 'auto' }, locale);
  }
  return formatRelativeTime(Math.round(hours / 24), 'day', { numeric: 'auto' }, locale);
}

export function MailThreadListItem({
  thread,
  selected = false,
  onSelect,
  compact = false,
  disabled = false,
  presentation = 'default',
}: {
  thread: MailThread;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
  disabled?: boolean;
  presentation?: 'default' | 'focus';
}) {
  const { t, i18n } = useTranslation('mail');
  const participant = thread.participants[0];
  const urgent = thread.importance === 'URGENT';
  const focusPresentation = presentation === 'focus';
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-busy={disabled || undefined}
      sx={(theme) => ({
        width: 1,
        minHeight: compact ? (focusPresentation ? 82 : 86) : 104,
        px: compact ? 1.5 : 2,
        py: focusPresentation ? 1.25 : 1.5,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: 1.25,
        alignItems: 'start',
        border: focusPresentation ? 1 : 0,
        borderBottom: 1,
        borderColor: focusPresentation ? alpha(theme.palette.primary.main, 0.14) : 'divider',
        borderRadius: focusPresentation ? COMPACT_RADIUS : 0,
        bgcolor: selected
          ? 'var(--dwp-product-selection)'
          : focusPresentation
            ? thread.unread
              ? alpha(theme.palette.primary.main, 0.035)
              : theme.palette.background.paper
            : thread.unread
              ? alpha(theme.palette.background.paper, 0.98)
              : alpha(theme.palette.background.paper, 0.72),
        color: 'text.primary',
        textAlign: 'left',
        cursor: disabled ? 'wait' : 'pointer',
        position: 'relative',
        boxShadow: 'none',
        transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow']),
        '&::before': selected
          ? {
              content: '""',
              position: 'absolute',
              inset: '10px auto 10px 0',
              width: 3,
              bgcolor: 'var(--dwp-product-accent)',
              borderRadius: COMPACT_RADIUS,
            }
          : undefined,
        '&:hover': {
          bgcolor: disabled ? undefined : 'action.hover',
          borderColor:
            disabled || !focusPresentation ? undefined : alpha(theme.palette.primary.main, 0.3),
          boxShadow: disabled || !focusPresentation ? undefined : 'none',
        },
        '&:disabled': { opacity: 0.72 },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <Avatar
        sx={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          fontSize: 'caption.fontSize',
          fontWeight: 'fontWeightBold',
          bgcolor: urgent ? 'error.main' : 'var(--dwp-product-soft)',
          color: urgent ? 'error.contrastText' : 'var(--dwp-product-accent)',
        }}
      >
        {initials(participant?.name ?? thread.accountName)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={thread.unread ? 'fontWeightBold' : 'fontWeightMedium'}
            noWrap
          >
            {participant?.name ?? thread.accountName}
          </Typography>
          {thread.sharedInboxName && (
            <Chip
              label={thread.sharedInboxName}
              size="small"
              variant="outlined"
              sx={{ height: 20 }}
            />
          )}
          {focusPresentation && urgent && (
            <Chip
              label={t('importance.URGENT')}
              size="small"
              sx={(theme) => ({
                height: 19,
                color: theme.palette.error.dark,
                bgcolor: alpha(theme.palette.error.main, 0.08),
                border: 1,
                borderColor: alpha(theme.palette.error.main, 0.2),
                '& .MuiChip-label': {
                  px: 0.75,
                  fontSize: 'caption.fontSize',
                  fontWeight: 'fontWeightBold',
                },
              })}
            />
          )}
        </Stack>
        <Typography
          variant="body2"
          fontWeight={thread.unread ? 'fontWeightBold' : 'fontWeightMedium'}
          noWrap
          sx={{ mt: 0.4 }}
        >
          {thread.subject}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            mt: 0.35,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: compact ? 1 : 2,
            overflow: 'hidden',
          }}
        >
          {thread.preview}
        </Typography>
        {!compact && thread.assignedName && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
            <UserRoundPlus size={13} />
            <Typography variant="caption" color="text.secondary">
              {t('thread.assignedTo', { name: thread.assignedName })}
            </Typography>
          </Stack>
        )}
      </Box>
      <Stack alignItems="flex-end" spacing={0.75} sx={{ minWidth: 54 }}>
        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
          {mailRelativeTime(thread.latestMessageAt, i18n.resolvedLanguage ?? i18n.language)}
        </Typography>
        <Stack direction="row" spacing={0.6} color="text.secondary">
          {thread.starred && <Star size={14} fill="currentColor" />}
          {thread.attachments && <Paperclip size={14} />}
          {thread.unread && (
            <Box
              aria-label={t('thread.unread')}
              sx={{ width: 8, height: 8, mt: 0.35, borderRadius: '50%', bgcolor: 'success.main' }}
            />
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
