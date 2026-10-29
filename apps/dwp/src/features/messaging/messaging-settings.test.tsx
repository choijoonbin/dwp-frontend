// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
  getDisplayPreference: vi.fn(),
  updateDisplayPreference: vi.fn(),
  updatePersonalPreference: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getMessagingDisplayPreference: doubles.getDisplayPreference,
  updateMessagingDisplayPreference: doubles.updateDisplayPreference,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@dwp-frontend/design-system', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useAppearance: () => ({
    preference: { highContrast: false, reduceMotion: false },
    policy: { userControls: { highContrast: true, reduceMotion: true } },
  }),
}));
vi.mock('../../providers/personal-preference-provider', () => ({
  usePersonalPreference: () => ({
    isLoading: false,
    isSaving: false,
    loadFailed: false,
    update: doubles.updatePersonalPreference,
    retry: vi.fn(),
  }),
}));
vi.mock('./messaging-privacy-panel', () => ({
  MessagingPrivacyPanel: () => <div>privacy-controls</div>,
}));

import { MessagingSettings } from './messaging-settings';

describe('Messenger settings controls', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    doubles.updatePersonalPreference.mockReset();
    doubles.getDisplayPreference.mockResolvedValue({
      layoutMode: 'AUTO',
      density: 'COMFORTABLE',
      theme: 'DEFAULT',
      showAvatars: true,
      timestampMode: 'SMART',
      messagePreview: true,
      version: 1,
      policy: {
        allowedThemes: ['DEFAULT'],
        allowPersonalBackgrounds: false,
        allowThemeSharing: false,
        version: 1,
      },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  async function render() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/messages/settings']}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/messages/settings" element={<MessagingSettings />} />
              <Route path="/notifications/settings" element={<div>notification-destination</div>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      )
    );
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('uses persisted accessibility controls and routes to the governed notification settings', async () => {
    await render();

    expect(host.textContent).toContain('settingsPage.accessibility.title');
    const switches = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(switches).toHaveLength(2);
    await act(async () => switches[0]!.click());
    await act(async () => switches[1]!.click());
    expect(doubles.updatePersonalPreference).toHaveBeenNthCalledWith(1, {
      accessibility: { highContrast: true },
    });
    expect(doubles.updatePersonalPreference).toHaveBeenNthCalledWith(2, {
      accessibility: { reduceMotion: true },
    });

    const notificationButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent === 'settingsPage.notifications.manageGlobal'
    );
    expect(notificationButton).toBeDefined();
    await act(async () => notificationButton!.click());
    expect(host.textContent).toContain('notification-destination');
  });
});
