import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FilePenLine, Save, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMailDraft, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MailDraftSaveStatus } from './mail-draft-save-status';
import { useMailDraftAutosave } from './use-mail-draft-autosave';

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
  const thread = detail.thread;
  const [toEmail, setToEmail] = useState(thread.participants[0]?.email ?? '');
  const [subject, setSubject] = useState(thread.subject);
  const [body, setBody] = useState(
    detail.messages.find((message) => message.direction === 'DRAFT')?.body ?? ''
  );
  const [sending, setSending] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [closeWhenSaved, setCloseWhenSaved] = useState(false);
  const fields = { toEmail, subject, body };
  const autosave = useMailDraftAutosave({
    enabled: !sending,
    fields,
    initialThreadId: thread.threadId,
    initialVersion: thread.version,
    initiallySaved: true,
    onSaved: async (updated) => {
      queryClient.setQueryData(['mail', 'thread', thread.threadId], updated);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      onUpdated?.(updated.thread);
    },
  });
  const sendMutation = useMutation({
    mutationFn: () => {
      const draft = autosave.identity;
      if (!draft) throw new Error('Draft identity is unavailable.');
      return updateMailDraft(draft.threadId, {
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        deliveryMode: 'SEND',
        idempotencyKey: crypto.randomUUID(),
        version: draft.version,
      });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(['mail', 'thread', thread.threadId], updated);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      onUpdated?.(updated.thread);
      toast.success(t('draft.sent'));
      onBack?.();
    },
    onError: () => {
      setSending(false);
      toast.error(t('draft.error'));
    },
  });

  const requestBack = () => {
    autosave.cancelScheduledSave();
    if (autosave.status === 'SAVING') {
      setCloseWhenSaved(true);
      return;
    }
    if (
      autosave.hasUnsavedChanges ||
      autosave.status === 'ERROR' ||
      autosave.status === 'CONFLICT'
    ) {
      setDiscardOpen(true);
      return;
    }
    onBack?.();
  };

  useEffect(() => {
    if (!closeWhenSaved) return;
    if (autosave.status === 'SAVED') {
      setCloseWhenSaved(false);
      onBack?.();
      return;
    }
    if (autosave.status === 'ERROR' || autosave.status === 'CONFLICT') {
      setCloseWhenSaved(false);
      setDiscardOpen(true);
    }
  }, [autosave.status, closeWhenSaved, onBack]);

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
            <ActionIconButton label={t('actions.back')} onClick={requestBack}>
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
            {closeWhenSaved && <Alert severity="info">{t('draft.autosave.closing')}</Alert>}
            <MailDraftSaveStatus status={autosave.status} onRetry={() => void autosave.saveNow()} />
            <FormField
              type="email"
              label={t('compose.to')}
              value={toEmail}
              autoComplete="off"
              disabled={closeWhenSaved}
              onChange={(event) => setToEmail(event.target.value)}
            />
            <FormField
              label={t('compose.subject')}
              value={subject}
              disabled={closeWhenSaved}
              inputProps={{ maxLength: 500 }}
              onChange={(event) => setSubject(event.target.value)}
            />
            <FormField
              multiline
              minRows={12}
              maxRows={24}
              label={t('compose.body')}
              value={body}
              disabled={closeWhenSaved}
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
              disabled={!autosave.canSave || closeWhenSaved}
              loading={autosave.status === 'SAVING'}
              onClick={() => void autosave.saveNow()}
            >
              {t('compose.saveDraft')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={!autosave.canSend || sending || closeWhenSaved}
              loading={sending || sendMutation.isPending}
              onClick={() => {
                autosave.cancelScheduledSave();
                setSending(true);
                sendMutation.mutate();
              }}
            >
              {t('compose.send')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>
      <ConfirmDialog
        open={discardOpen}
        title={t('draft.discard.title')}
        description={t('draft.discard.description')}
        cancelLabel={t('draft.discard.keepEditing')}
        confirmLabel={t('draft.discard.confirm')}
        intent="danger"
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onBack?.();
        }}
      />
    </Box>
  );
}
