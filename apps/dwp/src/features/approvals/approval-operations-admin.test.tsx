// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApprovalOperationsAdmin } from './approval-operations-admin';

const operations = {
  generatedAt: new Date().toISOString(),
  signals: [
    {
      key: 'integration',
      state: 'ATTENTION',
      titleKo: '전달',
      titleEn: 'Delivery',
      detailKo: '확인',
      detailEn: 'Review',
      count: 2,
    },
  ],
  breachedTasks: [],
  integrationDeliveries: ['one', 'two'].map((id, index) => ({
    outboxId: `00000000-0000-0000-0000-00000000000${index + 1}`,
    eventId: `event-${id}`,
    requestId: null,
    eventType: `REQUEST_${id.toUpperCase()}`,
    status: 'FAILED',
    attemptCount: 1,
    manualRetryCount: 0,
    version: 1,
    availableAt: new Date().toISOString(),
    publishedAt: null,
    lastError: 'Unavailable',
    createdAt: new Date().toISOString(),
    lastRetriedAt: null,
    retryEligibility: {
      eligible: false,
      reason: 'STATUS_NOT_RETRYABLE',
      expectedVersion: 1,
      evaluatedAt: new Date().toISOString(),
    },
  })),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));
vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getApprovalOperations: vi.fn(async () => operations),
  retryApprovalIntegrationDelivery: vi.fn(),
}));
vi.mock('./use-approval-experience', () => ({
  useApprovalExperience: () => ({ canOperate: false }),
  useApprovalManagementRequestScope: () => ({
    contextScopeKey: 'scope',
    cacheKey: ['tenant', 'user', 'normal', 'context', 'revision', 'scope'],
  }),
}));
vi.mock('./approval-management-scope', () => ({
  useApprovalManagementScopeReady: () => true,
  useApprovalManagementScopeReset: () => undefined,
}));
vi.mock('./approval-management-command-scope', () => ({
  useApprovalManagementHighRiskCommand: () => ({
    controller: { busy: false, close: vi.fn(), begin: vi.fn() },
  }),
}));
vi.mock('./approval-retention-workspace', () => ({ ApprovalRetentionWorkspace: () => null }));
vi.mock('./approval-high-risk-command-dialog', () => ({
  ApprovalHighRiskCommandDialog: () => null,
}));
vi.mock('./approval-native-operation-dialog', () => ({
  ApprovalNativeOperationDialog: () => null,
}));
vi.mock('./use-approval-native-operation-command', () => ({
  ApprovalNativeOperationCommand: () => null,
}));
vi.mock('./approval-operations-task-pane', () => ({
  ApprovalOperationsTaskPane: () => null,
  ApprovalOperationsTaskInspector: () => null,
}));
vi.mock('./approval-operations-delivery-pane', () => ({
  ApprovalOperationsDeliveryPane: ({
    deliveries,
    selected,
    onSelect,
  }: {
    deliveries: typeof operations.integrationDeliveries;
    selected: (typeof operations.integrationDeliveries)[number] | null;
    onSelect: (delivery: (typeof operations.integrationDeliveries)[number]) => void;
  }) => (
    <div>
      {deliveries.map((delivery) => (
        <button
          key={delivery.outboxId}
          aria-current={delivery.outboxId === selected?.outboxId ? 'true' : undefined}
          onClick={() => onSelect(delivery)}
        >
          {delivery.eventType}
        </button>
      ))}
    </div>
  ),
  ApprovalOperationsDeliveryInspector: ({
    delivery,
  }: {
    delivery: (typeof operations.integrationDeliveries)[number];
  }) => <div>{`Inspector ${delivery.eventType}`}</div>,
}));

describe('ApprovalOperationsAdmin mobile inspector focus', () => {
  let root: Root;
  let container: HTMLDivElement;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('focuses the mobile inspector and restores the exact selected delivery row', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <ApprovalOperationsAdmin />
          </QueryClientProvider>
        </MemoryRouter>
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const second = getByRole<HTMLButtonElement>(container, 'button', { name: 'REQUEST_TWO' });
    await act(async () => fireEvent.click(second));
    const inspector = getByRole<HTMLElement>(container, 'region', {
      name: 'admin.studio.processInspector',
    });
    expect(document.activeElement).toBe(inspector);

    await act(async () =>
      fireEvent.click(getByRole(container, 'button', { name: 'home.commandCenter.backToQueue' }))
    );
    expect(document.activeElement).toBe(second);
  });
});
