// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagingScheduleDialog } from './messaging-schedule-dialog';

import type { Root } from 'react-dom/client';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  getMessagingScheduledMessages: api.get,
  cancelMessagingScheduledMessage: api.cancel,
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
  resolveSystemTimeZone: () => 'UTC',
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let root: Root;
let host: HTMLDivElement;

async function render(attachmentBlocked = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MessagingScheduleDialog
          open
          bodyReady
          attachmentBlocked={attachmentBlocked}
          busy={false}
          error={false}
          onClose={() => undefined}
          onSchedule={async () => true}
        />
      </QueryClientProvider>
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe('Messaging scheduled delivery UI', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.get
      .mockReset()
      .mockResolvedValue({ items: [], limit: 10, hasMore: false, nextCursor: null });
    api.cancel.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('fails closed with an explicit attachment reservation explanation', async () => {
    await render(true);
    expect(document.body.textContent).toContain('schedule.attachmentBlocked');
    const submit = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent === 'schedule.confirm'
    );
    expect(submit?.disabled).toBe(true);
  });

  it('announces pending schedules once while treating the spinner as decorative', async () => {
    api.get.mockReturnValue(new Promise(() => undefined));

    await render();

    const status = document.body.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-label')).toBe('schedule.pendingLoading');
    expect(status?.textContent).toContain('schedule.pendingLoading');
    expect(status?.querySelector('[role="progressbar"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('queries pending commands and cancels using the current optimistic version', async () => {
    api.get.mockResolvedValue({
      limit: 10,
      hasMore: false,
      nextCursor: null,
      items: [
        {
          scheduledMessageId: 'scheduled-1',
          conversationId: 'conversation-1',
          body: 'Review the report',
          mentionedPersonPublicIds: [],
          scheduledFor: '2027-01-02T01:00:00Z',
          displayTimeZone: 'UTC',
          status: 'PENDING',
          attemptCount: 0,
          version: 4,
          createdAt: '2026-10-28T01:00:00Z',
          updatedAt: '2026-10-28T01:00:00Z',
        },
      ],
    });
    api.cancel.mockResolvedValue({ status: 'CANCELLED' });
    await render();
    const cancel = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('schedule.cancel')
    );
    expect(cancel).toBeDefined();
    await act(async () => cancel!.click());
    expect(api.cancel.mock.calls[0]?.[0]).toEqual({
      scheduledMessageId: 'scheduled-1',
      version: 4,
    });
  });

  it('loads every pending range through the opaque next cursor', async () => {
    const scheduled = (id: string, body: string) => ({
      scheduledMessageId: id,
      conversationId: `conversation-${id}`,
      conversationName: `Conversation ${id}`,
      body,
      mentionedPersonPublicIds: [],
      scheduledFor: '2027-01-02T01:00:00Z',
      displayTimeZone: 'UTC',
      status: 'PENDING',
      attemptCount: 0,
      version: 1,
      createdAt: '2026-10-28T01:00:00Z',
      updatedAt: '2026-10-28T01:00:00Z',
    });
    api.get.mockImplementation(({ cursor }: { cursor?: string }) =>
      Promise.resolve(
        cursor
          ? {
              items: [scheduled('scheduled-2', 'Second pending message')],
              limit: 10,
              hasMore: false,
              nextCursor: null,
            }
          : {
              items: [scheduled('scheduled-1', 'First pending message')],
              limit: 10,
              hasMore: true,
              nextCursor: 'cursor-2',
            }
      )
    );

    await render();
    const loadMore = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent === 'schedule.pendingLoadMore'
    );
    expect(loadMore).toBeDefined();
    await act(async () => loadMore!.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(document.body.textContent).toContain('First pending message');
    expect(document.body.textContent).toContain('Second pending message');
    expect(api.get).toHaveBeenNthCalledWith(2, {
      status: 'PENDING',
      cursor: 'cursor-2',
      limit: 10,
    });
  });
});
