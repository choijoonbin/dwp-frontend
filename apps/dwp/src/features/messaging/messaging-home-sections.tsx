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
import {
  ActionButton,
  ErrorState,
  GlyphSurface,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { alpha } from '@mui/material/styles';

import {
  messagingFocusReason,
  type MessagingAttentionState,
  type MessagingFocusReason,
  type MessagingHomeFilter,
} from './messaging-home-model';
import { messagingRelativeTime } from './messaging-components';
import { messagingPlainTextPreview } from './messaging-message-body';
import { messagingVisualTokens } from './messaging-visual-model';

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
        minHeight: 126,
        px: 1,
        py: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.65,
        justifyContent: 'center',
        textAlign: 'center',
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
      <GlyphSurface size={30} variant="soft" tone={signal.tone}>
        <Icon size={15} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0, width: 1 }}>
        <Typography
          component="p"
          variant="h5"
          sx={{ fontWeight: 800, color: signal.value ? 'primary.main' : 'text.primary' }}
        >
          {signal.value}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
        >
          {t(`home.signals.${signal.key}.label`)}
        </Typography>
      </Box>
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
  const primaryAction =
    state === 'MENTIONS' ? onOpenMentions : state === 'SAVED' ? onOpenSaved : onOpenInbox;
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
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        '@container messaging-home-main (min-width: 600px)': {
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(250px, 1fr)',
        },
        border: 1,
        borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.14),
        borderRadius: messagingVisualTokens.radius.surface,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      })}
    >
      <Box
        sx={(theme) => ({
          minWidth: 0,
          p: { xs: 1.5, md: 1.75 },
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 1,
          alignContent: 'center',
          bgcolor: alpha(attentionTones[state], theme.palette.mode === 'dark' ? 0.08 : 0.025),
        })}
      >
        <Stack direction="row" gap={0.7} alignItems="center" color="success.main">
          <StateIcon size={15} aria-hidden="true" />
          <Typography variant="caption" fontWeight={700}>
            {t('home.attention.eyebrow')}
          </Typography>
        </Stack>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            id="messaging-attention-title"
            component="h2"
            variant="h6"
            sx={{ lineHeight: 1.45, fontWeight: 800, overflowWrap: 'anywhere' }}
          >
            {t(`home.attention.states.${stateKey}.title`, { count })}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, maxWidth: 560 }}>
            {t(`home.attention.states.${stateKey}.description`, {
              unread: metrics.unreadConversations,
              mentions: metrics.mentions,
              saved: metrics.savedItems,
            })}
          </Typography>
          <ActionButton
            intent={state === 'CLEAR' ? 'quiet' : 'primary'}
            size="small"
            endIcon={<ArrowRight size={15} />}
            onClick={primaryAction}
            sx={{ mt: 1.25 }}
          >
            {t(`home.attention.actions.${stateKey}`)}
          </ActionButton>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          alignSelf: 'center',
          p: 1,
          '& > * + *': {
            borderLeftStyle: 'solid',
            borderLeftWidth: 1,
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
  const tone = conversationTone(conversation);

  return (
    <Box
      component={RouterLink}
      to={`/messages/inbox?conversation=${conversation.conversationId}`}
      data-testid="messaging-focus-conversation"
      sx={(theme) => ({
        minWidth: 0,
        minHeight: 72,
        px: 1.5,
        py: 1,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        '@container messaging-home-main (min-width: 520px)': {
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        },
        gap: 1.15,
        alignItems: 'center',
        position: 'relative',
        color: 'text.primary',
        textDecoration: 'none',
        border: 1,
        borderColor: alpha(tone, conversation.unreadCount > 0 ? 0.24 : 0.14),
        borderRadius: messagingVisualTokens.radius.surface,
        bgcolor: 'background.paper',
        transition: theme.transitions.create(['background-color', 'border-color', 'transform'], {
          duration: theme.transitions.duration.shortest,
        }),
        '&:hover': {
          bgcolor: alpha(tone, 0.045),
          borderColor: alpha(tone, 0.34),
          transform: 'translateX(2px)',
        },
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
      <GlyphSurface size={36} variant="soft" tone={tone}>
        <Icon size={17} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" gap={0.65} alignItems="center" flexWrap="wrap">
          <Typography
            variant="body2"
            fontWeight={conversation.unreadCount > 0 ? 800 : 700}
            sx={{ overflowWrap: 'anywhere' }}
          >
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
          variant="caption"
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
                (conversation.lastMessage?.body
                  ? messagingPlainTextPreview(conversation.lastMessage.body)
                  : conversation.topic) || t('home.focus.noPreview')
              }`}
        </Typography>
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 0.55 }}>
          <Typography variant="caption" color="text.secondary">
            {t(`type.${conversation.conversationType}`)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('conversation.members', { count: conversation.memberCount })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {messagingRelativeTime(
              conversation.lastMessageAt,
              i18n.resolvedLanguage ?? i18n.language
            )}
          </Typography>
        </Stack>
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        sx={{
          gridColumn: '2',
          '@container messaging-home-main (min-width: 520px)': { gridColumn: 'auto' },
        }}
      >
        <FocusReasonChip reason={reason} unreadCount={conversation.unreadCount} />
        <ArrowRight size={15} aria-hidden="true" />
      </Stack>
    </Box>
  );
}

export function MessagingFocusQueue({
  conversations,
  loading,
  filter,
  onFilterChange,
  filterCounts,
  error,
  onRetry,
  onOpenAll,
}: {
  conversations: MessagingConversation[];
  loading: boolean;
  filter: MessagingHomeFilter;
  onFilterChange: (filter: MessagingHomeFilter) => void;
  filterCounts: Partial<Record<MessagingHomeFilter, number>>;
  error: boolean;
  onRetry: () => void;
  onOpenAll: () => void;
}) {
  const { t } = useTranslation('messaging');

  return (
    <Box component="section" aria-labelledby="messaging-focus-title" sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={1}
        mb={1.25}
      >
        <Box>
          <Typography
            id="messaging-focus-title"
            component="h2"
            variant="subtitle1"
            fontWeight={800}
          >
            {t('home.focus.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.35, display: 'block' }}>
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
      <Tabs
        value={filter}
        onChange={(_, next: MessagingHomeFilter) => onFilterChange(next)}
        variant="scrollable"
        scrollButtons={false}
        aria-label={t('home.focus.filters.label')}
        sx={{
          minHeight: 36,
          mb: 1.1,
          '& .MuiTab-root': {
            minWidth: 0,
            minHeight: 36,
            px: 1.35,
            py: 0.75,
            textTransform: 'none',
          },
          '& .MuiTabs-indicator': { height: 2 },
        }}
      >
        {(['ALL', 'MENTIONS', 'SPACE', 'DIRECT'] as const).map((value) => (
          <Tab
            key={value}
            value={value}
            label={
              <Stack direction="row" alignItems="center" spacing={0.65}>
                <span>{t(`home.focus.filters.${value}`)}</span>
                {filterCounts[value] !== undefined && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {filterCounts[value]}
                  </Typography>
                )}
              </Stack>
            }
          />
        ))}
      </Tabs>
      <Box>
        {error ? (
          <ErrorState
            title={t('home.focus.mentionsError')}
            onRetry={onRetry}
            retryLabel={t('actions.retry')}
            size="compact"
          />
        ) : loading ? (
          <Stack spacing={1} aria-label={t('home.focus.loading')}>
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={78} />
            ))}
          </Stack>
        ) : conversations.length ? (
          <Stack spacing={0.9}>
            {conversations.map((conversation) => (
              <MessagingFocusConversation
                key={conversation.conversationId}
                conversation={conversation}
              />
            ))}
          </Stack>
        ) : (
          <Box
            sx={{
              minHeight: 176,
              display: 'grid',
              placeItems: 'center',
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: messagingVisualTokens.radius.surface,
              bgcolor: 'background.paper',
            }}
          >
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
    <Box
      aria-hidden="true"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 1.5,
        '@media (min-width: 1280px)': {
          gridTemplateColumns: 'minmax(0, 1.58fr) minmax(308px, 0.76fr)',
        },
      }}
    >
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={180} />
        <Skeleton variant="rounded" height={450} />
      </Stack>
      <Stack spacing={1.25}>
        {[210, 220, 210].map((height, index) => (
          <Skeleton key={index} variant="rounded" height={height} />
        ))}
      </Stack>
    </Box>
  );
}
