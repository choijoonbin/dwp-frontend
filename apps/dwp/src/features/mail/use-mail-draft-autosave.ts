import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createMailDraft,
  HttpError,
  saveMailDraft,
  type MailDraftSaveInput,
  type MailThreadDetail,
} from '@dwp-frontend/shared-utils';

export type MailDraftFields = {
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
};

export type MailDraftSaveStatus = 'EMPTY' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR' | 'CONFLICT';

type DraftIdentity = { threadId: string; version: number } | null;

type DraftSaveAttempt = {
  snapshot: string;
  payload: Omit<MailDraftSaveInput, 'idempotencyKey' | 'version'>;
  idempotencyKey: string;
  target: { kind: 'CREATE' } | { kind: 'UPDATE'; threadId: string; version: number };
};

const EMPTY_DRAFT_SNAPSHOT = '{}';

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalBody(value: string) {
  return value.trim() ? value : undefined;
}

export function mailDraftPayload(
  fields: MailDraftFields
): Omit<MailDraftSaveInput, 'idempotencyKey' | 'version'> {
  return {
    toEmail: optionalTrimmed(fields.toEmail),
    toName: optionalTrimmed(fields.toName),
    subject: optionalTrimmed(fields.subject),
    body: optionalBody(fields.body),
  };
}

export function mailDraftSnapshot(fields: MailDraftFields) {
  return JSON.stringify(mailDraftPayload(fields));
}

export function mailDraftHasContent(fields: MailDraftFields) {
  return mailDraftSnapshot(fields) !== EMPTY_DRAFT_SNAPSHOT;
}

export function mailDraftCanSend(fields: MailDraftFields) {
  return Boolean(
    /^\S+@\S+\.\S+$/u.test(fields.toEmail.trim()) && fields.subject.trim() && fields.body.trim()
  );
}

export function useMailDraftAutosave({
  enabled,
  fields,
  initialThreadId,
  initialVersion,
  initiallySaved = false,
  delayMs = 1_750,
  onSaved,
}: {
  enabled: boolean;
  fields: MailDraftFields;
  initialThreadId?: string;
  initialVersion?: number;
  initiallySaved?: boolean;
  delayMs?: number;
  onSaved?: (detail: MailThreadDetail) => void | Promise<void>;
}) {
  const initialSnapshotRef = useRef(mailDraftSnapshot(fields));
  const fieldsRef = useRef(fields);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAttemptRef = useRef<DraftSaveAttempt | null>(null);
  const activePromiseRef = useRef<Promise<MailThreadDetail> | null>(null);
  const failedAttemptRef = useRef<DraftSaveAttempt | null>(null);
  const onSavedRef = useRef(onSaved);
  const [identity, setIdentity] = useState<DraftIdentity>(() =>
    initialThreadId !== undefined && initialVersion !== undefined
      ? { threadId: initialThreadId, version: initialVersion }
      : null
  );
  const identityRef = useRef(identity);
  const savedSnapshotRef = useRef(
    initiallySaved ? initialSnapshotRef.current : EMPTY_DRAFT_SNAPSHOT
  );
  const [status, setStatus] = useState<MailDraftSaveStatus>(() => {
    if (initiallySaved) return 'SAVED';
    return mailDraftHasContent(fields) ? 'DIRTY' : 'EMPTY';
  });
  const statusRef = useRef(status);

  fieldsRef.current = fields;
  onSavedRef.current = onSaved;

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
      updateStatus('SAVING');
      const input = {
        ...attempt.payload,
        idempotencyKey: attempt.idempotencyKey,
      };
      const request =
        attempt.target.kind === 'CREATE'
          ? createMailDraft(input)
          : saveMailDraft(attempt.target.threadId, {
              ...input,
              version: attempt.target.version,
            });
      const promise = request
        .then(async (detail) => {
          const nextIdentity = {
            threadId: detail.thread.threadId,
            version: detail.thread.version,
          };
          identityRef.current = nextIdentity;
          savedSnapshotRef.current = attempt.snapshot;
          failedAttemptRef.current = null;
          if (mountedRef.current) setIdentity(nextIdentity);
          await onSavedRef.current?.(detail);
          updateStatus(
            mailDraftSnapshot(fieldsRef.current) === attempt.snapshot ? 'SAVED' : 'DIRTY'
          );
          return detail;
        })
        .catch((error: unknown) => {
          failedAttemptRef.current = attempt;
          updateStatus(error instanceof HttpError && error.status === 409 ? 'CONFLICT' : 'ERROR');
          throw error;
        })
        .finally(() => {
          if (activeAttemptRef.current === attempt) activeAttemptRef.current = null;
          if (activePromiseRef.current === promise) activePromiseRef.current = null;
        });
      activePromiseRef.current = promise;
      return promise;
    },
    [clearTimer, updateStatus]
  );

  const saveNow = useCallback(async (): Promise<MailThreadDetail | null> => {
    clearTimer();
    if (activePromiseRef.current) {
      try {
        await activePromiseRef.current;
      } catch {
        return null;
      }
    }
    if (statusRef.current === 'CONFLICT') return null;

    const failedAttempt = failedAttemptRef.current;
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

  useEffect(() => {
    clearTimer();
    if (!enabled || activeAttemptRef.current || failedAttemptRef.current) return undefined;
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
    canSend: mailDraftCanSend(fields) && !['SAVING', 'ERROR', 'CONFLICT'].includes(status),
    canSave: hasContent && !['SAVING', 'CONFLICT'].includes(status),
    saveNow,
    cancelScheduledSave: clearTimer,
  };
}
