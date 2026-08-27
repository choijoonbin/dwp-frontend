import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AtSign, Paperclip, RotateCcw, Send, SmilePlus, Video } from 'lucide-react';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  buildMessagingMentionOptions,
  pruneMessagingMentions,
  replaceMessagingComposerRange,
  resolveMessagingMentionQuery,
  type MessagingMentionDraft,
  type MessagingMentionOption,
} from './messaging-composer-model';
import { MessagingAttachmentDrafts } from './messaging-attachment-drafts';
import { MessagingExpressionPicker } from './messaging-expression-picker';
import { MessagingMentionMenu } from './messaging-mention-menu';
import { shouldSendMessagingMessage } from './messaging-model';
import { MESSAGING_ATTACHMENT_ACCEPT } from './use-messaging-attachment-queue';

import type { MessagingMember } from '@dwp-frontend/shared-utils';
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
  members = [],
  currentUserId,
  mentions = [],
  onMentionsChange,
  allowMentionAll = false,
  onOpenMeeting,
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
  members?: MessagingMember[];
  currentUserId?: number;
  mentions?: MessagingMentionDraft[];
  onMentionsChange?: (mentions: MessagingMentionDraft[]) => void;
  allowMentionAll?: boolean;
  onOpenMeeting?: () => void;
}) {
  const { t, i18n } = useTranslation('messaging');
  const statusId = useId();
  const mentionListboxId = useId();
  const composingRef = useRef(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [expressionAnchor, setExpressionAnchor] = useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] =
    useState<ReturnType<typeof resolveMessagingMentionQuery>>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const hasReadyAttachment = attachments.some((attachment) => attachment.state === 'READY');
  const drafting = Boolean(value.trim() || hasReadyAttachment);
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
  const korean = (i18n.resolvedLanguage ?? i18n.language).startsWith('ko');
  const mentionOptions = useMemo(
    () =>
      buildMessagingMentionOptions({
        members,
        currentUserId,
        allowMentionAll,
        query: mentionQuery?.query ?? '',
        allLabel: t('mentions.everyone'),
        allToken: korean ? '@모두' : '@everyone',
      }),
    [allowMentionAll, currentUserId, korean, members, mentionQuery?.query, t]
  );

  const focusAt = (caret: number) => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
    });
  };
  const updateMentionState = (nextValue: string, caret: number) => {
    const nextMentions = pruneMessagingMentions(nextValue, mentions);
    if (nextMentions.length !== mentions.length) onMentionsChange?.(nextMentions);
    setMentionQuery(resolveMessagingMentionQuery(nextValue, caret));
    setMentionActiveIndex(0);
  };
  const selectMention = (option: MessagingMentionOption) => {
    if (!mentionQuery) return;
    const replacement = replaceMessagingComposerRange(
      value,
      mentionQuery.start,
      mentionQuery.end,
      `${option.token} `
    );
    const retained = pruneMessagingMentions(replacement.value, mentions).filter(
      (mention) => mention.token !== option.token
    );
    onChange(replacement.value);
    onMentionsChange?.([...retained, { token: option.token, userIds: option.userIds }]);
    setMentionQuery(null);
    focusAt(replacement.caret);
  };
  const startMention = () => {
    const caret = inputRef.current?.selectionStart ?? value.length;
    const needsSpace = caret > 0 && !/\s/u.test(value.charAt(caret - 1));
    const insertion = `${needsSpace ? ' ' : ''}@`;
    const replacement = replaceMessagingComposerRange(value, caret, caret, insertion);
    const queryStart = caret + (needsSpace ? 1 : 0);
    onChange(replacement.value);
    setMentionQuery({ start: queryStart, end: replacement.caret, query: '' });
    setMentionActiveIndex(0);
    focusAt(replacement.caret);
  };
  const insertExpression = (expression: { value: string; stamp?: boolean }) => {
    const start = inputRef.current?.selectionStart ?? value.length;
    const end = inputRef.current?.selectionEnd ?? start;
    const prefix = expression.stamp && start > 0 && !/\s/u.test(value.charAt(start - 1)) ? ' ' : '';
    const suffix = expression.stamp ? ' ' : '';
    const replacement = replaceMessagingComposerRange(
      value,
      start,
      end,
      `${prefix}${expression.value}${suffix}`
    );
    onChange(replacement.value);
    onMentionsChange?.(pruneMessagingMentions(replacement.value, mentions));
    setMentionQuery(null);
    focusAt(replacement.caret);
  };

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
      <Box ref={composerRef} sx={{ minWidth: 0 }}>
        <FormField
          fullWidth
          multiline
          inputRef={inputRef}
          minRows={1}
          maxRows={compact ? 4 : 5}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder ?? t('conversation.composerPlaceholder')}
          onChange={(event) => {
            onChange(event.target.value);
            updateMentionState(
              event.target.value,
              event.target.selectionStart ?? event.target.value.length
            );
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            const input = inputRef.current;
            updateMentionState(input?.value ?? value, input?.selectionStart ?? value.length);
          }}
          onKeyDown={(event) => {
            if (mentionQuery) {
              if (event.key === 'Escape') {
                event.preventDefault();
                setMentionQuery(null);
                return;
              }
              if (mentionOptions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                const direction = event.key === 'ArrowDown' ? 1 : -1;
                setMentionActiveIndex(
                  (current) => (current + direction + mentionOptions.length) % mentionOptions.length
                );
                return;
              }
              if (mentionOptions.length && event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                selectMention(mentionOptions[mentionActiveIndex] ?? mentionOptions[0]!);
                return;
              }
            }
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
              role: mentionQuery ? 'combobox' : undefined,
              'aria-label': ariaLabel ?? t('conversation.composerLabel'),
              'aria-describedby': statusId,
              'aria-autocomplete': mentionQuery ? 'list' : undefined,
              'aria-expanded': mentionQuery ? true : undefined,
              'aria-controls': mentionQuery ? mentionListboxId : undefined,
              'aria-activedescendant':
                mentionQuery && mentionOptions.length
                  ? `${mentionListboxId}-option-${mentionActiveIndex}`
                  : undefined,
            },
          }}
          sx={{ maxWidth: '100%' }}
        />
        <MessagingMentionMenu
          anchorEl={composerRef.current}
          open={Boolean(mentionQuery)}
          options={mentionOptions}
          listboxId={mentionListboxId}
          activeIndex={mentionActiveIndex}
          suggestionsLabel={t('mentions.suggestionsLabel')}
          emptyLabel={t('mentions.empty')}
          participantCountLabel={(count) => t('mentions.participantCount', { count })}
          onActiveIndexChange={setMentionActiveIndex}
          onSelect={selectMention}
          onClose={() => setMentionQuery(null)}
        />
      </Box>
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
        flexWrap="wrap"
        useFlexGap
        sx={{ minWidth: 0 }}
      >
        <Stack
          direction="row"
          spacing={0.25}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0, flex: '1 1 240px' }}
        >
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
          <ActionIconButton
            label={t('conversation.attachments.add')}
            disabled={isSending || attachments.length >= 10}
            onClick={() => fileInputRef.current?.click()}
            size="small"
          >
            <Paperclip size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={t('expressions.open')}
            onClick={(event) => setExpressionAnchor(event.currentTarget)}
            size="small"
          >
            <SmilePlus size={16} />
          </ActionIconButton>
          <ActionIconButton label={t('mentions.open')} onClick={startMention} size="small">
            <AtSign size={16} />
          </ActionIconButton>
          {onOpenMeeting && (
            <ActionIconButton
              label={t('conversation.composerMeetingAction')}
              onClick={onOpenMeeting}
              size="small"
            >
              <Video size={16} />
            </ActionIconButton>
          )}
          <Stack
            id={statusId}
            direction="row"
            spacing={0.7}
            alignItems="center"
            aria-live="polite"
            sx={{ minWidth: 0, ml: 0.75 }}
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
            <Typography variant="caption" color="text.secondary">
              {status}
            </Typography>
          </Stack>
        </Stack>
        <ActionButton
          intent="primary"
          endIcon={isSending ? <CircularProgress size={15} /> : <Send size={16} />}
          disabled={!drafting || isSending || attachmentBusy || attachmentFailed}
          onClick={onSend}
          sx={{ minWidth: compact ? 92 : 108, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {isSending ? t('conversation.sending') : t('conversation.send')}
        </ActionButton>
      </Stack>
      <MessagingExpressionPicker
        anchorEl={expressionAnchor}
        open={Boolean(expressionAnchor)}
        onClose={() => setExpressionAnchor(null)}
        onSelect={insertExpression}
      />
    </Stack>
  );
}
