// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WorkplaceServiceFulfillmentPage from './workplace-service-fulfillment';

const api = vi.hoisted(() => ({
  detail: vi.fn(),
  queue: vi.fn(),
}));
const inspectorRender = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => ({
  capabilities: {
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canManageWorkplaceAdmin: true,
  },
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  getWorkplaceServiceFulfillmentOrder: api.detail,
  getWorkplaceServiceFulfillmentQueue: api.queue,
}));

vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => access.capabilities,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({ children }: { children: ReactNode }) => createElement('button', null, children),
  EmptyState: ({ title }: { title: ReactNode }) => createElement('div', null, title),
  InlineFeedback: ({ children }: { children: ReactNode }) =>
    createElement('div', { role: 'alert' }, children),
  LoadingState: ({ label }: { label: ReactNode }) => createElement('div', null, label),
  SelectField: () => null,
}));

vi.mock('./workplace-service-fulfillment-panels', () => ({
  FulfillmentInspector: (props: unknown) => {
    inspectorRender(props);
    return createElement('div', { 'data-testid': 'fulfillment-inspector' });
  },
  QueueItem: () => null,
}));
vi.mock('./workplace-service-operations-table', () => ({
  WorkplaceServiceOperationsTable: () => null,
}));
vi.mock('./workplace-mobile-reservation-inspector', () => ({
  WorkplaceMobileReservationInspector: ({ children }: { children: ReactNode }) =>
    createElement('aside', null, children),
}));
vi.mock('./workplace-member-surfaces', () => ({ workplaceMemberCard: () => ({}) }));

const ORDER_ID = '18000000-0000-4000-8000-000000000011';
const OTHER_ORDER_ID = '18000000-0000-4000-8000-000000000012';
const ADJUSTMENT_ID = '18000000-0000-4000-8000-000000000013';

function order(serviceOrderId = ORDER_ID) {
  return { serviceOrderId };
}

describe('Workplace service fulfillment exact owner target', () => {
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
    api.queue.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
    api.detail.mockResolvedValue(order());
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } },
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
          <MemoryRouter
            initialEntries={[
              `/workplace/admin/service-fulfillment?order=${ORDER_ID}&adjustment=${ADJUSTMENT_ID}`,
            ]}
          >
            <WorkplaceServiceFulfillmentPage />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    }
  }

  it('renders a queue-external exact order only when its response id matches', async () => {
    await renderTarget();

    expect(api.detail).toHaveBeenCalledWith(ORDER_ID);
    expect(inspectorRender).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ serviceOrderId: ORDER_ID }),
        requestedAdjustmentId: ADJUSTMENT_ID,
      })
    );
    expect(host.querySelector('[data-testid="fulfillment-inspector"]')).not.toBe(null);
  });

  it('blocks fulfillment when the exact response belongs to another order', async () => {
    api.detail.mockResolvedValue(order(OTHER_ORDER_ID));
    await renderTarget();

    expect(host.textContent).toContain('workplace.services.fulfillmentTargetError');
    expect(inspectorRender).not.toHaveBeenCalled();
  });

  it('keeps a 404 order target visible as an explicit fail-closed error', async () => {
    api.detail.mockRejectedValue(new Error('404'));
    await renderTarget();

    expect(host.textContent).toContain('workplace.services.fulfillmentTargetError');
    expect(inspectorRender).not.toHaveBeenCalled();
  });

  it('keeps an exact order visible read-only when the queue fails', async () => {
    api.queue.mockRejectedValue(new Error('queue unavailable'));
    await renderTarget();

    expect(host.textContent).toContain('workplace.services.fulfillmentQueueDegraded');
    expect(inspectorRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ serviceOrderId: ORDER_ID }),
        canManage: false,
      })
    );
  });

  it('does not request queue or detail data without admin view authority', async () => {
    access.capabilities = {
      isLoaded: true,
      canViewWorkplaceAdmin: false,
      canManageWorkplaceAdmin: false,
    };
    await renderTarget();

    expect(api.queue).not.toHaveBeenCalled();
    expect(api.detail).not.toHaveBeenCalled();
  });
});
