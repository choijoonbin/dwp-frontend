import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  resolveIdempotentMutationIntent,
  getMailThread,
  HttpError,
  updateAdvancedMailDraft,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog, FormDialog, FormField } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

import { MailDraftSaveStatus } from './mail-draft-save-status';
import { MailComposeOptionsFields } from './mail-compose-options';
import { MailMessageBodyField } from './mail-message-body-field';
import { mailWritingAssetBody } from './mail-writing-asset-content';
import {
  clearMailDraftConflict,
  listMailDraftConflicts,
  mailDraftFieldsFromDetail,
  readMailDraftConflict,
  rememberMailDraftConflict,
  type MailDraftConflictRecord,
} from './mail-draft-conflict';
import { MailDraftConflictReview } from './mail-draft-conflict-review';
import {
  clearMailSendAttempt,
  listMailSendAttempts,
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

import type {
  IdempotentMutationIntent,
  MailProposalMutationBinding,
} from '@dwp-frontend/shared-utils';
import type {
  MailClassification,
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

function restoreDraftSend(owner: string) {
  for (const { scope, attempt } of listMailSendAttempts<unknown>(owner, 'draft')) {
    if (isDraftSendPayload(attempt.payload)) {
      return { scope, attempt: { intent: attempt.intent, payload: attempt.payload } };
    }
    clearMailSendAttempt(scope);
  }
  return null;
}

type MailComposeDialogProps = {
  open: boolean;
  canSave?: boolean;
  canSend?: boolean;
  initialAccountId?: string;
  initialToEmail?: string;
  initialSubject?: string;
  initialBody?: string;
  fromDwaion?: boolean;
  proposalBinding?: MailProposalMutationBinding;
  dwaionProposalBinding?: import('@dwp-frontend/shared-utils').DwaionProposalHandoffBinding | null;
  submissionBlocked?: boolean;
  handoffNotice?: React.ReactNode;
  onClose: () => void;
  onCompleted?: (
    threadId: string,
    deliveryMode: 'SEND' | 'DRAFT'
  ) => boolean | void | Promise<boolean | void>;
};

export function MailComposeDialog(props: MailComposeDialogProps) {
  const auth = useAuth();
  const custodyOwner = mailSendCustodyOwner(auth.user);
  return (
    <MailComposeDialogSession
      key={`${custodyOwner}:${props.initialAccountId ?? 'default'}:${props.open ? 'open' : 'closed'}`}
      {...props}
      custodyOwner={custodyOwner}
    />
  );
}

function emptyComposeOptions(toEmail = '', accountId?: string): MailComposeOptions {
  return {
    accountId: accountId ?? null,
    recipients: toEmail.trim() ? [{ type: 'TO', name: null, email: toEmail.trim() }] : [],
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

function MailComposeDialogSession({
  open,
  canSave = true,
  canSend = true,
  initialAccountId,
  initialToEmail = '',
  initialSubject = '',
  initialBody = '',
  fromDwaion = false,
  proposalBinding,
  dwaionProposalBinding,
  submissionBlocked = false,
  handoffNotice,
  onClose,
  onCompleted,
  custodyOwner,
}: MailComposeDialogProps & { custodyOwner: string }) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const queryClient = useQueryClient();
  const restoredConflictRef = useRef(listMailDraftConflicts(custodyOwner)[0] ?? null);
  const restoredConflict = restoredConflictRef.current;
  const restoredSendRef = useRef(restoredConflict ? null : restoreDraftSend(custodyOwner));
  const restoredSend = restoredSendRef.current;
  const [toEmail, setToEmail] = useState(
    restoredConflict?.local.toEmail ?? restoredSend?.attempt.payload.toEmail ?? initialToEmail
  );
  const [subject, setSubject] = useState(
    restoredConflict?.local.subject ?? restoredSend?.attempt.payload.subject ?? initialSubject
  );
  const [body, setBody] = useState(
    restoredConflict?.local.body ?? restoredSend?.attempt.payload.body ?? initialBody
  );
  const [classification, setClassification] = useState<MailClassification>(
    restoredConflict?.local.classification ??
      restoredSend?.attempt.payload.classification ??
      'INTERNAL'
  );
  const [composeOptions, setComposeOptions] = useState<MailComposeOptions>(
    restoredConflict?.local.composeOptions ??
      restoredSend?.attempt.payload.composeOptions ??
      emptyComposeOptions(initialToEmail, initialAccountId)
  );
  const [sending, setSending] = useState(false);
  const [ownerCompletionPending, setOwnerCompletionPending] = useState(false);
  const [attachmentsReady, setAttachmentsReady] = useState(true);
  const [personalizationReviewPending, setPersonalizationReviewPending] = useState(false);
  const [externalRecipients, setExternalRecipients] = useState(Boolean(initialToEmail.trim()));
  const [externalConfirmationOpen, setExternalConfirmationOpen] = useState(false);
  const [sendResolutionPending, setSendResolutionPending] = useState(Boolean(restoredSend));
  const [sendRejected, setSendRejected] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [closeWhenSaved, setCloseWhenSaved] = useState(false);
  const [draftConflict, setDraftConflict] = useState<MailDraftConflictRecord | null>(
    restoredConflict
  );
  const [conflictServerDetail, setConflictServerDetail] = useState<Awaited<
    ReturnType<typeof getMailThread>
  > | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictLoadFailed, setConflictLoadFailed] = useState(false);
  const [reviewedLocalPendingSave, setReviewedLocalPendingSave] = useState(false);
  const sessionActiveRef = useRef(true);
  const sendIdentityRef = useRef<IdempotentMutationIntent | null>(
    restoredSend?.attempt.intent ?? null
  );
  const activeSendScopeRef = useRef<string | null>(restoredSend?.scope ?? null);
  const ownerDraftCompletionKeyRef = useRef<string | null>(null);
  const fields = { toEmail, subject, body, classification, composeOptions };
  const autosave = useMailDraftAutosave({
    enabled:
      open &&
      canSave &&
      !submissionBlocked &&
      !sending &&
      !sendResolutionPending &&
      !sendRejected &&
      !draftConflict,
    fields,
    initialThreadId: restoredSend?.attempt.payload.threadId,
    initialVersion: restoredSend?.attempt.payload.version,
    initiallySaved: Boolean(restoredSend),
    dwaionProposalBinding,
    onSaved: async (detail) => {
      if (reviewedLocalPendingSave) {
        clearMailDraftConflict(custodyOwner, detail.thread.threadId);
        setReviewedLocalPendingSave(false);
      }
      queryClient.setQueryData(['mail', 'thread', detail.thread.threadId], detail);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
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
      if (!draft) throw new Error('The draft must be saved before it can be sent.');
      const scope = activeSendScopeRef.current ?? mailDraftSendScope(custodyOwner, draft.threadId);
      const storedAttempt = readMailSendAttempt<DraftSendPayload>(scope);
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
      activeSendScopeRef.current = scope;
      rememberMailSendAttempt(scope, {
        intent: sendIdentity,
        payload,
      });
      return updateAdvancedMailDraft(
        payload.threadId,
        {
          toEmail: payload.toEmail,
          subject: payload.subject,
          body: payload.body,
          classification: payload.classification,
          externalRecipientConfirmed: payload.externalRecipientConfirmed,
          composeOptions: payload.composeOptions,
          deliveryMode: payload.deliveryMode,
          idempotencyKey: sendIdentity.key,
          version: payload.version,
        },
        proposalBinding
      );
    },
    onSuccess: async (detail) => {
      if (activeSendScopeRef.current) clearMailSendAttempt(activeSendScopeRef.current);
      activeSendScopeRef.current = null;
      sendIdentityRef.current = null;
      if (!sessionActiveRef.current) return;
      setSendResolutionPending(false);
      setSendRejected(false);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      toast.success(composeOptions.scheduledAt ? t('compose.scheduled') : t('compose.sent'));
      const completed = await onCompleted?.(detail.thread.threadId, 'SEND');
      if (completed === false) return;
      onClose();
    },
    onError: (error) => {
      if (mailSendErrorDisposition(error) === 'UNCONFIRMED') {
        if (!sessionActiveRef.current) return;
        setSending(false);
        setSendResolutionPending(true);
        toast.error(t('compose.outcomeUnconfirmed'));
        return;
      }
      const failedScope = activeSendScopeRef.current;
      let conflictRecorded = false;
      if (error instanceof HttpError && error.status === 409 && failedScope) {
        const attempt = readMailSendAttempt<DraftSendPayload>(failedScope);
        if (attempt) {
          const local = {
            toEmail: attempt.payload.toEmail,
            subject: attempt.payload.subject,
            body: attempt.payload.body,
            classification: attempt.payload.classification,
            composeOptions: attempt.payload.composeOptions,
          };
          const conflict = {
            threadId: attempt.payload.threadId,
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
      if (failedScope) clearMailSendAttempt(failedScope);
      activeSendScopeRef.current = null;
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
    setComposeOptions(selected.composeOptions ?? emptyComposeOptions(selected.toEmail));
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

  const closeSavedDraft = useCallback(async () => {
    if (autosave.identity) {
      let completedThreadId = autosave.identity.threadId;
      if (proposalBinding) {
        setOwnerCompletionPending(true);
        try {
          const saved = autosave.savedFields;
          ownerDraftCompletionKeyRef.current ??= crypto.randomUUID();
          const detail = await updateAdvancedMailDraft(
            autosave.identity.threadId,
            {
              toEmail: saved.toEmail,
              toName: saved.toName,
              subject: saved.subject,
              body: saved.body,
              classification: saved.classification ?? 'INTERNAL',
              externalRecipientConfirmed: false,
              composeOptions: saved.composeOptions,
              deliveryMode: 'DRAFT',
              idempotencyKey: ownerDraftCompletionKeyRef.current,
              version: autosave.identity.version,
            },
            proposalBinding
          );
          completedThreadId = detail.thread.threadId;
        } catch {
          toast.error(t('draft.error'));
          return;
        } finally {
          setOwnerCompletionPending(false);
        }
      }
      const completed = await onCompleted?.(completedThreadId, 'DRAFT');
      if (completed === false) return;
    }
    onClose();
  }, [autosave.identity, autosave.savedFields, onClose, onCompleted, proposalBinding, t, toast]);

  useEffect(() => {
    if (!closeWhenSaved) return;
    if (autosave.status === 'SAVED') {
      setCloseWhenSaved(false);
      void closeSavedDraft();
      return;
    }
    if (autosave.status === 'ERROR' || autosave.status === 'CONFLICT') {
      setCloseWhenSaved(false);
      setDiscardOpen(true);
    }
  }, [autosave.status, closeSavedDraft, closeWhenSaved]);

  const requestClose = () => {
    if (ownerCompletionPending) return;
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
    void closeSavedDraft();
  };

  return (
    <>
      <FormDialog
        open={open}
        title={t('compose.title')}
        description={t('compose.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={composeOptions.scheduledAt ? t('compose.scheduleSend') : t('compose.send')}
        submittingLabel={
          composeOptions.scheduledAt ? t('compose.scheduling') : t('compose.sending')
        }
        busy={sending || sendMutation.isPending || ownerCompletionPending}
        submitDisabled={
          !canSend ||
          !autosave.canSend ||
          ownerCompletionPending ||
          submissionBlocked ||
          !attachmentsReady ||
          personalizationReviewPending ||
          !autosave.identity ||
          closeWhenSaved ||
          sendRejected ||
          reviewedLocalPendingSave ||
          Boolean(draftConflict)
        }
        maxWidth="md"
        onClose={requestClose}
        onSubmit={() => {
          autosave.cancelScheduledSave();
          if (externalRecipients) {
            setExternalConfirmationOpen(true);
            return;
          }
          setSending(true);
          sendMutation.mutate(false);
        }}
        secondaryActions={
          <ActionButton
            intent="quiet"
            startIcon={<Save size={16} />}
            disabled={
              !canSave ||
              !autosave.canSave ||
              ownerCompletionPending ||
              submissionBlocked ||
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
        }
      >
        <Stack spacing={2}>
          {handoffNotice}
          {!canSave ? (
            <Alert severity="info">
              {t('permissions.readOnly', {
                defaultValue: 'You have read-only mail access. Draft changes are unavailable.',
              })}
            </Alert>
          ) : !canSend ? (
            <Alert severity="info">
              {t('permissions.draftOnly', {
                defaultValue: 'You can edit and save this draft, but sending requires permission.',
              })}
            </Alert>
          ) : null}
          {fromDwaion && <Alert severity="info">{t('compose.dwaionDraftNotice')}</Alert>}
          {closeWhenSaved && <Alert severity="info">{t('draft.autosave.closing')}</Alert>}
          {sendResolutionPending && (
            <Alert severity="warning">{t('compose.retrySameCommand')}</Alert>
          )}
          {sendRejected && <Alert severity="error">{t('compose.requestRejectedReview')}</Alert>}
          {draftConflict && (
            <MailDraftConflictReview
              conflict={draftConflict}
              server={conflictServerDetail ? mailDraftFieldsFromDetail(conflictServerDetail) : null}
              loading={conflictLoading}
              loadFailed={conflictLoadFailed}
              onRetry={() => void loadConflictServer()}
              onUseServer={() => resolveConflict('SERVER')}
              onKeepLocal={() => resolveConflict('LOCAL')}
            />
          )}
          <MailDraftSaveStatus
            status={autosave.status}
            onRetry={canSave ? () => void autosave.saveNow() : undefined}
          />
          <MailComposeOptionsFields
            toEmail={toEmail}
            options={composeOptions}
            disabled={!canSave || closeWhenSaved || sendResolutionPending || Boolean(draftConflict)}
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
            disabled={!canSave || closeWhenSaved || sendResolutionPending || Boolean(draftConflict)}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => {
              setSendRejected(false);
              setSubject(event.target.value);
            }}
          />
          <MailMessageBodyField
            format={composeOptions.bodyFormat}
            value={body}
            disabled={!canSave || closeWhenSaved || sendResolutionPending || Boolean(draftConflict)}
            minRows={10}
            onChange={(value) => {
              setSendRejected(false);
              setBody(value);
            }}
          />
        </Stack>
      </FormDialog>
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
          onClose();
        }}
      />
    </>
  );
}
