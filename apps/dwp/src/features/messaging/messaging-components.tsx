import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AtSign,
  Bookmark,
  Hash,
  MessageSquareReply,
  MessageSquareText,
  Pencil,
  Pin,
  ShieldCheck,
  SmilePlus,
  Star,
  Trash2,
} from 'lucide-react';
import { formatRelativeTime, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  MessagingConversation,
  MessagingClassification,
  MessagingMember,
  MessagingMessage,
  MessagingPerson,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

const QUICK_REACTIONS = [
  { emoji: '👍', labelKey: 'like' },
  { emoji: '✅', labelKey: 'done' },
  { emoji: '👀', labelKey: 'seen' },
  { emoji: '🙌', labelKey: 'thanks' },
] as const;

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
}: {
  conversation: MessagingConversation;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation('messaging');
  const Icon = conversationIcon(conversation);
  const urgent = conversation.dataClassification === 'RESTRICTED';
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={(theme) => ({
        width: 1,
        minHeight: compact ? 82 : 98,
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
        cursor: 'pointer',
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
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <Avatar
        variant="rounded"
        sx={{
          width: compact ? 36 : 40,
          height: compact ? 36 : 40,
          bgcolor: urgent ? '#8B2D3D' : 'var(--dwp-product-soft)',
          color: urgent ? '#fff' : 'var(--dwp-product-accent)',
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
        </Stack>
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

export function MessagingMessageRow({
  message,
  mine,
  onReact,
  onReply,
  replyCount = 0,
  onSave,
  onEdit,
  onDelete,
  compact = false,
}: {
  message: MessagingMessage;
  mine: boolean;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  replyCount?: number;
  onSave?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation('messaging');
  const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null);
  const reactionMenuOpen = Boolean(reactionAnchor);
  const unavailable = t('message.connectionRequired');

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: mine ? 'minmax(0, 1fr) auto' : 'auto minmax(0, 1fr)',
        gap: 1.15,
        alignItems: 'start',
        py: compact ? 0.85 : 1.1,
        position: 'relative',
        '& .dwp-message-actions': {
          opacity: { xs: 1, md: 0 },
          transform: { xs: 'none', md: 'translateY(-2px)' },
          pointerEvents: { xs: 'auto', md: 'none' },
          transition: 'opacity 140ms ease, transform 140ms ease',
        },
        '&:hover .dwp-message-actions, &:focus-within .dwp-message-actions': {
          opacity: 1,
          transform: 'none',
          pointerEvents: 'auto',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .dwp-message-actions': { transition: 'none', transform: 'none' },
        },
      }}
    >
      {!mine && (
        <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800 }}>
          {messagingInitials(message.senderName)}
        </Avatar>
      )}
      <Box sx={{ minWidth: 0, justifySelf: mine ? 'end' : 'stretch', maxWidth: mine ? '78%' : 1 }}>
        <Stack
          direction="row"
          spacing={0.8}
          alignItems="baseline"
          justifyContent={mine ? 'flex-end' : 'flex-start'}
        >
          <Typography variant="body2" fontWeight={760}>
            {mine ? t('message.me') : message.senderName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {messagingRelativeTime(message.createdAt, i18n.resolvedLanguage ?? i18n.language)}
          </Typography>
          {message.editedAt && !message.deletedAt && (
            <Typography variant="caption" color="text.secondary">
              {t('message.edited')}
            </Typography>
          )}
        </Stack>
        <Box
          sx={(theme) => ({
            mt: 0.45,
            px: 1.4,
            py: 1.1,
            border: 1,
            borderColor: mine ? alpha(theme.palette.primary.main, 0.25) : 'divider',
            borderRadius: 1,
            bgcolor: mine ? 'var(--dwp-product-selection)' : 'background.paper',
            boxShadow: mine ? 'none' : '0 8px 24px rgba(17, 24, 39, 0.04)',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          })}
        >
          <Typography variant="body2" lineHeight={1.68}>
            {message.deletedAt ? t('message.deleted') : message.body}
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          sx={{ mt: 0.65, justifyContent: mine ? 'flex-end' : 'flex-start' }}
        >
          {message.reactions.map((reaction) => (
            <Tooltip
              key={reaction.emoji}
              title={t(reaction.mine ? 'message.removeReaction' : 'message.addReactionEmoji', {
                emoji: reaction.emoji,
              })}
            >
              <Chip
                component="button"
                type="button"
                label={`${reaction.emoji} ${reaction.count}`}
                size="small"
                color={reaction.mine ? 'primary' : 'default'}
                variant={reaction.mine ? 'filled' : 'outlined'}
                onClick={() => onReact(reaction.emoji)}
                sx={{ height: 23, cursor: 'pointer' }}
              />
            </Tooltip>
          ))}
          {replyCount > 0 && onReply && (
            <Chip
              component="button"
              type="button"
              label={
                <Stack direction="row" spacing={0.4} alignItems="center">
                  <MessageSquareReply size={13} />
                  <Box component="span">{t('message.replyCount', { count: replyCount })}</Box>
                </Stack>
              }
              size="small"
              variant="outlined"
              onClick={onReply}
              sx={{ height: 23, cursor: 'pointer' }}
            />
          )}
        </Stack>
      </Box>
      {!message.deletedAt && (
        <Stack
          className="dwp-message-actions"
          direction="row"
          spacing={0.15}
          sx={{
            position: 'absolute',
            top: 2,
            left: mine ? 0 : 'auto',
            right: mine ? 'auto' : 0,
            zIndex: 1,
            p: 0.25,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.1)',
          }}
        >
          <ActionIconButton
            label={t('message.addReaction')}
            onClick={(event) => setReactionAnchor(event.currentTarget)}
            size="small"
          >
            <SmilePlus size={15} />
          </ActionIconButton>
          {onReply && (
            <ActionIconButton label={t('message.reply')} onClick={onReply} size="small">
              <MessageSquareReply size={15} />
            </ActionIconButton>
          )}
          <ActionIconButton
            label={t('message.save')}
            tooltip={onSave ? t('message.save') : unavailable}
            onClick={onSave}
            disabled={!onSave}
            size="small"
          >
            <Bookmark size={15} />
          </ActionIconButton>
          {mine && (
            <>
              <ActionIconButton
                label={t('message.edit')}
                tooltip={onEdit ? t('message.edit') : unavailable}
                onClick={onEdit}
                disabled={!onEdit}
                size="small"
              >
                <Pencil size={15} />
              </ActionIconButton>
              <ActionIconButton
                label={t('message.delete')}
                tooltip={onDelete ? t('message.delete') : unavailable}
                onClick={onDelete}
                disabled={!onDelete}
                size="small"
                intent="danger"
              >
                <Trash2 size={15} />
              </ActionIconButton>
            </>
          )}
          <Menu
            anchorEl={reactionAnchor}
            open={reactionMenuOpen}
            onClose={() => setReactionAnchor(null)}
            slotProps={{
              paper: {
                sx: {
                  mt: 0.5,
                  borderRadius: 1,
                  boxShadow: '0 18px 46px rgba(15, 23, 42, 0.16)',
                },
              },
            }}
          >
            {QUICK_REACTIONS.map((reaction) => (
              <MenuItem
                key={reaction.emoji}
                onClick={() => {
                  onReact(reaction.emoji);
                  setReactionAnchor(null);
                }}
                sx={{ gap: 1.2, minWidth: 154 }}
              >
                <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
                  {reaction.emoji}
                </Typography>
                <Typography variant="body2">
                  {t(`message.reactions.${reaction.labelKey}`)}
                </Typography>
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      )}
      {mine && (
        <Avatar sx={{ width: 34, height: 34, fontSize: 12, fontWeight: 800 }}>
          {messagingInitials(message.senderName)}
        </Avatar>
      )}
    </Box>
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
