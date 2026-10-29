// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('./messaging-composer', () => ({ MessagingComposer: () => <div>composer</div> }));
vi.mock('./messaging-message-row', () => ({ MessagingMessageRow: () => <div>message</div> }));
vi.mock('./use-messaging-display-preference', () => ({
  useMessagingDisplayPreference: () => ({
    preference: {
      layoutMode: 'COLLABORATIVE',
      density: 'COMFORTABLE',
      theme: 'DEFAULT',
      effectiveLayoutMode: 'COLLABORATIVE',
      effectiveDensity: 'COMFORTABLE',
      effectiveTheme: 'DEFAULT',
      showAvatars: true,
      timestampMode: 'SMART',
      messagePreview: true,
      policyLocked: false,
      version: 0,
    },
  }),
}));
vi.mock('./use-messaging-read-receipts', () => ({
  useMessagingReadReceipts: () => new Map(),
}));
vi.mock('./use-messaging-read-observer', () => ({ useMessagingReadObserver: () => undefined }));

import { MessagingThreadPanel } from './messaging-thread-panel';

import type { MessagingAttachmentQueue } from './use-messaging-attachment-queue';

describe('Messaging thread load states', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps an old deep-link thread panel mounted with an actionable retry on fetch failure', async () => {
    const retry = vi.fn();
    await act(async () =>
      root.render(
        <MessagingThreadPanel
          open
          desktop
          thread={null}
          draft=""
          draftMentions={[]}
          members={[]}
          allowMentionAll={false}
          onDraftChange={vi.fn()}
          onDraftMentionsChange={vi.fn()}
          onSend={vi.fn()}
          onRetry={vi.fn()}
          isSending={false}
          hasError={false}
          scheduleBusy={false}
          scheduleError={false}
          draftPersistenceState="SAVED"
          onResolveDraftConflict={vi.fn()}
          onSchedule={vi.fn()}
          attachmentQueue={{ items: [] } as unknown as MessagingAttachmentQueue}
          onClose={vi.fn()}
          onReact={vi.fn()}
          onSave={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          loadError
          onRetryLoad={retry}
        />
      )
    );

    expect(host.querySelector('[role="region"]')).not.toBeNull();
    expect(host.textContent).toContain('thread.loadError');
    const retryButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent === 'actions.retry'
    );
    expect(retryButton).toBeDefined();
    await act(async () => retryButton!.click());
    expect(retry).toHaveBeenCalledOnce();
    expect(host.textContent).not.toContain('composer');
  });
});
