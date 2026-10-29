// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MailThreadListItem } from './mail-components';

import type { Root } from 'react-dom/client';
import type { MailThread } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'mailbox.bulk.selectMessage': 'Select message',
        'mailbox.bulk.deselectMessage': 'Deselect message',
        'thread.unread': 'Unread message',
        'thread.attachment': 'Attachment',
      })[key] ?? key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const thread: MailThread = {
  threadId: 'thread-1',
  accountId: 'account-1',
  accountName: 'Work',
  folderType: 'INBOX',
  subject: 'Quarterly review',
  preview: 'Please review the attached document.',
  participants: [{ name: 'Alex Kim', email: 'alex@example.com' }],
  latestMessageAt: '2026-10-28T01:55:00.000Z',
  unread: true,
  starred: false,
  importance: 'NORMAL',
  triageLane: 'NEEDS_REPLY',
  workflowState: 'OPEN',
  attachments: true,
  externalSender: false,
  classification: 'INTERNAL',
  messageCount: 1,
  version: 1,
};

describe('MailThreadListItem selection semantics', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('announces the selection action and pressed state in bulk mode', async () => {
    await act(async () =>
      root.render(
        <MailThreadListItem thread={thread} selectionMode selected onSelect={() => undefined} />
      )
    );

    const button = host.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toMatch(/^Deselect message, Alex Kim/);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.hasAttribute('aria-current')).toBe(false);
  });

  it('announces the open thread as current without exposing a toggle state outside bulk mode', async () => {
    await act(async () =>
      root.render(<MailThreadListItem thread={thread} selected onSelect={() => undefined} />)
    );

    const button = host.querySelector('button')!;
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.getAttribute('aria-current')).toBe('true');
  });
});
