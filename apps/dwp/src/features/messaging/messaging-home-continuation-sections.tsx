import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, AtSign, Bookmark, Hash, MessageSquarePlus, UsersRound } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import {
  ActionButton,
  ActionIconButton,
  GlyphSurface,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { alpha } from '@mui/material/styles';

import { MessagingPersonLine, messagingRelativeTime } from './messaging-components';
import { messagingPlainTextPreview } from './messaging-message-body';
import { messagingVisualTokens } from './messaging-visual-model';

import type {
  MessagingConversation,
  MessagingHome,
  MessagingPerson,
  MessagingSavedItem,
} from '@dwp-frontend/shared-utils';

export function MessagingPeoplePulse({
  people,
  onOpenDirectory,
  onOpenPerson,
  openingPerson,
}: {
  people: MessagingPerson[];
  onOpenDirectory: () => void;
  onOpenPerson: (userId: number) => void;
  openingPerson: boolean;
}) {
  const { t } = useTranslation('messaging');
  if (!people.length) return null;
  const visiblePeople = [...people]
    .sort(
      (left, right) =>
        Number(right.presenceState === 'AVAILABLE') - Number(left.presenceState === 'AVAILABLE')
    )
    .slice(0, 5);
  const availableCount = visiblePeople.filter(
    (person) => person.presenceState === 'AVAILABLE'
  ).length;

  return (
    <Box component="section" aria-labelledby="messaging-people-pulse-title" sx={{ minWidth: 0 }}>
      <Box sx={{ pb: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <GlyphSurface size={32} variant="soft" tone={messagingVisualTokens.tones.direct}>
              <UsersRound size={16} aria-hidden="true" />
            </GlyphSurface>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                id="messaging-people-pulse-title"
                component="h2"
                variant="subtitle1"
                fontWeight="fontWeightBold"
              >
                {t('home.people.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('home.people.availableSnapshot', { count: availableCount })}
              </Typography>
            </Box>
          </Stack>
          <ActionIconButton label={t('home.people.open')} size="small" onClick={onOpenDirectory}>
            <ArrowRight size={17} />
          </ActionIconButton>
        </Stack>
      </Box>
      <Stack spacing={0.4}>
        {visiblePeople.map((person) => (
          <ButtonBase
            key={person.userId}
            disabled={openingPerson}
            onClick={() => onOpenPerson(person.userId)}
            aria-label={t('home.people.messagePerson', { name: person.displayName })}
            sx={{
              display: 'block',
              width: 1,
              textAlign: 'left',
              p: 0.75,
              borderRadius: messagingVisualTokens.radius.compact,
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            <MessagingPersonLine person={person} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', pl: 5.4, mt: 0.2 }}
            >
              {t(`home.people.presence.${person.presenceState}`)}
            </Typography>
          </ButtonBase>
        ))}
      </Stack>
    </Box>
  );
}

function SpaceConversationLink({ conversation }: { conversation: MessagingConversation }) {
  const { t, i18n } = useTranslation('messaging');
  const direct = conversation.conversationType === 'DIRECT';
  const Icon = direct ? AtSign : Hash;

  return (
    <Box
      component={RouterLink}
      to={`/messages/${direct ? 'direct' : 'spaces'}?conversation=${conversation.conversationId}`}
      sx={(theme) => ({
        px: 1.1,
        py: 1.05,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 1,
        color: 'text.primary',
        textDecoration: 'none',
        borderRadius: messagingVisualTokens.radius.compact,
        bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.08 : 0.035),
        transition: theme.transitions.create(['background-color', 'transform'], {
          duration: theme.transitions.duration.shortest,
        }),
        '&:hover': {
          bgcolor: alpha(theme.palette.success.main, 0.055),
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
      <GlyphSurface size={32} variant="soft" tone="#16815F">
        <Icon size={16} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={750} noWrap>
          {conversation.name ?? t('conversation.untitled')}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {direct
            ? t('conversation.members', { count: conversation.memberCount })
            : conversation.linkedSpaceName || t('home.spaces.spaceLinked')}
        </Typography>
      </Box>
      <Stack alignItems="flex-end" spacing={0.35}>
        {conversation.unreadCount > 0 && (
          <Chip
            size="small"
            color="primary"
            label={conversation.unreadCount}
            aria-label={t('home.focus.reasons.unread', { count: conversation.unreadCount })}
            sx={{ height: 21 }}
          />
        )}
        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
          {messagingRelativeTime(
            conversation.lastMessageAt,
            i18n.resolvedLanguage ?? i18n.language
          )}
        </Typography>
      </Stack>
    </Box>
  );
}

export function MessagingSpacesPanel({
  conversations,
  directConversations,
  metrics,
  onOpenAll,
  onOpenDirect,
}: {
  conversations: MessagingConversation[];
  directConversations: MessagingConversation[];
  metrics: MessagingHome['metrics'];
  onOpenAll: () => void;
  onOpenDirect: () => void;
}) {
  const { t } = useTranslation('messaging');
  const [tab, setTab] = useState<'SPACE' | 'DIRECT'>('SPACE');
  const visibleConversations = tab === 'SPACE' ? conversations : directConversations;
  return (
    <Box component="section" aria-labelledby="messaging-spaces-title">
      <Box>
        <Box sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                id="messaging-spaces-title"
                component="h2"
                variant="subtitle1"
                fontWeight={800}
              >
                {t('home.spaces.title')}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.35, display: 'block' }}
              >
                {t('home.spaces.description')}
              </Typography>
            </Box>
            <ActionIconButton
              label={t(tab === 'SPACE' ? 'home.spaces.open' : 'home.spaces.openDirect')}
              size="small"
              onClick={tab === 'SPACE' ? onOpenAll : onOpenDirect}
            >
              <ArrowRight size={17} />
            </ActionIconButton>
          </Stack>
          <Tabs
            value={tab}
            onChange={(_, value: 'SPACE' | 'DIRECT') => setTab(value)}
            aria-label={t('home.spaces.scope')}
            sx={{
              minHeight: 32,
              mt: 1,
              '& .MuiTab-root': {
                minHeight: 32,
                minWidth: 0,
                px: 1.1,
                py: 0.6,
                textTransform: 'none',
              },
            }}
          >
            <Tab
              value="SPACE"
              label={t('home.spaces.spaceCount', { count: metrics.spaceChannels })}
            />
            <Tab
              value="DIRECT"
              label={t('home.spaces.directCount', { count: metrics.directMessages })}
            />
          </Tabs>
        </Box>
        <Stack spacing={0.6}>
          {visibleConversations.length ? (
            visibleConversations.map((conversation) => (
              <SpaceConversationLink
                key={conversation.conversationId}
                conversation={conversation}
              />
            ))
          ) : (
            <Box sx={{ minHeight: 150, display: 'grid', placeItems: 'center', p: 2 }}>
              <GuidedEmptyState
                kind="empty"
                title={t(
                  tab === 'SPACE' ? 'home.spaces.emptyTitle' : 'home.spaces.directEmptyTitle'
                )}
                description={t(
                  tab === 'SPACE'
                    ? 'home.spaces.emptyDescription'
                    : 'home.spaces.directEmptyDescription'
                )}
              />
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

function SavedItemLink({ item }: { item: MessagingSavedItem }) {
  const { t, i18n } = useTranslation('messaging');
  return (
    <Box
      component={RouterLink}
      to={`/messages/inbox?conversation=${item.message.conversationId}`}
      sx={(theme) => ({
        px: 1.1,
        py: 1.35,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        alignItems: 'start',
        gap: 1,
        color: 'text.primary',
        textDecoration: 'none',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <GlyphSurface size={32} variant="soft" tone="#A86209">
        <Bookmark size={16} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" gap={0.65} alignItems="center" flexWrap="wrap" sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={750} noWrap>
            {item.conversationName ?? t(`type.${item.conversationType}`)}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {item.message.senderName}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            mt: 0.35,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflowWrap: 'anywhere',
          }}
        >
          {item.message.deletedAt
            ? t('message.deleted')
            : messagingPlainTextPreview(item.message.body)}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        whiteSpace="nowrap"
        sx={{ gridColumn: 2 }}
      >
        {messagingRelativeTime(item.savedAt, i18n.resolvedLanguage ?? i18n.language)}
      </Typography>
    </Box>
  );
}

export function MessagingContinuePanel({
  items,
  loading,
  error,
  onRetry,
  onOpenAll,
  onOpenDirectory,
}: {
  items: MessagingSavedItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenAll: () => void;
  onOpenDirectory: () => void;
}) {
  const { t } = useTranslation('messaging');
  return (
    <Box component="section" aria-labelledby="messaging-continue-title" sx={{ minWidth: 0 }}>
      <Box sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              id="messaging-continue-title"
              component="h2"
              variant="subtitle1"
              fontWeight={800}
            >
              {t('home.continue.title')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.35, display: 'block' }}
            >
              {t('home.continue.description')}
            </Typography>
          </Box>
          <ActionIconButton label={t('home.continue.open')} size="small" onClick={onOpenAll}>
            <ArrowRight size={17} />
          </ActionIconButton>
        </Stack>
      </Box>
      {loading ? (
        <Stack spacing={1} sx={{ p: 1.5 }} aria-label={t('home.continue.loading')}>
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} variant="rounded" height={62} />
          ))}
        </Stack>
      ) : error ? (
        <Alert
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={onRetry}>
              {t('actions.retry')}
            </ActionButton>
          }
          sx={{ m: 1.5 }}
        >
          {t('home.continue.loadError')}
        </Alert>
      ) : items.length ? (
        <Box
          sx={{
            bgcolor: 'action.hover',
            borderRadius: messagingVisualTokens.radius.compact,
            '& > * + *': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          {items.map((item) => (
            <SavedItemLink
              key={`${item.message.conversationId}:${item.message.messageId}`}
              item={item}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ minHeight: 145, display: 'grid', placeItems: 'center', p: 2 }}>
          <GuidedEmptyState
            kind="empty"
            title={t('home.continue.emptyTitle')}
            description={t('home.continue.emptyDescription')}
          />
        </Box>
      )}
      <Divider sx={{ mt: 1.5 }} />
      <ButtonBase
        onClick={onOpenDirectory}
        sx={{ width: 1, px: 2, py: 1.25, justifyContent: 'space-between', textAlign: 'left' }}
      >
        <Stack direction="row" spacing={0.8} alignItems="center">
          <MessageSquarePlus size={16} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Typography variant="body2" fontWeight={700}>
            {t('home.continue.startDirect')}
          </Typography>
        </Stack>
        <ArrowRight size={16} aria-hidden="true" />
      </ButtonBase>
    </Box>
  );
}
