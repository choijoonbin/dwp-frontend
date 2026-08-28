import { useTranslation } from 'react-i18next';
import { AtSign, Hash, MessageSquareText, Pin, ShieldCheck, Star } from 'lucide-react';
import { formatRelativeTime, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  MessagingConversation,
  MessagingClassification,
  MessagingMember,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

export function messagingInitials(value: string) {
  const normalized = value.trim();
  if (!normalized) return '?';
  const words = normalized.split(/\s+/u);
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
    : normalized.slice(0, 2);
}

export function messagingRelativeTime(value?: string | null, language?: string) {
  if (!value) return '';
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

export function MessagingPageHeading({
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
        <Typography component="h1" variant="h4" fontWeight={850}>
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

export function MessagingMetric({
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
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone }} />
        <Typography variant="body2" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
      </Stack>
      <Typography component="p" variant="h4" fontWeight={850} sx={{ mt: 0.85 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
        {detail}
      </Typography>
    </Box>
  );
}

function conversationIcon(conversation: MessagingConversation) {
  if (conversation.visibility === 'SPACE') return Hash;
  if (conversation.conversationType === 'DIRECT') return AtSign;
  if (conversation.conversationType === 'ANNOUNCEMENT') return ShieldCheck;
  return MessageSquareText;
}

export function MessagingConversationListItem({
  conversation,
  selected = false,
  onSelect,
  compact = false,
  showPreview = true,
}: {
  conversation: MessagingConversation;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
  showPreview?: boolean;
}) {
  const { t, i18n } = useTranslation('messaging');
  const Icon = conversationIcon(conversation);
  const restricted = conversation.dataClassification === 'RESTRICTED';
  return (
    <Box
      component={onSelect ? 'button' : 'div'}
      type={onSelect ? 'button' : undefined}
      onClick={onSelect}
      aria-pressed={onSelect ? selected : undefined}
      sx={(theme) => ({
        width: 1,
        minHeight: compact || !showPreview ? 78 : 98,
        px: compact ? 1.5 : 1.85,
        py: 1.35,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: 1.25,
        alignItems: 'start',
        border: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected
          ? 'var(--dwp-product-selection)'
          : conversation.unreadCount
            ? alpha(theme.palette.background.paper, 0.98)
            : alpha(theme.palette.background.paper, 0.72),
        color: 'text.primary',
        textAlign: 'left',
        cursor: onSelect ? 'pointer' : 'default',
        position: 'relative',
        '&::before': selected
          ? {
              content: '""',
              position: 'absolute',
              inset: '10px auto 10px 0',
              width: 3,
              bgcolor: 'var(--dwp-product-accent)',
              borderRadius: '0 3px 3px 0',
            }
          : undefined,
        '&:hover': onSelect ? { bgcolor: 'action.hover' } : undefined,
        '&:focus-visible': onSelect
          ? {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            }
          : undefined,
      })}
    >
      <Avatar
        variant="rounded"
        sx={{
          width: compact ? 36 : 40,
          height: compact ? 36 : 40,
          bgcolor: 'var(--dwp-product-soft)',
          color: 'var(--dwp-product-accent)',
          borderRadius: 1,
        }}
      >
        <Icon size={19} />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={conversation.unreadCount ? 850 : 700} noWrap>
            {conversation.name ?? t('conversation.untitled')}
          </Typography>
          {conversation.pinned && (
            <Tooltip title={t('conversation.settings.pinned')}>
              <Pin size={13} fill="currentColor" color="var(--dwp-product-accent)" />
            </Tooltip>
          )}
          {conversation.favorite && (
            <Tooltip title={t('conversation.settings.favorite')}>
              <Star size={13} fill="currentColor" color="#B7791F" />
            </Tooltip>
          )}
          {conversation.linkedSpaceName && (
            <Chip label={conversation.linkedSpaceName} size="small" sx={{ height: 20 }} />
          )}
          {restricted ? (
            <Tooltip title={t('classification.RESTRICTED')}>
              <ShieldCheck size={14} color="var(--dwp-status-warning)" />
            </Tooltip>
          ) : null}
        </Stack>
        {showPreview ? (
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
            {conversation.lastMessage?.body || conversation.topic}
          </Typography>
        ) : null}
        {!compact && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.8 }}>
            <Chip
              label={t(`type.${conversation.conversationType}`)}
              size="small"
              variant="outlined"
              sx={{ height: 21 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('conversation.members', { count: conversation.memberCount })}
            </Typography>
          </Stack>
        )}
      </Box>
      <Stack alignItems="flex-end" spacing={0.75} sx={{ minWidth: 56 }}>
        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
          {messagingRelativeTime(
            conversation.lastMessageAt,
            i18n.resolvedLanguage ?? i18n.language
          )}
        </Typography>
        {conversation.unreadCount > 0 && (
          <Box
            sx={{
              minWidth: 22,
              height: 22,
              px: 0.75,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 11,
              bgcolor: 'var(--dwp-product-accent)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {conversation.unreadCount}
          </Box>
        )}
      </Stack>
    </Box>
  );
}

export function PresenceDot({ state }: { state: MessagingPerson['presenceState'] }) {
  const color =
    state === 'AVAILABLE'
      ? '#1E8E5A'
      : state === 'FOCUS'
        ? '#2856C7'
        : state === 'BUSY'
          ? '#B54747'
          : state === 'AWAY'
            ? '#B7791F'
            : '#8A94A6';
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        bgcolor: color,
        boxShadow: '0 0 0 2px #fff',
      }}
    />
  );
}

export function MessagingPersonLine({
  person,
  action,
}: {
  person: MessagingPerson | MessagingMember;
  action?: ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
      <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800 }}>
        {messagingInitials(person.displayName)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750} noWrap>
            {person.displayName}
          </Typography>
          <PresenceDot state={person.presenceState} />
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap>
          {person.jobTitle || person.emailAddress}
        </Typography>
      </Box>
      {action}
    </Stack>
  );
}

export function ClassificationChip({
  classification,
}: {
  classification: MessagingClassification;
}) {
  const { t } = useTranslation('messaging');
  const color = classification === 'RESTRICTED' ? 'error' : 'default';
  return (
    <Chip
      size="small"
      color={color}
      variant="outlined"
      label={t(`classification.${classification}`)}
    />
  );
}
