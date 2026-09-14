import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Reply, Send } from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { resolveMessagingReplyTarget } from './notification-inbox-model';

import type { NotificationItem } from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationDetailReply({
  item,
  busy,
  onQuickReply,
  actionContainer,
  mobile = false,
}: {
  item: NotificationItem;
  busy: boolean;
  actionContainer?: HTMLElement | null;
  mobile?: boolean;
  onQuickReply: (
    target: { conversationId: string; replyToMessageId?: string },
    body: string,
    idempotencyKey: string
  ) => Promise<void>;
}) {
  const { t } = useTranslation('notifications');
  const target = useMemo(() => resolveMessagingReplyTarget(item), [item]);
  const formId = useId();
  const sendingRef = useRef(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  if (!target || item.sensitive) return null;

  const send = async () => {
    const message = body.trim();
    if (!message || sendingRef.current || busy) return;
    const nextIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(nextIdempotencyKey);
    sendingRef.current = true;
    setSending(true);
    setError(false);
    try {
      await onQuickReply(target, message, nextIdempotencyKey);
      setBody('');
      setIdempotencyKey(null);
    } catch {
      setError(true);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const action = (
    <ActionButton
      intent="primary"
      size="small"
      type="submit"
      form={formId}
      startIcon={<Send size={16} aria-hidden="true" />}
      disabled={!body.trim() || busy}
      loading={sending}
      fullWidth={mobile}
      sx={{
        minWidth: 0,
        minHeight: foundationTokens.density.comfortable.controlHeight,
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
      }}
    >
      {t('workbench.card.send')}
    </ActionButton>
  );

  return (
    <Box
      component="form"
      id={formId}
      data-testid="notification-detail-reply"
      aria-label={t('workbench.card.reply')}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      style={{ borderRadius: foundationTokens.radius.surface }}
      sx={{
        mt: 2,
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        minWidth: 0,
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', flexShrink: 0 }}>
          <Reply size={17} aria-hidden="true" />
        </Box>
        <Typography component="h4" variant="subtitle2">
          {t('workbench.card.reply')}
        </Typography>
      </Stack>
      <Stack gap={1} sx={{ mt: 1 }}>
        <FormField
          multiline
          minRows={3}
          size="small"
          fullWidth
          value={body}
          disabled={sending}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) {
              setError(false);
              setIdempotencyKey(null);
            }
          }}
          label={t('workbench.card.replyLabel')}
          placeholder={t('workbench.card.replyPlaceholder')}
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key === 'Enter' &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
          errorMessage={error ? t('workbench.card.replyError') : undefined}
          sx={{
            '& .MuiInputBase-root': { bgcolor: 'background.paper', typography: 'body2' },
            '& .MuiInputBase-input': { overflowWrap: 'anywhere' },
          }}
        />
        {mobile ? (
          actionContainer && createPortal(action, actionContainer)
        ) : (
          <Box sx={{ alignSelf: 'flex-end' }}>{action}</Box>
        )}
      </Stack>
    </Box>
  );
}
