// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getNotificationSummary: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-summary-api', () => ({
  getNotificationSummary: mocks.getNotificationSummary,
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { tenantId: 1, userId: 2 },
  }),
}));

vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: mocks.hasPermission, isLoaded: true }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('NotificationMenu runtime boundary', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubEnv('VITE_PRODUCT_NOTIFICATION_RUNTIME', 'disabled');
    mocks.getNotificationSummary.mockReset();
    mocks.hasPermission.mockClear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllEnvs();
  });

  it('does not render or query notifications when their product runtime is disabled', async () => {
    const { NotificationMenu } = await import('./shell-controls');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <NotificationMenu />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    expect(host.querySelector('[data-testid="shell-notification-control"]')).toBeNull();
    expect(mocks.getNotificationSummary).not.toHaveBeenCalled();
  });
});
