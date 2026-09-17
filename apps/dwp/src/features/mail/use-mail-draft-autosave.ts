import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAdvancedMailDraft,
  HttpError,
  saveAdvancedMailDraft,
  type MailAdvancedDraftSaveInput,
  type MailAdvancedThreadDetail,
  type MailClassification,
  type MailComposeOptions,
  type DwaionProposalHandoffBinding,
} from '@dwp-frontend/shared-utils';

export type MailDraftFields = {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  classification?: MailClassification;
  composeOptions?: MailComposeOptions;
};

export type MailDraftSaveStatus = 'EMPTY' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR' | 'CONFLICT';

export function isMailComposeOptions(value: unknown): value is MailComposeOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.recipients) ||
    !Array.isArray(candidate.attachmentIds) ||
    (candidate.bodyFormat !== 'TEXT' && candidate.bodyFormat !== 'HTML')
  ) {
    return false;
  }
  return (
    candidate.recipients.every(
      (recipient) =>
        Boolean(recipient) &&
        typeof recipient === 'object' &&
        !Array.isArray(recipient) &&
        ['TO', 'CC', 'BCC'].includes((recipient as Record<string, unknown>).type as string) &&
        typeof (recipient as Record<string, unknown>).email === 'string'
    ) && candidate.attachmentIds.every((attachmentId) => typeof attachmentId === 'string')
  );
}

type DraftIdentity = { threadId: string; version: number } | null;

type DraftSaveAttempt = {
  snapshot: string;
  fields: MailDraftFields;
  payload: Omit<MailAdvancedDraftSaveInput, 'idempotencyKey' | 'version'>;
  idempotencyKey: string;
  target: { kind: 'CREATE' } | { kind: 'UPDATE'; threadId: string; version: number };
};

type DraftSaveFailureDisposition = 'REJECTED' | 'UNCONFIRMED' | 'CONFLICT';

const EMPTY_DRAFT_FIELDS: MailDraftFields = {
  toEmail: '',
  subject: '',
  body: '',
  classification: 'INTERNAL',
};
const EMPTY_DRAFT_SNAPSHOT = JSON.stringify({
  classification: 'INTERNAL',
  externalRecipientConfirmed: false,
});

function copyDraftFields(fields: MailDraftFields): MailDraftFields {
  return { ...fields };
}

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalBody(value: string) {
  return value.trim() ? value : undefined;
}

function draftSaveFailureDisposition(error: unknown): DraftSaveFailureDisposition {
  if (error instanceof HttpError && error.status === 409) return 'CONFLICT';
  if (
    error instanceof HttpError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![408, 425, 499].includes(error.status)
  ) {
    return 'REJECTED';
  }
  return 'UNCONFIRMED';
}

export function mailDraftPayload(
  fields: MailDraftFields
): Omit<MailAdvancedDraftSaveInput, 'idempotencyKey' | 'version'> {
  const composeOptions = meaningfulComposeOptions(fields.composeOptions);
  return {
    toEmail: optionalTrimmed(fields.toEmail),
    toName: optionalTrimmed(fields.toName),
    subject: optionalTrimmed(fields.subject),
    body: optionalBody(fields.body),
    classification: fields.classification ?? 'INTERNAL',
    externalRecipientConfirmed: false,
    ...(composeOptions ? { composeOptions } : {}),
  };
}

export function mailDraftSnapshot(fields: MailDraftFields) {
  return JSON.stringify(mailDraftPayload(fields));
}

export function mailDraftHasContent(fields: MailDraftFields) {
  return mailDraftSnapshot(fields) !== EMPTY_DRAFT_SNAPSHOT;
}

export function mailDraftCanSend(fields: MailDraftFields) {
  const recipients = fields.composeOptions?.recipients;
  const recipientReady = recipients?.length
    ? recipients.some((recipient) => recipient.type === 'TO') &&
      recipients.every((recipient) => /^\S+@\S+\.\S+$/u.test(recipient.email.trim()))
    : /^\S+@\S+\.\S+$/u.test(fields.toEmail.trim());
  const scheduleReady =
    !fields.composeOptions?.scheduledAt ||
    new Date(fields.composeOptions.scheduledAt).getTime() > Date.now();
  return Boolean(recipientReady && scheduleReady && fields.subject.trim() && fields.body.trim());
}

function meaningfulComposeOptions(options: MailComposeOptions | undefined) {
  if (!options) return undefined;
  return options.accountId ||
    options.bodyFormat === 'HTML' ||
    options.recipients.length ||
    options.attachmentIds.length ||
    options.scheduledAt ||
    options.timeZone ||
    options.templateId ||
    options.signatureId
    ? options
    : undefined;
}

export function useMailDraftAutosave({
  enabled,
  fields,
  initialThreadId,
  initialVersion,
  initiallySaved = false,
  delayMs = 1_750,
  onSaved,
  onConflict,
  dwaionProposalBinding,
}: {
  enabled: boolean;
  fields: MailDraftFields;
  initialThreadId?: string;
  initialVersion?: number;
  initiallySaved?: boolean;
  delayMs?: number;
  onSaved?: (detail: MailAdvancedThreadDetail) => void | Promise<void>;
  onConflict?: (conflict: {
    threadId: string;
    base: MailDraftFields;
    local: MailDraftFields;
  }) => void;
  dwaionProposalBinding?: DwaionProposalHandoffBinding | null;
}) {
  const initialSnapshotRef = useRef(mailDraftSnapshot(fields));
  const fieldsRef = useRef(fields);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAttemptRef = useRef<DraftSaveAttempt | null>(null);
  const activePromiseRef = useRef<Promise<MailAdvancedThreadDetail> | null>(null);
  const failedAttemptRef = useRef<DraftSaveAttempt | null>(null);
  const failedDispositionRef = useRef<DraftSaveFailureDisposition | null>(null);
  const onSavedRef = useRef(onSaved);
  const onConflictRef = useRef(onConflict);
  const [identity, setIdentity] = useState<DraftIdentity>(() =>
    initialThreadId !== undefined && initialVersion !== undefined
      ? { threadId: initialThreadId, version: initialVersion }
      : null
  );
  const identityRef = useRef(identity);
  const savedSnapshotRef = useRef(
    initiallySaved ? initialSnapshotRef.current : EMPTY_DRAFT_SNAPSHOT
  );
  const savedFieldsRef = useRef(
    initiallySaved ? copyDraftFields(fields) : copyDraftFields(EMPTY_DRAFT_FIELDS)
  );
  const [status, setStatus] = useState<MailDraftSaveStatus>(() => {
    if (initiallySaved) return 'SAVED';
    return mailDraftHasContent(fields) ? 'DIRTY' : 'EMPTY';
  });
  const statusRef = useRef(status);

  fieldsRef.current = fields;
  onSavedRef.current = onSaved;
  onConflictRef.current = onConflict;

  const updateStatus = useCallback((next: MailDraftSaveStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runAttempt = useCallback(
    (attempt: DraftSaveAttempt) => {
      clearTimer();
      activeAttemptRef.current = attempt;
      failedAttemptRef.current = null;
      failedDispositionRef.current = null;
      updateStatus('SAVING');
      const input = {
        ...attempt.payload,
        idempotencyKey: attempt.idempotencyKey,
      };
      const request =
        attempt.target.kind === 'CREATE'
          ? dwaionProposalBinding
            ? createAdvancedMailDraft(input, dwaionProposalBinding)
            : createAdvancedMailDraft(input)
          : saveAdvancedMailDraft(attempt.target.threadId, {
              ...input,
              version: attempt.target.version,
            });
      const promise = request
        .then(async (detail) => {
          if (!mountedRef.current) return detail;
          const nextIdentity = {
            threadId: detail.thread.threadId,
            version: detail.thread.version,
          };
          identityRef.current = nextIdentity;
          savedSnapshotRef.current = attempt.snapshot;
          savedFieldsRef.current = copyDraftFields(attempt.fields);
          failedAttemptRef.current = null;
          failedDispositionRef.current = null;
          if (mountedRef.current) setIdentity(nextIdentity);
          await onSavedRef.current?.(detail);
          updateStatus(
            mailDraftSnapshot(fieldsRef.current) === attempt.snapshot ? 'SAVED' : 'DIRTY'
          );
          return detail;
        })
        .catch((error: unknown) => {
          if (!mountedRef.current) throw error;
          failedAttemptRef.current = attempt;
          failedDispositionRef.current = draftSaveFailureDisposition(error);
          if (failedDispositionRef.current === 'CONFLICT' && attempt.target.kind === 'UPDATE') {
            onConflictRef.current?.({
              threadId: attempt.target.threadId,
              base: copyDraftFields(savedFieldsRef.current),
              local: copyDraftFields(attempt.fields),
            });
          }
          updateStatus(failedDispositionRef.current === 'CONFLICT' ? 'CONFLICT' : 'ERROR');
          throw error;
        })
        .finally(() => {
          if (activeAttemptRef.current === attempt) activeAttemptRef.current = null;
          if (activePromiseRef.current === promise) activePromiseRef.current = null;
        });
      activePromiseRef.current = promise;
      return promise;
    },
    [clearTimer, dwaionProposalBinding, updateStatus]
  );

  const saveNow = useCallback(async (): Promise<MailAdvancedThreadDetail | null> => {
    clearTimer();
    if (activePromiseRef.current) {
      try {
        await activePromiseRef.current;
      } catch {
        return null;
      }
    }
    if (statusRef.current === 'CONFLICT') return null;

    let failedAttempt = failedAttemptRef.current;
    if (
      failedAttempt &&
      failedDispositionRef.current === 'REJECTED' &&
      failedAttempt.snapshot !== mailDraftSnapshot(fieldsRef.current)
    ) {
      failedAttemptRef.current = null;
      failedDispositionRef.current = null;
      failedAttempt = null;
    }
    if (failedAttempt) {
      try {
        return await runAttempt(failedAttempt);
      } catch {
        return null;
      }
    }

    const currentFields = fieldsRef.current;
    const snapshot = mailDraftSnapshot(currentFields);
    if (!mailDraftHasContent(currentFields)) {
      updateStatus(identityRef.current ? 'DIRTY' : 'EMPTY');
      return null;
    }
    if (snapshot === savedSnapshotRef.current) {
      updateStatus('SAVED');
      return null;
    }

    const currentIdentity = identityRef.current;
    const attempt: DraftSaveAttempt = {
      snapshot,
      fields: copyDraftFields(currentFields),
      payload: mailDraftPayload(currentFields),
      idempotencyKey: crypto.randomUUID(),
      target: currentIdentity
        ? {
            kind: 'UPDATE',
            threadId: currentIdentity.threadId,
            version: currentIdentity.version,
          }
        : { kind: 'CREATE' },
    };
    try {
      return await runAttempt(attempt);
    } catch {
      return null;
    }
  }, [clearTimer, runAttempt, updateStatus]);

  const snapshot = useMemo(() => mailDraftSnapshot(fields), [fields]);
  const hasContent = useMemo(() => mailDraftHasContent(fields), [fields]);
  const hasUnsavedChanges = snapshot !== savedSnapshotRef.current;

  const adoptServerVersion = useCallback(
    (
      detail: MailAdvancedThreadDetail,
      serverFields: MailDraftFields,
      nextFields = fieldsRef.current
    ) => {
      clearTimer();
      const nextIdentity = {
        threadId: detail.thread.threadId,
        version: detail.thread.version,
      };
      identityRef.current = nextIdentity;
      savedSnapshotRef.current = mailDraftSnapshot(serverFields);
      savedFieldsRef.current = copyDraftFields(serverFields);
      failedAttemptRef.current = null;
      failedDispositionRef.current = null;
      if (mountedRef.current) setIdentity(nextIdentity);
      updateStatus(mailDraftSnapshot(nextFields) === savedSnapshotRef.current ? 'SAVED' : 'DIRTY');
    },
    [clearTimer, updateStatus]
  );

  useEffect(() => {
    clearTimer();
    if (!enabled || activeAttemptRef.current) return undefined;
    if (failedAttemptRef.current) {
      if (
        failedDispositionRef.current === 'REJECTED' &&
        failedAttemptRef.current.snapshot !== snapshot
      ) {
        failedAttemptRef.current = null;
        failedDispositionRef.current = null;
      } else {
        return undefined;
      }
    }
    if (!hasContent) {
      updateStatus(identityRef.current ? 'DIRTY' : 'EMPTY');
      return undefined;
    }
    if (snapshot === savedSnapshotRef.current) {
      updateStatus('SAVED');
      return undefined;
    }
    updateStatus('DIRTY');
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, delayMs);
    return clearTimer;
  }, [
    clearTimer,
    delayMs,
    enabled,
    hasContent,
    identity?.version,
    saveNow,
    snapshot,
    updateStatus,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  return {
    status,
    identity,
    hasContent,
    hasUnsavedChanges,
    savedFields: savedFieldsRef.current,
    canSend: mailDraftCanSend(fields) && !['SAVING', 'ERROR', 'CONFLICT'].includes(status),
    canSave: hasContent && !['SAVING', 'CONFLICT'].includes(status),
    saveNow,
    cancelScheduledSave: clearTimer,
    adoptServerVersion,
  };
}
