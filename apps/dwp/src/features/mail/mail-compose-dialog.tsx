import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { composeMail, updateMailDraft, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, FormDialog, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import { MailDraftSaveStatus } from './mail-draft-save-status';
import { useMailDraftAutosave } from './use-mail-draft-autosave';

type MailComposeDialogProps = {
  open: boolean;
  initialToEmail?: string;
  initialSubject?: string;
  initialBody?: string;
  fromDwaion?: boolean;
  onClose: () => void;
  onCompleted?: (threadId: string, deliveryMode: 'SEND' | 'DRAFT') => void;
};

export function MailComposeDialog(props: MailComposeDialogProps) {
  return <MailComposeDialogSession key={props.open ? 'open' : 'closed'} {...props} />;
}

function MailComposeDialogSession({
  open,
  initialToEmail = '',
  initialSubject = '',
  initialBody = '',
  fromDwaion = false,
  onClose,
  onCompleted,
}: MailComposeDialogProps) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toEmail, setToEmail] = useState(initialToEmail);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [closeWhenSaved, setCloseWhenSaved] = useState(false);
  const fields = { toEmail, subject, body };
  const autosave = useMailDraftAutosave({
    enabled: open && !sending,
    fields,
    onSaved: async (detail) => {
      queryClient.setQueryData(['mail', 'thread', detail.thread.threadId], detail);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      const input = {
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        deliveryMode: 'SEND' as const,
        idempotencyKey: crypto.randomUUID(),
      };
      const draft = autosave.identity;
      return draft
        ? updateMailDraft(draft.threadId, { ...input, version: draft.version })
        : composeMail(input);
    },
    onSuccess: async (detail) => {
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      toast.success(t('compose.sent'));
      onCompleted?.(detail.thread.threadId, 'SEND');
      onClose();
    },
    onError: () => {
      setSending(false);
      toast.error(t('compose.error'));
    },
  });

  const closeSavedDraft = useCallback(() => {
    if (autosave.identity) onCompleted?.(autosave.identity.threadId, 'DRAFT');
    onClose();
  }, [autosave.identity, onClose, onCompleted]);

  useEffect(() => {
    if (!closeWhenSaved) return;
    if (autosave.status === 'SAVED') {
      setCloseWhenSaved(false);
      closeSavedDraft();
      return;
    }
    if (autosave.status === 'ERROR' || autosave.status === 'CONFLICT') {
      setCloseWhenSaved(false);
      setDiscardOpen(true);
    }
  }, [autosave.status, closeSavedDraft, closeWhenSaved]);

  const requestClose = () => {
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
    closeSavedDraft();
  };

  return (
    <>
      <FormDialog
        open={open}
        title={t('compose.title')}
        description={t('compose.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('compose.send')}
        submittingLabel={t('compose.sending')}
        busy={sending || sendMutation.isPending}
        submitDisabled={!autosave.canSend || closeWhenSaved}
        maxWidth="md"
        onClose={requestClose}
        onSubmit={() => {
          autosave.cancelScheduledSave();
          setSending(true);
          sendMutation.mutate();
        }}
        secondaryActions={
          <ActionButton
            intent="quiet"
            startIcon={<Save size={16} />}
            disabled={!autosave.canSave || closeWhenSaved}
            loading={autosave.status === 'SAVING'}
            onClick={() => void autosave.saveNow()}
          >
            {t('compose.saveDraft')}
          </ActionButton>
        }
      >
        <Stack spacing={2}>
          {fromDwaion && <Alert severity="info">{t('compose.dwaionDraftNotice')}</Alert>}
          {closeWhenSaved && <Alert severity="info">{t('draft.autosave.closing')}</Alert>}
          <MailDraftSaveStatus status={autosave.status} onRetry={() => void autosave.saveNow()} />
          <FormField
            type="email"
            label={t('compose.to')}
            value={toEmail}
            autoFocus
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
            minRows={10}
            maxRows={18}
            label={t('compose.body')}
            value={body}
            disabled={closeWhenSaved}
            inputProps={{ maxLength: 100_000 }}
            onChange={(event) => setBody(event.target.value)}
          />
        </Stack>
      </FormDialog>
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
          onClose();
        }}
      />
    </>
  );
}
