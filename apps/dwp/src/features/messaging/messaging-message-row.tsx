import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, MessageSquareReply, Pencil, SmilePlus, Trash2 } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { MessagingAttachmentList } from './messaging-attachment-list';
import { messagingInitials, messagingRelativeTime } from './messaging-components';
import { MessagingExpressionPicker } from './messaging-expression-picker';
import { isMessagingTimestampVisible } from './messaging-display-model';
import { MessagingMessageBody } from './messaging-message-body';

import type {
  MessagingConversationDisplayPreference,
  MessagingMessage,
} from '@dwp-frontend/shared-utils';

type MessagingMessageRowProps = {
  message: MessagingMessage;
  mine: boolean;
  display: MessagingConversationDisplayPreference;
  groupedWithPrevious?: boolean;
  groupedWithNext?: boolean;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  replyCount?: number;
  onSave?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
};

export function MessagingMessageRow({
  message,
  mine,
  display,
  groupedWithPrevious = false,
  groupedWithNext = false,
  onReact,
  onReply,
  replyCount = 0,
  onSave,
  onEdit,
  onDelete,
  compact = false,
}: MessagingMessageRowProps) {
  const { t, i18n } = useTranslation('messaging');
  const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const unavailable = t('message.connectionRequired');
  const conversational = display.effectiveLayoutMode === 'CONVERSATIONAL';
  const dense = compact || display.effectiveDensity === 'COMPACT';
  const alignRight = conversational && mine;
  const showAvatar = display.showAvatars && !groupedWithPrevious && (!mine || !conversational);
  const showTimestamp = isMessagingTimestampVisible(display.timestampMode, groupedWithPrevious);
  const language = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const absoluteTime = formatDate(
    message.createdAt,
    { dateStyle: 'medium', timeStyle: 'short' },
    language
  );

  if (message.messageKind === 'SYSTEM') {
    return (
      <Box component="article" aria-describedby={bodyId} sx={{ py: dense ? 0.5 : 0.8, px: 2 }}>
        <Typography
          id={bodyId}
          variant="caption"
          color="text.secondary"
          textAlign="center"
          sx={{ display: 'block' }}
        >
          {message.body}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="article"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      sx={{
        display: 'flex',
        justifyContent: alignRight ? 'flex-end' : 'flex-start',
        gap: dense ? 0.8 : 1.1,
        px: { xs: 0.25, sm: conversational ? 1 : 0.5 },
        pt: groupedWithPrevious ? (dense ? 0.15 : 0.25) : dense ? 0.8 : 1.15,
        pb: groupedWithNext ? 0 : dense ? 0.45 : 0.7,
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
      {!alignRight ? (
        <Box sx={{ width: display.showAvatars ? 34 : 0, flexShrink: 0 }}>
          {showAvatar ? (
            <Avatar sx={{ width: 34, height: 34, fontSize: 11, fontWeight: 800 }}>
              {messagingInitials(message.senderName)}
            </Avatar>
          ) : null}
        </Box>
      ) : null}
      <Box
        sx={{
          minWidth: 0,
          maxWidth: conversational ? { xs: '86%', sm: 'min(72%, 680px)' } : 840,
          flex: conversational ? '0 1 auto' : '1 1 auto',
          position: 'relative',
        }}
      >
        {!groupedWithPrevious ? (
          <Stack
            id={titleId}
            direction="row"
            spacing={0.8}
            alignItems="baseline"
            justifyContent={alignRight ? 'flex-end' : 'flex-start'}
            sx={{ minHeight: dense ? 18 : 20 }}
          >
            <Typography variant="body2" fontWeight={780}>
              {mine ? t('message.me') : message.senderName}
            </Typography>
            {showTimestamp ? (
              <Tooltip title={absoluteTime}>
                <Typography
                  component="time"
                  dateTime={message.createdAt}
                  variant="caption"
                  color="text.secondary"
                >
                  {messagingRelativeTime(message.createdAt, i18n.resolvedLanguage ?? i18n.language)}
                </Typography>
              </Tooltip>
            ) : null}
            {message.editedAt && !message.deletedAt ? (
              <Typography variant="caption" color="text.secondary">
                {t('message.edited')}
              </Typography>
            ) : null}
          </Stack>
        ) : showTimestamp ? (
          <Tooltip title={absoluteTime}>
            <Typography
              component="time"
              dateTime={message.createdAt}
              variant="caption"
              color="text.disabled"
              sx={{ display: 'block', textAlign: alignRight ? 'right' : 'left', mb: 0.2 }}
            >
              {messagingRelativeTime(message.createdAt, i18n.resolvedLanguage ?? i18n.language)}
            </Typography>
          </Tooltip>
        ) : null}
        <Box
          id={bodyId}
          sx={(theme) => ({
            mt: groupedWithPrevious ? 0 : 0.35,
            px: conversational ? (dense ? 1.15 : 1.4) : 0,
            py: conversational ? (dense ? 0.75 : 0.95) : dense ? 0.15 : 0.25,
            border: conversational ? 1 : 0,
            borderColor: conversational
              ? mine
                ? alpha(theme.palette.primary.main, 0.14)
                : alpha(theme.palette.divider, 0.72)
              : 'transparent',
            borderRadius: conversational ? 1 : 0,
            bgcolor: conversational
              ? mine
                ? 'var(--msg-mine-surface)'
                : 'var(--msg-other-surface)'
              : 'transparent',
            boxShadow:
              conversational && !mine
                ? `0 5px 18px ${alpha(theme.palette.common.black, 0.035)}`
                : 'none',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          })}
        >
          {message.body || message.deletedAt ? (
            <Typography
              variant="body2"
              lineHeight={dense ? 1.5 : 1.62}
              color={message.deletedAt ? 'text.secondary' : 'text.primary'}
              fontStyle={message.deletedAt ? 'italic' : 'normal'}
            >
              {message.deletedAt ? (
                t('message.deleted')
              ) : (
                <MessagingMessageBody body={message.body} mentions={message.mentions} />
              )}
            </Typography>
          ) : null}
          {!message.deletedAt && (message.attachments?.length ?? 0) > 0 ? (
            <MessagingAttachmentList
              conversationId={message.conversationId}
              attachments={message.attachments}
            />
          ) : null}
        </Box>
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 0.45, justifyContent: alignRight ? 'flex-end' : 'flex-start' }}
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
                variant="outlined"
                onClick={() => onReact(reaction.emoji)}
                sx={{
                  height: 24,
                  cursor: 'pointer',
                  bgcolor: reaction.mine ? 'var(--msg-reaction-surface)' : 'transparent',
                  borderColor: reaction.mine ? 'primary.main' : 'divider',
                }}
              />
            </Tooltip>
          ))}
          {replyCount > 0 && onReply ? (
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
              sx={{ height: 24, cursor: 'pointer', bgcolor: 'transparent' }}
            />
          ) : null}
        </Stack>
        {!message.deletedAt ? (
          <Stack
            className="dwp-message-actions"
            direction="row"
            spacing={0.1}
            sx={(theme) => ({
              position: { xs: 'static', md: 'absolute' },
              top: { md: groupedWithPrevious ? -7 : -4 },
              right: { md: alignRight ? 'auto' : 0 },
              left: { md: alignRight ? 0 : 'auto' },
              zIndex: 1,
              width: 'fit-content',
              mt: { xs: 0.5, md: 0 },
              ml: { xs: alignRight ? 'auto' : 0, md: 0 },
              p: { xs: 0, md: 0.2 },
              border: 1,
              borderColor: { xs: 'transparent', md: 'divider' },
              borderRadius: 1,
              bgcolor: { xs: 'transparent', md: 'background.paper' },
              boxShadow: {
                xs: 'none',
                md: `0 8px 24px ${alpha(theme.palette.common.black, 0.09)}`,
              },
            })}
          >
            <ActionIconButton
              label={t('message.addReaction')}
              onClick={(event) => setReactionAnchor(event.currentTarget)}
              size="small"
            >
              <SmilePlus size={15} />
            </ActionIconButton>
            {onReply ? (
              <ActionIconButton label={t('message.reply')} onClick={onReply} size="small">
                <MessageSquareReply size={15} />
              </ActionIconButton>
            ) : null}
            <ActionIconButton
              label={t('message.save')}
              tooltip={onSave ? t('message.save') : unavailable}
              onClick={onSave}
              disabled={!onSave}
              size="small"
            >
              <Bookmark size={15} />
            </ActionIconButton>
            {mine ? (
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
            ) : null}
          </Stack>
        ) : null}
      </Box>
      <MessagingExpressionPicker
        mode="reaction"
        anchorEl={reactionAnchor}
        open={Boolean(reactionAnchor)}
        onClose={() => setReactionAnchor(null)}
        onSelect={(expression) => onReact(expression.value)}
      />
    </Box>
  );
}
