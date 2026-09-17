import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FilePenLine, Save, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  resolveIdempotentMutationIntent,
  getMailThread,
  HttpError,
  updateAdvancedMailDraft,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
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
import { MailComposeOptionsFields } from './mail-compose-options';
import { MailMessageBodyField } from './mail-message-body-field';
import { mailWritingAssetBody } from './mail-writing-asset-content';
import {
  clearMailDraftConflict,
  mailDraftFieldsFromDetail,
  readMailDraftConflict,
  rememberMailDraftConflict,
  type MailDraftConflictRecord,
} from './mail-draft-conflict';
import { MailDraftConflictReview } from './mail-draft-conflict-review';
import {
  clearMailSendAttempt,
  mailDraftSendScope,
  mailSendCustodyOwner,
  mailSendErrorDisposition,
  readMailSendAttempt,
  rememberMailSendAttempt,
} from './mail-send-attempt';
import {
  isMailComposeOptions,
  mailDraftSnapshot,
  useMailDraftAutosave,
} from './use-mail-draft-autosave';
import { useMailUserPermissions } from './use-mail-user-permissions';

import type {
  IdempotentMutationIntent,
  MailAdvancedThreadDetail,
  MailClassification,
  MailThread,
  MailComposeOptions,
  MailSignature,
  MailTemplate,
} from '@dwp-frontend/shared-utils';
import type { MailDraftFields } from './use-mail-draft-autosave';

type DraftSendPayload = Readonly<{
  threadId: string;
  version: number;
  toEmail: string;
  subject: string;
  body: string;
  classification: MailClassification;
  externalRecipientConfirmed: boolean;
  deliveryMode: 'SEND';
  composeOptions?: MailComposeOptions;
  base: MailDraftFields;
}>;

function isDraftFields(value: unknown): value is MailDraftFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.toEmail === 'string' &&
    (candidate.toName === undefined || typeof candidate.toName === 'string') &&
    typeof candidate.subject === 'string' &&
    typeof candidate.body === 'string' &&
    (candidate.classification === undefined ||
      ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(
        candidate.classification as string
      )) &&
    (candidate.composeOptions === undefined || isMailComposeOptions(candidate.composeOptions))
  );
}

function isDraftSendPayload(value: unknown): value is DraftSendPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.threadId === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.toEmail === 'string' &&
    typeof candidate.subject === 'string' &&
    typeof candidate.body === 'string' &&
    ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(
      candidate.classification as string
    ) &&
    typeof candidate.externalRecipientConfirmed === 'boolean' &&
    candidate.deliveryMode === 'SEND' &&
    isDraftFields(candidate.base)
  );
}

function restoreDraftSendAttempt(scope: string) {
  const attempt = readMailSendAttempt<unknown>(scope);
  if (!attempt) return null;
  if (isDraftSendPayload(attempt.payload)) return { ...attempt, payload: attempt.payload };
  clearMailSendAttempt(scope);
  return null;
}

function emptyComposeOptions(
  toEmail = '',
  toName?: string | null,
  accountId?: string | null
): MailComposeOptions {
  return {
    accountId: accountId ?? null,
    recipients: toEmail.trim()
      ? [
          {
            type: 'TO',
            name: toName?.trim() && toName.trim() !== toEmail.trim() ? toName.trim() : null,
            email: toEmail.trim(),
          },
        ]
      : [],
    bodyFormat: 'TEXT',
    attachmentIds: [],
    scheduledAt: null,
    timeZone: null,
    templateId: null,
    signatureId: null,
  };
}

function applyTemplate(
  template: MailTemplate,
  setSubject: (value: string) => void,
  setBody: (value: string) => void
) {
  if (template.subject) setSubject(template.subject);
  setBody(mailWritingAssetBody(template));
}

function applySignature(
  signature: MailSignature,
  setBody: React.Dispatch<React.SetStateAction<string>>
) {
  const separator = signature.bodyFormat === 'HTML' ? '<br><br>' : '\n\n';
  const content = mailWritingAssetBody(signature);
  setBody((current) => `${current.trimEnd()}${current.trim() ? separator : ''}${content}`);
}

export function MailDraftEditor({
  detail,
  onBack,
  onUpdated,
}: {
  detail: MailAdvancedThreadDetail;
  onBack?: () => void;
  onUpdated?: (thread: MailThread) => void;
}) {
  const { t } = useTranslation('mail');
  const auth = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canUpdate, canSend } = useMailUserPermissions();
  const thread = detail.thread;
  const custodyOwner = mailSendCustodyOwner(auth.user);
  const sendScope = mailDraftSendScope(custodyOwner, thread.threadId);
  const restoredConflictRef = useRef(readMailDraftConflict(custodyOwner, thread.threadId));
  const restoredConflict = restoredConflictRef.current;
  const unresolvedSendRef = useRef(restoredConflict ? null : restoreDraftSendAttempt(sendScope));
  const unresolvedSend = unresolvedSendRef.current;
  const [toEmail, setToEmail] = useState(
    restoredConflict?.local.toEmail ??
      unresolvedSend?.payload.toEmail ??
      thread.participants[0]?.email ??
      ''
  );
  const [subject, setSubject] = useState(
    restoredConflict?.local.subject ?? unresolvedSend?.payload.subject ?? thread.subject
  );
  const [body, setBody] = useState(
    restoredConflict?.local.body ??
      unresolvedSend?.payload.body ??
      detail.messages.find((message) => message.direction === 'DRAFT')?.body ??
      ''
  );
  const [classification, setClassification] = useState<MailClassification>(
    restoredConflict?.local.classification ??
      unresolvedSend?.payload.classification ??
      thread.classification ??
      'INTERNAL'
  );
  const [composeOptions, setComposeOptions] = useState<MailComposeOptions>(
    restoredConflict?.local.composeOptions ??
      unresolvedSend?.payload.composeOptions ??
      detail.draftOptions ??
      emptyComposeOptions(
        thread.participants[0]?.email,
        thread.participants[0]?.name,
        thread.accountId
      )
  );
  const [sending, setSending] = useState(false);
  const [attachmentsReady, setAttachmentsReady] = useState(() =>
    (detail.draftAttachments ?? []).every((attachment) => attachment.scanState === 'READY')
  );
  const [personalizationReviewPending, setPersonalizationReviewPending] = useState(false);
  const [externalRecipients, setExternalRecipients] = useState(Boolean(toEmail.trim()));
  const [externalConfirmationOpen, setExternalConfirmationOpen] = useState(false);
  const [sendResolutionPending, setSendResolutionPending] = useState(Boolean(unresolvedSend));
  const [sendRejected, setSendRejected] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [closeWhenSaved, setCloseWhenSaved] = useState(false);
  const [draftConflict, setDraftConflict] = useState<MailDraftConflictRecord | null>(
    restoredConflict
  );
  const [conflictServerDetail, setConflictServerDetail] = useState<MailAdvancedThreadDetail | null>(
    null
  );
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictLoadFailed, setConflictLoadFailed] = useState(false);
  const [reviewedLocalPendingSave, setReviewedLocalPendingSave] = useState(false);
  const sessionActiveRef = useRef(true);
  const sendIdentityRef = useRef<IdempotentMutationIntent | null>(unresolvedSend?.intent ?? null);
  const fields = { toEmail, subject, body, classification, composeOptions };
  const autosave = useMailDraftAutosave({
    enabled: canUpdate && !sending && !sendResolutionPending && !sendRejected && !draftConflict,
    fields,
    initialThreadId: thread.threadId,
    initialVersion: thread.version,
    initiallySaved: true,
    onSaved: async (updated) => {
      if (reviewedLocalPendingSave) {
        clearMailDraftConflict(custodyOwner, updated.thread.threadId);
        setReviewedLocalPendingSave(false);
      }
      queryClient.setQueryData(['mail', 'thread', thread.threadId], updated);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      onUpdated?.(updated.thread);
    },
    onConflict: (conflict) => {
      rememberMailDraftConflict(custodyOwner, conflict);
      setDraftConflict(conflict);
      setConflictServerDetail(null);
      setConflictLoadFailed(false);
      setReviewedLocalPendingSave(false);
    },
  });

  useEffect(() => {
    sessionActiveRef.current = true;
    return () => {
      sessionActiveRef.current = false;
    };
  }, []);

  const loadConflictServer = useCallback(async () => {
    if (!draftConflict) return;
    setConflictLoading(true);
    setConflictLoadFailed(false);
    try {
      const latest = await getMailThread(draftConflict.threadId);
      setConflictServerDetail(latest);
      queryClient.setQueryData(['mail', 'thread', draftConflict.threadId], latest);
    } catch {
      setConflictLoadFailed(true);
    } finally {
      setConflictLoading(false);
    }
  }, [draftConflict, queryClient]);

  useEffect(() => {
    if (draftConflict && !conflictServerDetail && !conflictLoadFailed && !conflictLoading) {
      void loadConflictServer();
    }
  }, [
    conflictLoadFailed,
    conflictLoading,
    conflictServerDetail,
    draftConflict,
    loadConflictServer,
  ]);

  useEffect(() => {
    if (!reviewedLocalPendingSave || !autosave.identity) return;
    const pending = readMailDraftConflict(custodyOwner, autosave.identity.threadId);
    if (!pending) return;
    const local = { toEmail, subject, body, classification, composeOptions };
    if (mailDraftSnapshot(local) === mailDraftSnapshot(autosave.savedFields)) {
      clearMailDraftConflict(custodyOwner, autosave.identity.threadId);
      setReviewedLocalPendingSave(false);
      return;
    }
    rememberMailDraftConflict(custodyOwner, {
      ...pending,
      local,
    });
  }, [
    autosave.identity,
    autosave.savedFields,
    body,
    classification,
    custodyOwner,
    reviewedLocalPendingSave,
    subject,
    toEmail,
    composeOptions,
  ]);
  const sendMutation = useMutation({
    mutationFn: (externalRecipientConfirmed: boolean) => {
      if (!canSend) throw new Error('Mail send permission is required.');
      const draft = autosave.identity;
      if (!draft) throw new Error('Draft identity is unavailable.');
      const storedAttempt = readMailSendAttempt<DraftSendPayload>(sendScope);
      const payload: DraftSendPayload =
        storedAttempt?.payload ??
        ({
          toEmail: toEmail.trim(),
          subject: subject.trim(),
          body: body.trim(),
          classification,
          externalRecipientConfirmed,
          deliveryMode: 'SEND',
          composeOptions,
          threadId: draft.threadId,
          version: draft.version,
          base: { ...autosave.savedFields },
        } as const);
      const sendIdentity =
        storedAttempt?.intent ?? resolveIdempotentMutationIntent(sendIdentityRef.current, payload);
      sendIdentityRef.current = sendIdentity;
      rememberMailSendAttempt(sendScope, { intent: sendIdentity, payload });
      return updateAdvancedMailDraft(payload.threadId, {
        toEmail: payload.toEmail,
        subject: payload.subject,
        body: payload.body,
        classification: payload.classification,
        externalRecipientConfirmed: payload.externalRecipientConfirmed,
        composeOptions: payload.composeOptions,
        deliveryMode: payload.deliveryMode,
        idempotencyKey: sendIdentity.key,
        version: payload.version,
      });
    },
    onSuccess: async (updated) => {
      clearMailSendAttempt(sendScope);
      sendIdentityRef.current = null;
      if (!sessionActiveRef.current) return;
      setSendResolutionPending(false);
      setSendRejected(false);
      queryClient.setQueryData(['mail', 'thread', thread.threadId], updated);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      onUpdated?.(updated.thread);
      toast.success(composeOptions.scheduledAt ? t('compose.scheduled') : t('draft.sent'));
      onBack?.();
    },
    onError: (error) => {
      if (mailSendErrorDisposition(error) === 'UNCONFIRMED') {
        if (!sessionActiveRef.current) return;
        setSending(false);
        setSendResolutionPending(true);
        toast.error(t('compose.outcomeUnconfirmed'));
        return;
      }
      let conflictRecorded = false;
      if (error instanceof HttpError && error.status === 409) {
        const attempt = readMailSendAttempt<DraftSendPayload>(sendScope);
        if (attempt) {
          const local = {
            toEmail: attempt.payload.toEmail,
            subject: attempt.payload.subject,
            body: attempt.payload.body,
            classification: attempt.payload.classification,
            composeOptions: attempt.payload.composeOptions,
          };
          const conflict = {
            threadId: thread.threadId,
            base: attempt.payload.base,
            local,
          } as const;
          rememberMailDraftConflict(custodyOwner, conflict);
          if (sessionActiveRef.current) {
            setDraftConflict(conflict);
            setConflictServerDetail(null);
            setConflictLoadFailed(false);
          }
          conflictRecorded = true;
        }
      }
      clearMailSendAttempt(sendScope);
      sendIdentityRef.current = null;
      if (!sessionActiveRef.current) return;
      setSending(false);
      setSendResolutionPending(false);
      setSendRejected(!conflictRecorded);
    },
  });

  const resolveConflict = (selection: 'SERVER' | 'LOCAL') => {
    if (!draftConflict || !conflictServerDetail) return;
    const serverFields = mailDraftFieldsFromDetail(conflictServerDetail);
    const selected = selection === 'SERVER' ? serverFields : draftConflict.local;
    setToEmail(selected.toEmail);
    setSubject(selected.subject);
    setBody(selected.body);
    setClassification(selected.classification ?? 'INTERNAL');
    setComposeOptions(
      selected.composeOptions ?? emptyComposeOptions(selected.toEmail, null, thread.accountId)
    );
    autosave.adoptServerVersion(conflictServerDetail, serverFields, selected);
    if (selection === 'SERVER' || mailDraftSnapshot(selected) === mailDraftSnapshot(serverFields)) {
      clearMailDraftConflict(custodyOwner, draftConflict.threadId);
      setReviewedLocalPendingSave(false);
    } else {
      setReviewedLocalPendingSave(true);
    }
    setDraftConflict(null);
    setConflictServerDetail(null);
    setConflictLoadFailed(false);
    setSendRejected(false);
  };

  const requestBack = () => {
    autosave.cancelScheduledSave();
    if (sendResolutionPending) {
      toast.error(t('compose.resolveBeforeLeaving'));
      return;
    }
    if (draftConflict) {
      setDiscardOpen(true);
      return;
    }
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
            {!canUpdate ? (
              <Alert severity="info">
                {t('permissions.readOnly', {
                  defaultValue: 'You have read-only mail access. Draft changes are unavailable.',
                })}
              </Alert>
            ) : !canSend ? (
              <Alert severity="info">
                {t('permissions.draftOnly', {
                  defaultValue:
                    'You can edit and save this draft, but sending requires permission.',
                })}
              </Alert>
            ) : null}
            {closeWhenSaved && <Alert severity="info">{t('draft.autosave.closing')}</Alert>}
            {sendResolutionPending && (
              <Alert severity="warning">{t('compose.retrySameCommand')}</Alert>
            )}
            {sendRejected && <Alert severity="error">{t('compose.requestRejectedReview')}</Alert>}
            {draftConflict && (
              <MailDraftConflictReview
                conflict={draftConflict}
                server={
                  conflictServerDetail ? mailDraftFieldsFromDetail(conflictServerDetail) : null
                }
                loading={conflictLoading}
                loadFailed={conflictLoadFailed}
                onRetry={() => void loadConflictServer()}
                onUseServer={() => resolveConflict('SERVER')}
                onKeepLocal={() => resolveConflict('LOCAL')}
              />
            )}
            <MailDraftSaveStatus
              status={autosave.status}
              onRetry={canUpdate ? () => void autosave.saveNow() : undefined}
            />
            <MailComposeOptionsFields
              toEmail={toEmail}
              options={composeOptions}
              initialAttachments={detail.draftAttachments ?? []}
              disabled={
                !canUpdate || closeWhenSaved || sendResolutionPending || Boolean(draftConflict)
              }
              hasBody={Boolean(body.trim())}
              onToEmailChange={(value) => {
                setSendRejected(false);
                setToEmail(value);
              }}
              onChange={(value) => {
                setSendRejected(false);
                setComposeOptions(value);
              }}
              onAttachmentReadyChange={setAttachmentsReady}
              onPersonalizationReviewChange={setPersonalizationReviewPending}
              classification={classification}
              onClassificationChange={(value) => {
                setSendRejected(false);
                setClassification(value);
              }}
              onExternalRecipientChange={setExternalRecipients}
              onInsertTemplate={(template) => applyTemplate(template, setSubject, setBody)}
              onInsertSignature={(signature) => applySignature(signature, setBody)}
            />
            <FormField
              label={t('compose.subject')}
              value={subject}
              disabled={
                !canUpdate || closeWhenSaved || sendResolutionPending || Boolean(draftConflict)
              }
              inputProps={{ maxLength: 500 }}
              onChange={(event) => {
                setSendRejected(false);
                setSubject(event.target.value);
              }}
            />
            <MailMessageBodyField
              format={composeOptions.bodyFormat}
              value={body}
              disabled={
                !canUpdate || closeWhenSaved || sendResolutionPending || Boolean(draftConflict)
              }
              minRows={12}
              onChange={(value) => {
                setSendRejected(false);
                setBody(value);
              }}
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
              disabled={
                !canUpdate ||
                !autosave.canSave ||
                closeWhenSaved ||
                sendResolutionPending ||
                sendRejected ||
                Boolean(draftConflict)
              }
              loading={autosave.status === 'SAVING'}
              onClick={() => void autosave.saveNow()}
            >
              {t('compose.saveDraft')}
            </ActionButton>
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={
                !canSend ||
                !autosave.canSend ||
                !attachmentsReady ||
                personalizationReviewPending ||
                sending ||
                closeWhenSaved ||
                sendRejected ||
                reviewedLocalPendingSave ||
                Boolean(draftConflict)
              }
              loading={sending || sendMutation.isPending}
              onClick={() => {
                autosave.cancelScheduledSave();
                if (externalRecipients) {
                  setExternalConfirmationOpen(true);
                  return;
                }
                setSending(true);
                sendMutation.mutate(false);
              }}
            >
              {composeOptions.scheduledAt ? t('compose.scheduleSend') : t('compose.send')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>
      <ConfirmDialog
        open={externalConfirmationOpen}
        title={t('compose.externalConfirmTitle')}
        description={t('compose.externalConfirmDescription')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('compose.externalConfirmAction')}
        busy={sending || sendMutation.isPending}
        onClose={() => setExternalConfirmationOpen(false)}
        onConfirm={() => {
          setExternalConfirmationOpen(false);
          autosave.cancelScheduledSave();
          setSending(true);
          sendMutation.mutate(true);
        }}
      />
      <ConfirmDialog
        open={discardOpen}
        title={t('draft.discard.title')}
        description={t('draft.discard.description')}
        cancelLabel={t('draft.discard.keepEditing')}
        confirmLabel={t('draft.discard.confirm')}
        intent="danger"
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          if (draftConflict) clearMailDraftConflict(custodyOwner, draftConflict.threadId);
          if (reviewedLocalPendingSave && autosave.identity) {
            clearMailDraftConflict(custodyOwner, autosave.identity.threadId);
          }
          setDiscardOpen(false);
          onBack?.();
        }}
      />
    </Box>
  );
}
