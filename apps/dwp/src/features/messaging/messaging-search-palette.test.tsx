// @vitest-environment jsdom

import { act, type ChangeEvent, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpError } from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  search: vi.fn(),
  createDirect: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    searchMessaging: api.search,
    createDirectMessagingConversation: api.createDirect,
    useToast: () => ({ error: vi.fn() }),
  };
});
vi.mock('@dwp-frontend/design-system', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    CommandPaletteDialog: ({
      query,
      onQueryChange,
      children,
    }: {
      query: string;
      onQueryChange: (value: string) => void;
      children: ReactNode;
    }) => (
      <div>
        <input
          aria-label="query"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
        />
        {children}
      </div>
    ),
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { MessagingSearchPalette } from './messaging-search-palette';

describe('MessagingSearchPalette read failure', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.search.mockReset().mockRejectedValue(new HttpError('forbidden', 403));
    api.createDirect.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps list children valid and exposes permission loss with retry', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MessagingSearchPalette
            open
            onClose={() => undefined}
            onOpenConversation={() => undefined}
          />
        </QueryClientProvider>
      );
    });

    const input = host.querySelector('input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'ab');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    });

    const list = host.querySelector('ul')!;
    expect(Array.from(list.children).every((child) => child.tagName === 'LI')).toBe(true);
    expect(host.textContent).toContain('readFailure.permission');

    const retry = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent === 'actions.retry'
    );
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(api.search).toHaveBeenCalledTimes(3);
  });
});
