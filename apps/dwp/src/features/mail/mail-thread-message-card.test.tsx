// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@dwp-frontend/shared-utils', () => ({
  downloadMailMessageAttachment: vi.fn(),
  useToast: () => ({ error: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'thread.externalLink.title') return 'Open external link?';
      if (key === 'thread.externalLink.open') return 'Open link';
      if (key === 'thread.externalLink.description')
        return `You are leaving DWP for ${String(options?.domain)} at ${String(options?.url)}`;
      if (key === 'actions.cancel') return 'Cancel';
      if (key === 'thread.forward') return 'Forward';
      return String(options?.defaultValue ?? key);
    },
  }),
}));

import { MailThreadMessageCard } from './mail-thread-message-card';

import type { MailMessage } from '@dwp-frontend/shared-utils';

const message: MailMessage = {
  messageId: 'message-1',
  direction: 'INBOUND',
  senderName: 'External sender',
  senderEmail: 'sender@example.net',
  recipients: [{ type: 'TO', email: 'member@example.com' }],
  sentAt: '2026-09-17T00:00:00.000Z',
  bodyFormat: 'HTML',
  body: '<p>Review <a href="https://outside.example.net/review?id=42">this document</a>.</p>',
  deliveryState: 'RECEIVED',
  attachments: [],
};

describe('Mail HTML external-link boundary', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('shows the destination before opening it with an isolated browsing context', async () => {
    const openedWindow = { opener: {} };
    const open = vi.spyOn(window, 'open').mockReturnValue(openedWindow as unknown as WindowProxy);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <MailThreadMessageCard
            threadId="thread-1"
            message={message}
            language="en"
            remoteImagePolicy="BLOCK"
            remoteImagesManuallyAllowed={false}
            canForward={false}
            onLoadRemoteImages={vi.fn()}
            onForward={vi.fn()}
          />
        </QueryClientProvider>
      )
    );

    const link = getByRole(host, 'link', { name: 'this document' });
    expect(link.getAttribute('target')).toBeNull();
    await act(async () => link.click());
    expect(open).not.toHaveBeenCalled();

    const dialog = getByRole(document.body, 'dialog', { name: 'Open external link?' });
    expect(dialog.textContent).toContain('outside.example.net');
    expect(dialog.textContent).toContain('https://outside.example.net/review?id=42');
    await act(async () => getByRole(dialog, 'button', { name: 'Open link' }).click());

    expect(open).toHaveBeenCalledWith(
      'https://outside.example.net/review?id=42',
      '_blank',
      'noopener,noreferrer'
    );
    expect(openedWindow.opener).toBeNull();
  });
});
