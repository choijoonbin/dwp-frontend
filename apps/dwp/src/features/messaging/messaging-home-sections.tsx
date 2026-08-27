import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  AtSign,
  Bookmark,
  CheckCheck,
  Hash,
  Inbox,
  LockKeyhole,
  MessageSquareText,
  Pin,
  Star,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { ActionButton, GlyphSurface, GuidedEmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  messagingFocusReason,
  type MessagingAttentionState,
  type MessagingFocusReason,
} from './messaging-home-model';
import { messagingRelativeTime } from './messaging-components';

import type { MessagingConversation, MessagingHome } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

type Signal = {
  key: 'mentions' | 'unread' | 'saved';
  value: number;
  icon: LucideIcon;
  tone: string;
  onSelect: () => void;
};

const attentionIcons: Record<MessagingAttentionState, LucideIcon> = {
  MENTIONS: AtSign,
  UNREAD: Inbox,
  SAVED: Bookmark,
  CLEAR: CheckCheck,
};

const attentionTones: Record<MessagingAttentionState, string> = {
  MENTIONS: '#315FDB',
  UNREAD: '#16815F',
  SAVED: '#A86209',
  CLEAR: '#1E8E5A',
};

function attentionCount(state: MessagingAttentionState, metrics: MessagingHome['metrics']) {
  if (state === 'MENTIONS') return metrics.mentions;
  if (state === 'UNREAD') return metrics.unreadConversations;
  if (state === 'SAVED') return metrics.savedItems;
  return 0;
}

function AttentionSignal({ signal }: { signal: Signal }) {
  const { t } = useTranslation('messaging');
  const Icon = signal.icon;

  return (
    <ButtonBase
      onClick={signal.onSelect}
      aria-label={t(`home.signals.${signal.key}.action`, { count: signal.value })}
      sx={(theme) => ({
        minWidth: 0,
        minHeight: 94,
        px: 2,
        py: 1.6,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: 1.1,
        alignItems: 'center',
        textAlign: 'left',
        color: 'text.primary',
        transition: theme.transitions.create(['background-color', 'color'], {
          duration: theme.transitions.duration.shortest,
        }),
        '&:hover': { bgcolor: alpha(signal.tone, theme.palette.mode === 'dark' ? 0.14 : 0.055) },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      })}
    >
      <GlyphSurface size={34} variant="soft" tone={signal.tone}>
        <Icon size={17} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {t(`home.signals.${signal.key}.label`)}
        </Typography>
        <Typography
          component="p"
          sx={{ mt: 0.15, fontSize: 22, lineHeight: 1.25, fontWeight: 800, letterSpacing: 0 }}
        >
          {signal.value}
        </Typography>
      </Box>
      <ArrowRight size={16} color="currentColor" aria-hidden="true" />
    </ButtonBase>
  );
}

export function MessagingAttentionOverview({
  metrics,
  state,
  onOpenInbox,
  onOpenMentions,
  onOpenSaved,
}: {
  metrics: MessagingHome['metrics'];
  state: MessagingAttentionState;
  onOpenInbox: () => void;
  onOpenMentions: () => void;
  onOpenSaved: () => void;
}) {
  const { t } = useTranslation('messaging');
  const StateIcon = attentionIcons[state];
  const count = attentionCount(state, metrics);
  const stateKey = state.toLowerCase();
  const signals: Signal[] = [
    {
      key: 'mentions',
      value: metrics.mentions,
      icon: AtSign,
      tone: attentionTones.MENTIONS,
      onSelect: onOpenMentions,
    },
    {
      key: 'unread',
      value: metrics.unreadConversations,
      icon: Inbox,
      tone: attentionTones.UNREAD,
      onSelect: onOpenInbox,
    },
    {
      key: 'saved',
      value: metrics.savedItems,
      icon: Bookmark,
      tone: attentionTones.SAVED,
      onSelect: onOpenSaved,
    },
  ];

  return (
    <Box
      component="section"
      aria-labelledby="messaging-attention-title"
      aria-label={t('home.signalSummary', {
        unread: metrics.unreadConversations,
        mentions: metrics.mentions,
        saved: metrics.savedItems,
      })}
      data-testid="messaging-attention-overview"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(360px, 1.12fr) minmax(0, 1fr)' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={(theme) => ({
          minWidth: 0,
          p: { xs: 2.25, md: 3 },
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          gap: 1.6,
          alignContent: 'center',
          bgcolor: alpha(attentionTones[state], theme.palette.mode === 'dark' ? 0.11 : 0.045),
          borderRight: { xs: 0, lg: 1 },
          borderBottom: { xs: 1, lg: 0 },
          borderColor: 'divider',
        })}
      >
        <GlyphSurface size={46} variant="soft" tone={attentionTones[state]}>
          <StateIcon size={22} aria-hidden="true" />
        </GlyphSurface>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {t('home.attention.eyebrow')}
          </Typography>
          <Typography
            id="messaging-attention-title"
            component="h2"
            sx={{ mt: 0.3, fontSize: { xs: 20, md: 23 }, lineHeight: 1.3, fontWeight: 800 }}
          >
            {t(`home.attention.states.${stateKey}.title`, { count })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65, maxWidth: 560 }}>
            {t(`home.attention.states.${stateKey}.description`, {
              unread: metrics.unreadConversations,
              mentions: metrics.mentions,
              saved: metrics.savedItems,
            })}
          </Typography>
          <ActionButton
            intent={state === 'CLEAR' ? 'quiet' : 'secondary'}
            size="small"
            endIcon={<ArrowRight size={15} />}
            onClick={onOpenInbox}
            sx={{ mt: 1.5 }}
          >
            {t('home.attention.openInbox')}
          </ActionButton>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          '& > * + *': {
            borderTop: { xs: 1, sm: 0 },
            borderLeft: { xs: 0, sm: 1 },
            borderColor: 'divider',
          },
        }}
      >
        {signals.map((signal) => (
          <AttentionSignal key={signal.key} signal={signal} />
        ))}
      </Box>
    </Box>
  );
}

function conversationIcon(conversation: MessagingConversation) {
  if (conversation.visibility === 'SPACE') return Hash;
  if (conversation.conversationType === 'DIRECT') return AtSign;
  return MessageSquareText;
}

function conversationTone(conversation: MessagingConversation) {
  if (conversation.visibility === 'SPACE') return '#315FDB';
  if (conversation.conversationType === 'DIRECT') return '#7656B8';
  return '#16815F';
}

function FocusReasonChip({
  reason,
  unreadCount,
}: {
  reason: MessagingFocusReason;
  unreadCount: number;
}) {
  const { t } = useTranslation('messaging');
  const label =
    reason === 'UNREAD'
      ? t('home.focus.reasons.unread', { count: unreadCount })
      : t(`home.focus.reasons.${reason.toLowerCase()}`);
  return (
    <Chip
      size="small"
      variant={reason === 'UNREAD' ? 'filled' : 'outlined'}
      color={reason === 'UNREAD' ? 'primary' : 'default'}
      label={label}
      sx={{ height: 22 }}
    />
  );
}

function MessagingFocusConversation({ conversation }: { conversation: MessagingConversation }) {
  const { t, i18n } = useTranslation('messaging');
  const Icon = conversationIcon(conversation);
  const reason = messagingFocusReason(conversation);
  const protectedConversation =
    conversation.dataClassification === 'CONFIDENTIAL' ||
    conversation.dataClassification === 'RESTRICTED';

  return (
    <Box
      component={RouterLink}
      to={`/messages/inbox?conversation=${conversation.conversationId}`}
      data-testid="messaging-focus-conversation"
      sx={(theme) => ({
        minWidth: 0,
        minHeight: 96,
        px: { xs: 1.5, md: 2 },
        py: 1.5,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: 1.35,
        alignItems: 'start',
        position: 'relative',
        color: 'text.primary',
        textDecoration: 'none',
        bgcolor:
          conversation.unreadCount > 0 ? alpha(theme.palette.primary.main, 0.025) : 'transparent',
        transition: theme.transitions.create(['background-color', 'transform'], {
          duration: theme.transitions.duration.shortest,
        }),
        '&:hover': { bgcolor: 'action.hover', transform: 'translateY(-1px)' },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      })}
    >
      <GlyphSurface size={40} variant="soft" tone={conversationTone(conversation)}>
        <Icon size={19} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" gap={0.65} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" fontWeight={conversation.unreadCount > 0 ? 800 : 700}>
            {conversation.name ?? t('conversation.untitled')}
          </Typography>
          {conversation.pinned && <Pin size={13} aria-label={t('conversation.settings.pinned')} />}
          {conversation.favorite && (
            <Star
              size={13}
              fill="currentColor"
              color="var(--dwp-color-warning, #B7791F)"
              aria-label={t('conversation.settings.favorite')}
            />
          )}
          {protectedConversation && (
            <Chip
              icon={<LockKeyhole size={12} />}
              label={t(`classification.${conversation.dataClassification}`)}
              color={conversation.dataClassification === 'RESTRICTED' ? 'error' : 'warning'}
              variant="outlined"
              size="small"
              sx={{ height: 22 }}
            />
          )}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.45,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {protectedConversation
            ? t('home.focus.protectedPreview')
            : `${conversation.lastMessage?.senderName ? `${conversation.lastMessage.senderName}: ` : ''}${
                conversation.lastMessage?.body || conversation.topic || t('home.focus.noPreview')
              }`}
        </Typography>
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.85 }}>
          <FocusReasonChip reason={reason} unreadCount={conversation.unreadCount} />
          <Typography variant="caption" color="text.secondary">
            {t(`type.${conversation.conversationType}`)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('conversation.members', { count: conversation.memberCount })}
          </Typography>
        </Stack>
      </Box>
      <Stack alignItems="flex-end" spacing={1} sx={{ minWidth: 52 }}>
        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
          {messagingRelativeTime(
            conversation.lastMessageAt,
            i18n.resolvedLanguage ?? i18n.language
          )}
        </Typography>
        <ArrowRight size={16} aria-hidden="true" />
      </Stack>
    </Box>
  );
}

export function MessagingFocusQueue({
  conversations,
  loading,
  onOpenAll,
}: {
  conversations: MessagingConversation[];
  loading: boolean;
  onOpenAll: () => void;
}) {
  const { t } = useTranslation('messaging');

  return (
    <Box component="section" aria-labelledby="messaging-focus-title" sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
        gap={1}
        mb={1.25}
      >
        <Box>
          <Typography id="messaging-focus-title" component="h2" variant="h6" fontWeight={800}>
            {t('home.focus.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('home.focus.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} />}
          onClick={onOpenAll}
          sx={{ alignSelf: { xs: 'flex-end', sm: 'auto' } }}
        >
          {t('home.focus.open')}
        </ActionButton>
      </Stack>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
          '& > * + *': { borderTop: 1, borderColor: 'divider' },
        }}
      >
        {loading ? (
          <Stack spacing={1} sx={{ p: 1.5 }} aria-label={t('home.focus.loading')}>
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={78} />
            ))}
          </Stack>
        ) : conversations.length ? (
          conversations.map((conversation) => (
            <MessagingFocusConversation
              key={conversation.conversationId}
              conversation={conversation}
            />
          ))
        ) : (
          <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center', p: 2 }}>
            <GuidedEmptyState
              kind="empty"
              title={t('home.focus.emptyTitle')}
              description={t('home.focus.emptyDescription')}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function MessagingHomeSkeleton() {
  return (
    <Stack spacing={3} aria-hidden="true">
      <Skeleton variant="rounded" height={190} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 3,
          '@media (min-width: 1280px)': {
            gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.75fr)',
          },
        }}
      >
        <Skeleton variant="rounded" height={520} />
        <Stack spacing={2.5}>
          <Skeleton variant="rounded" height={280} />
          <Skeleton variant="rounded" height={270} />
        </Stack>
      </Box>
    </Stack>
  );
}
