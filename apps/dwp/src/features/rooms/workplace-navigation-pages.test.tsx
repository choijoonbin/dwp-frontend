// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceWayfindingPage } from './workplace-navigation-pages';

const api = vi.hoisted(() => ({ explore: vi.fn() }));
const wayfindingRender = vi.hoisted(() => vi.fn());

vi.mock('@dwp-frontend/shared-utils', () => ({
  getWorkplaceExplore: api.explore,
  useProductSurfaceAuthority: () => ({ snapshot: null }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));

vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({ canUpdateWorkplaceBooking: false }),
}));

vi.mock('./rooms-ui', () => ({
  RoomsPageHeading: ({ title, description }: { title: string; description: string }) =>
    createElement('header', null, title, description),
}));

vi.mock('./workplace-navigation-wayfinding', () => ({
  WorkplaceWayfinding: (props: { siteId: string }) => {
    wayfindingRender(props);
    return createElement('div', { 'data-testid': 'wayfinding-content' }, props.siteId);
  },
}));

vi.mock('@dwp-frontend/design-system', () => ({
  PageCanvas: ({ children }: { children: ReactNode }) => createElement('main', null, children),
  LoadingState: ({ label }: { label: string }) => createElement('div', null, label),
  InlineFeedback: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  EmptyState: ({ title, description }: { title: string; description: string }) =>
    createElement('section', null, createElement('h2', null, title), description),
}));

describe('Workplace wayfinding entry page', () => {
  let host: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    api.explore.mockReset();
    wayfindingRender.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/workplace/navigation']}>
            <WorkplaceWayfindingPage />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  it('explains the missing site access instead of leaving the route without content', async () => {
    api.explore.mockResolvedValue({
      sites: [],
      selectedFloor: null,
      resources: [],
      occupancy: [],
    });

    await renderPage();

    expect(host.textContent).toContain('workplace.explore.noSitesTitle');
    expect(host.textContent).toContain('workplace.explore.noSitesDescription');
    expect(wayfindingRender).not.toHaveBeenCalled();
  });

  it('renders the route planner when an authorized active site exists', async () => {
    api.explore.mockResolvedValue({
      sites: [{ siteId: 'site-seoul', name: 'Seoul HQ', state: 'ACTIVE' }],
      selectedFloor: null,
      resources: [],
      occupancy: [],
    });

    await renderPage();

    expect(host.textContent).toContain('site-seoul');
    expect(wayfindingRender).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: 'site-seoul' })
    );
  });
});
