import { ArrowUp } from 'lucide-react';
import { ActionButton, GuidedEmptyState } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { MessagingComposer } from './messaging-composer';
import { MessagingMessageRow } from './messaging-components';
import { MessagingTypingIndicator } from './messaging-typing-indicator';

import type { MessagingMessage } from '@dwp-frontend/shared-utils';
import type { RefObject, UIEventHandler } from 'react';

type MessagingTimelinePaneProps = {
  messages: MessagingMessage[];
  currentUserId?: number;
  replyCounts: Map<string, number>;
  typingNames: string[];
  scrollRef: RefObject<HTMLDivElement | null>;
  draft: string;
  sending: boolean;
  sendError: boolean;
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
  };
  onScroll: UIEventHandler<HTMLDivElement>;
  onLoadOlder: () => void;
  onDraftChange: (value: string) => void;
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
  currentUserId,
  replyCounts,
  typingNames,
  scrollRef,
  draft,
  sending,
  sendError,
  hasOlder,
  loadingOlder,
  olderLoadError,
  labels,
  onScroll,
  onLoadOlder,
  onDraftChange,
  onSend,
  onRetrySend,
  onReply,
  onReact,
  onSave,
  onEdit,
  onDelete,
}: MessagingTimelinePaneProps) {
  return (
    <>
      <Box
        ref={scrollRef}
        role="log"
        aria-label={labels.timeline}
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={loadingOlder}
        onScroll={onScroll}
        sx={{
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          px: { xs: 1.25, sm: 2 },
          py: 1.25,
          scrollBehavior: 'auto',
        }}
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
          messages.map((message) => (
            <MessagingMessageRow
              key={message.messageId}
              message={message}
              mine={message.senderUserId === currentUserId}
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
          ))
        ) : (
          <Box sx={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
            <GuidedEmptyState
              kind="empty"
              title={labels.emptyTitle}
              description={labels.emptyDescription}
            />
          </Box>
        )}
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
        />
      </Box>
    </>
  );
}
