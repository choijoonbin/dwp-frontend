import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Reply, Send } from 'lucide-react';

import { ActionButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { resolveMessagingReplyTarget } from './notification-inbox-model';

import type { NotificationItem } from '@dwp-frontend/shared-utils/api/notification-api';

export function NotificationDetailReply({
  item,
  busy,
  onQuickReply,
}: {
  item: NotificationItem;
  busy: boolean;
  onQuickReply: (
    target: { conversationId: string; replyToMessageId?: string },
    body: string,
    idempotencyKey: string
  ) => Promise<void>;
}) {
  const { t } = useTranslation('notifications');
  const target = useMemo(() => resolveMessagingReplyTarget(item), [item]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  if (!target || item.sensitive) return null;

  const send = async () => {
    const message = body.trim();
    if (!message || sending || busy) return;
    const nextIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(nextIdempotencyKey);
    setSending(true);
    setError(false);
    try {
      await onQuickReply(target, message, nextIdempotencyKey);
      setBody('');
      setIdempotencyKey(null);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box component="section" sx={{ mt: 3, pt: 2.5, borderTop: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Reply size={17} aria-hidden="true" />
        <Typography component="h4" variant="subtitle2">
          {t('workbench.card.reply')}
        </Typography>
      </Stack>
      <Stack gap={1} sx={{ mt: 1 }}>
        <FormField
          multiline
          minRows={3}
          fullWidth
          value={body}
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
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void send();
          }}
          errorMessage={error ? t('workbench.card.replyError') : undefined}
        />
        <ActionButton
          intent="primary"
          startIcon={<Send size={16} />}
          disabled={!body.trim() || busy}
          loading={sending}
          onClick={() => void send()}
          sx={{ alignSelf: 'flex-end' }}
        >
          {t('workbench.card.send')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
