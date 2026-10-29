// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceVisitAdmin } from './workplace-visit-admin';

const api = vi.hoisted(() => ({
  detail: vi.fn(),
  exceptions: vi.fn(),
}));
const access = vi.hoisted(() => ({
  capabilities: {
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canManageWorkplaceAdmin: true,
  },
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  approveAdminWorkplaceVisit: vi.fn(),
  confirmAdminWorkplaceVisitCheckout: vi.fn(),
  createWorkplaceIdempotencyKey: () => 'idempotency-key',
  getAdminWorkplaceVisit: api.detail,
  getAdminWorkplaceVisitExceptions: api.exceptions,
  notifyAdminWorkplaceVisitHost: vi.fn(),
  resolveIdempotentMutationIntent: () => ({ key: 'idempotency-key' }),
  retryAdminWorkplaceVisitAccess: vi.fn(),
  useProductSurfaceAuthority: () => ({
    snapshot: { envelope: { activeAccessMode: 'ELEVATED' } },
  }),
}));

vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => access.capabilities,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en' },
  }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
  resolveSupportedLocale: () => 'en',
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({ children }: { children: ReactNode }) => createElement('button', null, children),
  EmptyState: ({ title }: { title: ReactNode }) => createElement('div', null, title),
  FormField: () => null,
  InlineFeedback: ({ children }: { children: ReactNode }) =>
    createElement('div', { role: 'alert' }, children),
  LoadingState: ({ label }: { label: ReactNode }) => createElement('div', null, label),
  PageCanvas: ({ children }: { children: ReactNode }) => createElement('main', null, children),
}));

vi.mock('./rooms-ui', () => ({
  RoomsPageHeading: ({ title }: { title: ReactNode }) => createElement('h1', null, title),
}));
vi.mock('./workplace-member-surfaces', () => ({
  workplaceMemberCard: () => ({}),
  workplaceMemberSoftSurface: () => ({}),
}));
vi.mock('./workplace-mobile-reservation-inspector', () => ({
  WorkplaceMobileReservationInspector: ({ children }: { children: ReactNode }) =>
    createElement('aside', { 'data-testid': 'visit-inspector' }, children),
}));

const VISIT_ID = '18000000-0000-4000-8000-000000000001';
const OTHER_VISIT_ID = '18000000-0000-4000-8000-000000000002';

function visit(visitId = VISIT_ID) {
  return {
    visitId,
    requesterUserId: 42,
    reservation: { authority: 'WORKPLACE', reservationId: 'reservation-1' },
    visitType: 'GUEST',
    siteId: 'site-1',
    startsAt: '2026-10-28T11:00:00Z',
    endsAt: '2026-10-28T12:00:00Z',
    zoneIds: [],
    guests: [{ maskedLabel: 'Guest ···12' }],
    state: 'RESULT_UNKNOWN',
    version: 3,
    providerOperationEvidenceReference: null,
    limitationCode: null,
    timeline: [],
    updatedAt: '2026-10-28T11:00:00Z',
  };
}

describe('Workplace visit exact owner target', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    access.capabilities = {
      isLoaded: true,
      canViewWorkplaceAdmin: true,
      canManageWorkplaceAdmin: true,
    };
    api.exceptions.mockResolvedValue({ items: [], generatedAt: '2026-10-28T11:00:00Z' });
    api.detail.mockResolvedValue(visit());
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  async function renderTarget() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/workplace/admin/visits?visit=${VISIT_ID}`]}>
            <WorkplaceVisitAdmin />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    }
  }

  it('renders a queue-external exact visit only when its response id matches', async () => {
    await renderTarget();

    expect(api.detail).toHaveBeenCalledWith(VISIT_ID);
    expect(host.querySelector('[data-testid="visit-inspector"]')).not.toBe(null);
    expect(host.textContent).toContain('Guest ···12');
  });

  it('blocks the inspector when the exact response belongs to another visit', async () => {
    api.detail.mockResolvedValue(visit(OTHER_VISIT_ID));
    await renderTarget();

    expect(host.textContent).toContain('workplace.visits.admin.detailError');
    expect(host.textContent).not.toContain('Guest ···12');
  });

  it('keeps a 404 target visible as an explicit fail-closed error', async () => {
    api.detail.mockRejectedValue(new Error('404'));
    await renderTarget();

    expect(host.textContent).toContain('workplace.visits.admin.detailError');
    expect(host.querySelector('[data-testid="visit-inspector"]')).not.toBe(null);
  });

  it('keeps an exact visit visible read-only when the exception list fails', async () => {
    api.exceptions.mockRejectedValue(new Error('queue unavailable'));
    await renderTarget();

    expect(host.textContent).toContain('workplace.visits.admin.listDegraded');
    expect(host.textContent).toContain('Guest ···12');
    expect(api.detail).toHaveBeenCalledWith(VISIT_ID);
  });

  it('does not request exception or detail data without admin view authority', async () => {
    access.capabilities = {
      isLoaded: true,
      canViewWorkplaceAdmin: false,
      canManageWorkplaceAdmin: false,
    };
    await renderTarget();

    expect(api.exceptions).not.toHaveBeenCalled();
    expect(api.detail).not.toHaveBeenCalled();
  });
});
