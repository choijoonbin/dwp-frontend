// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getMessagingPrivacyPreference: api.get,
  updateMessagingPrivacyPreference: api.update,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { MessagingPrivacyPanel } from './messaging-privacy-panel';

describe('Messenger presence privacy control', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    api.get.mockReset().mockResolvedValue({
      readReceiptsEnabled: true,
      presenceSharingEnabled: true,
      version: 7,
    });
    api.update.mockReset().mockImplementation(async (input) => ({
      readReceiptsEnabled: true,
      presenceSharingEnabled: input.presenceSharingEnabled ?? true,
      version: 8,
    }));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('sends a versioned presence-only opt-out and exposes its enforced state', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <MessagingPrivacyPanel />
        </QueryClientProvider>
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const switches = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(switches).toHaveLength(2);
    await act(async () => switches[1]!.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(api.update.mock.calls[0]?.[0]).toEqual({
      presenceSharingEnabled: false,
      version: 7,
    });
    expect(host.textContent).toContain('privacy.presenceDisabledDescription');
  });
});
