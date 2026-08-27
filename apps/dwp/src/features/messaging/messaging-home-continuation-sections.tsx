import { useTranslation } from 'react-i18next';
import { ArrowRight, Bookmark, Hash, MessageSquarePlus } from 'lucide-react';
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

import { messagingRelativeTime } from './messaging-components';

import type {
  MessagingConversation,
  MessagingHome,
  MessagingSavedItem,
} from '@dwp-frontend/shared-utils';

function SpaceConversationLink({ conversation }: { conversation: MessagingConversation }) {
  const { t, i18n } = useTranslation('messaging');

  return (
    <Box
      component={RouterLink}
      to={`/messages/spaces?conversation=${conversation.conversationId}`}
      sx={(theme) => ({
        px: 1.75,
        py: 1.35,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
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
      <GlyphSurface size={32} variant="soft" tone="#16815F">
        <Hash size={16} aria-hidden="true" />
      </GlyphSurface>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={750} noWrap>
          {conversation.name ?? t('conversation.untitled')}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {conversation.linkedSpaceName || t('home.spaces.spaceLinked')}
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
  metrics,
  onOpenAll,
}: {
  conversations: MessagingConversation[];
  metrics: MessagingHome['metrics'];
  onOpenAll: () => void;
}) {
  const { t } = useTranslation('messaging');
  return (
    <Box component="section" aria-labelledby="messaging-spaces-title">
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography id="messaging-spaces-title" component="h2" variant="h6" fontWeight={800}>
                {t('home.spaces.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t('home.spaces.description')}
              </Typography>
            </Box>
            <ActionIconButton label={t('home.spaces.open')} size="small" onClick={onOpenAll}>
              <ArrowRight size={17} />
            </ActionIconButton>
          </Stack>
          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={t('home.spaces.spaceCount', { count: metrics.spaceChannels })}
            />
            <Chip
              size="small"
              variant="outlined"
              label={t('home.spaces.directCount', { count: metrics.directMessages })}
            />
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ '& > * + *': { borderTop: 1, borderColor: 'divider' } }}>
          {conversations.length ? (
            conversations.map((conversation) => (
              <SpaceConversationLink
                key={conversation.conversationId}
                conversation={conversation}
              />
            ))
          ) : (
            <Box sx={{ minHeight: 150, display: 'grid', placeItems: 'center', p: 2 }}>
              <GuidedEmptyState
                kind="empty"
                title={t('home.spaces.emptyTitle')}
                description={t('home.spaces.emptyDescription')}
              />
            </Box>
          )}
        </Box>
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
        px: 1.75,
        py: 1.35,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
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
        <Stack direction="row" gap={0.65} alignItems="center" sx={{ minWidth: 0 }}>
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
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.message.deletedAt ? t('message.deleted') : item.message.body}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
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
    <Box
      component="section"
      aria-labelledby="messaging-continue-title"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography id="messaging-continue-title" component="h2" variant="h6" fontWeight={800}>
              {t('home.continue.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('home.continue.description')}
            </Typography>
          </Box>
          <ActionIconButton label={t('home.continue.open')} size="small" onClick={onOpenAll}>
            <ArrowRight size={17} />
          </ActionIconButton>
        </Stack>
      </Box>
      <Divider />
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
        <Box sx={{ '& > * + *': { borderTop: 1, borderColor: 'divider' } }}>
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
      <Divider />
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
