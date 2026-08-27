import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MessagingComposer } from './messaging-composer';
import { messagingTimelineSurfaceSx } from './messaging-display-model';
import { MessagingMessageRow } from './messaging-message-row';
import {
  buildMessagingTimelineItems,
  formatMessagingTimelineDate,
} from './messaging-timeline-model';
import { MessagingTypingIndicator } from './messaging-typing-indicator';
import { useMessagingDisplayPreference } from './use-messaging-display-preference';

import type {
  MessagingConversation,
  MessagingMember,
  MessagingMessage,
} from '@dwp-frontend/shared-utils';
import type { MessagingMentionDraft } from './messaging-composer-model';
import type { MessagingAttachmentQueue } from './use-messaging-attachment-queue';
import type { RefObject, UIEventHandler } from 'react';

type MessagingTimelinePaneProps = {
  messages: MessagingMessage[];
  conversation: MessagingConversation;
  currentUserId?: number;
  replyCounts: Map<string, number>;
  typingNames: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  draft: string;
  draftMentions: MessagingMentionDraft[];
  members: MessagingMember[];
  allowMentionAll: boolean;
  sending: boolean;
  sendError: boolean;
  attachmentQueue: MessagingAttachmentQueue;
  lastReadSequence?: number | null;
  newMessageCount: number;
  hasOlder: boolean;
  loadingOlder: boolean;
  olderLoadError: boolean;
  labels: {
    timeline: string;
    loadOlder: string;
    loadingOlder: string;
    olderLoadError: string;
    emptyTitle: string;
    emptyDescription: string;
    unread: string;
    newMessages: string;
  };
  onScroll: UIEventHandler<HTMLDivElement>;
  onLoadOlder: () => void;
  onJumpToLatest: () => void;
  onDraftChange: (value: string) => void;
  onDraftMentionsChange: (mentions: MessagingMentionDraft[]) => void;
  onOpenMeeting: () => void;
  onSend: () => void;
  onRetrySend: () => void;
  onReply: (messageId: string) => void;
  onReact: (messageId: string, emoji: string, remove: boolean) => void;
  onSave: (message: MessagingMessage) => void;
  onEdit: (message: MessagingMessage) => void;
  onDelete: (message: MessagingMessage) => void;
};

export function MessagingTimelinePane({
  messages,
  conversation,
  currentUserId,
  replyCounts,
  typingNames,
  scrollRef,
  draft,
  draftMentions,
  members,
  allowMentionAll,
  sending,
  sendError,
  attachmentQueue,
  lastReadSequence,
  newMessageCount,
  hasOlder,
  loadingOlder,
  olderLoadError,
  labels,
  onScroll,
  onLoadOlder,
  onJumpToLatest,
  onDraftChange,
  onDraftMentionsChange,
  onOpenMeeting,
  onSend,
  onRetrySend,
  onReply,
  onReact,
  onSave,
  onEdit,
  onDelete,
}: MessagingTimelinePaneProps) {
  const { i18n } = useTranslation('messaging');
  const { preference: displayPreference } = useMessagingDisplayPreference(conversation);
  const timelineItems = useMemo(
    () => buildMessagingTimelineItems(messages, currentUserId, lastReadSequence),
    [currentUserId, lastReadSequence, messages]
  );
  return (
    <>
      <Box
        ref={scrollRef}
        role="feed"
        aria-label={labels.timeline}
        aria-busy={loadingOlder}
        onScroll={onScroll}
        sx={(theme) => ({
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          px: { xs: 1.25, sm: 2 },
          py: 1.5,
          scrollBehavior: 'auto',
          ...messagingTimelineSurfaceSx(displayPreference.effectiveTheme, theme),
        })}
      >
        {hasOlder ? (
          <Box sx={{ display: 'grid', placeItems: 'center', pb: 1.25 }}>
            <ActionButton
              intent="quiet"
              startIcon={
                loadingOlder ? (
                  <CircularProgress size={15} color="inherit" />
                ) : (
                  <ArrowUp size={16} />
                )
              }
              disabled={loadingOlder}
              onClick={onLoadOlder}
            >
              {loadingOlder ? labels.loadingOlder : labels.loadOlder}
            </ActionButton>
          </Box>
        ) : null}
        {olderLoadError ? (
          <Alert severity="warning" sx={{ mb: 1.25 }}>
            {labels.olderLoadError}
          </Alert>
        ) : null}
        {messages.length ? (
          timelineItems.map((item) => {
            if (item.kind === 'date') {
              return (
                <Stack
                  key={item.key}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{ py: 1.25 }}
                  aria-hidden="true"
                >
                  <Divider sx={{ flex: 1 }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {formatMessagingTimelineDate(item.date, i18n.resolvedLanguage ?? i18n.language)}
                  </Typography>
                  <Divider sx={{ flex: 1 }} />
                </Stack>
              );
            }
            if (item.kind === 'unread') {
              return (
                <Stack
                  key={item.key}
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  role="separator"
                  aria-label={labels.unread}
                  sx={{ py: 1 }}
                >
                  <Divider sx={{ flex: 1, borderColor: 'primary.main' }} />
                  <Typography variant="caption" color="primary.main" fontWeight={800}>
                    {labels.unread}
                  </Typography>
                  <Divider sx={{ flex: 1, borderColor: 'primary.main' }} />
                </Stack>
              );
            }
            const { message } = item;
            return (
              <MessagingMessageRow
                key={item.key}
                message={message}
                mine={message.senderUserId === currentUserId}
                display={displayPreference}
                groupedWithPrevious={item.groupedWithPrevious}
                groupedWithNext={item.groupedWithNext}
                replyCount={message.replyCount ?? replyCounts.get(message.messageId) ?? 0}
                onReply={() => onReply(message.messageId)}
                onSave={() => onSave(message)}
                onEdit={() => onEdit(message)}
                onDelete={() => onDelete(message)}
                onReact={(emoji) =>
                  onReact(
                    message.messageId,
                    emoji,
                    message.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine)
                  )
                }
              />
            );
          })
        ) : (
          <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
            <GuidedEmptyState
              kind="empty"
              title={labels.emptyTitle}
              description={labels.emptyDescription}
            />
          </Box>
        )}
        {newMessageCount > 0 ? (
          <Box sx={{ position: 'sticky', bottom: 8, display: 'grid', placeItems: 'center', mt: 1 }}>
            <ActionButton
              intent="primary"
              startIcon={<ArrowDown size={16} />}
              onClick={onJumpToLatest}
              sx={{ boxShadow: 3 }}
            >
              {labels.newMessages}
            </ActionButton>
          </Box>
        ) : null}
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            p: 0,
            m: '-1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {newMessageCount > 0 ? labels.newMessages : ''}
        </Box>
      </Box>
      <Box
        sx={{
          p: 1.5,
          minWidth: 0,
          width: 1,
          maxWidth: 1,
          boxSizing: 'border-box',
          overflow: 'hidden',
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <MessagingTypingIndicator names={typingNames} />
        <MessagingComposer
          value={draft}
          onChange={onDraftChange}
          onSend={onSend}
          onRetry={onRetrySend}
          isSending={sending}
          hasError={sendError}
          attachments={attachmentQueue.items}
          attachmentBusy={attachmentQueue.busy}
          onAttachFiles={attachmentQueue.addFiles}
          onRetryAttachment={attachmentQueue.retry}
          onRemoveAttachment={attachmentQueue.remove}
          members={members}
          currentUserId={currentUserId}
          mentions={draftMentions}
          onMentionsChange={onDraftMentionsChange}
          allowMentionAll={allowMentionAll}
          onOpenMeeting={onOpenMeeting}
        />
      </Box>
    </>
  );
}
