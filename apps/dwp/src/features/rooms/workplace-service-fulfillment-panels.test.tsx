// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FulfillmentInspector } from './workplace-service-fulfillment-panels';

const api = vi.hoisted(() => ({ adjustment: vi.fn() }));
const recoveryRender = vi.hoisted(() => vi.fn());

vi.mock('@dwp-frontend/shared-utils', () => ({
  createWorkplaceIdempotencyKey: () => 'idempotency-key',
  getWorkplaceServiceLineAdjustment: api.adjustment,
  resolveIdempotentMutationIntent: () => ({ key: 'idempotency-key' }),
  updateWorkplaceServiceFulfillment: vi.fn(),
  useProductSurfaceAuthority: () => ({
    snapshot: { envelope: { activeAccessMode: 'ELEVATED' } },
  }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => value,
  resolveSupportedLocale: () => 'en',
  useDisplayDictionary: () => (_group: string, value: string) => value,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));

vi.mock('@dwp-frontend/design-system', () => ({
  ActionButton: ({ children }: { children: ReactNode }) => createElement('button', null, children),
  FormField: () => null,
  InlineFeedback: ({ children }: { children: ReactNode }) =>
    createElement('div', { role: 'alert' }, children),
  SelectField: () => null,
}));

vi.mock('./workplace-member-surfaces', () => ({ workplaceMemberSoftSurface: () => ({}) }));
vi.mock('./workplace-service-assignee-picker', () => ({
  WorkplaceServiceAssigneePicker: () => null,
}));
vi.mock('./workplace-service-order-collaboration', () => ({
  WorkplaceServiceOrderCollaboration: () => null,
}));
vi.mock('./workplace-service-sensitive-actions', () => ({
  WorkplaceServiceInspectionPanel: () => null,
}));
vi.mock('./workplace-service-order-pages', () => ({
  useWorkplaceServiceOrderEventPages: () => ({
    data: { pages: [{ items: [] }] },
    isError: false,
    hasNextPage: false,
  }),
}));
vi.mock('./workplace-service-line-adjustment', () => ({
  WorkplaceServiceLineAdjustmentRecovery: (props: unknown) => {
    recoveryRender(props);
    return createElement('div', { 'data-testid': 'adjustment-recovery' });
  },
}));

const ORDER_ID = '18000000-0000-4000-8000-000000000001';
const OTHER_ORDER_ID = '18000000-0000-4000-8000-000000000002';
const ADJUSTMENT_ID = '18000000-0000-4000-8000-000000000003';
const LINE_ID = '18000000-0000-4000-8000-000000000004';

const order = {
  serviceOrderId: ORDER_ID,
  reservationId: '18000000-0000-4000-8000-000000000005',
  reservationImpact: 'NONE',
  costCenter: null,
  attendeeCount: 2,
  tasks: [],
  lines: [],
};

function adjustment(serviceOrderId = ORDER_ID, lineAdjustmentId = ADJUSTMENT_ID) {
  return {
    serviceOrderId,
    lineAdjustmentId,
    serviceOrderLineId: LINE_ID,
  };
}

describe('Workplace service refund exception target', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    api.adjustment.mockResolvedValue(adjustment());
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
          <FulfillmentInspector
            order={order as never}
            canManage
            requestedAdjustmentId={ADJUSTMENT_ID}
          />
        </QueryClientProvider>
      );
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
    }
  }

  it('loads and renders the exact adjustment even when it is absent from event history', async () => {
    await renderTarget();

    expect(api.adjustment).toHaveBeenCalledWith(ORDER_ID, ADJUSTMENT_ID, true);
    expect(recoveryRender).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        recovery: { lineAdjustmentId: ADJUSTMENT_ID, serviceOrderLineId: LINE_ID },
        targeted: true,
      })
    );
    expect(host.querySelector('[data-testid="adjustment-recovery"]')).not.toBe(null);
  });

  it('blocks reconciliation when the exact response belongs to another order', async () => {
    api.adjustment.mockResolvedValue(adjustment(OTHER_ORDER_ID));
    await renderTarget();

    expect(host.textContent).toContain('workplace.services.lineRecovery.targetError');
    expect(recoveryRender).not.toHaveBeenCalled();
  });

  it('blocks reconciliation when the exact adjustment returns 404', async () => {
    api.adjustment.mockRejectedValue(new Error('404'));
    await renderTarget();

    expect(host.textContent).toContain('workplace.services.lineRecovery.targetError');
    expect(recoveryRender).not.toHaveBeenCalled();
  });
});
