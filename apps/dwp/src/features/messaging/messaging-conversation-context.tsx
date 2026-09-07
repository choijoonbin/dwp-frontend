import {
  ChevronDown,
  ChevronUp,
  MessageSquareReply,
  NotebookText,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { MessagingPersonLine, messagingRelativeTime } from './messaging-components';
import { buildMessagingContext } from './messaging-context-model';
import { messagingPlainTextPreview } from './messaging-message-body';
import { messagingVisualTokens } from './messaging-visual-model';

import type { MessagingConversationDetail, MessagingMessage } from '@dwp-frontend/shared-utils';

type MessagingConversationContextProps = {
  detail?: MessagingConversationDetail;
  messages: MessagingMessage[];
  onOpenThread: (messageId: string) => void;
  onJumpToMessage: (messageId: string) => void;
  onOpenMembers: () => void;
};

export function MessagingConversationContext({
  detail,
  messages,
  onOpenThread,
  onJumpToMessage,
  onOpenMembers,
}: MessagingConversationContextProps) {
  const { t, i18n } = useTranslation('messaging');
  const [briefExpanded, setBriefExpanded] = useState(true);
  const view = useMemo(
    () => buildMessagingContext(messages, detail?.members ?? []),
    [messages, detail?.members]
  );
  if (!detail)
    return (
      <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">
        {t('context.empty')}
      </Typography>
    );
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <Stack
      data-testid="messaging-context-rail"
      spacing={2.5}
      sx={{ minHeight: 1, px: 1.5, py: 1.75, bgcolor: 'background.paper' }}
    >
      <Box component="section" aria-labelledby="messaging-brief-title">
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <NotebookText size={16} aria-hidden="true" />
          <Typography
            id="messaging-brief-title"
            component="h2"
            variant="subtitle2"
            fontWeight="fontWeightBold"
            sx={{ flex: 1 }}
          >
            {t('context.catchUp')}
          </Typography>
          <ActionIconButton
            size="small"
            label={t(briefExpanded ? 'context.collapseBrief' : 'context.expandBrief')}
            aria-expanded={briefExpanded}
            aria-controls="messaging-brief-content"
            onClick={() => setBriefExpanded((current) => !current)}
          >
            {briefExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </ActionIconButton>
        </Stack>
        <Collapse in={briefExpanded} timeout={0}>
          <Box id="messaging-brief-content">
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('context.catchUpDescription')}
            </Typography>
            <Stack component="ol" spacing={0.75} sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {view.recentMessages.map((message, index) => (
                <Box component="li" key={message.messageId}>
                  <ButtonBase
                    onClick={() => onJumpToMessage(message.messageId)}
                    aria-label={t('context.jumpToMessage', { name: message.senderName })}
                    sx={(theme) => ({
                      display: 'grid',
                      gridTemplateColumns: '20px minmax(0, 1fr)',
                      gap: 0.65,
                      width: 1,
                      p: 1,
                      alignItems: 'start',
                      textAlign: 'left',
                      borderRadius: messagingVisualTokens.radius.control,
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.12 : 0.045
                      ),
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
                    })}
                  >
                    <Typography variant="caption" fontWeight="fontWeightBold" color="primary.main">
                      {index + 1}.
                    </Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 3,
                          overflow: 'hidden',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {messagingPlainTextPreview(message.body) || t('context.sharedContent')}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.5 }}
                      >
                        {message.senderName}
                      </Typography>
                    </Box>
                  </ButtonBase>
                </Box>
              ))}
            </Stack>
            {!view.recentMessages.length && (
              <Typography variant="caption" color="text.secondary">
                {t('context.noMessages')}
              </Typography>
            )}
          </Box>
        </Collapse>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 0.75,
            mt: 1.25,
          }}
        >
          {[
            t('context.unread', { count: detail.conversation.unreadCount }),
            t('context.replies', { count: view.replyTotal }),
          ].map((label) => (
            <Typography
              key={label}
              variant="caption"
              align="center"
              sx={{
                py: 0.7,
                border: 1,
                borderColor: 'divider',
                borderRadius: messagingVisualTokens.radius.compact,
              }}
            >
              {label}
            </Typography>
          ))}
        </Box>
      </Box>

      <Box component="section" aria-labelledby="messaging-threads-title">
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
          <MessageSquareReply size={15} aria-hidden="true" />
          <Typography
            id="messaging-threads-title"
            component="h2"
            variant="subtitle2"
            fontWeight="fontWeightBold"
          >
            {t('context.threads')}
          </Typography>
        </Stack>
        <Stack spacing={0.75}>
          {view.activeThreads.map((message) => (
            <ButtonBase
              key={message.messageId}
              onClick={() => onOpenThread(message.messageId)}
              aria-label={`${t('context.openThread')}: ${message.senderName}`}
              sx={(theme) => ({
                width: 1,
                p: 1,
                display: 'block',
                textAlign: 'left',
                borderLeft: 2,
                borderColor: alpha(theme.palette.primary.main, 0.35),
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                borderRadius: messagingVisualTokens.radius.compact,
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
              })}
            >
              <Stack direction="row" gap={0.5} justifyContent="space-between">
                <Typography variant="caption" fontWeight="fontWeightBold" noWrap>
                  {message.senderName}
                </Typography>
                <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                  {messagingRelativeTime(message.createdAt, language)}
                </Typography>
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  my: 0.4,
                }}
              >
                {messagingPlainTextPreview(message.body) || t('context.sharedContent')}
              </Typography>
              <Typography variant="caption" color="primary.main">
                {t('context.replies', { count: message.replyCount ?? 0 })}
              </Typography>
            </ButtonBase>
          ))}
          {!view.activeThreads.length && (
            <Typography variant="caption" color="text.secondary">
              {t('context.noThreads')}
            </Typography>
          )}
        </Stack>
      </Box>

      <Box component="section" aria-labelledby="messaging-members-title">
        <Stack direction="row" gap={0.75} alignItems="center" sx={{ mb: 1.25 }}>
          <UsersRound size={15} aria-hidden="true" />
          <Typography
            id="messaging-members-title"
            component="h2"
            variant="subtitle2"
            fontWeight="fontWeightBold"
            sx={{ flex: 1 }}
          >
            {t('context.members')}
          </Typography>
          <Typography variant="caption" color="success.main">
            {t('context.activeNow', { count: view.activeCount })}
          </Typography>
        </Stack>
        <Stack spacing={1.3}>
          {view.members.slice(0, 6).map((member) => (
            <MessagingPersonLine key={member.userId} person={member} />
          ))}
        </Stack>
        {['GROUP', 'CHANNEL'].includes(detail.conversation.conversationType) && (
          <ActionButton
            intent="quiet"
            size="small"
            fullWidth
            onClick={onOpenMembers}
            sx={{ mt: 1 }}
          >
            {t('context.allMembers', { count: detail.members.length })}
          </ActionButton>
        )}
      </Box>

      <Stack
        direction="row"
        spacing={0.75}
        alignItems="flex-start"
        sx={{ mt: 'auto !important', pt: 2.5, color: 'text.secondary' }}
      >
        <ShieldCheck size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
        <Typography variant="caption">
          {t(`classification.${detail.conversation.dataClassification}`)} ·{' '}
          {detail.conversation.linkedSpaceName
            ? t('context.spaceLinked', { space: detail.conversation.linkedSpaceName })
            : t('context.membershipBound')}
        </Typography>
      </Stack>
    </Stack>
  );
}
