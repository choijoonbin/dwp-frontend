// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagingSavedItems } from './messaging-saved-items';

import type { Root } from 'react-dom/client';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  unsave: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  getMessagingLaterItems: api.get,
  updateMessagingLaterItem: api.update,
  unsaveMessagingMessage: api.unsave,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@dwp-frontend/shared-i18n', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  resolveSystemTimeZone: () => 'America/New_York',
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

let root: Root;
let host: HTMLDivElement;

async function render({ openSnooze = true }: { openSnooze?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <MessagingSavedItems />
        </QueryClientProvider>
      </MemoryRouter>
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  if (openSnooze) {
    const snooze = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent === 'laterPage.snooze'
    );
    expect(snooze).toBeDefined();
    await act(async () => snooze!.click());
  }
}

async function enterLocalTime(value: string) {
  const input = document.body.querySelector<HTMLInputElement>('input[type="datetime-local"]');
  expect(input).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('Messaging Later items', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.get.mockReset().mockResolvedValue({
      items: [
        {
          messageId: 'message-1',
          conversationId: 'conversation-1',
          conversationName: 'Operations',
          conversationType: 'GROUP',
          senderName: 'Alex Kim',
          preview: 'Follow up',
          protectedContent: false,
          messageDeleted: false,
          savedAt: '2026-10-28T01:00:00Z',
          state: 'SAVED',
          reminderAt: null,
          snoozedUntil: null,
          completedAt: null,
          version: 1,
        },
      ],
      total: 1,
      page: 0,
      pageSize: 30,
      generatedAt: '2026-10-28T01:00:00Z',
    });
    api.update.mockReset();
    api.unsave.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it.each([
    ['2026-03-08T02:30', 'laterPage.snoozeDialog.nonexistentTime'],
    ['2026-11-01T01:30', 'laterPage.snoozeDialog.ambiguousTime'],
  ])('blocks the DST boundary %s with a specific error', async (value, errorKey) => {
    await render();
    await enterLocalTime(value);

    expect(document.body.textContent).toContain(errorKey);
    const confirm = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent === 'laterPage.snoozeDialog.confirm'
    );
    expect(confirm?.disabled).toBe(true);
    expect(api.update).not.toHaveBeenCalled();
  });

  it('uses the semantic outlined success treatment for a completed item', async () => {
    api.get.mockResolvedValueOnce({
      items: [
        {
          messageId: 'message-1',
          conversationId: 'conversation-1',
          conversationName: 'Operations',
          conversationType: 'GROUP',
          senderName: 'Alex Kim',
          preview: 'Follow up',
          protectedContent: false,
          messageDeleted: false,
          savedAt: '2026-10-28T01:00:00Z',
          state: 'COMPLETED',
          reminderAt: null,
          snoozedUntil: null,
          completedAt: '2026-10-28T02:00:00Z',
          version: 2,
        },
      ],
      total: 1,
      page: 0,
      pageSize: 30,
      generatedAt: '2026-10-28T02:00:00Z',
    });

    await render({ openSnooze: false });

    const completedLabel = Array.from(document.body.querySelectorAll('span')).find(
      (node) => node.textContent === 'laterPage.states.COMPLETED'
    );
    const chip = completedLabel?.closest('.MuiChip-root');
    expect(chip?.classList.contains('MuiChip-outlined')).toBe(true);
    expect(chip?.classList.contains('MuiChip-colorSuccess')).toBe(true);
  });
});
