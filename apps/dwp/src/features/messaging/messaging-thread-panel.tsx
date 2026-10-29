import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareReply, X } from 'lucide-react';
import { ActionButton, ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MessagingComposer } from './messaging-composer';
import { MessagingMessageRow } from './messaging-message-row';
import { useMessagingDisplayPreference } from './use-messaging-display-preference';
import { useMessagingReadReceipts } from './use-messaging-read-receipts';
import { useMessagingReadObserver } from './use-messaging-read-observer';
import {
  messagingMobileThreadDrawerLayout,
  messagingMobileThreadTransitionDuration,
} from './messaging-workspace-layout';

import type { MessagingThread } from './messaging-model';
import type { MessagingMentionDraft } from './messaging-composer-model';
import type { MessagingAttachmentQueue } from './use-messaging-attachment-queue';
import type { MessagingDraftPersistenceState } from './use-messaging-draft-continuity';
import type { MessagingConversation, MessagingMember } from '@dwp-frontend/shared-utils';

export function MessagingThreadPanel({
  open,
  desktop,
  thread,
  currentUserId,
  conversation,
  draft,
  draftMentions,
  members,
  allowMentionAll,
  onDraftChange,
  onDraftMentionsChange,
  onSend,
  onRetry,
  isSending,
  hasError,
  scheduleBusy,
  scheduleError,
  draftPersistenceState,
  onResolveDraftConflict,
  onSchedule,
  attachmentQueue,
  onClose,
  onReact,
  onSave,
  onTrackAsTask,
  onEdit,
  onDelete,
  highlightMessageId,
  loading = false,
  loadError = false,
  onRetryLoad,
}: {
  open: boolean;
  desktop: boolean;
  thread: MessagingThread | null;
  currentUserId?: number;
  conversation?: MessagingConversation;
  draft: string;
  draftMentions: MessagingMentionDraft[];
  members: MessagingMember[];
  allowMentionAll: boolean;
  onDraftChange: (value: string) => void;
  onDraftMentionsChange: (mentions: MessagingMentionDraft[]) => void;
  onSend: () => void;
  onRetry: () => void;
  isSending: boolean;
  hasError: boolean;
  scheduleBusy: boolean;
  scheduleError: boolean;
  draftPersistenceState: MessagingDraftPersistenceState;
  onResolveDraftConflict: (choice: 'SERVER' | 'LOCAL') => void;
  onSchedule: (input: { scheduledFor: string; displayTimeZone: string }) => Promise<boolean>;
  attachmentQueue: MessagingAttachmentQueue;
  onClose: () => void;
  onReact: (messageId: string, emoji: string, remove: boolean) => void;
  onSave: (message: MessagingThread['root']) => void;
  onTrackAsTask?: (message: MessagingThread['root']) => void;
  onEdit: (message: MessagingThread['root']) => void;
  onDelete: (message: MessagingThread['root']) => void;
  highlightMessageId?: string | null;
  loading?: boolean;
  loadError?: boolean;
  onRetryLoad?: () => void;
}) {
  const { t } = useTranslation('messaging');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const { preference: displayPreference } = useMessagingDisplayPreference(conversation);
  const receipts = useMessagingReadReceipts(
    conversation?.conversationId,
    thread ? [thread.root, ...thread.replies] : [],
    currentUserId,
    open
  );
  useMessagingReadObserver(
    scrollRef,
    conversation?.conversationId,
    thread ? [thread.root, ...thread.replies] : [],
    currentUserId,
    open
  );

  useEffect(() => {
    if (!open || !thread) return;
    if (highlightMessageId) return;
    if (!nearBottomRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [highlightMessageId, open, thread?.replies.length, thread]);

  const content = (
    <Box
      role="region"
      aria-label={t('thread.title')}
      sx={{
        width: '100%',
        maxWidth: '100%',
        height: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: { xs: 1, sm: 1.75 },
          py: { xs: 0.75, sm: 1.4 },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <MessageSquareReply size={18} color="var(--dwp-product-accent)" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h3" variant="subtitle1" fontWeight={850}>
            {t('thread.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {thread
              ? t('thread.replyCount', { count: thread.replies.length })
              : loadError
                ? t('thread.loadError')
                : t('thread.loading')}
          </Typography>
        </Box>
        <ActionIconButton label={t('thread.close')} onClick={onClose}>
          <X size={17} />
        </ActionIconButton>
      </Stack>

      <Box
        ref={scrollRef}
        onScroll={(event) => {
          const target = event.currentTarget;
          nearBottomRef.current =
            target.scrollHeight - target.scrollTop - target.clientHeight <= 48;
        }}
        sx={{ minWidth: 0, minHeight: 0, overflowX: 'hidden', overflowY: 'auto', px: 1.5, py: 1 }}
      >
        {!thread ? (
          loadError ? (
            <Alert
              severity="error"
              action={
                onRetryLoad ? (
                  <ActionButton intent="quiet" onClick={onRetryLoad}>
                    {t('actions.retry')}
                  </ActionButton>
                ) : undefined
              }
            >
              {t('thread.loadError')}
            </Alert>
          ) : (
            <Stack spacing={1} aria-label={t('thread.loading')} aria-busy="true">
              <Skeleton variant="rounded" height={92} />
              <Skeleton variant="rounded" height={72} />
              <Skeleton variant="rounded" height={72} />
            </Stack>
          )
        ) : (
          <>
            <Typography variant="overline" color="text.secondary">
              {t('thread.originalMessage')}
            </Typography>
            <MessagingMessageRow
              message={thread.root}
              receipt={receipts.get(thread.root.messageId)}
              mine={thread.root.senderUserId === currentUserId}
              display={{ ...displayPreference, effectiveLayoutMode: 'COLLABORATIVE' }}
              compact
              highlighted={thread.root.messageId === highlightMessageId}
              onReact={(emoji) =>
                onReact(
                  thread.root.messageId,
                  emoji,
                  thread.root.reactions.some(
                    (reaction) => reaction.emoji === emoji && reaction.mine
                  )
                )
              }
              onSave={() => onSave(thread.root)}
              onTrackAsTask={onTrackAsTask ? () => onTrackAsTask(thread.root) : undefined}
              onEdit={() => onEdit(thread.root)}
              onDelete={() => onDelete(thread.root)}
            />
            <Divider sx={{ my: 1.25 }} />
            <Typography variant="overline" color="text.secondary">
              {t('thread.replies')}
            </Typography>
            {loadError ? (
              <Alert
                severity="error"
                action={
                  onRetryLoad ? (
                    <ActionButton intent="quiet" onClick={onRetryLoad}>
                      {t('actions.retry')}
                    </ActionButton>
                  ) : undefined
                }
                sx={{ mt: 1 }}
              >
                {t('thread.loadError')}
              </Alert>
            ) : loading ? (
              <Stack spacing={1} sx={{ pt: 1 }} aria-label={t('thread.loading')}>
                <Skeleton variant="rounded" height={72} />
                <Skeleton variant="rounded" height={72} />
              </Stack>
            ) : thread.replies.length ? (
              thread.replies.map((reply) => (
                <Box
                  key={reply.messageId}
                  sx={{
                    contentVisibility: reply.messageId === highlightMessageId ? 'visible' : 'auto',
                    containIntrinsicSize: 'auto 72px',
                  }}
                >
                  <MessagingMessageRow
                    message={reply}
                    receipt={receipts.get(reply.messageId)}
                    mine={reply.senderUserId === currentUserId}
                    display={{ ...displayPreference, effectiveLayoutMode: 'COLLABORATIVE' }}
                    compact
                    highlighted={reply.messageId === highlightMessageId}
                    onReact={(emoji) =>
                      onReact(
                        reply.messageId,
                        emoji,
                        reply.reactions.some(
                          (reaction) => reaction.emoji === emoji && reaction.mine
                        )
                      )
                    }
                    onSave={() => onSave(reply)}
                    onTrackAsTask={onTrackAsTask ? () => onTrackAsTask(reply) : undefined}
                    onEdit={() => onEdit(reply)}
                    onDelete={() => onDelete(reply)}
                  />
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                {t('thread.empty')}
              </Typography>
            )}
          </>
        )}
      </Box>

      {thread ? (
        <Box
          sx={{
            px: { xs: 0.75, sm: 1.5 },
            pt: { xs: 0.5, sm: 1.5 },
            pb: { xs: 'calc(6px + env(safe-area-inset-bottom))', sm: 1.5 },
            minWidth: 0,
            boxSizing: 'border-box',
            overflow: 'hidden',
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <MessagingComposer
            compact
            autoFocus
            value={draft}
            onChange={onDraftChange}
            onSend={onSend}
            onRetry={onRetry}
            isSending={isSending}
            hasError={hasError}
            scheduleBusy={scheduleBusy}
            scheduleError={scheduleError}
            draftPersistenceState={draftPersistenceState}
            onResolveDraftConflict={onResolveDraftConflict}
            placeholder={t('thread.composerPlaceholder')}
            ariaLabel={t('thread.composerLabel')}
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
            onSchedule={onSchedule}
          />
        </Box>
      ) : null}
    </Box>
  );

  if (desktop) return content;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      transitionDuration={messagingMobileThreadTransitionDuration}
      ModalProps={{ keepMounted: true }}
      slotProps={{ paper: { sx: messagingMobileThreadDrawerLayout } }}
    >
      {content}
    </Drawer>
  );
}
