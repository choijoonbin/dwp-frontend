import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bookmark,
  MessageSquareReply,
  MoreHorizontal,
  Pencil,
  SmilePlus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { MessagingAttachmentList } from './messaging-attachment-list';
import { messagingInitials, messagingRelativeTime } from './messaging-components';
import { MessagingExpressionPicker } from './messaging-expression-picker';
import { isMessagingTimestampVisible } from './messaging-display-model';
import { MessagingMessageBody } from './messaging-message-body';
import { MessagingReadReceiptButton } from './messaging-read-receipt';
import { messagingVisualTone, messagingVisualTokens } from './messaging-visual-model';

import type {
  MessagingConversationDisplayPreference,
  MessagingMessage,
  MessagingReadReceipt,
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
  receipt?: MessagingReadReceipt;
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
  receipt,
}: MessagingMessageRowProps) {
  const { t, i18n } = useTranslation('messaging');
  const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null);
  const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const conversational = display.effectiveLayoutMode === 'CONVERSATIONAL';
  const dense = compact || display.effectiveDensity === 'COMPACT';
  const alignRight = conversational && mine;
  const showAvatar = display.showAvatars && !groupedWithPrevious && (!mine || !conversational);
  const showTimestamp = isMessagingTimestampVisible(display.timestampMode, groupedWithPrevious);
  const language = resolveSupportedLocale(i18n.resolvedLanguage ?? i18n.language);
  const visualTone = messagingVisualTone(message.senderUserId);
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
      data-msg-receipt-id={message.messageId}
      tabIndex={-1}
      sx={(theme) => ({
        display: 'flex',
        justifyContent: alignRight ? 'flex-end' : 'flex-start',
        gap: dense ? 0.8 : 1.1,
        px: { xs: 0.25, sm: conversational ? 1 : 0.5 },
        pt: groupedWithPrevious ? (dense ? 0.15 : 0.25) : dense ? 0.8 : 1.15,
        pb: groupedWithNext ? 0 : dense ? 0.45 : 0.7,
        position: 'relative',
        borderRadius: messagingVisualTokens.radius.control,
        transition: theme.transitions.create('background-color', {
          duration: theme.transitions.duration.shortest,
        }),
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.028) },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
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
          transition: 'none',
          '& .dwp-message-actions': { transition: 'none', transform: 'none' },
        },
      })}
    >
      {!alignRight ? (
        <Box sx={{ width: display.showAvatars ? 34 : 0, flexShrink: 0 }}>
          {showAvatar ? (
            <Avatar
              sx={(theme) => ({
                width: 34,
                height: 34,
                fontSize: 11,
                fontWeight: 800,
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? alpha(visualTone.foreground, 0.3)
                    : visualTone.surface,
                color: theme.palette.mode === 'dark' ? visualTone.surface : visualTone.foreground,
              })}
            >
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
          pr: { xs: alignRight ? 0 : 4.25, md: 0 },
          pl: { xs: alignRight ? 4.25 : 0, md: 0 },
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
            <Typography variant="body2" fontWeight={740}>
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
          {message.messageKind === 'AI_PROPOSAL' && !message.deletedAt ? (
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 0.65 }}>
              <Sparkles size={14} color="var(--dwp-product-accent)" aria-hidden="true" />
              <Typography variant="caption" color="primary.main" fontWeight="fontWeightBold">
                {t('message.aiProposal')}
              </Typography>
            </Stack>
          ) : null}
          {message.body || message.deletedAt ? (
            <Typography
              component="div"
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
                  bgcolor: reaction.mine
                    ? 'var(--msg-reaction-surface)'
                    : alpha(visualTone.foreground, 0.055),
                  borderColor: reaction.mine ? 'primary.main' : alpha(visualTone.foreground, 0.18),
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
          {mine && message.messageKind === 'USER' && !message.deletedAt ? (
            <MessagingReadReceiptButton message={message} receipt={receipt} />
          ) : null}
        </Stack>
        {!message.deletedAt ? (
          <Stack
            className="dwp-message-actions"
            direction="row"
            spacing={0.1}
            sx={(theme) => ({
              position: 'absolute',
              top: { xs: groupedWithPrevious ? -3 : -5, md: groupedWithPrevious ? -7 : -4 },
              right: alignRight ? 'auto' : 0,
              left: alignRight ? 0 : 'auto',
              zIndex: 1,
              width: 'fit-content',
              mt: 0,
              ml: 0,
              p: { xs: 0, md: 0.2 },
              border: 1,
              borderColor: { xs: 'transparent', md: 'divider' },
              borderRadius: 1.25,
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
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              <SmilePlus size={15} />
            </ActionIconButton>
            {onReply ? (
              <ActionIconButton
                label={t('message.reply')}
                onClick={onReply}
                size="small"
                sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              >
                <MessageSquareReply size={15} />
              </ActionIconButton>
            ) : null}
            <ActionIconButton
              label={t('message.moreActions')}
              onClick={(event) => setActionAnchor(event.currentTarget)}
              size="small"
            >
              <MoreHorizontal size={16} />
            </ActionIconButton>
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
      <Menu
        anchorEl={actionAnchor}
        open={Boolean(actionAnchor)}
        onClose={() => setActionAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            const anchor = actionAnchor;
            setActionAnchor(null);
            setReactionAnchor(anchor);
          }}
        >
          <ListItemIcon>
            <SmilePlus size={16} />
          </ListItemIcon>
          {t('message.addReaction')}
        </MenuItem>
        {onReply ? (
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onReply();
            }}
          >
            <ListItemIcon>
              <MessageSquareReply size={16} />
            </ListItemIcon>
            {t('message.reply')}
          </MenuItem>
        ) : null}
        {onSave ? (
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onSave();
            }}
          >
            <ListItemIcon>
              <Bookmark size={16} />
            </ListItemIcon>
            {t('message.save')}
          </MenuItem>
        ) : null}
        {mine && onEdit ? (
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onEdit();
            }}
          >
            <ListItemIcon>
              <Pencil size={16} />
            </ListItemIcon>
            {t('message.edit')}
          </MenuItem>
        ) : null}
        {mine && onDelete ? (
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onDelete();
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon sx={{ color: 'error.main' }}>
              <Trash2 size={16} />
            </ListItemIcon>
            {t('message.delete')}
          </MenuItem>
        ) : null}
      </Menu>
    </Box>
  );
}
