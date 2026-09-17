import { HttpError } from '@dwp-frontend/shared-utils';

import type { IdempotentMutationIntent, MailRecipient } from '@dwp-frontend/shared-utils';

export type MailSendAttempt<TPayload> = Readonly<{
  intent: IdempotentMutationIntent;
  payload: TPayload;
}>;

export type MailRejectedReplyReview = Readonly<{
  threadId: string;
  body: string;
  mode?: 'REPLY' | 'REPLY_ALL';
  recipients?: MailRecipient[];
}>;

const STORAGE_PREFIX = 'dwp.mail.unresolved-send.v1:';
const REJECTED_REPLY_STORAGE_PREFIX = 'dwp.mail.rejected-reply.v1:';
const unresolvedAttempts = new Map<string, MailSendAttempt<unknown>>();
const rejectedReplyReviews = new Map<string, MailRejectedReplyReview>();

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseAttempt(value: string | null): MailSendAttempt<unknown> | null {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (!isRecord(candidate) || !isRecord(candidate.intent) || !('payload' in candidate)) {
      return null;
    }
    if (
      typeof candidate.intent.key !== 'string' ||
      !candidate.intent.key ||
      typeof candidate.intent.fingerprint !== 'string' ||
      !candidate.intent.fingerprint
    ) {
      return null;
    }
    return candidate as MailSendAttempt<unknown>;
  } catch {
    return null;
  }
}

function storageKey(scope: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(scope)}`;
}

function rejectedReplyStorageKey(scope: string) {
  return `${REJECTED_REPLY_STORAGE_PREFIX}${encodeURIComponent(scope)}`;
}

export function mailSendCustodyOwner(
  user:
    | {
        identityPlane?: string | null;
        tenantId?: string | number | null;
        userId?: string | number | null;
      }
    | null
    | undefined
) {
  return `${user?.identityPlane ?? 'tenant'}:${user?.tenantId ?? 'unknown'}:${user?.userId ?? 'unknown'}`;
}

export function mailDraftSendScope(owner: string, threadId: string) {
  return `${owner}:draft:${threadId}`;
}

export function mailGroupSendScope(owner: string, groupId: string) {
  return `${owner}:group:${groupId}`;
}

export function mailReplySendScope(owner: string, threadId: string) {
  return `${owner}:reply:${threadId}`;
}

export function rememberMailSendAttempt<TPayload>(
  scope: string,
  attempt: MailSendAttempt<TPayload>
) {
  unresolvedAttempts.set(scope, attempt);
  try {
    storage()?.setItem(storageKey(scope), JSON.stringify(attempt));
  } catch {
    // In-memory custody still protects retries when browser storage is unavailable.
  }
}

export function readMailSendAttempt<TPayload>(scope: string): MailSendAttempt<TPayload> | null {
  const cached = unresolvedAttempts.get(scope) as MailSendAttempt<TPayload> | undefined;
  if (cached) return cached;
  const persisted = parseAttempt(storage()?.getItem(storageKey(scope)) ?? null);
  if (!persisted) {
    storage()?.removeItem(storageKey(scope));
    return null;
  }
  unresolvedAttempts.set(scope, persisted);
  return persisted as MailSendAttempt<TPayload>;
}

export function listMailSendAttempts<TPayload>(owner: string, kind: 'draft' | 'group' | 'reply') {
  const target = storage();
  if (!target) return [];
  const scopePrefix = `${owner}:${kind}:`;
  const results: Array<{ scope: string; attempt: MailSendAttempt<TPayload> }> = [];
  for (let index = 0; index < target.length; index += 1) {
    const persistedKey = target.key(index);
    if (!persistedKey?.startsWith(STORAGE_PREFIX)) continue;
    let scope: string;
    try {
      scope = decodeURIComponent(persistedKey.slice(STORAGE_PREFIX.length));
    } catch {
      target.removeItem(persistedKey);
      continue;
    }
    if (!scope.startsWith(scopePrefix)) continue;
    const attempt = readMailSendAttempt<TPayload>(scope);
    if (attempt) results.push({ scope, attempt });
  }
  return results;
}

export function clearMailSendAttempt(scope: string) {
  unresolvedAttempts.delete(scope);
  storage()?.removeItem(storageKey(scope));
}

export function rememberMailRejectedReplyReview(scope: string, review: MailRejectedReplyReview) {
  rejectedReplyReviews.set(scope, review);
  try {
    storage()?.setItem(rejectedReplyStorageKey(scope), JSON.stringify(review));
  } catch {
    // The mounted editor still retains the rejected input when browser storage is unavailable.
  }
}

export function readMailRejectedReplyReview(scope: string): MailRejectedReplyReview | null {
  const cached = rejectedReplyReviews.get(scope);
  if (cached) return cached;
  const target = storage();
  const key = rejectedReplyStorageKey(scope);
  const serialized = target?.getItem(key);
  if (!serialized) return null;
  try {
    const candidate: unknown = JSON.parse(serialized);
    if (!isRecord(candidate)) throw new Error();
    if (
      typeof candidate.threadId !== 'string' ||
      typeof candidate.body !== 'string' ||
      (candidate.mode !== undefined &&
        candidate.mode !== 'REPLY' &&
        candidate.mode !== 'REPLY_ALL') ||
      (candidate.recipients !== undefined && !Array.isArray(candidate.recipients))
    ) {
      throw new Error();
    }
    const review = candidate as MailRejectedReplyReview;
    rejectedReplyReviews.set(scope, review);
    return review;
  } catch {
    target?.removeItem(key);
    return null;
  }
}

export function clearMailRejectedReplyReview(scope: string) {
  rejectedReplyReviews.delete(scope);
  storage()?.removeItem(rejectedReplyStorageKey(scope));
}

export function mailSendErrorDisposition(error: unknown): 'REJECTED' | 'UNCONFIRMED' {
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

export function clearMailSendAttemptMemoryForTests() {
  unresolvedAttempts.clear();
  rejectedReplyReviews.clear();
}

export function clearMailSendAttemptsForTests() {
  unresolvedAttempts.clear();
  rejectedReplyReviews.clear();
  const target = storage();
  if (!target) return;
  for (let index = target.length - 1; index >= 0; index -= 1) {
    const key = target.key(index);
    if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(REJECTED_REPLY_STORAGE_PREFIX)) {
      target.removeItem(key);
    }
  }
}
