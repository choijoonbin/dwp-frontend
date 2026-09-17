// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceServiceCredentialReveal } from './workplace-service-sensitive-actions';

import type { WorkplaceServiceOrder, WorkplaceServiceOrderLine } from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  revoke: vi.fn(),
  challenge: vi.fn(),
  translate: vi.fn((key: string, values?: { time?: string }) => values?.time ?? key),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mocks.translate,
    i18n: { resolvedLanguage: 'en' },
  }),
}));
vi.mock('../../components/allowed-product-surface-context', () => ({
  useOptionalAllowedProductSurface: () => ({
    context: { contextKey: 'ctx:workplace:self' },
    scope: { key: 'scope:workplace:self' },
    decisionRevision: 'screen-18-authority',
    effectiveReadOnly: false,
  }),
}));
vi.mock('@dwp-frontend/shared-utils', () => ({
  createWorkplaceIdempotencyKey: () => 'screen-18-credential-command',
  getProductSurfaceStepUpContinuation: () => null,
  getWorkplaceServiceInspection: vi.fn(),
  issueProductSurfaceStepUpChallenge: mocks.challenge,
  issueWorkplaceServiceAccessCredential: mocks.issue,
  recordWorkplaceServiceInspectionAttempt: vi.fn(),
  revokeWorkplaceServiceAccessCredential: mocks.revoke,
}));

const order = {
  serviceOrderId: '18000000-0000-4000-8000-000000000101',
  version: 7,
} as WorkplaceServiceOrder;
const line = {
  serviceOrderLineId: '18000000-0000-4000-8000-000000000104',
  category: 'AV',
} as WorkplaceServiceOrderLine;

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

function input(labelText: string) {
  const label = Array.from(document.querySelectorAll('label')).find(
    (candidate) => candidate.textContent === labelText
  );
  const field = label && document.getElementById(label.htmlFor);
  if (!(field instanceof HTMLInputElement)) throw new Error(`Missing input ${labelText}`);
  return field;
}

function button(text: string) {
  const candidate = Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent === text
  );
  if (!candidate) throw new Error(`Missing button ${text}`);
  return candidate;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  sessionStorage.clear();
  mocks.challenge.mockResolvedValue({ challenge: 'signed-step-up' });
  mocks.issue.mockResolvedValue({
    grantId: '18000000-0000-4000-8000-000000000009',
    oneTimeCredential: '461 880',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    revealOnce: true,
    receipt: {},
  });
  mocks.revoke.mockResolvedValue({});
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <WorkplaceServiceCredentialReveal order={order} line={line} canWrite />
      </QueryClientProvider>
    );
  });
});

afterEach(async () => {
  if (container.isConnected) await act(async () => root.unmount());
  container.remove();
  client.clear();
  vi.clearAllMocks();
});

describe('workplace service credential memory boundary', () => {
  it('keeps the one-time value out of mutation and browser storage and revokes it on unmount', async () => {
    const reason = input('workplace.services.extensions.pinReason');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(reason, 'Open the room AV console');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const confirmation = document.querySelector('input[type="checkbox"]');
    if (!(confirmation instanceof HTMLInputElement)) throw new Error('Missing confirmation');
    await act(async () => confirmation.click());
    await act(async () => button('workplace.services.extensions.revealPin').click());
    await flush();

    expect(document.body.textContent).toContain('461 880');
    expect(client.getMutationCache().getAll().at(-1)?.state.data).toBeUndefined();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    await act(async () => root.unmount());
    await flush();
    container.remove();
    expect(mocks.revoke).toHaveBeenCalledWith(
      order.serviceOrderId,
      line.serviceOrderLineId,
      '18000000-0000-4000-8000-000000000009',
      expect.objectContaining({ expectedOrderVersion: 7, explicitConfirmation: true }),
      expect.objectContaining({ activeAccessMode: 'ELEVATED' })
    );
  });
});
