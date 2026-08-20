import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquareReply, X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { MessagingComposer } from './messaging-composer';
import { MessagingMessageRow } from './messaging-components';

import type { MessagingThread } from './messaging-model';
import type { MessagingAttachmentQueue } from './use-messaging-attachment-queue';

export function MessagingThreadPanel({
  open,
  desktop,
  thread,
  currentUserId,
  draft,
  onDraftChange,
  onSend,
  onRetry,
  isSending,
  hasError,
  attachmentQueue,
  onClose,
  onReact,
  onSave,
  onEdit,
  onDelete,
  loading = false,
  loadError = false,
}: {
  open: boolean;
  desktop: boolean;
  thread: MessagingThread | null;
  currentUserId?: number;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  isSending: boolean;
  hasError: boolean;
  attachmentQueue: MessagingAttachmentQueue;
  onClose: () => void;
  onReact: (messageId: string, emoji: string, remove: boolean) => void;
  onSave: (message: MessagingThread['root']) => void;
  onEdit: (message: MessagingThread['root']) => void;
  onDelete: (message: MessagingThread['root']) => void;
  loading?: boolean;
  loadError?: boolean;
}) {
  const { t } = useTranslation('messaging');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (!open || !thread) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [open, thread?.replies.length, thread]);

  if (!thread) return null;

  const content = (
    <Box
      role="region"
      aria-label={t('thread.title')}
      sx={{
        width: desktop ? 1 : { xs: '100vw', sm: 440 },
        maxWidth: '100vw',
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
        sx={{ px: 1.75, py: 1.4, borderBottom: 1, borderColor: 'divider' }}
      >
        <MessageSquareReply size={18} color="var(--dwp-product-accent)" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h3" variant="subtitle1" fontWeight={850}>
            {t('thread.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('thread.replyCount', { count: thread.replies.length })}
          </Typography>
        </Box>
        <ActionIconButton label={t('thread.close')} onClick={onClose}>
          <X size={17} />
        </ActionIconButton>
      </Stack>

      <Box
        ref={scrollRef}
        sx={{ minWidth: 0, minHeight: 0, overflowX: 'hidden', overflowY: 'auto', px: 1.5, py: 1 }}
      >
        <Typography variant="overline" color="text.secondary">
          {t('thread.originalMessage')}
        </Typography>
        <MessagingMessageRow
          message={thread.root}
          mine={thread.root.senderUserId === currentUserId}
          compact
          onReact={(emoji) =>
            onReact(
              thread.root.messageId,
              emoji,
              thread.root.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine)
            )
          }
          onSave={() => onSave(thread.root)}
          onEdit={() => onEdit(thread.root)}
          onDelete={() => onDelete(thread.root)}
        />
        <Divider sx={{ my: 1.25 }} />
        <Typography variant="overline" color="text.secondary">
          {t('thread.replies')}
        </Typography>
        {loadError ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {t('thread.loadError')}
          </Alert>
        ) : loading ? (
          <Stack spacing={1} sx={{ pt: 1 }} aria-label={t('thread.loading')}>
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="rounded" height={72} />
          </Stack>
        ) : thread.replies.length ? (
          thread.replies.map((reply) => (
            <MessagingMessageRow
              key={reply.messageId}
              message={reply}
              mine={reply.senderUserId === currentUserId}
              compact
              onReact={(emoji) =>
                onReact(
                  reply.messageId,
                  emoji,
                  reply.reactions.some((reaction) => reaction.emoji === emoji && reaction.mine)
                )
              }
              onSave={() => onSave(reply)}
              onEdit={() => onEdit(reply)}
              onDelete={() => onDelete(reply)}
            />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {t('thread.empty')}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          p: 1.5,
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
          placeholder={t('thread.composerPlaceholder')}
          ariaLabel={t('thread.composerLabel')}
          attachments={attachmentQueue.items}
          attachmentBusy={attachmentQueue.busy}
          onAttachFiles={attachmentQueue.addFiles}
          onRetryAttachment={attachmentQueue.retry}
          onRemoveAttachment={attachmentQueue.remove}
        />
      </Box>
    </Box>
  );

  if (desktop) return content;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      transitionDuration={reducedMotion ? 0 : undefined}
      ModalProps={{ keepMounted: true }}
      slotProps={{ paper: { sx: { width: 1, maxWidth: 1, overflowX: 'hidden' } } }}
    >
      {content}
    </Drawer>
  );
}
