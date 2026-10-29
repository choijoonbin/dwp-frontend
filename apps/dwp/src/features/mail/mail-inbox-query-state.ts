import type { MailImportance, MailTriageLane } from '@dwp-frontend/shared-utils';

export type MailboxMode =
  'inbox' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash' | 'custom' | 'shared';

export const MAIL_INBOX_LANES: readonly MailTriageLane[] = [
  'PRIORITY',
  'NEEDS_REPLY',
  'ASSIGNED',
  'UPDATES',
];
export const MAIL_INBOX_PAGE_SIZE = 30;
const importanceFilters: readonly MailImportance[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export function requestedMailInboxPage(value: string | null) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function resolveMailInboxLane(value: string | null, mode: MailboxMode) {
  if (value && MAIL_INBOX_LANES.includes(value as MailTriageLane)) {
    return value as MailTriageLane;
  }
  return mode === 'shared' ? null : 'PRIORITY';
}

export function resolveMailInboxImportance(value: string | null): MailImportance | undefined {
  return importanceFilters.includes(value as MailImportance)
    ? (value as MailImportance)
    : undefined;
}
