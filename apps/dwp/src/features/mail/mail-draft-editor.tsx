import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FilePenLine, Save, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMailDraft, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton, ActionIconButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailThread, MailThreadDetail } from '@dwp-frontend/shared-utils';

export function MailDraftEditor({
  detail,
  onBack,
  onUpdated,
}: {
  detail: MailThreadDetail;
  onBack?: () => void;
  onUpdated?: (thread: MailThread) => void;
}) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'SEND' | 'DRAFT'>('DRAFT');
  const thread = detail.thread;

  useEffect(() => {
    setToEmail(thread.participants[0]?.email ?? '');
    setSubject(thread.subject);
    setBody(detail.messages.find((message) => message.direction === 'DRAFT')?.body ?? '');
  }, [detail.messages, thread.participants, thread.subject, thread.threadId]);

  const mutation = useMutation({
    mutationFn: (deliveryMode: 'SEND' | 'DRAFT') =>
      updateMailDraft(thread.threadId, {
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        deliveryMode,
        idempotencyKey: crypto.randomUUID(),
        version: thread.version,
      }),
    onSuccess: async (updated, deliveryMode) => {
      queryClient.setQueryData(['mail', 'thread', thread.threadId], updated);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      onUpdated?.(updated.thread);
      toast.success(deliveryMode === 'SEND' ? t('draft.sent') : t('draft.saved'));
      if (deliveryMode === 'SEND') onBack?.();
    },
    onError: () => toast.error(t('draft.error')),
  });
  const valid = Boolean(/^\S+@\S+\.\S+$/u.test(toEmail.trim()) && subject.trim() && body.trim());

  return (
    <Box sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: { xs: 1.5, md: 2.25 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {onBack && (
            <ActionIconButton label={t('actions.back')} onClick={onBack}>
              <ArrowLeft size={18} />
            </ActionIconButton>
          )}
          <FilePenLine size={18} color="var(--dwp-product-accent)" />
          <Typography variant="body2" fontWeight={800}>
            {t('draft.title')}
          </Typography>
        </Stack>
        <Chip size="small" variant="outlined" label={t('draft.status')} />
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, md: 3 } }}>
        <Box sx={{ width: 1, maxWidth: 820, mx: 'auto' }}>
          <Typography component="h2" variant="h5" fontWeight={800}>
            {t('draft.heading')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            {t('draft.description')}
          </Typography>
          <Stack spacing={2}>
            <FormField
              required
              type="email"
              label={t('compose.to')}
              value={toEmail}
              autoComplete="off"
              onChange={(event) => setToEmail(event.target.value)}
            />
            <FormField
              required
              label={t('compose.subject')}
              value={subject}
              inputProps={{ maxLength: 500 }}
              onChange={(event) => setSubject(event.target.value)}
            />
            <FormField
              required
              multiline
              minRows={12}
              maxRows={24}
              label={t('compose.body')}
              value={body}
              inputProps={{ maxLength: 100_000 }}
              onChange={(event) => setBody(event.target.value)}
            />
          </Stack>
          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            justifyContent="flex-end"
            spacing={1}
            sx={{ mt: 2 }}
          >
            <ActionButton
              intent="secondary"
              startIcon={<Save size={16} />}
              disabled={!valid || mutation.isPending}
              loading={mutation.isPending && mode === 'DRAFT'}
              onClick={() => {
                setMode('DRAFT');
                mutation.mutate('DRAFT');
              }}
            >
              {t('compose.saveDraft')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={!valid || mutation.isPending}
              loading={mutation.isPending && mode === 'SEND'}
              onClick={() => {
                setMode('SEND');
                mutation.mutate('SEND');
              }}
            >
              {t('compose.send')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
