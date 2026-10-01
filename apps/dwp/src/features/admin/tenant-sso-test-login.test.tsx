// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantSsoTestLogin } from './tenant-sso-test-login';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  request: vi.fn(),
  permission: vi.fn((_resource: string, _permission: string) => false),
  permissionsLoaded: true,
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  listTenantSsoTestLoginReceipts: mocks.history,
  requestTenantSsoTestLogin: mocks.request,
  usePermissions: () => ({
    hasPermission: mocks.permission,
    isLoaded: mocks.permissionsLoaded,
  }),
  useToast: () => mocks.toast,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({ formatDate: (value: string) => value }));

const receipt = {
  testLoginJobId: '10000000-0000-4000-8000-000000000001',
  tenantId: 1,
  providerKey: 'entra-primary',
  lifecycleState: 'OWNER_DEBUG_STATE',
  internalPrerequisiteState: 'READY_FOR_EXTERNAL_PROBE',
  externalProbeState: 'UNAVAILABLE',
  blockingReasons: ['OWNER_SECRET_REASON'],
  executionBoundary: 'RAW_INTERNAL_BOUNDARY',
  requestedBy: 42,
  idempotencyKey: '20000000-0000-4000-8000-000000000002',
  requestedAt: '2026-09-30T01:00:00Z',
  completedAt: '2026-09-30T01:00:01Z',
  receiptPayloadCanonical: 'CANONICAL_OWNER_EVIDENCE_MUST_NOT_RENDER',
  receiptSha256: 'a'.repeat(64),
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function render() {
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(TenantSsoTestLogin)));
  });
  for (let index = 0; index < 4; index += 1) {
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
  }
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.permissionsLoaded = true;
  mocks.permission.mockReset().mockReturnValue(false);
  mocks.history.mockReset().mockResolvedValue({ items: [receipt], limit: 20, hasMore: true });
  mocks.request.mockReset();
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

describe('tenant SSO test-login evidence', () => {
  it('does not query or expose the control without exact VIEW permission', async () => {
    await render();

    expect(mocks.permission).toHaveBeenCalledWith('ADMIN.IDENTITY_PROVISIONING', 'VIEW');
    expect(mocks.history).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  it('shows bounded receipts, redacts hashes, and fails closed for unknown server values', async () => {
    mocks.permission.mockImplementation(
      (resource: string, permission: string) =>
        resource === 'ADMIN.IDENTITY_PROVISIONING' && permission === 'VIEW'
    );
    await render();

    expect(mocks.history).toHaveBeenCalledOnce();
    expect(container.textContent).toContain(
      'settingsHome.overview.governance.ssoTest.moreAvailable'
    );
    expect(container.textContent).toContain(
      'settingsHome.overview.governance.ssoTest.states.UNKNOWN'
    );
    expect(container.textContent).toContain(
      'settingsHome.overview.governance.ssoTest.reasons.UNKNOWN'
    );
    expect(container.textContent).toContain(
      'settingsHome.overview.governance.ssoTest.boundaries.UNKNOWN'
    );
    expect(container.textContent).toContain('aaaaaaaaaaaa…');
    expect(container.textContent).not.toContain('a'.repeat(64));
    expect(container.textContent).not.toContain('OWNER_DEBUG_STATE');
    expect(container.textContent).not.toContain('OWNER_SECRET_REASON');
    expect(container.textContent).not.toContain('CANONICAL_OWNER_EVIDENCE_MUST_NOT_RENDER');
    expect(container.textContent).not.toContain('settingsHome.overview.governance.ssoTest.action');
  });

  it('does not claim an empty history when receipts exist beyond the bounded page', async () => {
    mocks.permission.mockImplementation(
      (resource: string, permission: string) =>
        resource === 'ADMIN.IDENTITY_PROVISIONING' && permission === 'VIEW'
    );
    mocks.history.mockResolvedValue({ items: [], limit: 20, hasMore: true });
    await render();

    expect(container.textContent).toContain(
      'settingsHome.overview.governance.ssoTest.moreAvailable'
    );
    expect(container.textContent).not.toContain('settingsHome.overview.governance.ssoTest.empty');
  });

  it('shows the mutation action only with exact MANAGE permission', async () => {
    mocks.permission.mockImplementation(
      (resource: string, permission: string) =>
        resource === 'ADMIN.IDENTITY_PROVISIONING' &&
        (permission === 'VIEW' || permission === 'MANAGE')
    );
    await render();

    expect(container.textContent).toContain('settingsHome.overview.governance.ssoTest.action');
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
