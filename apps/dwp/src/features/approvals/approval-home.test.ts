// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalHome } from './approval-home';

const dependencies = vi.hoisted(() => ({
  getApprovalHome: vi.fn(),
  getApprovalHomePreference: vi.fn(),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'ko' },
    }),
  };
});

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getApprovalHome: dependencies.getApprovalHome,
    getApprovalHomePreference: dependencies.getApprovalHomePreference,
    useAuth: () => ({ user: { userId: 11, tenantId: 1 } }),
    useToast: () => ({ success: vi.fn(), error: vi.fn() }),
  };
});

vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    contextScopeKey: 'scope-self',
    cacheKey: ['1', '11', 'NORMAL', 'revision-1', 'scope-self'],
    queryMeta: { accessSensitive: true },
  }),
}));

vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canAdmin: false }),
}));

vi.mock('./use-approval-governed-mutation', () => ({
  isProductSurfaceOperationCancelledError: () => false,
  useApprovalGovernedMutation: () => vi.fn(),
}));

let root: Root | null;
let container: HTMLDivElement | null;
let queryClient: QueryClient | null;

describe('ApprovalHome query state', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    root = null;
    queryClient = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });
    dependencies.getApprovalHome.mockRejectedValue(new Error('approval home unavailable'));
    dependencies.getApprovalHomePreference.mockResolvedValue({
      version: 0,
      layout: { presentation: 'balanced', widgets: [] },
    });
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
    queryClient?.clear();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('shows the retryable error state when the initial home request fails', async () => {
    await act(async () => {
      root?.render(
        createElement(
          QueryClientProvider,
          { client: queryClient! },
          createElement(MemoryRouter, null, createElement(ApprovalHome))
        )
      );
    });

    await act(async () => {
      await vi.waitFor(() => expect(container?.textContent).toContain('home.loadError'));
    });

    expect(container?.textContent).toContain('actions.retry');
    expect(container?.querySelector('.MuiSkeleton-root')).toBeNull();
    expect(dependencies.getApprovalHome).toHaveBeenCalledTimes(2);
  });
});
