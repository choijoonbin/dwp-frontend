// @vitest-environment jsdom

import { act, useEffect, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: () => 'Aug 19, 2026',
  resolveSupportedLocale: () => 'en',
}));
vi.mock('@mui/material/Menu', () => {
  function MockMenu({
    open,
    children,
    slotProps,
  }: {
    open: boolean;
    children: ReactNode;
    slotProps?: { transition?: { onExited?: () => void } };
  }) {
    const previousOpen = useRef(open);
    useEffect(() => {
      if (previousOpen.current && !open) slotProps?.transition?.onExited?.();
      previousOpen.current = open;
    }, [open, slotProps]);
    return open ? <div role="menu">{children}</div> : null;
  }
  return { default: MockMenu };
});
vi.mock('./messaging-attachment-list', () => ({ MessagingAttachmentList: () => null }));
vi.mock('./messaging-components', () => ({
  messagingInitials: () => 'AK',
  messagingRelativeTime: () => 'now',
}));
vi.mock('./messaging-display-model', () => ({ isMessagingTimestampVisible: () => false }));
vi.mock('./messaging-expression-picker', () => ({ MessagingExpressionPicker: () => null }));
vi.mock('./messaging-message-body', () => ({
  MessagingMessageBody: ({ body }: { body: string }) => <span>{body}</span>,
}));
vi.mock('./messaging-read-receipt', () => ({ MessagingReadReceiptButton: () => null }));

import { MessagingMessageRow } from './messaging-message-row';

import type {
  MessagingConversationDisplayPreference,
  MessagingMessage,
} from '@dwp-frontend/shared-utils';

const message = {
  messageId: 'message-1',
  conversationId: 'conversation-1',
  senderUserId: 2,
  senderPersonPublicId: 'person-2',
  senderName: 'Alex Kim',
  messageKind: 'USER',
  body: 'Follow up',
  mentions: [],
  reactions: [],
  attachments: [],
  createdAt: '2026-08-19T08:30:00Z',
  editedAt: null,
  deletedAt: null,
} as unknown as MessagingMessage;

const display = {
  effectiveLayoutMode: 'COLLABORATIVE',
  effectiveDensity: 'COMFORTABLE',
  effectiveTheme: 'DEFAULT',
  showAvatars: true,
  timestampMode: 'SMART',
} as MessagingConversationDisplayPreference;

describe('MessagingMessageRow action menu', () => {
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
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('fully closes the action menu before opening a reply thread', async () => {
    let menuOpenWhenReplyRuns = true;
    const onReply = vi.fn(() => {
      menuOpenWhenReplyRuns = document.querySelector('[role="menu"]') !== null;
    });
    await act(async () =>
      root.render(
        <MessagingMessageRow
          message={message}
          mine={false}
          display={display}
          onReact={vi.fn()}
          onReply={onReply}
        />
      )
    );

    const more = host.querySelector<HTMLButtonElement>('button[aria-label="message.moreActions"]');
    expect(more).not.toBeNull();
    await act(async () => more!.click());
    const reply = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (item) => item.textContent?.includes('message.reply')
    );
    expect(reply).toBeDefined();
    await act(async () => reply!.click());

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(menuOpenWhenReplyRuns).toBe(false);
    expect(onReply).toHaveBeenCalledOnce();
  });
});
