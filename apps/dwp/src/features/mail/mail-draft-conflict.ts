import type { MailAdvancedThreadDetail } from '@dwp-frontend/shared-utils';

import type { MailDraftFields } from './use-mail-draft-autosave';
import { isMailComposeOptions } from './use-mail-draft-autosave';

export type MailDraftConflictRecord = Readonly<{
  threadId: string;
  base: MailDraftFields;
  local: MailDraftFields;
}>;

const STORAGE_PREFIX = 'dwp.mail.draft-conflict.v1:';

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function key(owner: string, threadId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(`${owner}:${threadId}`)}`;
}

function fields(value: unknown): value is MailDraftFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.toEmail === 'string' &&
    (candidate.toName === undefined || typeof candidate.toName === 'string') &&
    typeof candidate.subject === 'string' &&
    typeof candidate.body === 'string' &&
    (candidate.composeOptions === undefined || isMailComposeOptions(candidate.composeOptions))
  );
}

export function mailDraftFieldsFromDetail(detail: MailAdvancedThreadDetail): MailDraftFields {
  return {
    toEmail: detail.thread.participants[0]?.email ?? '',
    subject: detail.thread.subject,
    body: detail.messages.find((message) => message.direction === 'DRAFT')?.body ?? '',
    composeOptions: detail.draftOptions,
  };
}

export function rememberMailDraftConflict(owner: string, conflict: MailDraftConflictRecord) {
  try {
    storage()?.setItem(key(owner, conflict.threadId), JSON.stringify(conflict));
  } catch {
    // The current React session still retains the user's input when storage is unavailable.
  }
}

export function readMailDraftConflict(owner: string, threadId: string) {
  const target = storage();
  const storageKey = key(owner, threadId);
  const serialized = target?.getItem(storageKey);
  if (!serialized) return null;
  try {
    const candidate: unknown = JSON.parse(serialized);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error();
    const record = candidate as Record<string, unknown>;
    if (record.threadId !== threadId || !fields(record.base) || !fields(record.local)) {
      throw new Error();
    }
    return record as MailDraftConflictRecord;
  } catch {
    target?.removeItem(storageKey);
    return null;
  }
}

export function listMailDraftConflicts(owner: string) {
  const target = storage();
  if (!target) return [];
  const ownerPrefix = `${owner}:`;
  const conflicts: MailDraftConflictRecord[] = [];
  for (let index = 0; index < target.length; index += 1) {
    const storageKey = target.key(index);
    if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;
    let scope: string;
    try {
      scope = decodeURIComponent(storageKey.slice(STORAGE_PREFIX.length));
    } catch {
      target.removeItem(storageKey);
      continue;
    }
    if (!scope.startsWith(ownerPrefix)) continue;
    const threadId = scope.slice(ownerPrefix.length);
    const conflict = readMailDraftConflict(owner, threadId);
    if (conflict) conflicts.push(conflict);
  }
  return conflicts;
}

export function clearMailDraftConflict(owner: string, threadId: string) {
  storage()?.removeItem(key(owner, threadId));
}

export function clearMailDraftConflictsForTests() {
  const target = storage();
  if (!target) return;
  for (let index = target.length - 1; index >= 0; index -= 1) {
    const storageKey = target.key(index);
    if (storageKey?.startsWith(STORAGE_PREFIX)) target.removeItem(storageKey);
  }
}
