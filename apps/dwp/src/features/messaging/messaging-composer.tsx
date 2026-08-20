import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, RotateCcw, Send } from 'lucide-react';
import { ActionButton, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MessagingAttachmentDrafts } from './messaging-attachment-drafts';
import { shouldSendMessagingMessage } from './messaging-model';
import { MESSAGING_ATTACHMENT_ACCEPT } from './use-messaging-attachment-queue';

import type { MessagingAttachmentDraft } from './use-messaging-attachment-queue';

export function MessagingComposer({
  value,
  onChange,
  onSend,
  onRetry,
  isSending,
  hasError,
  autoFocus = false,
  compact = false,
  placeholder,
  ariaLabel,
  attachments,
  attachmentBusy,
  onAttachFiles,
  onRetryAttachment,
  onRemoveAttachment,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onRetry?: () => void;
  isSending: boolean;
  hasError: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  attachments: MessagingAttachmentDraft[];
  attachmentBusy: boolean;
  onAttachFiles: (files: File[]) => void;
  onRetryAttachment: (localId: string) => void;
  onRemoveAttachment: (localId: string) => void;
}) {
  const { t } = useTranslation('messaging');
  const statusId = useId();
  const composingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drafting = Boolean(value.trim());
  const attachmentFailed = attachments.some(
    (attachment) => attachment.state === 'ERROR' || attachment.state === 'REJECTED'
  );
  const status = hasError
    ? t('conversation.composerStatus.error')
    : attachmentBusy
      ? t('conversation.attachments.uploading')
      : attachmentFailed
        ? t('conversation.attachments.reviewFailed')
        : isSending
          ? t('conversation.composerStatus.sending')
          : drafting
            ? t('conversation.composerStatus.drafting')
            : t('conversation.composerHint');

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      {hasError && (
        <Alert
          severity="error"
          action={
            onRetry ? (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RotateCcw size={14} />}
                onClick={onRetry}
              >
                {t('actions.retry')}
              </ActionButton>
            ) : undefined
          }
        >
          {t('conversation.sendError')}
        </Alert>
      )}
      <FormField
        fullWidth
        multiline
        minRows={compact ? 2 : 2}
        maxRows={compact ? 4 : 5}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder ?? t('conversation.composerPlaceholder')}
        onChange={(event) => onChange(event.target.value)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onKeyDown={(event) => {
          if (
            shouldSendMessagingMessage({
              key: event.key,
              shiftKey: event.shiftKey,
              isComposing: composingRef.current || event.nativeEvent.isComposing,
              defaultPrevented: event.defaultPrevented,
            })
          ) {
            event.preventDefault();
            onSend();
          }
        }}
        slotProps={{
          htmlInput: {
            'aria-label': ariaLabel ?? t('conversation.composerLabel'),
            'aria-describedby': statusId,
          },
        }}
        sx={{ maxWidth: '100%' }}
      />
      <MessagingAttachmentDrafts
        items={attachments}
        labels={{
          uploading: t('conversation.attachments.uploading'),
          ready: t('conversation.attachments.ready'),
          rejected: t('conversation.attachments.rejected'),
          error: t('conversation.attachments.error'),
          retry: t('conversation.attachments.retry'),
          remove: t('conversation.attachments.remove'),
        }}
        onRetry={onRetryAttachment}
        onRemove={onRemoveAttachment}
      />
      <Stack
        direction="row"
        spacing={1.25}
        justifyContent="space-between"
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept={MESSAGING_ATTACHMENT_ACCEPT}
            onChange={(event) => {
              onAttachFiles(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Paperclip size={15} />}
            disabled={isSending || attachments.length >= 10}
            onClick={() => fileInputRef.current?.click()}
            sx={{ minWidth: 0, flexShrink: 0 }}
          >
            {t('conversation.attachments.add')}
          </ActionButton>
          <Stack
            id={statusId}
            direction="row"
            spacing={0.7}
            alignItems="center"
            aria-live="polite"
            sx={{ minWidth: 0 }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 6,
                height: 6,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor:
                  hasError || attachmentFailed
                    ? 'error.main'
                    : isSending || attachmentBusy
                      ? 'warning.main'
                      : drafting
                        ? 'success.main'
                        : 'text.disabled',
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {status}
            </Typography>
          </Stack>
        </Stack>
        <ActionButton
          intent="primary"
          endIcon={isSending ? <CircularProgress size={15} /> : <Send size={16} />}
          disabled={!drafting || isSending || attachmentBusy}
          onClick={onSend}
          sx={{ minWidth: compact ? 92 : 108, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {isSending ? t('conversation.sending') : t('conversation.send')}
        </ActionButton>
      </Stack>
    </Stack>
  );
}
