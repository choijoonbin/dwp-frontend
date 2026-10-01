// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePrivacyControls } from './profile-privacy-controls';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  consent: vi.fn(),
  requests: vi.fn(),
  createRequest: vi.fn(),
  cancelRequest: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  getPersonalPrivacyConsentLedger: mocks.consent,
  listPersonalPrivacyRequests: mocks.requests,
  createPersonalPrivacyRequest: mocks.createRequest,
  cancelPersonalPrivacyRequest: mocks.cancelRequest,
  useToast: () => mocks.toast,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: (value: string) => value }));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function flush() {
  for (let index = 0; index < 4; index += 1) {
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  }
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.consent.mockReset().mockResolvedValue({
    currentProductAnalytics: null,
    history: [],
    historyHasMore: false,
    historyLimit: 50,
    coveredPurposes: ['PRODUCT_ANALYTICS'],
    coverageState: 'PRODUCT_LOCAL',
    coverageBoundary: 'CROSS_PRODUCT_CONSENT_SOURCES_NOT_CONNECTED',
  });
  mocks.requests.mockReset().mockResolvedValue({
    items: [
      {
        requestId: '10000000-0000-4000-8000-000000000001',
        requestType: 'DATA_EXPORT',
        requestState: 'RECEIVED',
        requestedScope: 'ALL_PERSONAL_DATA',
        reason: null,
        fulfillmentAvailable: false,
        fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
        version: 0,
        createdAt: '2026-09-30T01:00:00Z',
        updatedAt: '2026-09-30T01:00:00Z',
        receipt: {
          receiptId: '20000000-0000-4000-8000-000000000002',
          receiptType: 'INTAKE',
          evidenceState: 'INTAKE_ONLY',
          fulfillmentBoundary: 'PRIVACY_OWNER_EXECUTION_NOT_CONNECTED',
          requestFingerprint: 'a'.repeat(64),
          issuedAt: '2026-09-30T01:00:00Z',
        },
        lifecycle: [
          {
            eventId: '30000000-0000-4000-8000-000000000003',
            eventType: 'REQUEST_RECEIVED',
            requestState: 'RECEIVED',
            detailKey: 'PRIVACY_REQUEST_INTAKE_RECORDED',
            occurredAt: '2026-09-30T01:00:00Z',
          },
        ],
        lifecycleHasMore: true,
        lifecycleLimit: 50,
      },
    ],
    hasMore: true,
    limit: 50,
  });
  mocks.createRequest.mockReset();
  mocks.cancelRequest.mockReset().mockResolvedValue({});
  window.localStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

describe('profile privacy controls', () => {
  it('consumes the bounded request envelope and exposes page and lifecycle partial states', async () => {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(ProfilePrivacyControls, { enabled: true })
        )
      );
    });
    await flush();

    expect(mocks.requests).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('20000000-0000-4000-8000-000000000002');
    expect(container.textContent).toContain('profile.privacy.requests.lifecycleMoreAvailable');
    expect(container.textContent).toContain('profile.privacy.requests.moreAvailable');
    expect(container.textContent).toContain('"loaded":1');
    expect(container.textContent).toContain('"limit":50');

    const exportRequest = container.querySelector('[data-privacy-request-type="DATA_EXPORT"]');
    const action = exportRequest?.querySelector('button');
    expect(action?.textContent).toContain('profile.privacy.requests.cancel');
    await act(async () => action?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();

    expect(mocks.cancelRequest).toHaveBeenCalledWith('10000000-0000-4000-8000-000000000001', 0);
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });
});
