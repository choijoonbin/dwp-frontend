import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { composeMail, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

export function MailComposeDialog({
  open,
  initialToEmail = '',
  initialSubject = '',
  initialBody = '',
  fromDwaion = false,
  onClose,
  onCompleted,
}: {
  open: boolean;
  initialToEmail?: string;
  initialSubject?: string;
  initialBody?: string;
  fromDwaion?: boolean;
  onClose: () => void;
  onCompleted?: (threadId: string, deliveryMode: 'SEND' | 'DRAFT') => void;
}) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'SEND' | 'DRAFT'>('SEND');
  const idempotencyKey = useRef(crypto.randomUUID());
  const mutation = useMutation({
    mutationFn: (deliveryMode: 'SEND' | 'DRAFT') =>
      composeMail({
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        deliveryMode,
        idempotencyKey: idempotencyKey.current,
      }),
    onSuccess: async (detail, deliveryMode) => {
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      toast.success(deliveryMode === 'SEND' ? t('compose.sent') : t('compose.saved'));
      onCompleted?.(detail.thread.threadId, deliveryMode);
      onClose();
    },
    onError: () => toast.error(t('compose.error')),
  });

  useEffect(() => {
    if (!open) return;
    setToEmail(initialToEmail);
    setSubject(initialSubject);
    setBody(initialBody);
    setMode('SEND');
    idempotencyKey.current = crypto.randomUUID();
  }, [initialBody, initialSubject, initialToEmail, open]);

  const valid = /^\S+@\S+\.\S+$/u.test(toEmail.trim()) && subject.trim() && body.trim();

  return (
    <FormDialog
      open={open}
      title={t('compose.title')}
      description={t('compose.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('compose.send')}
      submittingLabel={t('compose.sending')}
      busy={mutation.isPending}
      submitDisabled={!valid}
      maxWidth="md"
      onClose={onClose}
      onSubmit={() => {
        setMode('SEND');
        mutation.mutate('SEND');
      }}
      secondaryActions={
        <ActionButton
          intent="quiet"
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
      }
    >
      <Stack spacing={2}>
        {fromDwaion && <Alert severity="info">{t('compose.dwaionDraftNotice')}</Alert>}
        <FormField
          required
          type="email"
          label={t('compose.to')}
          value={toEmail}
          autoFocus
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
          minRows={10}
          maxRows={18}
          label={t('compose.body')}
          value={body}
          inputProps={{ maxLength: 100_000 }}
          onChange={(event) => setBody(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
